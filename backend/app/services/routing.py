"""Route optimization service using OR-Tools for VRP and TSP problems."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple

from fastapi import HTTPException, status
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp


@dataclass
class Location:
    """Represents a location with coordinates."""
    id: str
    name: str
    latitude: float
    longitude: float
    demand: float = 0.0  # For VRP capacity constraints


@dataclass
class Vehicle:
    """Represents a vehicle for routing."""
    id: str
    capacity: float = 1000.0  # Maximum capacity
    cost_per_km: float = 1.0  # Cost per kilometer


class RouteOptimizationService:
    """Service for optimizing delivery routes using OR-Tools."""

    def __init__(self):
        self.earth_radius_km = 6371.0  # Earth's radius in kilometers

    def calculate_distance_matrix(
        self, locations: List[Location]
    ) -> List[List[int]]:
        """Calculate distance matrix using Haversine formula.
        
        Returns distance matrix in meters (as integers for OR-Tools).
        """
        n = len(locations)
        matrix = [[0] * n for _ in range(n)]
        
        for i in range(n):
            for j in range(n):
                if i == j:
                    matrix[i][j] = 0
                else:
                    dist_km = self._haversine_distance(
                        locations[i].latitude, locations[i].longitude,
                        locations[j].latitude, locations[j].longitude
                    )
                    # Convert to meters and round to integer
                    matrix[i][j] = int(dist_km * 1000)
        
        return matrix

    def _haversine_distance(
        self, lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        """Calculate great-circle distance between two points using Haversine formula."""
        # Convert to radians
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        # Haversine formula
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = (
            math.sin(dlat / 2) ** 2 +
            math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.asin(math.sqrt(a))
        
        return self.earth_radius_km * c

    def solve_tsp(
        self,
        locations: List[Location],
        depot_index: int = 0
    ) -> Dict[str, Any]:
        """Solve Traveling Salesman Problem (single vehicle, all locations).
        
        Args:
            locations: List of locations to visit
            depot_index: Index of depot/starting location
            
        Returns:
            Dictionary with route, distance, and route details
        """
        if len(locations) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Need at least 2 locations for routing"
            )

        # Calculate distance matrix
        distance_matrix = self.calculate_distance_matrix(locations)
        
        # Create routing model
        manager = pywrapcp.RoutingIndexManager(
            len(locations), 1, depot_index
        )
        routing = pywrapcp.RoutingModel(manager)

        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return distance_matrix[from_node][to_node]

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        # Set search parameters
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.seconds = 5

        # Solve
        solution = routing.SolveWithParameters(search_parameters)
        
        if not solution:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to find solution for TSP"
            )

        # Extract route
        route = []
        route_indices = []
        index = routing.Start(0)
        total_distance = 0
        
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            route.append(locations[node])
            route_indices.append(node)
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            total_distance += routing.GetArcCostForVehicle(
                previous_index, index, 0
            )

        # Add depot at end to complete cycle
        final_node = manager.IndexToNode(index)
        route.append(locations[final_node])
        route_indices.append(final_node)

        return {
            "route": [
                {
                    "id": loc.id,
                    "name": loc.name,
                    "latitude": loc.latitude,
                    "longitude": loc.longitude,
                    "sequence": idx
                }
                for idx, loc in enumerate(route)
            ],
            "total_distance_meters": total_distance,
            "total_distance_km": round(total_distance / 1000, 2),
            "number_of_stops": len(route) - 1,  # Exclude return to depot
            "route_indices": route_indices
        }

    def solve_vrp(
        self,
        locations: List[Location],
        vehicles: List[Vehicle],
        depot_index: int = 0
    ) -> Dict[str, Any]:
        """Solve Vehicle Routing Problem (multiple vehicles with capacity).
        
        Args:
            locations: List of locations (first is depot)
            vehicles: List of vehicles
            depot_index: Index of depot
            
        Returns:
            Dictionary with routes for each vehicle, total distance, etc.
        """
        if len(locations) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Need at least 2 locations for routing"
            )
        if not vehicles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Need at least 1 vehicle"
            )

        # Calculate distance matrix
        distance_matrix = self.calculate_distance_matrix(locations)
        
        # Get demands (capacity requirements)
        demands = [int(loc.demand * 100) for loc in locations]  # Convert to integer units
        
        # Create routing model
        manager = pywrapcp.RoutingIndexManager(
            len(locations), len(vehicles), depot_index
        )
        routing = pywrapcp.RoutingModel(manager)

        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return distance_matrix[from_node][to_node]

        def demand_callback(from_index):
            from_node = manager.IndexToNode(from_index)
            return demands[from_node]

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        demand_callback_index = routing.RegisterUnaryCallback(demand_callback)
        
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,  # null capacity slack
            [int(v.capacity * 100) for v in vehicles],  # vehicle capacities
            True,  # start cumul to zero
            "Capacity"
        )

        # Set search parameters
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.seconds = 10

        # Solve
        solution = routing.SolveWithParameters(search_parameters)
        
        if not solution:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to find solution for VRP"
            )

        # Extract routes for each vehicle
        vehicle_routes = []
        total_distance = 0
        
        for vehicle_id in range(len(vehicles)):
            route = []
            route_indices = []
            index = routing.Start(vehicle_id)
            vehicle_distance = 0
            
            while not routing.IsEnd(index):
                node = manager.IndexToNode(index)
                route.append(locations[node])
                route_indices.append(node)
                previous_index = index
                index = solution.Value(routing.NextVar(index))
                vehicle_distance += routing.GetArcCostForVehicle(
                    previous_index, index, vehicle_id
                )
            
            # Add depot at end
            final_node = manager.IndexToNode(index)
            route.append(locations[final_node])
            route_indices.append(final_node)
            
            if len(route) > 2:  # Only include routes with actual stops
                vehicle_routes.append({
                    "vehicle_id": vehicles[vehicle_id].id,
                    "route": [
                        {
                            "id": loc.id,
                            "name": loc.name,
                            "latitude": loc.latitude,
                            "longitude": loc.longitude,
                            "sequence": idx,
                            "demand": loc.demand
                        }
                        for idx, loc in enumerate(route)
                    ],
                    "distance_meters": vehicle_distance,
                    "distance_km": round(vehicle_distance / 1000, 2),
                    "number_of_stops": len(route) - 2,  # Exclude depot start/end
                    "route_indices": route_indices
                })
                total_distance += vehicle_distance

        return {
            "vehicle_routes": vehicle_routes,
            "total_distance_meters": total_distance,
            "total_distance_km": round(total_distance / 1000, 2),
            "vehicles_used": len(vehicle_routes),
            "total_vehicles": len(vehicles)
        }

