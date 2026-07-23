import pytest

from app.core.config import Settings
from app.services.forecast import ForecastService


def test_production_rejects_the_default_secret():
    settings = Settings(
        environment="production",
        secret_key="insecure-secret",
        allowed_origins="https://app.example.com",
    )

    with pytest.raises(ValueError, match="SECRET_KEY"):
        settings.validate_production_security()


def test_production_requires_an_allowed_origin():
    settings = Settings(
        environment="production",
        secret_key="a" * 32,
        allowed_origins="",
    )

    with pytest.raises(ValueError, match="ALLOWED_ORIGINS"):
        settings.validate_production_security()


def test_forecast_cache_invalidation_covers_supported_horizons(monkeypatch):
    deleted_keys = []
    from app.core import cache as cache_module

    monkeypatch.setattr(cache_module.cache, "delete", deleted_keys.append)
    ForecastService("tenant-a").invalidate_cached_forecasts(max_horizon_days=3)

    assert deleted_keys == [
        "forecast:tenant-a:1",
        "forecast:tenant-a:2",
        "forecast:tenant-a:3",
    ]
