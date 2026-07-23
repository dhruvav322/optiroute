from app.services.routing import Location, RouteOptimizationService, Vehicle


def _locations():
    return [
        Location("depot", "Depot", 0.0, 0.0),
        Location("a", "Stop A", 0.0, 1.0, demand=1.0),
        Location("b", "Stop B", 0.0, 2.0, demand=1.0),
    ]


def _matrix():
    # Returning from B to the depot is deliberately expensive. An open route
    # must not include that leg in either the solver objective or the result.
    return [[0, 10, 100], [10, 0, 10], [100, 10, 0]]


def test_open_tsp_does_not_include_a_return_to_depot_leg(monkeypatch):
    service = RouteOptimizationService()
    monkeypatch.setattr(service, "calculate_distance_matrix", lambda _: _matrix())

    result = service.solve_tsp(_locations(), return_to_depot=False)

    assert result["total_distance_meters"] == 20
    assert result["number_of_stops"] == 2
    assert result["route_indices"] == [0, 1, 2]


def test_open_vrp_does_not_include_a_return_to_depot_leg(monkeypatch):
    service = RouteOptimizationService()
    monkeypatch.setattr(service, "calculate_distance_matrix", lambda _: _matrix())

    result = service.solve_vrp(
        _locations(),
        [Vehicle("vehicle-1", capacity=10.0)],
        return_to_depot=False,
    )

    assert result["total_distance_meters"] == 20
    assert result["vehicles_used"] == 1
    assert result["vehicle_routes"][0]["number_of_stops"] == 2


def test_route_endpoint_requires_authentication(client):
    response = client.post("/api/v1/routes/optimize", json={"locations": []})
    assert response.status_code == 403


def test_route_endpoint_rejects_an_invalid_depot_index(client, auth_headers):
    response = client.post(
        "/api/v1/routes/optimize",
        json={
            "locations": [
                {"id": "depot", "name": "Depot", "latitude": 0, "longitude": 0},
                {"id": "a", "name": "A", "latitude": 0, "longitude": 1},
            ],
            "depot_index": 5,
        },
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "depot_index" in response.json()["detail"]
