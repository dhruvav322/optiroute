from datetime import datetime

import pytest

from app.api import endpoints


@pytest.fixture(autouse=True)
def mock_evaluation_service(monkeypatch):
    sample_response = {
        "evaluated_at": "2025-01-02T00:00:00Z",
        "train_start": "2024-01-01T00:00:00Z",
        "train_end": "2024-12-01T00:00:00Z",
        "test_start": "2024-12-02T00:00:00Z",
        "test_end": "2025-01-01T00:00:00Z",
        "models": [
            {
                "name": "prophet",
                "metrics": {"mae": 5.2, "rmse": 6.1, "mape": 4.3, "aic": 120.5, "bic": 135.9},
                "horizon_metrics": [
                    {"horizon": 1, "mae": 4.0, "rmse": 5.1, "mape": 3.0},
                    {"horizon": 7, "mae": 5.0, "rmse": 6.0, "mape": 4.0},
                ],
                "predictions": [
                    {
                        "date": "2025-01-01T00:00:00",
                        "actual": 120.0,
                        "prediction": 118.0,
                        "lower": 110.0,
                        "upper": 125.0,
                    }
                ],
                "residuals": [2.0],
                "residual_summary": {"mean": 2.0, "std": 0.0, "median": 2.0, "mad": 0.0},
                "histogram": [
                    {"bin_start": 1.5, "bin_end": 2.5, "count": 1},
                ],
            },
            {
                "name": "arima",
                "metrics": {"mae": 5.5, "rmse": 6.4, "mape": 4.6, "aic": 130.1, "bic": 142.3},
                "horizon_metrics": [
                    {"horizon": 1, "mae": 4.3, "rmse": 5.4, "mape": 3.2},
                    {"horizon": 7, "mae": 5.3, "rmse": 6.2, "mape": 4.2},
                ],
                "predictions": [
                    {
                        "date": "2025-01-01T00:00:00",
                        "actual": 120.0,
                        "prediction": 117.0,
                        "lower": 108.0,
                        "upper": 126.0,
                    }
                ],
                "residuals": [3.0],
                "residual_summary": {"mean": 3.0, "std": 0.0, "median": 3.0, "mad": 0.0},
                "histogram": [
                    {"bin_start": 2.5, "bin_end": 3.5, "count": 1},
                ],
            },
        ],
        "comparison": [
            {"model": "prophet", "mae": 5.2, "rmse": 6.1, "mape": 4.3, "aic": 120.5, "bic": 135.9},
            {"model": "arima", "mae": 5.5, "rmse": 6.4, "mape": 4.6, "aic": 130.1, "bic": 142.3},
        ],
        "training_history": [
            {
                "evaluated_at": "2025-01-02T00:00:00Z",
                "train_start": "2024-01-01T00:00:00Z",
                "train_end": "2024-12-01T00:00:00Z",
                "test_start": "2024-12-02T00:00:00Z",
                "test_end": "2025-01-01T00:00:00Z",
                "models": [],
                "errors": None,
            }
        ],
        "errors": None,
        "model_selection_reason": "Prophet is the leading model with RMSE 6.10, beating Arima by 0.30 units. MAPE stands at 4.30% for the champion.",
    }

    class _FakeEvaluationService:
        def __init__(self, *_args, **_kwargs):
            pass

        def evaluate(self):
            return sample_response

    monkeypatch.setattr(endpoints, "EvaluationService", _FakeEvaluationService)
    yield


def test_model_evaluation_endpoint_returns_expected_payload(client):
    response = client.get("/model/evaluation")
    assert response.status_code == 200
    payload = response.json()

    assert payload["comparison"][0]["model"] == "prophet"
    assert payload["models"][0]["name"] == "prophet"
    assert payload["models"][0]["residual_summary"]["mean"] == pytest.approx(2.0)
    assert payload["training_history"], "training history should not be empty"
