"""Input validation and sanitization utilities."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status


def validate_coordinates(latitude: float, longitude: float) -> tuple[float, float]:
    """Validate and sanitize geographic coordinates."""
    if not (-90 <= latitude <= 90):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Latitude must be between -90 and 90"
        )
    if not (-180 <= longitude <= 180):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Longitude must be between -180 and 180"
        )
    return float(latitude), float(longitude)


def validate_demand(demand: float) -> float:
    """Validate demand value."""
    if demand < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Demand must be non-negative"
        )
    if demand > 1_000_000:  # Reasonable upper limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Demand exceeds maximum allowed value"
        )
    return float(demand)


def validate_capacity(capacity: float) -> float:
    """Validate vehicle capacity."""
    if capacity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Capacity must be positive"
        )
    if capacity > 100_000:  # Reasonable upper limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Capacity exceeds maximum allowed value"
        )
    return float(capacity)


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal."""
    # Remove path components
    filename = Path(filename).name
    
    # Remove dangerous characters
    filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    
    # Limit length
    if len(filename) > 255:
        filename = filename[:255]
    
    # Ensure it's not empty
    if not filename:
        filename = "upload"
    
    return filename


def validate_file_size(content: bytes, max_size_mb: int = 10) -> None:
    """Validate uploaded file size."""
    max_size_bytes = max_size_mb * 1024 * 1024
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {max_size_mb}MB"
        )


def validate_locations_count(locations: list[Any], max_locations: int = 100) -> None:
    """Validate number of locations in route optimization."""
    if len(locations) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 2 locations required for routing"
        )
    if len(locations) > max_locations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {max_locations} locations allowed"
        )


def validate_vehicles_count(vehicles: list[Any], max_vehicles: int = 50) -> None:
    """Validate number of vehicles."""
    if len(vehicles) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 1 vehicle required"
        )
    if len(vehicles) > max_vehicles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {max_vehicles} vehicles allowed"
        )

