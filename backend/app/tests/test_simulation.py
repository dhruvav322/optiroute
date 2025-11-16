from datetime import datetime

import pandas as pd

from app.services.forecast import ForecastService


def test_simulation_run_calculates_eoq_correctly(client, monkeypatch, test_db):
    forecast_values = pd.DataFrame(
        {
            "ds": pd.date_range(datetime.utcnow(), periods=30, freq="D"),
            "yhat": [100.0] * 30,
            "yhat_upper": [110.0] * 30,
            "yhat_lower": [90.0] * 30,
        }
    )

    monkeypatch.setattr(
        ForecastService,
        "forecast",
        lambda self, days: forecast_values,
    )

    payload = {
        "holding_cost_per_unit_per_year": 2.5,
        "order_cost": 50,
        "unit_cost": 10,
        "lead_time_days": 10,
        "service_level": 0.95,
        "forecast_days": 30,
    }

    response = client.post("/simulation/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["new_eoq"] == 1209
    assert test_db.simulation_parameters.count_documents({}) == 1
