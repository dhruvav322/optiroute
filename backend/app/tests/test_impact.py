import pytest


BASELINE_POLICY = {
    "annual_demand": 12000,
    "order_quantity": 500,
    "order_cost": 75,
    "holding_cost_per_unit": 2.5,
    "unit_cost": 10,
    "service_level": 0.9,
    "safety_stock": 150,
    "stockout_cost_per_unit": 15,
    "obsolescence_rate": 0.02,
}


OPTIMIZED_POLICY = {
    "annual_demand": 12000,
    "order_quantity": 400,
    "order_cost": 70,
    "holding_cost_per_unit": 2.3,
    "unit_cost": 10,
    "service_level": 0.95,
    "safety_stock": 180,
    "stockout_cost_per_unit": 15,
    "obsolescence_rate": 0.015,
}


def test_business_impact_endpoint(client, auth_headers):
    payload = {
        "baseline": BASELINE_POLICY,
        "optimized": OPTIMIZED_POLICY,
        "implementation_cost": 25000,
    }

    response = client.post("/api/v1/analysis/business-impact", json=payload, headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert "baseline" in data and "optimized" in data
    assert data["savings"]["annual_savings"] != 0
    assert "roi_pct" in data["savings"]


@pytest.mark.parametrize(
    "missing_key",
    ["baseline", "optimized"],
)
def test_business_impact_validation_errors(client, auth_headers, missing_key):
    payload = {
        "baseline": BASELINE_POLICY,
        "optimized": OPTIMIZED_POLICY,
    }
    payload.pop(missing_key)

    response = client.post("/api/v1/analysis/business-impact", json=payload, headers=auth_headers)
    assert response.status_code == 422
