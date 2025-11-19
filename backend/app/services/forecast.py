"""Forecasting service interfacing with persisted ML models."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable

import joblib
import numpy as np
import pandas as pd
from fastapi import HTTPException, status

from ..core.config import get_settings
from .outlier_handler import OutlierHandler


class ForecastService:
    def __init__(
        self,
        client_id: str = "default",
        model_path: Path | None = None,
        outlier_handler: OutlierHandler | None = None,
    ) -> None:
        settings = get_settings()
        client_model_dir = settings.model_dir / client_id
        client_model_dir.mkdir(parents=True, exist_ok=True)
        self._client_id = client_id
        self._model_path = model_path or client_model_dir / "model.pkl"
        self._outlier_handler = outlier_handler or OutlierHandler()

    @property
    def model_path(self) -> Path:
        return self._model_path

    def load_model(self):  # pragma: no cover - replaced during testing
        if not self.model_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trained model not found. Upload data and retrain the model first.",
            )

        bundle = joblib.load(self.model_path)
        if isinstance(bundle, dict) and "model" in bundle:
            return bundle

        return {"model": bundle, "model_type": getattr(bundle, "__class__", type(bundle)).__name__}

    def forecast(self, horizon_days: int) -> pd.DataFrame:
        # Try to get from cache first
        from ..core.cache import cache
        cache_key = f"forecast:{self._client_id}:{horizon_days}"
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            return pd.DataFrame(cached_result)
        
        bundle = self.load_model()
        model = bundle["model"]
        model_type = bundle.get("model_type", "prophet")

        if hasattr(model, "make_future_dataframe"):
            future = model.make_future_dataframe(periods=horizon_days)
            forecast_df = model.predict(future)[-horizon_days:]
            forecast_df = forecast_df[["ds", "yhat", "yhat_upper", "yhat_lower"]]
        elif model_type.lower() == "arima":
            last_date = bundle.get("last_date")
            if last_date is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Stored ARIMA model missing last_date metadata.",
                )

            start = pd.to_datetime(last_date) + timedelta(days=1)
            date_index = pd.date_range(start=start, periods=horizon_days, freq="D")
            forecast_res = model.get_forecast(steps=horizon_days)
            predictions = forecast_res.predicted_mean
            conf_int = forecast_res.conf_int(alpha=0.05)
            forecast_df = pd.DataFrame(
                {
                    "ds": date_index,
                    "yhat": predictions,
                    "yhat_upper": conf_int.iloc[:, 1].to_numpy(),
                    "yhat_lower": conf_int.iloc[:, 0].to_numpy(),
                }
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unsupported model type for forecasting.",
            )
        
        # Cache the result (convert DataFrame to dict for caching)
        result_dict = forecast_df.to_dict(orient="records")
        cache.set(cache_key, result_dict, ttl=3600)  # Cache for 1 hour
        
        return forecast_df

    @staticmethod
    def summarize_forecast(values: Iterable[float]) -> dict[str, float]:
        arr = np.array(list(values), dtype=float)
        return {
            "mean": float(np.mean(arr)) if arr.size else 0.0,
            "median": float(np.median(arr)) if arr.size else 0.0,
            "95pct_upper": float(np.quantile(arr, 0.95)) if arr.size else 0.0,
            "95pct_lower": float(np.quantile(arr, 0.05)) if arr.size else 0.0,
        }

    def save_model(self, bundle: dict) -> None:
        joblib.dump(bundle, self.model_path)

    def retrain_model(
        self,
        frame: pd.DataFrame,
        outlier_handling: str = "winsorize",
    ) -> Dict[str, Any]:
        """Clean outliers then retrain forecasting model.

        Args:
            frame: DataFrame with ``ds`` datetime column and ``y`` demand column.
            outlier_handling: Strategy to apply (keep, winsorize, remove).

        Returns:
            Dictionary containing metrics, model_type, cleaned_frame, outlier_stats.

        Raises:
            ValueError: if cleaning removes all rows or frame invalid.
        """

        if {"ds", "y"} - set(frame.columns):
            raise ValueError("Training frame must contain 'ds' and 'y' columns.")

        working = frame.copy()
        working["ds"] = pd.to_datetime(working["ds"])
        working["y"] = working["y"].astype(float)
        working = working.sort_values("ds")

        quantity_df = working.rename(columns={"y": "quantity"})
        cleaned, metadata = self._outlier_handler.handle_outliers(
            quantity_df, method=outlier_handling, column="quantity"
        )
        cleaned = cleaned.rename(columns={"quantity": "y"})
        cleaned["ds"] = pd.to_datetime(cleaned["ds"])
        cleaned = cleaned.sort_values("ds")

        if cleaned.empty:
            raise ValueError("Outlier handling removed all data points.")

        training_result = self.train_model(cleaned[["ds", "y"]])

        return {
            "metrics": training_result["metrics"],
            "model_type": training_result["model_type"],
            "cleaned_frame": cleaned[["ds", "y"]].copy(),
            "outlier_stats": metadata,
        }

    def train_model(self, frame: pd.DataFrame) -> dict[str, dict | str]:  # pragma: no cover
        """Train Prophet model; fallback to ARIMA if Prophet unavailable."""

        metrics: dict[str, float]
        try:
            from prophet import Prophet

            model = Prophet(weekly_seasonality=True, yearly_seasonality=True)
            model.fit(frame)
            in_sample_forecast = model.predict(frame[["ds"]])
            metrics = self._calculate_metrics(
                frame["y"].tolist(), in_sample_forecast["yhat"].tolist()
            )
            model_type = "prophet"
            model_bundle = {
                "model": model,
                "model_type": model_type,
                "last_date": frame["ds"].max().to_pydatetime(),
            }
        except (ImportError, ValueError, AttributeError, RuntimeError):
            from statsmodels.tsa.arima.model import ARIMA

            frame_sorted = frame.sort_values("ds")
            model = ARIMA(frame_sorted["y"], order=(5, 1, 0)).fit()
            preds = model.predict(start=0, end=len(frame_sorted["y"]) - 1)
            metrics = self._calculate_metrics(
                frame_sorted["y"].tolist(), preds.tolist()
            )
            model_type = "arima"
            model_bundle = {
                "model": model,
                "model_type": model_type,
                "last_date": frame_sorted["ds"].max().to_pydatetime(),
            }

        self.save_model(model_bundle)
        return {"metrics": metrics, "model_type": model_type}

    @staticmethod
    def _calculate_metrics(actual: list[float], predicted: list[float]) -> dict[str, float]:
        actual_arr = np.array(actual, dtype=float)
        pred_arr = np.array(predicted, dtype=float)
        error = actual_arr - pred_arr
        mae = float(np.mean(np.abs(error))) if error.size else 0.0
        rmse = float(np.sqrt(np.mean(np.square(error)))) if error.size else 0.0
        return {"mae": mae, "rmse": rmse, "generated_at": datetime.now(timezone.utc).isoformat()}
