"""Feature engineering and analysis service for demand forecasting."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from fastapi import HTTPException, status
from pandas.tseries.holiday import USFederalHolidayCalendar
from pandas.tseries.offsets import Day
from statsmodels.tsa.seasonal import seasonal_decompose
from sklearn.ensemble import RandomForestRegressor


@dataclass
class FeatureEngineeringConfig:
    minimum_points: int = 60
    decomposition_period: int = 7
    lag_windows: tuple[int, ...] = (7, 14, 30)
    rolling_windows: tuple[int, ...] = (7, 14, 30)
    histogram_bins: int = 20


class FeatureEngineeringService:
    """Compute engineered features, decompositions, and diagnostics for demand history."""

    def __init__(
        self,
        db,
        client_id: str,
        config: FeatureEngineeringConfig | None = None,
    ) -> None:
        self.db = db
        self.client_id = client_id
        self.config = config or FeatureEngineeringConfig()

    def analyze(self) -> Dict[str, Any]:
        records = list(
            self.db.historical_sales.find({"client_id": self.client_id}).sort("date", 1)
        )
        if len(records) < self.config.minimum_points:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least 60 observations are required for feature analysis.",
            )

        frame = self._prepare_frame(records)
        engineered = self._engineer_features(frame.copy())
        decomposition = self._decompose(frame)
        holidays = self._holiday_features(frame)
        outliers = self._detect_outliers(frame)
        feature_importance = self._feature_importances(engineered)
        correlation_matrix = self._correlation_matrix(engineered)

        analyzed_at = datetime.now(timezone.utc)
        doc = {
            "analyzed_at": analyzed_at,
            "rows": len(frame),
            "lag_features": [f"lag_{lag}" for lag in self.config.lag_windows],
            "rolling_features": [f"rolling_mean_{w}" for w in self.config.rolling_windows]
            + [f"rolling_std_{w}" for w in self.config.rolling_windows],
            "holiday_features": list(holidays.columns.difference(["ds"])),
            "feature_importance": feature_importance,
            "correlation_matrix": correlation_matrix,
            "outliers": outliers,
        }
        doc["client_id"] = self.client_id
        self.db.feature_analysis.insert_one(doc)

        return {
            "analyzed_at": analyzed_at.isoformat(),
            "data_points": len(frame),
            "seasonality_decomposition": decomposition,
            "features": {
                "lags": [
                    {
                        "name": column,
                        "values": self._records_from_frame(engineered, column),
                    }
                    for column in [f"lag_{lag}" for lag in self.config.lag_windows]
                ],
                "rolling": [
                    {
                        "name": column,
                        "values": self._records_from_frame(engineered, column),
                    }
                    for column in [
                        *[f"rolling_mean_{w}" for w in self.config.rolling_windows],
                        *[f"rolling_std_{w}" for w in self.config.rolling_windows],
                        *[f"rolling_min_{w}" for w in self.config.rolling_windows],
                        *[f"rolling_max_{w}" for w in self.config.rolling_windows],
                    ]
                ],
                "holidays": holidays.to_dict(orient="records"),
            },
            "feature_importance": feature_importance,
            "correlation_matrix": correlation_matrix,
            "outliers": outliers,
        }

    @staticmethod
    def _prepare_frame(records: List[Dict[str, Any]]) -> pd.DataFrame:
        frame = pd.DataFrame(records)
        for column in ["_id", "client_id", "source_file", "uploaded_at"]:
            if column in frame.columns:
                frame = frame.drop(columns=column)
        frame = frame.rename(columns={"date": "ds", "quantity": "y"})
        frame["ds"] = pd.to_datetime(frame["ds"])
        frame = frame.sort_values("ds")
        frame["y"] = frame["y"].astype(float)
        
        # Handle duplicate dates by aggregating (take mean of quantities for same date)
        if frame["ds"].duplicated().any():
            frame = frame.groupby("ds", as_index=False)["y"].mean()
            frame = frame.sort_values("ds")
        
        # Resample to daily frequency and interpolate missing dates
        frame = frame.set_index("ds").resample("D").interpolate(method="linear").reset_index()
        return frame

    def _engineer_features(self, frame: pd.DataFrame) -> pd.DataFrame:
        for lag in self.config.lag_windows:
            frame[f"lag_{lag}"] = frame["y"].shift(lag)
        for window in self.config.rolling_windows:
            frame[f"rolling_mean_{window}"] = frame["y"].rolling(window).mean()
            frame[f"rolling_std_{window}"] = frame["y"].rolling(window).std()
            frame[f"rolling_min_{window}"] = frame["y"].rolling(window).min()
            frame[f"rolling_max_{window}"] = frame["y"].rolling(window).max()
        frame["day_of_week"] = frame["ds"].dt.dayofweek
        frame["is_weekend"] = frame["day_of_week"].isin([5, 6]).astype(int)
        return frame

    def _holiday_features(self, frame: pd.DataFrame) -> pd.DataFrame:
        calendar = USFederalHolidayCalendar()
        holidays = calendar.holidays(start=frame["ds"].min(), end=frame["ds"].max())
        df = frame[["ds"]].copy()
        df["is_holiday"] = df["ds"].isin(holidays).astype(int)
        df["days_until_holiday"] = self._days_until_event(df["ds"], holidays)
        df["days_since_holiday"] = self._days_since_event(df["ds"], holidays)
        df["date"] = df["ds"].dt.strftime("%Y-%m-%d")
        return df.drop(columns="ds")

    @staticmethod
    def _days_until_event(dates: pd.Series, events: pd.DatetimeIndex) -> List[int]:
        result: List[int] = []
        for current in dates:
            future_events = events[events >= current]
            if future_events.empty:
                result.append(-1)
            else:
                result.append(int((future_events[0] - current) / Day()))
        return result

    @staticmethod
    def _days_since_event(dates: pd.Series, events: pd.DatetimeIndex) -> List[int]:
        result: List[int] = []
        for current in dates:
            past_events = events[events <= current]
            if past_events.empty:
                result.append(-1)
            else:
                result.append(int((current - past_events[-1]) / Day()))
        return result

    def _decompose(self, frame: pd.DataFrame) -> Dict[str, List[Dict[str, float]]]:
        result = seasonal_decompose(
            frame.set_index("ds")["y"],
            model="additive",
            period=self.config.decomposition_period,
            extrapolate_trend="freq",
        )
        return {
            "trend": self._series_to_records(result.trend),
            "seasonal": self._series_to_records(result.seasonal),
            "resid": self._series_to_records(result.resid),
            "observed": self._series_to_records(result.observed),
        }

    @staticmethod
    def _series_to_records(series: pd.Series) -> List[Dict[str, float]]:
        return [
            {"date": idx.isoformat(), "value": float(value)}
            for idx, value in series.dropna().items()
        ]

    def _detect_outliers(self, frame: pd.DataFrame) -> Dict[str, Any]:
        values = frame["y"].to_numpy(dtype=float)
        mean = float(np.mean(values))
        std = float(np.std(values))
        z_scores = (values - mean) / (std + 1e-9)
        z_outliers = [
            {
                "date": frame.iloc[idx]["ds"].isoformat(),
                "value": float(values[idx]),
                "z_score": float(z_scores[idx]),
            }
            for idx in np.where(np.abs(z_scores) > 3)[0]
        ]

        q1 = np.percentile(values, 25)
        q3 = np.percentile(values, 75)
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        iqr_outliers = [
            {
                "date": frame.iloc[idx]["ds"].isoformat(),
                "value": float(values[idx]),
            }
            for idx in np.where((values < lower_bound) | (values > upper_bound))[0]
        ]

        return {
            "z_score_outliers": z_outliers,
            "iqr_outliers": iqr_outliers,
            "stats": {
                "mean": mean,
                "std": std,
                "q1": float(q1),
                "q3": float(q3),
                "iqr": float(iqr),
            },
        }

    def _feature_importances(self, frame: pd.DataFrame) -> List[Dict[str, float]]:
        numeric_cols = frame.select_dtypes(include=[np.number]).columns.tolist()
        feature_cols = [col for col in numeric_cols if col != "y"]
        modelling_df = frame.dropna(subset=feature_cols)
        if len(modelling_df) < 30 or not feature_cols:
            return []

        X = modelling_df[feature_cols]
        y = modelling_df["y"]

        try:
            model = RandomForestRegressor(n_estimators=200, random_state=42)
            model.fit(X, y)
        except ValueError:
            return []

        importances = model.feature_importances_
        results = [
            {"feature": feature_cols[idx], "importance": float(importances[idx])}
            for idx in np.argsort(importances)[::-1]
        ]
        total = sum(item["importance"] for item in results) or 1.0
        for item in results:
            item["weight_pct"] = float(item["importance"] / total * 100.0)
        return results

    def _correlation_matrix(self, frame: pd.DataFrame) -> List[Dict[str, Any]]:
        feature_cols = [
            col
            for col in frame.columns
            if col not in {"ds"} and frame[col].dtype != "O"
        ]
        corr = frame[feature_cols].corr().fillna(0.0)
        matrix: List[Dict[str, Any]] = []
        for feature in corr.columns:
            matrix.append(
                {
                    "feature": feature,
                    "correlations": {
                        other: float(corr.loc[feature, other]) for other in corr.columns
                    },
                }
            )
        return matrix

    @staticmethod
    def _records_from_frame(frame: pd.DataFrame, column: str) -> List[Dict[str, float]]:
        if column not in frame.columns:
            return []
        subset = frame[["ds", column]].dropna()
        subset = subset.assign(date=subset["ds"].dt.strftime("%Y-%m-%d"), value=subset[column])
        return subset[["date", "value"]].to_dict(orient="records")
