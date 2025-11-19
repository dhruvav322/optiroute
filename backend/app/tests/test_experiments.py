from datetime import datetime

from bson import ObjectId


def _sample_payload():
    return {
        "model_type": "prophet",
        "model_version": "models/model.pkl",
        "hyperparameters": {"weekly_seasonality": True},
        "metrics": {
            "train": {"mae": 1.2, "rmse": 1.8, "mape": 4.5},
            "validation": {"mae": 1.4, "rmse": 2.0, "mape": 5.1},
        },
        "data_profile": {
            "size": 365,
            "date_range": ["2024-01-01", "2024-12-31"],
            "missing_percentage": 0.0,
        },
        "training_duration_seconds": 42.3,
        "description": "Baseline prophet run",
    }


def test_experiments_log_and_history(client, test_db, auth_headers):
    response = client.post("/api/v1/experiments/log", json=_sample_payload(), headers=auth_headers)
    assert response.status_code == 201
    inserted_id = response.json()["id"]
    assert ObjectId.is_valid(inserted_id)

    history = client.get("/api/v1/experiments/history?limit=10", headers=auth_headers)
    assert history.status_code == 200
    payload = history.json()
    assert payload["experiments"]
    logged = payload["experiments"][0]
    assert logged["model_type"] == "prophet"
    assert logged["metrics"]["validation"]["rmse"] == 2.0


def test_experiments_compare_and_best(client, test_db, auth_headers):
    ids = []
    for idx in range(2):
        payload = _sample_payload()
        payload["model_type"] = f"arima_{idx}"
        payload["metrics"]["validation"]["rmse"] = 1.5 + idx
        response = client.post("/api/v1/experiments/log", json=payload, headers=auth_headers)
        assert "id" in response.json()
        ids.append(response.json()["id"])

    compare = client.get(f"/api/v1/experiments/compare?ids={','.join(ids)}", headers=auth_headers)
    assert compare.status_code == 200
    compared = compare.json()["experiments"]
    assert len(compared) == 2

    best = client.get("/api/v1/experiments/best?metric=rmse", headers=auth_headers)
    assert best.status_code == 200
    best_payload = best.json()
    assert best_payload["experiment"]
    assert best_payload["experiment"]["model_type"] == "arima_0"
