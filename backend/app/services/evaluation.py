"""Model evaluation service providing comparative metrics and artifacts."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, List, Sequence

import numpy as np
import pandas as pd
from fastapi import HTTPException, status

from .forecast import ForecastService

logger = logging.getLogger(__name__)


@dataclass
class _ModelEvaluation:
    name: str
    predictions: List[Dict[str, Any]]
    residuals: List[float]
    metrics: Dict[str, float]
    horizon_metrics: List[Dict[str, Any]]
    residual_summary: Dict[str, float]
    histogram: List[Dict[str, Any]]


class EvaluationService:
    """Train Prophet and ARIMA models on a rolling window and surface diagnostics."""

    MIN_HISTORY_POINTS = 60
    TEST_WINDOW_DAYS = 30
    HISTOGRAM_BINS = 10

    def __init__(
        self,
        db,
        client_id: str = "default",
        forecast_service: ForecastService | None = None,
    ) -> None:
        self.db = db
        self.client_id = client_id
        self._forecast_service = forecast_service or ForecastService(client_id)

    def evaluate(self, horizons: Sequence[int] = (1, 7, 30)) -> Dict[str, Any]:
        records = list(self.db.historical_sales.find({"client_id": self.client_id}).sort("date", 1))
        if len(records) < self.MIN_HISTORY_POINTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least 60 daily observations are required for evaluation.",
            )

        frame = self._prepare_frame(records)
        test_window = min(self.TEST_WINDOW_DAYS, max(1, len(frame) // 4))
        train_df = frame.iloc[:-test_window]
        test_df = frame.iloc[-test_window:]

        evaluated_at = datetime.utcnow()
        models_section: List[_ModelEvaluation] = []
        errors: List[str] = []

        for evaluator in (self._evaluate_prophet, self._evaluate_arima):
            try:
                result = evaluator(train_df, test_df, horizons)
            except Exception as exc:  # noqa: BLE001
                # Log the error but continue with other models
                error_msg = str(exc)
                errors.append(error_msg)
                logger.warning(f"Model evaluation failed for {evaluator.__name__}: {error_msg}")
            else:
                models_section.append(result)

        if not models_section:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Model evaluation failed for all algorithms.",
            )

        history_doc = {
            "evaluated_at": evaluated_at,
            "train_start": train_df["ds"].min().to_pydatetime(),
            "train_end": train_df["ds"].max().to_pydatetime(),
            "test_start": test_df["ds"].min().to_pydatetime(),
            "test_end": test_df["ds"].max().to_pydatetime(),
            "models": [self._document_from_model(model) for model in models_section],
            "errors": errors,
        }
        self.db.model_evaluations.insert_one(history_doc)

        history = list(self.db.model_evaluations.find().sort("evaluated_at", -1).limit(10))
        comparison = [
            {
                "model": model.name,
                "mae": model.metrics["mae"],
                "rmse": model.metrics["rmse"],
                "mape": model.metrics["mape"],
                "aic": model.metrics.get("aic"),
                "bic": model.metrics.get("bic"),
            }
            for model in models_section
        ]
        selection_reason = self._model_selection_reason(comparison)

        return {
            "evaluated_at": evaluated_at.isoformat(),
            "train_start": history_doc["train_start"].isoformat(),
            "train_end": history_doc["train_end"].isoformat(),
            "test_start": history_doc["test_start"].isoformat(),
            "test_end": history_doc["test_end"].isoformat(),
            "models": [self._response_from_model(model) for model in models_section],
            "comparison": comparison,
            "training_history": [self._serialize_history_entry(entry) for entry in history],
            "errors": errors or None,
            "model_selection_reason": selection_reason,
        }

    @staticmethod
    def _prepare_frame(records: List[Dict[str, Any]]) -> pd.DataFrame:
        frame = pd.DataFrame(records)
        frame = frame.rename(columns={"date": "ds", "quantity": "y"})
        frame = frame.dropna(subset=["ds", "y"])
        frame["ds"] = pd.to_datetime(frame["ds"])
        frame = frame.sort_values("ds")
        frame["y"] = frame["y"].astype(float)
        frame = frame.reset_index(drop=True)
        return frame

    def _evaluate_prophet(
        self,
        train_df: pd.DataFrame,
        test_df: pd.DataFrame,
        horizons: Sequence[int],
    ) -> _ModelEvaluation:
        try:
            from prophet import Prophet
        except ImportError as exc:  # pragma: no cover - dependency is pinned
            raise RuntimeError("Prophet is not installed.") from exc

        try:
            model = Prophet(weekly_seasonality=True, yearly_seasonality=True)
            model.fit(train_df)
            future = model.make_future_dataframe(periods=len(test_df), freq="D")
            forecast = model.predict(future).tail(len(test_df))
        except (AttributeError, RuntimeError, Exception) as e:
            # Handle Prophet model issues (e.g., stan_backend errors, installation issues)
            error_msg = str(e)
            if "stan_backend" in error_msg or "attribute" in error_msg.lower():
                raise RuntimeError(
                    f"Prophet model error: {error_msg}. "
                    "This may be due to Prophet installation issues. "
                    "The system will fall back to ARIMA."
                ) from e
            raise

        predictions = self._merge_predictions(
            test_df,
            forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].rename(
                columns={"yhat": "prediction", "yhat_lower": "lower", "yhat_upper": "upper"}
            ),
        )

        residuals = [point["actual"] - point["prediction"] for point in predictions]
        metrics = self._compute_metrics(residuals, predictions, model_params=self._prophet_param_count(model))
        horizon_metrics = self._compute_horizon_metrics(predictions, horizons)
        residual_summary = self._residual_summary(residuals)
        histogram = self._residual_histogram(residuals)

        return _ModelEvaluation(
            name="prophet",
            predictions=predictions,
            residuals=residuals,
            metrics=metrics,
            horizon_metrics=horizon_metrics,
            residual_summary=residual_summary,
            histogram=histogram,
        )

    def _evaluate_arima(
        self,
        train_df: pd.DataFrame,
        test_df: pd.DataFrame,
        horizons: Sequence[int],
    ) -> _ModelEvaluation:
        from statsmodels.tsa.arima.model import ARIMA

        model = ARIMA(train_df["y"], order=(5, 1, 0)).fit()
        forecast_res = model.get_forecast(steps=len(test_df))
        predictions = self._merge_predictions(
            test_df,
            pd.DataFrame(
                {
                    "ds": test_df["ds"].to_list(),
                    "prediction": forecast_res.predicted_mean,
                    "lower": forecast_res.conf_int(alpha=0.05).iloc[:, 0].to_list(),
                    "upper": forecast_res.conf_int(alpha=0.05).iloc[:, 1].to_list(),
                }
            ),
        )

        residuals = [point["actual"] - point["prediction"] for point in predictions]
        metrics = self._compute_metrics(residuals, predictions, model_params=len(model.params))
        horizon_metrics = self._compute_horizon_metrics(predictions, horizons)
        residual_summary = self._residual_summary(residuals)
        histogram = self._residual_histogram(residuals)

        # Statsmodels already exposes AIC/BIC – prefer authoritative values.
        metrics["aic"] = float(model.aic)
        metrics["bic"] = float(model.bic)

        return _ModelEvaluation(
            name="arima",
            predictions=predictions,
            residuals=residuals,
            metrics=metrics,
            horizon_metrics=horizon_metrics,
            residual_summary=residual_summary,
            histogram=histogram,
        )

    @staticmethod
    def _merge_predictions(
        actual_df: pd.DataFrame,
        predicted_df: pd.DataFrame,
    ) -> List[Dict[str, Any]]:
        merged = actual_df.merge(predicted_df, on="ds", how="left")
        merged = merged.sort_values("ds")
        results: List[Dict[str, Any]] = []
        for _, row in merged.iterrows():
            results.append(
                {
                    "date": row["ds"].to_pydatetime(),
                    "actual": float(row["y"]),
                    "prediction": float(row.get("prediction", np.nan)),
                    "lower": float(row.get("lower", np.nan)) if not pd.isna(row.get("lower")) else None,
                    "upper": float(row.get("upper", np.nan)) if not pd.isna(row.get("upper")) else None,
                }
            )
        return results

    @staticmethod
    def _compute_metrics(
        residuals: Iterable[float],
        predictions: Sequence[Dict[str, Any]],
        model_params: int,
    ) -> Dict[str, float]:
        residual_arr = np.array(list(residuals), dtype=float)
        actual = np.array([point["actual"] for point in predictions], dtype=float)
        pred = np.array([point["prediction"] for point in predictions], dtype=float)
        mae = float(np.mean(np.abs(residual_arr)))
        rmse = float(np.sqrt(np.mean(np.square(residual_arr))))
        with np.errstate(divide="ignore", invalid="ignore"):
            mape_arr = np.abs((actual - pred) / np.where(actual == 0, np.nan, actual))
        mape = float(np.nanmean(mape_arr) * 100)
        rss = float(np.sum(np.square(residual_arr)))
        n = len(residual_arr)
        if n == 0:
            aic = float("nan")
            bic = float("nan")
        else:
            epsilon = 1e-12
            aic = n * np.log(rss / n + epsilon) + 2 * model_params
            bic = n * np.log(rss / n + epsilon) + np.log(n) * model_params
        return {
            "mae": mae,
            "rmse": rmse,
            "mape": mape,
            "aic": float(aic),
            "bic": float(bic),
        }

    @staticmethod
    def _compute_horizon_metrics(
        predictions: Sequence[Dict[str, Any]],
        horizons: Sequence[int],
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for horizon in horizons:
            window = predictions[: min(len(predictions), horizon)]
            if not window:
                continue
            residuals = np.array([point["actual"] - point["prediction"] for point in window], dtype=float)
            actual = np.array([point["actual"] for point in window], dtype=float)
            mae = float(np.mean(np.abs(residuals)))
            rmse = float(np.sqrt(np.mean(np.square(residuals))))
            with np.errstate(divide="ignore", invalid="ignore"):
                mape_arr = np.abs(residuals / np.where(actual == 0, np.nan, actual))
            mape = float(np.nanmean(mape_arr) * 100)
            results.append(
                {
                    "horizon": horizon,
                    "mae": mae,
                    "rmse": rmse,
                    "mape": mape,
                }
            )
        return results

    @staticmethod
    def _residual_summary(residuals: Sequence[float]) -> Dict[str, float]:
        arr = np.array(list(residuals), dtype=float)
        if arr.size == 0:
            return {"mean": 0.0, "std": 0.0, "median": 0.0, "mad": 0.0}
        median = float(np.median(arr))
        return {
            "mean": float(np.mean(arr)),
            "std": float(np.std(arr)),
            "median": median,
            "mad": float(np.median(np.abs(arr - median))),
        }

    def _residual_histogram(self, residuals: Sequence[float]) -> List[Dict[str, Any]]:
        arr = np.array(list(residuals), dtype=float)
        if arr.size == 0:
            return []
        bins = min(self.HISTOGRAM_BINS, max(1, arr.size // 2))
        counts, edges = np.histogram(arr, bins=bins)
        histogram: List[Dict[str, Any]] = []
        for idx, count in enumerate(counts):
            histogram.append(
                {
                    "bin_start": float(edges[idx]),
                    "bin_end": float(edges[idx + 1]),
                    "count": int(count),
                }
            )
        return histogram

    @staticmethod
    def _prophet_param_count(model: Any) -> int:
        """Count parameters in Prophet model safely."""
        try:
            # Try to get params dict
            params = getattr(model, "params", {})
            if isinstance(params, dict):
                return sum(np.size(value) for value in params.values())
        except (AttributeError, TypeError):
            pass
        
        # Fallback: estimate based on seasonality settings
        try:
            # Prophet typically has ~30-50 parameters depending on seasonality
            # Weekly + yearly seasonality adds more parameters
            if hasattr(model, "weekly_seasonality") and model.weekly_seasonality:
                if hasattr(model, "yearly_seasonality") and model.yearly_seasonality:
                    return 50  # Both seasonalities
                return 40  # Weekly only
            return 30  # Basic model
        except (AttributeError, TypeError):
            return 30  # Final fallback

    @staticmethod
    def _document_from_model(model: _ModelEvaluation) -> Dict[str, Any]:
        return {
            "name": model.name,
            "metrics": model.metrics,
            "horizon_metrics": model.horizon_metrics,
            "residual_summary": model.residual_summary,
            "histogram": model.histogram,
        }

    @staticmethod
    def _response_from_model(model: _ModelEvaluation) -> Dict[str, Any]:
        return {
            "name": model.name,
            "metrics": model.metrics,
            "horizon_metrics": model.horizon_metrics,
            "predictions": [
                {
                    **point,
                    "date": point["date"].isoformat(),
                }
                for point in model.predictions
            ],
            "residuals": model.residuals,
            "residual_summary": model.residual_summary,
            "histogram": model.histogram,
        }

    @staticmethod
    def _serialize_history_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "evaluated_at": entry.get("evaluated_at").isoformat() if entry.get("evaluated_at") else None,
            "train_start": entry.get("train_start").isoformat() if entry.get("train_start") else None,
            "train_end": entry.get("train_end").isoformat() if entry.get("train_end") else None,
            "test_start": entry.get("test_start").isoformat() if entry.get("test_start") else None,
            "test_end": entry.get("test_end").isoformat() if entry.get("test_end") else None,
            "models": entry.get("models", []),
            "errors": entry.get("errors") or None,
        }

    @staticmethod
    def _model_selection_reason(comparison: List[Dict[str, Any]]) -> str:
        if not comparison:
            return "No models produced evaluation metrics."
        sorted_models = sorted(comparison, key=lambda row: row["rmse"])
        best = sorted_models[0]
        if len(sorted_models) == 1:
            return f"{best['model'].title()} is currently the champion model based on RMSE of {best['rmse']:.2f}."
        challenger = sorted_models[1]
        improvement = challenger["rmse"] - best["rmse"]
        return (
            f"{best['model'].title()} is the leading model with RMSE {best['rmse']:.2f}, "
            f"beating {challenger['model'].title()} by {improvement:.2f} units. "
            f"MAPE stands at {best['mape']:.2f}% for the champion."
        )
