"""Caching utilities for performance optimization."""

from __future__ import annotations

import json
import hashlib
from functools import wraps
from typing import Any, Callable, Optional

from .config import get_settings

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None


class Cache:
    """Simple cache implementation with Redis fallback to in-memory."""
    
    def __init__(self):
        self.settings = get_settings()
        self.redis_client = None
        self.memory_cache: dict[str, tuple[Any, float]] = {}
        
        if REDIS_AVAILABLE:
            try:
                self.redis_client = redis.from_url(
                    self.settings.redis_url,
                    decode_responses=True
                )
                # Test connection
                self.redis_client.ping()
            except Exception:
                self.redis_client = None
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if self.redis_client:
            try:
                value = self.redis_client.get(key)
                if value:
                    return json.loads(value)
            except Exception:
                pass
        
        # Fallback to memory cache
        if key in self.memory_cache:
            value, expiry = self.memory_cache[key]
            import time
            if time.time() < expiry:
                return value
            del self.memory_cache[key]
        
        return None
    
    def set(self, key: str, value: Any, ttl: int = 3600) -> None:
        """Set value in cache with TTL."""
        if self.redis_client:
            try:
                self.redis_client.setex(
                    key,
                    ttl,
                    json.dumps(value, default=str)
                )
                return
            except Exception:
                pass
        
        # Fallback to memory cache
        import time
        self.memory_cache[key] = (value, time.time() + ttl)
    
    def delete(self, key: str) -> None:
        """Delete key from cache."""
        if self.redis_client:
            try:
                self.redis_client.delete(key)
            except Exception:
                pass
        
        if key in self.memory_cache:
            del self.memory_cache[key]
    
    def clear(self) -> None:
        """Clear all cache."""
        if self.redis_client:
            try:
                self.redis_client.flushdb()
            except Exception:
                pass
        
        self.memory_cache.clear()


# Global cache instance
cache = Cache()


def cache_key(*args, **kwargs) -> str:
    """Generate cache key from function arguments."""
    key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
    return hashlib.md5(key_data.encode()).hexdigest()


def cached(ttl: int = 3600):
    """Decorator to cache function results."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            key = f"{func.__name__}:{cache_key(*args, **kwargs)}"
            
            # Try to get from cache
            result = cache.get(key)
            if result is not None:
                return result
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Store in cache
            cache.set(key, result, ttl)
            
            return result
        return wrapper
    return decorator

