from datetime import datetime

import pandas as pd

from app.services.forecast import ForecastService


def test_inventory_summary_returns_metrics(client, test_db, monkeypatch):
    future_dates = pd.date_range(datetime.utcnow(), periods=30, freq="D")
    forecast_df = pd.DataFrame(
        {
            "ds": future_dates,
            "yhat": [20.0] * 30,
            "yhat_upper": [25.0] * 30,
            "yhat_lower": [15.0] * 30,
        }
    )

    monkeypatch.setattr(ForecastService, "forecast", lambda self, days: forecast_df)

    test_db.simulation_parameters.insert_one(
        {
            "saved_at": datetime.utcnow(),
            "result": {
                "new_reorder_point": 150.0,
                "safety_stock": 45.0,
            },
        }
    )
    test_db.inventory_state.insert_one({"current_stock": 800, "updated_at": datetime.utcnow()})

    response = client.get("/inventory/summary")
    assert response.status_code == 200
    payload = response.json()
    assert payload["forecasted_30_day_demand"] == 600.0
    assert payload["optimal_reorder_point"] == 150.0
    assert payload["safety_stock"] == 45.0
    assert payload["current_stock_level"] == 800
