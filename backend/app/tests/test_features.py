import pytest

from app.api import endpoints


@pytest.fixture(autouse=True)
def mock_feature_service(monkeypatch):
    sample_response = {
        "analyzed_at": "2025-01-02T00:00:00Z",
        "data_points": 365,
        "seasonality_decomposition": {
            "trend": [{"date": "2025-01-01", "value": 120.0}],
            "seasonal": [{"date": "2025-01-01", "value": 3.5}],
            "resid": [{"date": "2025-01-01", "value": -1.2}],
            "observed": [{"date": "2025-01-01", "value": 122.3}],
        },
        "features": {
            "lags": [
                {
                    "name": "lag_7",
                    "values": [{"date": "2025-01-01", "value": 118.0}],
                }
            ],
            "rolling": [
                {
                    "name": "rolling_mean_7",
                    "values": [{"date": "2025-01-01", "value": 119.4}],
                }
            ],
            "holidays": [
                {
                    "date": "2025-01-01",
                    "is_holiday": 1,
                    "days_until_holiday": 0,
                    "days_since_holiday": 0,
                }
            ],
        },
        "feature_importance": [
            {"feature": "lag_7", "importance": 0.4, "weight_pct": 40.0},
            {"feature": "rolling_mean_7", "importance": 0.3, "weight_pct": 30.0},
        ],
        "correlation_matrix": [
            {
                "feature": "lag_7",
                "correlations": {
                    "lag_7": 1.0,
                    "rolling_mean_7": 0.8,
                },
            }
        ],
        "outliers": {
            "z_score_outliers": [
                {"date": "2025-01-01", "value": 150.0, "z_score": 3.2},
            ],
            "iqr_outliers": [
                {"date": "2025-01-02", "value": 30.0},
            ],
            "stats": {"mean": 120.0, "std": 10.0, "q1": 112.0, "q3": 128.0, "iqr": 16.0},
        },
    }

    class _FakeFeatureService:
        def __init__(self, *_args, **_kwargs):
            pass

        def analyze(self):
            return sample_response

    monkeypatch.setattr(endpoints, "FeatureEngineeringService", _FakeFeatureService)
    yield


def test_feature_analysis_endpoint_returns_insights(client, auth_headers):
    response = client.get("/api/v1/features/analysis", headers=auth_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["data_points"] == 365
    assert payload["feature_importance"][0]["feature"] == "lag_7"
    assert payload["correlation_matrix"][0]["correlations"]["rolling_mean_7"] == pytest.approx(0.8)
