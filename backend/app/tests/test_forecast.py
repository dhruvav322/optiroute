from datetime import datetime

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.forecast import ForecastService


@pytest.fixture
def client(monkeypatch):
    future_dates = pd.date_range(datetime.utcnow(), periods=30, freq="D")
    forecast_df = pd.DataFrame(
        {
            "ds": future_dates,
            "yhat": [50.0] * 30,
            "yhat_upper": [60.0] * 30,
            "yhat_lower": [40.0] * 30,
        }
    )

    class DummyModel:
        def make_future_dataframe(self, periods):
            return pd.DataFrame({"ds": future_dates})

        def predict(self, future):
            return forecast_df

    monkeypatch.setattr(
        ForecastService,
        "load_model",
        lambda self: {"model": DummyModel(), "model_type": "prophet"},
    )

    app = create_app()
    return TestClient(app)


def test_forecast_endpoint_returns_30_days(client):
    response = client.get("/forecast/current?days=30")
    assert response.status_code == 200
    payload = response.json()
    assert payload["horizon_days"] == 30
    assert len(payload["forecast"]) == 30
    assert payload["summary"]["mean"] == 50.0
