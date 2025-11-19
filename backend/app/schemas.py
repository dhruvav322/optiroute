from datetime import date, datetime
from typing import Any, Dict, List, Optional, Literal

from pydantic import BaseModel, Field


class ForecastPoint(BaseModel):
    date: date
    demand: float


class ForecastSummary(BaseModel):
    mean: float
    median: float
    pct_95_upper: float = Field(..., alias="95pct_upper")
    pct_95_lower: float = Field(..., alias="95pct_lower")

    class Config:
        populate_by_name = True  # Pydantic v2


class ForecastResponse(BaseModel):
    horizon_days: int
    forecast: List[ForecastPoint]
    summary: ForecastSummary


class SimulationRequest(BaseModel):
    # client_id removed - now extracted from JWT token for security
    holding_cost_per_unit_per_year: float
    order_cost: float
    unit_cost: float
    lead_time_days: int
    service_level: float
    forecast_days: int = 30


class SimulationResponse(BaseModel):
    new_eoq: int
    annual_demand: float
    annual_ordering_cost: float
    annual_holding_cost: float
    new_reorder_point: float
    safety_stock: float
    total_projected_cost: float
    details: dict


class OutlierStatsResponse(BaseModel):
    method: str
    outliers_detected: int
    outliers_removed: int
    outliers_capped: int
    data_points_before: int
    data_points_after: int
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None
    z_score_threshold: Optional[float] = None
    iqr_lower_bound: Optional[float] = None
    iqr_upper_bound: Optional[float] = None
    capped_lower_bound: Optional[float] = None
    capped_upper_bound: Optional[float] = None


class ModelRetrainRequest(BaseModel):
    # client_id removed - now extracted from JWT token for security
    train_from_uploaded_data: bool = False
    outlier_handling: Literal["keep", "winsorize", "remove"] = "winsorize"


class ModelRetrainResponse(BaseModel):
    status: str
    message: str
    outlier_stats: Optional[OutlierStatsResponse] = None
    client_id: Optional[str] = None


class UploadResponse(BaseModel):
    status: str
    records_added: int


class ModelStatusResponse(BaseModel):
    model_path: str
    model_type: str
    trained_at: str
    train_metrics: dict
    notes: Optional[str] = None


class InventorySummary(BaseModel):
    current_stock_level: int
    forecasted_30_day_demand: float
    optimal_reorder_point: float
    safety_stock: float
    last_simulated_at: Optional[datetime] = None


class HorizonMetric(BaseModel):
    horizon: int
    mae: float
    rmse: float
    mape: float


class PredictionPointEvaluation(BaseModel):
    date: datetime
    actual: float
    prediction: float
    lower: Optional[float] = None
    upper: Optional[float] = None


class ResidualSummary(BaseModel):
    mean: float
    std: float
    median: float
    mad: float


class ResidualHistogramBin(BaseModel):
    bin_start: float
    bin_end: float
    count: int


class ModelEvaluationDetail(BaseModel):
    name: str
    metrics: dict
    horizon_metrics: List[HorizonMetric]
    predictions: List[PredictionPointEvaluation]
    residuals: List[float]
    residual_summary: ResidualSummary
    histogram: List[ResidualHistogramBin]


class EvaluationHistoryEntry(BaseModel):
    evaluated_at: Optional[str]
    train_start: Optional[str]
    train_end: Optional[str]
    test_start: Optional[str]
    test_end: Optional[str]
    models: List[dict]
    errors: Optional[List[str]] = None


class ModelEvaluationResponse(BaseModel):
    evaluated_at: str
    train_start: str
    train_end: str
    test_start: str
    test_end: str
    models: List[ModelEvaluationDetail]
    comparison: List[dict]
    training_history: List[EvaluationHistoryEntry]
    errors: Optional[List[str]] = None
    model_selection_reason: str


class SeriesPoint(BaseModel):
    date: str
    value: float


class SeasonalityDecomposition(BaseModel):
    trend: List[SeriesPoint]
    seasonal: List[SeriesPoint]
    resid: List[SeriesPoint]
    observed: List[SeriesPoint]


class EngineeredFeatureSeries(BaseModel):
    name: str
    values: List[SeriesPoint]


class HolidayFeature(BaseModel):
    date: str
    is_holiday: int
    days_until_holiday: int
    days_since_holiday: int


class FeatureImportanceEntry(BaseModel):
    feature: str
    importance: float
    weight_pct: float


class CorrelationRow(BaseModel):
    feature: str
    correlations: Dict[str, float]


class ZScoreOutlier(BaseModel):
    date: str
    value: float
    z_score: float


class IQROutlier(BaseModel):
    date: str
    value: float


class OutlierStats(BaseModel):
    mean: float
    std: float
    q1: float
    q3: float
    iqr: float


class OutlierSummary(BaseModel):
    z_score_outliers: List[ZScoreOutlier]
    iqr_outliers: List[IQROutlier]
    stats: OutlierStats


class EngineeredFeatureSet(BaseModel):
    lags: List[EngineeredFeatureSeries]
    rolling: List[EngineeredFeatureSeries]
    holidays: List[HolidayFeature]


class FeatureAnalysisResponse(BaseModel):
    analyzed_at: str
    data_points: int
    seasonality_decomposition: SeasonalityDecomposition
    features: EngineeredFeatureSet
    feature_importance: List[FeatureImportanceEntry]
    correlation_matrix: List[CorrelationRow]
    outliers: OutlierSummary


class MetricsDetail(BaseModel):
    mae: float
    rmse: float
    mape: float
    aic: Optional[float] = None
    bic: Optional[float] = None


class ExperimentMetrics(BaseModel):
    train: Optional[MetricsDetail] = None
    validation: Optional[MetricsDetail] = None
    test: Optional[MetricsDetail] = None


class DataProfile(BaseModel):
    size: int
    date_range: List[str]
    missing_percentage: float
    notes: Optional[str] = None


class ExperimentLogRequest(BaseModel):
    model_type: str
    model_version: Optional[str] = None
    hyperparameters: Dict[str, Any] = Field(default_factory=dict)
    metrics: ExperimentMetrics
    data_profile: DataProfile
    training_duration_seconds: Optional[float] = None
    description: Optional[str] = None
    created_at: Optional[str] = None
    client_id: Optional[str] = None


class ExperimentLogResponse(BaseModel):
    id: str


class ExperimentRecord(BaseModel):
    id: str
    model_type: str
    model_version: Optional[str] = None
    hyperparameters: Dict[str, Any]
    metrics: ExperimentMetrics
    data_profile: DataProfile
    training_duration_seconds: Optional[float] = None
    description: Optional[str] = None
    created_at: str
    client_id: Optional[str] = None


class ExperimentsHistoryResponse(BaseModel):
    experiments: List[ExperimentRecord]


class ExperimentsCompareResponse(BaseModel):
    experiments: List[ExperimentRecord]


class ExperimentsBestResponse(BaseModel):
    experiment: Optional[ExperimentRecord]


class PolicyInput(BaseModel):
    annual_demand: float
    order_quantity: float
    order_cost: float
    holding_cost_per_unit: float
    unit_cost: float
    service_level: float
    safety_stock: float
    average_inventory: Optional[float] = None
    stockout_cost_per_unit: float
    obsolescence_rate: Optional[float] = 0.0


class BusinessImpactRequest(BaseModel):
    baseline: PolicyInput
    optimized: PolicyInput
    implementation_cost: Optional[float] = 0.0


class CostBreakdown(BaseModel):
    ordering_cost: float
    holding_cost: float
    purchase_cost: float
    stockout_cost: float
    obsolescence_cost: float
    total: float


class SavingsSummary(BaseModel):
    annual_savings: float
    improvement_pct: float
    roi_pct: float


class BusinessImpactResponse(BaseModel):
    baseline: Dict[str, CostBreakdown]
    optimized: Dict[str, CostBreakdown]
    savings: SavingsSummary


# Route Optimization Schemas
class LocationInput(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    demand: float = 0.0


class VehicleInput(BaseModel):
    id: str
    capacity: float = 1000.0
    cost_per_km: float = 1.0


class RouteOptimizationRequest(BaseModel):
    locations: List[LocationInput]
    depot_index: int = 0
    problem_type: Literal["tsp", "vrp"] = "tsp"
    vehicles: Optional[List[VehicleInput]] = None
    return_to_depot: bool = True  # If True, vehicle returns to depot. If False, route ends at last stop.


class RouteStop(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    sequence: int
    demand: Optional[float] = None


class VehicleRoute(BaseModel):
    vehicle_id: str
    route: List[RouteStop]
    distance_meters: int
    distance_km: float
    number_of_stops: int
    route_indices: List[int]


class TSPResponse(BaseModel):
    route: List[RouteStop]
    total_distance_meters: int
    total_distance_km: float
    number_of_stops: int
    route_indices: List[int]


class VRPResponse(BaseModel):
    vehicle_routes: List[VehicleRoute]
    total_distance_meters: int
    total_distance_km: float
    vehicles_used: int
    total_vehicles: int


class RouteOptimizationResponse(BaseModel):
    problem_type: str
    tsp_result: Optional[TSPResponse] = None
    vrp_result: Optional[VRPResponse] = None
