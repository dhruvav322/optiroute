from __future__ import annotations

import io
import json
import logging
from datetime import datetime, timezone

import pandas as pd
from pandas.errors import EmptyDataError, ParserError
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from ..core.config import get_settings
from ..core.security import get_current_user, TokenData
from ..db import get_mongo
from ..schemas import (
    ForecastResponse,
    ForecastSummary,
    ForecastPoint,
    ModelRetrainRequest,
    ModelRetrainResponse,
    ModelStatusResponse,
    ModelEvaluationResponse,
    FeatureAnalysisResponse,
    ExperimentLogRequest,
    ExperimentLogResponse,
    ExperimentsHistoryResponse,
    ExperimentsCompareResponse,
    ExperimentsBestResponse,
    BusinessImpactRequest,
    BusinessImpactResponse,
    InventorySummary,
    SimulationRequest,
    SimulationResponse,
    UploadResponse,
    RouteOptimizationRequest,
    RouteOptimizationResponse,
    TSPResponse,
    VRPResponse,
)
from ..services.forecast import ForecastService
from ..services.inventory import InventoryService
from ..services.simulation import SimulationParameters, SimulationService
from ..services.evaluation import EvaluationService
from ..services.features import FeatureEngineeringService
from ..services.experiments import ExperimentTracker
from ..services.impact import ImpactService
from ..services.routing import RouteOptimizationService, Location, Vehicle
from ..core.validation import (
    validate_file_size,
    sanitize_filename,
    validate_coordinates,
    validate_demand,
    validate_capacity,
    validate_locations_count,
    validate_vehicles_count,
)


logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/v1", tags=["api"])


def get_db():
    return get_mongo().db


def get_experiment_tracker(
    current_user: TokenData = Depends(get_current_user),
    db=Depends(get_db)
):
    # Extract client_id from authenticated user token - never trust client input
    return ExperimentTracker(db, client_id=current_user.client_id)


@router.get(
    "/forecast/current",
    response_model=ForecastResponse,
    summary="Get forecast for upcoming days",
)
def get_current_forecast(
    days: int = Query(30, ge=1, le=180),
    current_user: TokenData = Depends(get_current_user),
    db=Depends(get_db),
) -> ForecastResponse:
    # Extract client_id from authenticated user token - never trust client input
    service = ForecastService(current_user.client_id)
    forecast_df = service.forecast(days)

    points = [
        ForecastPoint(date=row["ds"].date(), demand=float(row["yhat"]))
        for _, row in forecast_df.iterrows()
    ]

    summary = ForecastSummary(**service.summarize_forecast(forecast_df["yhat"]))
    return ForecastResponse(horizon_days=days, forecast=points, summary=summary)


@router.post(
    "/simulation/run",
    response_model=SimulationResponse,
    summary="Run inventory simulation formulas",
)
def run_simulation(
    payload: SimulationRequest,
    current_user: TokenData = Depends(get_current_user),
    db=Depends(get_db),
) -> SimulationResponse:
    # Extract client_id from authenticated user token - never trust client input
    client_id = current_user.client_id
    forecast_service = ForecastService(client_id)
    forecast_df = forecast_service.forecast(payload.forecast_days)
    forecast_values = forecast_df["yhat"].tolist()

    sim_params = SimulationParameters(
        holding_cost_per_unit_per_year=payload.holding_cost_per_unit_per_year,
        order_cost=payload.order_cost,
        unit_cost=payload.unit_cost,
        lead_time_days=payload.lead_time_days,
        service_level=payload.service_level,
        forecast_values=forecast_values,
    )
    sim_service = SimulationService(sim_params)
    result = sim_service.run()

    db.simulation_parameters.insert_one(
        {
            "client_id": client_id,  # Store client_id from token
            "parameters": payload.dict(),
            "forecast_days": payload.forecast_days,
            "saved_at": datetime.now(timezone.utc),
            "result": result,
        }
    )

    return SimulationResponse(**result)


@router.post(
    "/model/retrain",
    response_model=ModelRetrainResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Retrain model with optional outlier handling",
)
def retrain_model(
    request: ModelRetrainRequest,
    current_user: TokenData = Depends(get_current_user),
    db=Depends(get_db),
    tracker: ExperimentTracker = Depends(get_experiment_tracker),
) -> ModelRetrainResponse:
    # Extract client_id from authenticated user token - never trust client input
    client_id = current_user.client_id
    record_count = db.historical_sales.count_documents({"client_id": client_id})
    if record_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No historical data available for training (client_id: {client_id}). Please upload data first.",
        )

    forecast_service = ForecastService(client_id)
    try:
        records = list(db.historical_sales.find({"client_id": client_id}).sort("date", 1))
        frame = pd.DataFrame(records)
        if "_id" in frame.columns:
            frame = frame.drop(columns="_id")
        frame = frame.rename(columns={"date": "ds", "quantity": "y"})
        frame = frame.dropna(subset=["ds", "y"])
        frame["ds"] = pd.to_datetime(frame["ds"])
        frame["y"] = frame["y"].astype(float)

        retrain_output = forecast_service.retrain_model(
            frame[["ds", "y"]], outlier_handling=request.outlier_handling
        )
        cleaned_frame = retrain_output["cleaned_frame"]
        training_result = {
            "metrics": retrain_output["metrics"],
            "model_type": retrain_output["model_type"],
        }
        outlier_stats = retrain_output["outlier_stats"]

        trained_at = datetime.now(timezone.utc)
        metrics = training_result.get("metrics", {})
        model_doc = {
            "client_id": client_id,  # Store client_id from authenticated user
            "model_path": str(forecast_service.model_path),
            "model_type": training_result.get("model_type", "unknown"),
            "train_metrics": metrics,
            "trained_at": trained_at,
            "notes": "Retrained via /model/retrain",
        }
        db.model_parameters.insert_one(model_doc)

        if not cleaned_frame.empty:
            data_profile = {
                "size": int(len(cleaned_frame)),
                "date_range": [
                    cleaned_frame["ds"].min().isoformat(),
                    cleaned_frame["ds"].max().isoformat(),
                ],
                "missing_percentage": float(cleaned_frame["y"].isna().mean() * 100.0),
            }
        else:
            data_profile = {"size": 0, "date_range": [], "missing_percentage": 0.0}

        tracker.log_experiment(
            {
                "model_type": model_doc["model_type"],
                "model_version": model_doc["model_path"],
                "hyperparameters": {},
                "metrics": {
                    "train": metrics,
                },
                "data_profile": data_profile,
                "training_duration_seconds": None,
                "description": "Automatic retrain",
                "created_at": trained_at,
                "outlier_handling_method": request.outlier_handling,
                "outliers_detected": outlier_stats.get("outliers_detected", 0),
                "outliers_removed": outlier_stats.get("outliers_removed", 0),
                "outliers_capped": outlier_stats.get("outliers_capped", 0),
                "data_points_before": outlier_stats.get("data_points_before"),
                "data_points_after": outlier_stats.get("data_points_after"),
            }
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Model retraining failed")
        db.model_parameters.insert_one(
            {
                "client_id": client_id,  # Store client_id from authenticated user
                "model_path": str(forecast_service.model_path),
                "model_type": "unknown",
                "train_metrics": {},
                "trained_at": datetime.now(timezone.utc),
                "notes": f"Training failed: {exc}",
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Model retraining failed. Check server logs for details.",
        ) from exc

    return ModelRetrainResponse(
        status="training_completed",
        message="Model retraining finished successfully.",
        outlier_stats=outlier_stats,
    )


@router.get(
    "/inventory/summary",
    response_model=InventorySummary,
    summary="Get dashboard inventory summary",
)
def inventory_summary(
    current_user: TokenData = Depends(get_current_user),
    db=Depends(get_db),
) -> InventorySummary:
    # Extract client_id from authenticated user token - never trust client input
    service = InventoryService(db, current_user.client_id)
    return service.summary()


@router.get(
    "/model/evaluation",
    response_model=ModelEvaluationResponse,
    summary="Compare forecasting models across diagnostics",
)
def model_evaluation(
    current_user: TokenData = Depends(get_current_user),
    db=Depends(get_db),
) -> ModelEvaluationResponse:
    # Extract client_id from authenticated user token - never trust client input
    service = EvaluationService(db, current_user.client_id)
    evaluation = service.evaluate()
    return ModelEvaluationResponse(**evaluation)


@router.get(
    "/features/analysis",
    response_model=FeatureAnalysisResponse,
    summary="Inspect engineered features, decomposition, and outliers",
)
def feature_analysis(
    current_user: TokenData = Depends(get_current_user),
    db=Depends(get_db),
) -> FeatureAnalysisResponse:
    # Extract client_id from authenticated user token - never trust client input
    service = FeatureEngineeringService(db, current_user.client_id)
    result = service.analyze()
    return FeatureAnalysisResponse(**result)


@router.post(
    "/experiments/log",
    response_model=ExperimentLogResponse,
    summary="Log a forecasting experiment",
    status_code=status.HTTP_201_CREATED,
)
def experiments_log(
    payload: ExperimentLogRequest,
    tracker: ExperimentTracker = Depends(get_experiment_tracker),
) -> ExperimentLogResponse:
    experiment_id = tracker.log_experiment(payload.dict())
    return ExperimentLogResponse(id=experiment_id)


@router.get(
    "/experiments/history",
    response_model=ExperimentsHistoryResponse,
    summary="List latest experiments",
)
def experiments_history(
    limit: int = Query(20, ge=1, le=200),
    tracker: ExperimentTracker = Depends(get_experiment_tracker),
) -> ExperimentsHistoryResponse:
    experiments = tracker.history(limit=limit)
    return ExperimentsHistoryResponse(experiments=experiments)


@router.get(
    "/experiments/compare",
    response_model=ExperimentsCompareResponse,
    summary="Compare selected experiments",
)
def experiments_compare(
    ids: str = Query(..., description="Comma separated experiment IDs"),
    tracker: ExperimentTracker = Depends(get_experiment_tracker),
) -> ExperimentsCompareResponse:
    id_list = [item.strip() for item in ids.split(",") if item.strip()]
    experiments = tracker.compare(id_list)
    return ExperimentsCompareResponse(experiments=experiments)


@router.get(
    "/experiments/best",
    response_model=ExperimentsBestResponse,
    summary="Fetch the best performing experiment",
)
def experiments_best(
    metric: str = Query(None, description="Primary metric to sort by"),
    tracker: ExperimentTracker = Depends(get_experiment_tracker),
) -> ExperimentsBestResponse:
    experiment = tracker.best(metric=metric)
    return ExperimentsBestResponse(experiment=experiment)


@router.post(
    "/analysis/business-impact",
    response_model=BusinessImpactResponse,
    summary="Estimate financial impact of optimized policy",
)
def business_impact(
    payload: BusinessImpactRequest,
    db=Depends(get_db),
) -> BusinessImpactResponse:
    _ = db  # placeholder to keep consistency; future versions may log scenarios
    service = ImpactService()
    result = service.calculate(payload.dict())
    return BusinessImpactResponse(**result)


@router.post(
    "/data/upload",
    response_model=UploadResponse,
    summary="Upload historical sales CSV",
)
async def upload_data(
    file: UploadFile = File(...),
    column_mapping: str = Form(None),
    current_user: TokenData = Depends(get_current_user),
    db=Depends(get_db),
) -> UploadResponse:
    # Extract client_id from authenticated user token - never trust client input
    client_id = current_user.client_id
    settings = get_settings()
    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # Determine configured max file size (fallback to safe default 10 MB)
    default_max_mb = 10
    max_file_size_mb = getattr(settings, "max_file_size_mb", default_max_mb)

    # Security: Validate file size
    validate_file_size(content, max_file_size_mb)

    # Security: Validate file type (must be CSV)
    if not file.filename or not file.filename.lower().endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are allowed.",
        )

    try:
        # Try UTF-8 first, then fallback to other encodings
        try:
            content_str = content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                content_str = content.decode("latin-1")
            except UnicodeDecodeError:
                content_str = content.decode("utf-8", errors="ignore")
        
        # Use python engine for better compatibility with various CSV formats
        # Try with on_bad_lines first (pandas >= 1.3.0), fallback if not available
        try:
            df = pd.read_csv(
                io.StringIO(content_str),
                sep=',',
                engine='python',
                on_bad_lines='skip',  # Skip malformed lines instead of failing
                skipinitialspace=True,  # Skip spaces after delimiter
            )
        except (TypeError, ValueError):
            # Fallback for older pandas versions or if parameter not recognized
            try:
                df = pd.read_csv(
                    io.StringIO(content_str),
                    sep=',',
                    engine='python',
                    error_bad_lines=False,  # Old parameter name (pandas < 1.3)
                    skipinitialspace=True,
                )
            except (TypeError, ValueError):
                # Final fallback - just read with basic parameters
                df = pd.read_csv(
                    io.StringIO(content_str),
                    sep=',',
                    engine='python',
                    skipinitialspace=True,
                )
    except EmptyDataError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file is empty. Please upload a file with data.",
        )
    except ParserError as exc:
        logger.warning(f"CSV parsing failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV file: {str(exc)}. Please ensure it's a valid CSV format with 'date' and 'quantity' columns.",
        ) from exc
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"CSV parsing failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV file: {str(exc)}. Please ensure it's a valid CSV format.",
        ) from exc

    # Apply column mapping if provided
    mapping_dict = None
    if column_mapping:
        try:
            mapping_dict = json.loads(column_mapping)
            if not isinstance(mapping_dict, dict):
                raise ValueError("column_mapping must be a JSON object")
            
            # Validate mapping contains required fields
            if "date" not in mapping_dict or "quantity" not in mapping_dict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="column_mapping must include 'date' and 'quantity' fields.",
                )
            
            # Create reverse mapping: original_column -> standard_column
            reverse_mapping = {}
            for standard_col, original_col in mapping_dict.items():
                if original_col not in df.columns:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Column '{original_col}' specified in mapping not found in CSV. Available columns: {', '.join(df.columns)}",
                    )
                reverse_mapping[original_col] = standard_col
            
            # Rename columns based on mapping
            df.rename(columns=reverse_mapping, inplace=True)
            
            logger.info(f"Applied column mapping: {mapping_dict}")
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid JSON in column_mapping: {str(exc)}",
            ) from exc

    # Check for required columns (after mapping)
    required_columns = {"date", "quantity"}
    if not required_columns.issubset(df.columns):
        if mapping_dict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"After mapping, CSV must include 'date' and 'quantity' columns. Current columns: {', '.join(df.columns)}",
            )
        else:
            # Fallback to case-insensitive matching if no mapping provided
            normalized = {col.lower(): col for col in df.columns}
            if not required_columns.issubset(normalized.keys()):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="CSV must include 'date' and 'quantity' columns.",
                )
            df.rename(columns={normalized["date"]: "date", normalized["quantity"]: "quantity"}, inplace=True)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    if df["date"].isna().any():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV contains rows with invalid date values. Expected format YYYY-MM-DD.",
        )

    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce")
    if df["quantity"].isna().any():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV contains rows with non-numeric quantity values.",
        )

    df["quantity"] = df["quantity"].astype(int)

    # Security: Sanitize filename to prevent path traversal
    safe_filename = sanitize_filename(file.filename or 'upload.csv')
    upload_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    upload_path = settings.uploads_dir / f"{upload_id}_{safe_filename}"
    with upload_path.open("wb") as fh:
        fh.write(content)

    # Determine SKU column - use mapped 'sku' if available, otherwise default
    sku_column = "sku" if "sku" in df.columns else None
    
    records = [
        {
            "client_id": client_id,
            "date": row["date"].to_pydatetime(),
            "quantity": int(row["quantity"]),
            "sku": str(row[sku_column]) if sku_column and pd.notna(row[sku_column]) else "default_item",
            "source_file": upload_path.name,
            "uploaded_at": datetime.now(timezone.utc),
        }
        for _, row in df.iterrows()
    ]

    if records:
        db.historical_sales.insert_many(records)

    try:
        upload_path.unlink(missing_ok=True)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to remove uploaded file %s: %s", upload_path, exc)

    return UploadResponse(status="uploaded", records_added=len(records))


@router.get(
    "/model/status",
    response_model=ModelStatusResponse,
    summary="Retrieve latest model metadata",
)
def model_status(
    current_user: TokenData = Depends(get_current_user),
    db=Depends(get_db),
) -> ModelStatusResponse:
    # Extract client_id from authenticated user token - never trust client input
    client_id = current_user.client_id
    latest = db.model_parameters.find_one(
        {"client_id": client_id},  # Filter by authenticated user's client_id
        sort=[("trained_at", -1)]
    )
    if not latest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No model metadata found.",
        )

    trained_at = latest.get("trained_at")
    if isinstance(trained_at, datetime):
        trained_at_str = trained_at.isoformat()
    elif trained_at:
        trained_at_str = str(trained_at)
    else:
        trained_at_str = datetime.now(timezone.utc).isoformat()

    return ModelStatusResponse(
        model_path=latest.get("model_path", ""),
        model_type=latest.get("model_type", "unknown"),
        trained_at=trained_at_str,
        train_metrics=latest.get("train_metrics", {}),
        notes=latest.get("notes"),
    )


@router.post(
    "/routes/optimize",
    response_model=RouteOptimizationResponse,
    summary="Optimize delivery routes using TSP or VRP",
)
def optimize_routes(
    payload: RouteOptimizationRequest,
    db=Depends(get_db),
) -> RouteOptimizationResponse:
    """Optimize routes for given locations.
    
    Supports:
    - TSP: Single vehicle visiting all locations
    - VRP: Multiple vehicles with capacity constraints
    """
    # Security: Validate input
    validate_locations_count(payload.locations)
    
    service = RouteOptimizationService()
    
    # Convert input to service objects with validation
    locations = []
    for loc in payload.locations:
        # Security: Validate coordinates
        lat, lon = validate_coordinates(loc.latitude, loc.longitude)
        # Security: Validate demand
        demand = validate_demand(loc.demand) if loc.demand > 0 else 0.0
        
        locations.append(
            Location(
                id=loc.id[:100],  # Limit ID length
                name=loc.name[:200],  # Limit name length
                latitude=lat,
                longitude=lon,
                demand=demand
            )
        )
    
    # Extract return_to_depot from payload (default True for backward compatibility)
    return_to_depot = getattr(payload, 'return_to_depot', True)
    
    if payload.problem_type == "tsp":
        result = service.solve_tsp(locations, payload.depot_index, return_to_depot=return_to_depot)
        return RouteOptimizationResponse(
            problem_type="tsp",
            tsp_result=TSPResponse(**result),
            vrp_result=None
        )
    else:  # vrp
        if not payload.vehicles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vehicles required for VRP problem"
            )
        # Security: Validate vehicles
        validate_vehicles_count(payload.vehicles)
        
        vehicles = []
        for v in payload.vehicles:
            # Security: Validate capacity
            capacity = validate_capacity(v.capacity)
            # Security: Validate cost
            if v.cost_per_km < 0 or v.cost_per_km > 1000:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cost per km must be between 0 and 1000"
                )
            
            vehicles.append(
                Vehicle(
                    id=v.id[:100],  # Limit ID length
                    capacity=capacity,
                    cost_per_km=v.cost_per_km
                )
            )
        result = service.solve_vrp(locations, vehicles, payload.depot_index, return_to_depot=return_to_depot)
        return RouteOptimizationResponse(
            problem_type="vrp",
            tsp_result=None,
            vrp_result=VRPResponse(**result)
        )


@router.post(
    "/api-keys/create",
    summary="Create a new API key for external integrations",
    status_code=status.HTTP_201_CREATED,
)
def create_api_key(
    name: str,
    current_user: TokenData = Depends(get_current_user),
    expires_days: int = Query(None, ge=1, le=365),
    scopes: list[str] = Query(default=[]),
    db=Depends(get_db),
) -> dict:
    """Create a new API key for external integrations."""
    from ..core.api_keys import APIKeyManager
    
    # Extract client_id from authenticated user token - never trust client input
    client_id = current_user.client_id
    manager = APIKeyManager(db)
    return manager.create_api_key(
        name=name,
        client_id=client_id,
        expires_days=expires_days,
        scopes=scopes,
    )


@router.get(
    "/api-keys/list",
    summary="List all API keys for a client",
)
def list_api_keys(
    current_user: TokenData = Depends(get_current_user),
    db=Depends(get_db),
) -> dict:
    """List all API keys for a client."""
    from ..core.api_keys import APIKeyManager
    
    # Extract client_id from authenticated user token - never trust client input
    client_id = current_user.client_id
    manager = APIKeyManager(db)
    keys = manager.list_api_keys(client_id)
    return {"api_keys": keys}


@router.delete(
    "/api-keys/{key_id}",
    summary="Revoke an API key",
)
def revoke_api_key(
    key_id: str,
    current_user: TokenData = Depends(get_current_user),
    db=Depends(get_db),
) -> dict:
    """Revoke an API key."""
    from ..core.api_keys import APIKeyManager
    from bson import ObjectId
    
    # Extract client_id from authenticated user token - never trust client input
    client_id = current_user.client_id
    
    try:
        manager = APIKeyManager(db)
        success = manager.revoke_api_key(ObjectId(key_id), client_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )
        return {"status": "revoked", "key_id": key_id}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid key ID: {exc}"
        ) from exc
