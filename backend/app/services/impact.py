"""Business impact calculator for inventory policies."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

from fastapi import HTTPException, status


@dataclass
class Policy:
    annual_demand: float
    order_quantity: float
    order_cost: float
    holding_cost_per_unit: float
    unit_cost: float
    service_level: float
    safety_stock: float
    average_inventory: Optional[float]
    stockout_cost_per_unit: float
    obsolescence_rate: float


class ImpactService:
    MIN_VALUE = 1e-3

    def calculate(self, payload: Dict) -> Dict:
        try:
            baseline = self._policy_from_payload(payload["baseline"])
            optimized = self._policy_from_payload(payload["optimized"])
        except KeyError as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required key: {exc.args[0]}",
            ) from exc

        baseline_costs = self._cost_breakdown(baseline)
        optimized_costs = self._cost_breakdown(optimized)

        baseline_total = baseline_costs["total"]
        optimized_total = optimized_costs["total"]
        savings = baseline_total - optimized_total
        improvement_pct = savings / baseline_total * 100 if baseline_total else 0.0

        roi = self._roi(payload.get("implementation_cost", 0.0), savings)

        return {
            "baseline": {
                "costs": baseline_costs,
            },
            "optimized": {
                "costs": optimized_costs,
            },
            "savings": {
                "annual_savings": round(savings, 2),
                "improvement_pct": round(improvement_pct, 2),
                "roi_pct": round(roi, 2),
            },
        }

    def _policy_from_payload(self, data: Dict) -> Policy:
        required_keys = {
            "annual_demand",
            "order_quantity",
            "order_cost",
            "holding_cost_per_unit",
            "unit_cost",
            "service_level",
            "safety_stock",
            "stockout_cost_per_unit",
        }
        missing = required_keys - data.keys()
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing fields for policy: {', '.join(sorted(missing))}",
            )

        average_inventory = data.get("average_inventory")
        if average_inventory is not None:
            average_inventory = max(float(average_inventory), 0.0)

        return Policy(
            annual_demand=float(data["annual_demand"]),
            order_quantity=max(float(data["order_quantity"]), self.MIN_VALUE),
            order_cost=float(data["order_cost"]),
            holding_cost_per_unit=float(data["holding_cost_per_unit"]),
            unit_cost=float(data["unit_cost"]),
            service_level=min(max(float(data["service_level"]), 0.0), 1.0),
            safety_stock=float(data.get("safety_stock", 0.0)),
            average_inventory=average_inventory,
            stockout_cost_per_unit=float(data["stockout_cost_per_unit"]),
            obsolescence_rate=float(data.get("obsolescence_rate", 0.0)),
        )

    def _cost_breakdown(self, policy: Policy) -> Dict[str, float]:
        avg_inventory = (
            policy.average_inventory
            if policy.average_inventory is not None
            else policy.order_quantity / 2 + policy.safety_stock
        )

        ordering_cost = (policy.annual_demand / policy.order_quantity) * policy.order_cost
        holding_cost = avg_inventory * policy.holding_cost_per_unit
        purchase_cost = policy.annual_demand * policy.unit_cost
        stockout_rate = max(0.0, 1.0 - policy.service_level)
        stockout_cost = stockout_rate * policy.annual_demand * policy.stockout_cost_per_unit
        obsolescence_cost = avg_inventory * policy.unit_cost * max(policy.obsolescence_rate, 0.0)

        total = ordering_cost + holding_cost + purchase_cost + stockout_cost + obsolescence_cost
        return {
            "ordering_cost": round(ordering_cost, 2),
            "holding_cost": round(holding_cost, 2),
            "purchase_cost": round(purchase_cost, 2),
            "stockout_cost": round(stockout_cost, 2),
            "obsolescence_cost": round(obsolescence_cost, 2),
            "total": round(total, 2),
        }

    @staticmethod
    def _roi(implementation_cost: float, savings: float) -> float:
        if implementation_cost <= 0:
            return 100.0 if savings > 0 else 0.0
        return savings / implementation_cost * 100.0
