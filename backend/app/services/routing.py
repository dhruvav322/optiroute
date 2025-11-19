"""Route optimization service using OR-Tools for VRP and TSP problems."""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from functools import lru_cache
from typing import List, Dict, Any, Tuple, Optional

import requests
from fastapi import HTTPException, status
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

logger = logging.getLogger(__name__)


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

    def calculate_distance_matrix(
        self, locations: List[Location]
    ) -> List[List[int]]:
        """Calculate distance matrix using OSRM (Open Source Routing Machine) for real road distances.
        
        Falls back to Haversine (straight-line) if OSRM is unavailable.
        
        Returns distance matrix in meters (as integers for OR-Tools).
        """
        # Try OSRM first for real driving distances
        try:
            return self._get_road_distance_matrix(locations)
        except Exception as e:
            logger.warning(f"OSRM unavailable, falling back to Haversine: {e}")
            return self._calculate_haversine_matrix(locations)

    def _get_road_distance_matrix(self, locations: List[Location]) -> List[List[int]]:
        """Get driving distance matrix from OSRM (Open Source Routing Machine).
        
        OSRM returns real road distances in meters, accounting for one-way streets,
        bridges, traffic patterns, etc. This is critical for real-world route optimization.
        
        Uses public OSRM demo server. For production, deploy your own OSRM instance.
        """
        if len(locations) > 100:
            # OSRM public API has limits, fall back for very large problems
            logger.warning(f"Too many locations ({len(locations)}), using Haversine fallback")
            return self._calculate_haversine_matrix(locations)

        # Build coordinates string: "lon1,lat1;lon2,lat2;..."
        # Note: OSRM expects longitude first, then latitude
        coordinates = ";".join([
            f"{loc.longitude},{loc.latitude}" 
            for loc in locations
        ])

        # OSRM Table Service API - returns distance matrix for all pairs
        # Public demo server (use your own Docker container for production)
        url = f"http://router.project-osrm.org/table/v1/driving/{coordinates}"
        params = {
            "annotations": "distance",  # Request distances only (faster than duration+distance)
            # Omitting sources/destinations means all-to-all distance matrix
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            if "distances" not in data:
                raise ValueError("OSRM response missing distances field")

            # OSRM returns distances in meters as floats, convert to integers
            # Handle None values (unreachable routes) by using a very large distance
            matrix = []
            for row in data["distances"]:
                matrix.append([
                    int(d) if d is not None else 999999999  # Unreachable = very large distance
                    for d in row
                ])

            logger.info(f"Successfully fetched road distance matrix from OSRM ({len(locations)}x{len(locations)})")
            return matrix

        except requests.RequestException as e:
            logger.warning(f"OSRM request failed: {e}")
            raise
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(f"OSRM response parsing failed: {e}")
            raise

    def _calculate_haversine_matrix(self, locations: List[Location]) -> List[List[int]]:
        """Calculate distance matrix using Haversine formula (straight-line distances).
        
        This is a fallback when OSRM is unavailable. Haversine calculates "as the crow flies"
        distances, which are always shorter than actual road distances.
        
        For production use, always prefer OSRM road distances.
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
        
        logger.info(f"Calculated Haversine distance matrix ({n}x{n})")
        return matrix

    @staticmethod
    @lru_cache(maxsize=10000)  # Cache up to 10,000 unique distance calculations
    def _haversine_distance(
        lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        """Calculate great-circle distance between two points using Haversine formula.
        
        Uses LRU cache for performance - repeated distance calculations are instant.
        Cache size of 10,000 covers ~100 location problems (100x100 matrix).
        """
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
        
        return 6371.0 * c  # Earth's radius in kilometers

    def solve_tsp(
        self,
        locations: List[Location],
        depot_index: int = 0,
        return_to_depot: bool = True
    ) -> Dict[str, Any]:
        """Solve Traveling Salesman Problem (single vehicle, all locations).
        
        Args:
            locations: List of locations to visit
            depot_index: Index of depot/starting location
            return_to_depot: If True, vehicle must return to depot. If False, route ends at last stop.
            
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
        # Note: OR-Tools always returns to depot by default. For open TSP (return_to_depot=False),
        # we'll handle this in route extraction by not adding the final depot node.
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

        # Add depot at end only if return_to_depot is True
        final_node = manager.IndexToNode(index)
        if return_to_depot:
            route.append(locations[final_node])
            route_indices.append(final_node)
        else:
            # For open TSP, the route ends at the last stop (driver can end shift there)
            # The final distance is already included in total_distance
            pass

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
            "number_of_stops": len(route) - (1 if return_to_depot else 0),  # Exclude return to depot if applicable
            "route_indices": route_indices,
            "return_to_depot": return_to_depot
        }

    def solve_vrp(
        self,
        locations: List[Location],
        vehicles: List[Vehicle],
        depot_index: int = 0,
        return_to_depot: bool = True
    ) -> Dict[str, Any]:
        """Solve Vehicle Routing Problem (multiple vehicles with capacity).
        
        Args:
            locations: List of locations (first is depot)
            vehicles: List of vehicles
            depot_index: Index of depot
            return_to_depot: If True, vehicles must return to depot. If False, routes can end at last stop.
            
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
            
            # Add depot at end only if return_to_depot is True
            final_node = manager.IndexToNode(index)
            if return_to_depot:
                route.append(locations[final_node])
                route_indices.append(final_node)
            else:
                # For open VRP, routes end at last stop (driver can end shift there)
                pass
            
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
                    "number_of_stops": len(route) - (2 if return_to_depot else 1),  # Exclude depot start/end if applicable
                    "route_indices": route_indices
                })
                total_distance += vehicle_distance

        return {
            "vehicle_routes": vehicle_routes,
            "total_distance_meters": total_distance,
            "total_distance_km": round(total_distance / 1000, 2),
            "vehicles_used": len(vehicle_routes),
            "total_vehicles": len(vehicles),
            "return_to_depot": return_to_depot
        }

