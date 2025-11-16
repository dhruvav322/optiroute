"""Inventory related aggregations for the dashboard summary."""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status

from ..schemas import InventorySummary
from ..services.forecast import ForecastService


class InventoryService:
    def __init__(self, db, client_id: str):
        self.db = db
        self.client_id = client_id
        self.forecast_service = ForecastService(client_id)

    def get_current_stock(self) -> int:
        document = self.db.inventory_state.find_one(
            {"client_id": self.client_id}, sort=[("updated_at", -1)]
        )
        if not document:
            return 500  # default placeholder stock level
        return int(document.get("current_stock", 0))

    def latest_simulation(self) -> Optional[dict]:
        return self.db.simulation_parameters.find_one(
            {"client_id": self.client_id}, sort=[("saved_at", -1)]
        )

    def summary(self) -> InventorySummary:
        try:
            forecast_df = self.forecast_service.forecast(30)
            forecasted_demand = float(forecast_df["yhat"].sum())
        except HTTPException as exc:
            if exc.status_code == status.HTTP_404_NOT_FOUND:
                forecasted_demand = 0.0
            else:
                raise

        simulation_record = self.latest_simulation() or {}
        result = simulation_record.get("result", {})

        return InventorySummary(
            current_stock_level=self.get_current_stock(),
            forecasted_30_day_demand=forecasted_demand,
            optimal_reorder_point=float(result.get("new_reorder_point", 0.0)),
            safety_stock=float(result.get("safety_stock", 0.0)),
            last_simulated_at=simulation_record.get("saved_at"),
        )
