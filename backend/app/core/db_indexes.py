"""Database indexes for performance optimization."""

from __future__ import annotations

from pymongo import ASCENDING, DESCENDING


def create_indexes(db) -> None:
    """Create database indexes for optimal query performance."""
    try:
        # Historical sales indexes
        db.historical_sales.create_index([("date", ASCENDING)], background=True)
        db.historical_sales.create_index([("client_id", ASCENDING), ("date", DESCENDING)], background=True)
        db.historical_sales.create_index([("uploaded_at", DESCENDING)], background=True)
        
        # Model parameters indexes
        db.model_parameters.create_index([("trained_at", DESCENDING)], background=True)
        db.model_parameters.create_index([("model_type", ASCENDING)], background=True)
        
        # Experiments indexes
        db.experiments.create_index([("created_at", DESCENDING)], background=True)
        db.experiments.create_index([("client_id", ASCENDING), ("created_at", DESCENDING)], background=True)
        db.experiments.create_index([("model_type", ASCENDING)], background=True)
        try:
            db.experiments.create_index([("metrics.validation.rmse", ASCENDING)], background=True)
        except Exception:
            pass  # Index might fail if field doesn't exist yet
        
        # Simulation parameters indexes
        db.simulation_parameters.create_index([("saved_at", DESCENDING)], background=True)
        db.simulation_parameters.create_index([("client_id", ASCENDING), ("saved_at", DESCENDING)], background=True)
        
        # Inventory state indexes
        db.inventory_state.create_index([("client_id", ASCENDING), ("updated_at", DESCENDING)], background=True)
        
        # API keys indexes
        db.api_keys.create_index([("client_id", ASCENDING)], background=True)
        db.api_keys.create_index([("is_active", ASCENDING), ("expires_at", ASCENDING)], background=True)
        db.api_keys.create_index([("created_at", DESCENDING)], background=True)
    except Exception as e:
        # Silently fail - indexes will be created when collections are first used
        import logging
        logger = logging.getLogger(__name__)
        logger.debug(f"Index creation skipped: {e}")

