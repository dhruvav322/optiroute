import pandas as pd
import pytest

from app.services.outlier_handler import OutlierHandler


def build_series(values):
    return pd.DataFrame({"quantity": values, "ds": pd.date_range("2024-01-01", periods=len(values))})


def test_detect_outliers_identifies_zscore_extremes():
    handler = OutlierHandler()
    df = build_series([10] * 20 + [1000])

    result = handler.detect_outliers(df)

    assert result["z_score"], "Expected z-score outliers"
    indices = [entry["index"] for entry in result["z_score"]]
    assert indices == [20]


def test_detect_outliers_identifies_iqr_extremes():
    handler = OutlierHandler()
    df = build_series([5, 6, 7, 500, 8, 9, 10, 11, 12, 13])

    result = handler.detect_outliers(df)

    assert result["iqr"], "Expected IQR outlier"
    assert result["iqr"][0]["index"] == 3


def test_winsorize_caps_extreme_values():
    handler = OutlierHandler()
    df = build_series([10] * 30 + [1000])

    cleaned, metadata = handler.handle_outliers(df, method="winsorize")

    assert metadata["method"] == "winsorize"
    assert metadata["outliers_capped"] >= 1
    assert cleaned["quantity"].max() < 1000


def test_remove_excludes_outlier_rows():
    handler = OutlierHandler()
    df = build_series([1, 2, 3, 400, 5, 6, 7])

    cleaned, metadata = handler.handle_outliers(df, method="remove")

    assert metadata["outliers_removed"] == 1
    assert len(cleaned) == len(df) - 1
    assert 400 not in cleaned["quantity"].values


def test_keep_returns_original_copy_without_mutation():
    handler = OutlierHandler()
    original = build_series([10, 12, 15, 18, 100])
    snapshot = original.copy()

    cleaned, metadata = handler.handle_outliers(original, method="keep")

    pd.testing.assert_frame_equal(original, snapshot)
    pd.testing.assert_frame_equal(cleaned, snapshot)
    assert metadata["method"] == "keep"


def test_handle_outliers_with_insufficient_rows_returns_original():
    handler = OutlierHandler()
    df = build_series([10, 11, 12])

    cleaned, metadata = handler.handle_outliers(df, method="winsorize")

    pd.testing.assert_frame_equal(cleaned, df)
    assert metadata["outliers_detected"] == 0


def test_handle_outliers_all_values_removed_raises_error():
    handler = OutlierHandler()
    df = build_series([1000] * 30)

    with pytest.raises(ValueError):
        handler.handle_outliers(df, method="remove")
