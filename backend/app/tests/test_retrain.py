from datetime import datetime, timedelta

import pandas as pd

from app.services.forecast import ForecastService


def test_retrain_background_starts_and_saves_model(client, test_db, monkeypatch):
    base_date = datetime(2024, 1, 1)
    test_db.historical_sales.insert_many(
        [
            {"date": base_date + timedelta(days=i), "quantity": 10 + i}
            for i in range(10)
        ]
    )

    called = {}

    def fake_train(self, frame):
        called["invoked"] = True
        return {"metrics": {"mae": 0.1, "rmse": 0.2}, "model_type": "prophet"}

    monkeypatch.setattr(ForecastService, "train_model", fake_train)
    monkeypatch.setattr(ForecastService, "save_model", lambda self, bundle: None)

    response = client.post("/model/retrain", json={"train_from_uploaded_data": True})
    assert response.status_code == 202
    assert response.json()["status"] == "training_started"
    assert called.get("invoked") is True

    stored = test_db.model_parameters.find_one()
    assert stored is not None
    assert stored["model_type"] == "prophet"
    assert stored["train_metrics"]["mae"] == 0.1


def test_model_status_returns_latest_metadata(client, test_db):
    now = datetime.utcnow()
    test_db.model_parameters.insert_many(
        [
            {
                "model_path": "models/model_v1.pkl",
                "model_type": "prophet",
                "train_metrics": {"mae": 0.3},
                "trained_at": now - timedelta(days=1),
                "notes": "older",
            },
            {
                "model_path": "models/model_v2.pkl",
                "model_type": "arima",
                "train_metrics": {"mae": 0.2},
                "trained_at": now,
                "notes": "newest",
            },
        ]
    )

    response = client.get("/model/status")
    assert response.status_code == 200
    payload = response.json()
    assert payload["model_type"] == "arima"
    assert "trained_at" in payload
    assert payload["notes"] == "newest"
