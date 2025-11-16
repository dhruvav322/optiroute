"""Rate limiting middleware using in-memory store (upgrade to Redis for production)."""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Callable

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimiter:
    """Simple in-memory rate limiter."""
    
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests: dict[str, list[float]] = defaultdict(list)
        self.cleanup_interval = 60  # Clean up old entries every 60 seconds
        self.last_cleanup = time.time()
    
    def is_allowed(self, key: str) -> bool:
        """Check if request is allowed."""
        now = time.time()
        
        # Cleanup old entries periodically
        if now - self.last_cleanup > self.cleanup_interval:
            self._cleanup(now)
            self.last_cleanup = now
        
        # Remove requests older than 1 minute
        self.requests[key] = [
            req_time for req_time in self.requests[key]
            if now - req_time < 60
        ]
        
        # Check limit
        if len(self.requests[key]) >= self.requests_per_minute:
            return False
        
        # Record request
        self.requests[key].append(now)
        return True
    
    def _cleanup(self, now: float) -> None:
        """Remove old entries."""
        keys_to_remove = []
        for key, timestamps in self.requests.items():
            self.requests[key] = [
                ts for ts in timestamps if now - ts < 60
            ]
            if not self.requests[key]:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self.requests[key]


# Global rate limiter instances
default_limiter = RateLimiter(requests_per_minute=60)
strict_limiter = RateLimiter(requests_per_minute=10)  # For sensitive endpoints


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware."""
    
    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.limiter = RateLimiter(requests_per_minute)
    
    async def dispatch(self, request: Request, call_next: Callable):
        # Get client identifier
        client_ip = request.client.host if request.client else "unknown"
        
        # Skip rate limiting for health checks
        if request.url.path == "/health":
            return await call_next(request)
        
        # Check rate limit
        if not self.limiter.is_allowed(client_ip):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later.",
                headers={"Retry-After": "60"},
            )
        
        return await call_next(request)


def get_client_ip(request: Request) -> str:
    """Extract client IP from request."""
    if request.client:
        return request.client.host
    return "unknown"

