"""Automatic outlier detection and handling strategies for Optiroute."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


@dataclass
class OutlierMetadata:
    method: str
    outliers_detected: int
    outliers_removed: int
    outliers_capped: int
    data_points_before: int
    data_points_after: int
    z_score_threshold: float
    iqr_lower_bound: float
    iqr_upper_bound: float
    capped_lower_bound: Optional[float]
    capped_upper_bound: Optional[float]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "method": self.method,
            "outliers_detected": self.outliers_detected,
            "outliers_removed": self.outliers_removed,
            "outliers_capped": self.outliers_capped,
            "data_points_before": self.data_points_before,
            "data_points_after": self.data_points_after,
            "z_score_threshold": self.z_score_threshold,
            "iqr_lower_bound": self.iqr_lower_bound,
            "iqr_upper_bound": self.iqr_upper_bound,
            "capped_lower_bound": self.capped_lower_bound,
            "capped_upper_bound": self.capped_upper_bound,
        }


class OutlierHandler:
    """Detects and optionally mitigates outliers in demand history."""

    Z_THRESHOLD: float = 3.0
    IQR_MULTIPLIER: float = 1.5

    def detect_outliers(self, df: pd.DataFrame, column: str = "quantity") -> Dict[str, Any]:
        """Identify outliers using both z-score and IQR heuristics.

        Args:
            df: Input dataframe containing the target column.
            column: Column to analyse; defaults to ``quantity``.

        Returns:
            Dictionary containing detailed outlier diagnostics including severity.

        Raises:
            ValueError: If dataframe lacks sufficient rows or column is missing.
        """

        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in dataframe.")
        if len(df) < 10:
            raise ValueError("At least 10 observations are required for outlier detection.")

        series = df[column].astype(float)
        mean = series.mean()
        std = series.std(ddof=0)
        if np.isclose(std, 0.0):
            z_scores = pd.Series(np.zeros_like(series), index=series.index)
        else:
            z_scores = (series - mean) / std

        exceeding = np.abs(z_scores) > self.Z_THRESHOLD
        z_outliers = [
            {
                "index": int(idx),
                "value": float(series.loc[idx]),
                "z_score": float(z_scores.loc[idx]),
            }
            for idx in series.index[exceeding].tolist()
        ]

        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        lower_bound = q1 - self.IQR_MULTIPLIER * iqr
        upper_bound = q3 + self.IQR_MULTIPLIER * iqr
        mask_iqr = (series < lower_bound) | (series > upper_bound)
        iqr_outliers = [
            {
                "index": int(idx),
                "value": float(series.loc[idx]),
                "distance": float(
                    series.loc[idx] - lower_bound if series.loc[idx] < lower_bound else series.loc[idx] - upper_bound
                ),
            }
            for idx in series.index[mask_iqr].tolist()
        ]

        combined_indices = sorted({item["index"] for item in z_outliers} | {item["index"] for item in iqr_outliers})

        return {
            "z_score": z_outliers,
            "iqr": iqr_outliers,
            "combined_indices": combined_indices,
            "summary": {
                "z_score_threshold": self.Z_THRESHOLD,
                "iqr_lower_bound": float(lower_bound),
                "iqr_upper_bound": float(upper_bound),
                "iqr": float(iqr),
            },
        }

    def handle_outliers(
        self,
        df: pd.DataFrame,
        method: str = "winsorize",
        column: str = "quantity",
    ) -> Tuple[pd.DataFrame, Dict[str, float | int | str | None]]:
        """Apply chosen outlier mitigation technique.

        Args:
            df: Raw dataframe.
            method: One of ``keep``, ``winsorize``, ``remove``.
            column: Target column name.

        Returns:
            Tuple of (cleaned dataframe, metadata dict).

        Raises:
            ValueError: If method invalid or dataframe insufficient.
        """

        method = method.lower()
        if method not in {"keep", "winsorize", "remove"}:
            raise ValueError("method must be one of 'keep', 'winsorize', 'remove'.")
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in dataframe.")

        base_series = df[column].astype(float)
        data_points_before = len(df)

        if df.empty:
            metadata = OutlierMetadata(
                method=method,
                outliers_detected=0,
                outliers_removed=0,
                outliers_capped=0,
                data_points_before=0,
                data_points_after=0,
                z_score_threshold=self.Z_THRESHOLD,
                iqr_lower_bound=float("nan"),
                iqr_upper_bound=float("nan"),
                capped_lower_bound=None,
                capped_upper_bound=None,
            )
            return df.copy(), metadata.to_dict()

        try:
            detection = self.detect_outliers(df, column)
            detected_indices = detection["combined_indices"]
        except ValueError:
            # Not enough data -> return original dataframe and neutral metadata
            metadata = OutlierMetadata(
                method=method,
                outliers_detected=0,
                outliers_removed=0,
                outliers_capped=0,
                data_points_before=data_points_before,
                data_points_after=data_points_before,
                z_score_threshold=self.Z_THRESHOLD,
                iqr_lower_bound=float("nan"),
                iqr_upper_bound=float("nan"),
                capped_lower_bound=None,
                capped_upper_bound=None,
            )
            return df.copy(), metadata.to_dict()

        if method == "keep" or not detected_indices:
            metadata = OutlierMetadata(
                method=method,
                outliers_detected=len(detected_indices),
                outliers_removed=0,
                outliers_capped=0,
                data_points_before=data_points_before,
                data_points_after=data_points_before,
                z_score_threshold=self.Z_THRESHOLD,
                iqr_lower_bound=float(detection["summary"]["iqr_lower_bound"]),
                iqr_upper_bound=float(detection["summary"]["iqr_upper_bound"]),
                capped_lower_bound=None,
                capped_upper_bound=None,
            )
            return df.copy(), metadata.to_dict()

        cleaned = df.copy()

        lower_bound = None
        upper_bound = None
        removed_count = 0
        capped_count = 0

        if method == "remove":
            cleaned = cleaned.drop(index=detected_indices)
            removed_count = len(detected_indices)
        elif method == "winsorize":
            lower_bound = base_series.quantile(0.01)
            upper_bound = base_series.quantile(0.99)
            capped_series = base_series.clip(lower=lower_bound, upper=upper_bound)
            capped_count = int((base_series != capped_series).sum())
            cleaned[column] = capped_series

        if cleaned.empty:
            raise ValueError("Outlier handling removed all data points.")

        metadata = OutlierMetadata(
            method=method,
            outliers_detected=len(detected_indices),
            outliers_removed=removed_count,
            outliers_capped=capped_count,
            data_points_before=data_points_before,
            data_points_after=len(cleaned),
            z_score_threshold=self.Z_THRESHOLD,
            iqr_lower_bound=float(detection["summary"]["iqr_lower_bound"]),
            iqr_upper_bound=float(detection["summary"]["iqr_upper_bound"]),
            capped_lower_bound=float(lower_bound) if lower_bound is not None else None,
            capped_upper_bound=float(upper_bound) if upper_bound is not None else None,
        )

        return cleaned, metadata.to_dict()
