from types import SimpleNamespace
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import mongomock
import pytest
from fastapi.testclient import TestClient

from app.api import endpoints
from app.main import create_app
from app.services.experiments import ExperimentTracker


@pytest.fixture(autouse=True)
def override_settings(monkeypatch, tmp_path):
    from app.core import config

    config.get_settings.cache_clear()

    model_dir = tmp_path / "models"
    uploads_dir = tmp_path / "uploads"
    model_dir.mkdir(parents=True, exist_ok=True)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    settings = SimpleNamespace(
        mongo_uri="mongodb://localhost:27017",
        mongo_db="optiroute",
        model_dir=model_dir,
        model_path=model_dir / "model.pkl",
        uploads_dir=uploads_dir,
        secret_key="test-secret",
    )

    monkeypatch.setattr(config, "get_settings", lambda: settings)
    monkeypatch.setattr(endpoints, "get_settings", lambda: settings)
    yield settings


@pytest.fixture()
def test_db():
    client = mongomock.MongoClient()
    return client["optiroute"]


@pytest.fixture()
def app(test_db, monkeypatch):
    app = create_app()
    app.dependency_overrides[endpoints.get_db] = lambda: test_db
    app.dependency_overrides[endpoints.get_experiment_tracker] = lambda: ExperimentTracker(test_db)
    yield app
    app.dependency_overrides.clear()


@pytest.fixture()
def client(app):
    with TestClient(app) as test_client:
        yield test_client
