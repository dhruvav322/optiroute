"""Inventory simulation service implementing EOQ, ROP, and safety stock formulas."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable

from fastapi import HTTPException, status


@dataclass
class SimulationParameters:
    holding_cost_per_unit_per_year: float
    order_cost: float
    unit_cost: float
    lead_time_days: int
    service_level: float
    forecast_values: Iterable[float]


class SimulationService:
    def __init__(self, params: SimulationParameters) -> None:
        self.params = params
        self._validate()

    def _validate(self) -> None:
        if self.params.lead_time_days < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="lead_time_days must be non-negative",
            )
        numeric_fields = {
            "holding_cost_per_unit_per_year": self.params.holding_cost_per_unit_per_year,
            "order_cost": self.params.order_cost,
            "unit_cost": self.params.unit_cost,
            "service_level": self.params.service_level,
        }
        for field, value in numeric_fields.items():
            if value < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{field} must be non-negative",
                )
        if not 0.5 <= self.params.service_level <= 0.999:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="service_level must be between 0.5 and 0.999",
            )

    def run(self) -> dict:
        forecast_list = list(self.params.forecast_values)
        if not forecast_list:
            annual_demand = 0.0
        else:
            forecast_period = len(forecast_list)
            period_demand = sum(forecast_list)
            annual_demand = (period_demand * 365) / forecast_period

        if annual_demand <= 0:
            return self._zero_demand_result()

        holding_cost = self.params.holding_cost_per_unit_per_year
        order_cost = self.params.order_cost

        eoq = math.sqrt((2 * annual_demand * order_cost) / max(holding_cost, 1e-9))
        eoq = math.ceil(eoq)

        average_daily_demand = annual_demand / 365
        daily_std = self._estimate_daily_std(forecast_list)
        sigma_lead_time = daily_std * math.sqrt(self.params.lead_time_days)
        z_score = self._service_level_to_z(self.params.service_level)
        safety_stock = z_score * sigma_lead_time

        reorder_point = average_daily_demand * self.params.lead_time_days + safety_stock

        annual_ordering_cost = (annual_demand / max(eoq, 1)) * order_cost
        annual_holding_cost = ((eoq / 2) + safety_stock) * holding_cost
        purchase_cost = annual_demand * self.params.unit_cost
        total_cost = annual_ordering_cost + annual_holding_cost + purchase_cost

        return {
            "new_eoq": eoq,
            "annual_demand": annual_demand,
            "annual_ordering_cost": annual_ordering_cost,
            "annual_holding_cost": annual_holding_cost,
            "new_reorder_point": reorder_point,
            "safety_stock": safety_stock,
            "total_projected_cost": total_cost,
            "details": {
                "EOQ_formula": "sqrt((2 * D * S) / H)",
                "parameters": {
                    "annual_demand": annual_demand,
                    "order_cost": order_cost,
                    "holding_cost_per_unit_per_year": holding_cost,
                    "lead_time_days": self.params.lead_time_days,
                    "service_level": self.params.service_level,
                    "unit_cost": self.params.unit_cost,
                },
            },
        }

    def _zero_demand_result(self) -> dict:
        return {
            "new_eoq": 0,
            "annual_demand": 0.0,
            "annual_ordering_cost": 0.0,
            "annual_holding_cost": 0.0,
            "new_reorder_point": 0.0,
            "safety_stock": 0.0,
            "total_projected_cost": 0.0,
            "details": {
                "EOQ_formula": "sqrt((2 * D * S) / H)",
                "parameters": {
                    "annual_demand": 0.0,
                    "order_cost": self.params.order_cost,
                    "holding_cost_per_unit_per_year": self.params.holding_cost_per_unit_per_year,
                    "lead_time_days": self.params.lead_time_days,
                    "service_level": self.params.service_level,
                    "unit_cost": self.params.unit_cost,
                },
            },
        }

    @staticmethod
    def _estimate_daily_std(values: list[float]) -> float:
        if len(values) <= 1:
            return 0.0
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
        return math.sqrt(max(variance, 0.0))

    @staticmethod
    def _service_level_to_z(service_level: float) -> float:
        from math import sqrt

        # Abramowitz and Stegun approximation for inverse error function
        if service_level <= 0:
            return 0.0
        if service_level >= 1:
            return 3.09

        from math import log

        p = service_level
        if p < 0.5:
            sign = -1
            p = 1 - p
        else:
            sign = 1

        t = sqrt(-2 * log(1 - p))
        # Coefficients for approximation
        c0, c1, c2 = 2.515517, 0.802853, 0.010328
        d1, d2, d3 = 1.432788, 0.189269, 0.001308
        z = t - ((c0 + c1 * t + c2 * t**2) / (1 + d1 * t + d2 * t**2 + d3 * t**3))
        return sign * z
