"""Comprehensive logging and monitoring configuration."""

from __future__ import annotations

import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from .config import get_settings


class RequestLogger:
    """Middleware logger for API requests."""
    
    def __init__(self):
        self.logger = logging.getLogger("api.requests")
    
    def log_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        client_ip: str | None = None,
        user_id: str | None = None,
    ) -> None:
        """Log API request details."""
        self.logger.info(
            f"{method} {path} | Status: {status_code} | "
            f"Duration: {duration_ms:.2f}ms | "
            f"IP: {client_ip or 'unknown'} | "
            f"User: {user_id or 'anonymous'}"
        )
    
    def log_error(
        self,
        method: str,
        path: str,
        error: Exception,
        client_ip: str | None = None,
    ) -> None:
        """Log API errors."""
        self.logger.error(
            f"{method} {path} | Error: {type(error).__name__} | "
            f"IP: {client_ip or 'unknown'}",
            exc_info=True
        )


class PerformanceLogger:
    """Logger for performance metrics."""
    
    def __init__(self):
        self.logger = logging.getLogger("performance")
    
    def log_forecast_time(self, duration_ms: float, days: int) -> None:
        """Log forecast generation time."""
        self.logger.info(f"Forecast generated | Days: {days} | Duration: {duration_ms:.2f}ms")
    
    def log_route_optimization_time(
        self,
        duration_ms: float,
        problem_type: str,
        locations: int,
    ) -> None:
        """Log route optimization time."""
        self.logger.info(
            f"Route optimized | Type: {problem_type} | "
            f"Locations: {locations} | Duration: {duration_ms:.2f}ms"
        )
    
    def log_model_training_time(self, duration_ms: float, model_type: str) -> None:
        """Log model training time."""
        self.logger.info(f"Model trained | Type: {model_type} | Duration: {duration_ms:.2f}ms")


class SecurityLogger:
    """Logger for security events."""
    
    def __init__(self):
        self.logger = logging.getLogger("security")
    
    def log_auth_failure(self, reason: str, client_ip: str | None = None) -> None:
        """Log authentication failures."""
        self.logger.warning(
            f"Authentication failed | Reason: {reason} | IP: {client_ip or 'unknown'}"
        )
    
    def log_rate_limit_exceeded(self, client_ip: str | None = None) -> None:
        """Log rate limit violations."""
        self.logger.warning(f"Rate limit exceeded | IP: {client_ip or 'unknown'}")
    
    def log_suspicious_activity(
        self,
        activity: str,
        client_ip: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Log suspicious activities."""
        details_str = f" | Details: {details}" if details else ""
        self.logger.warning(
            f"Suspicious activity detected | Activity: {activity} | "
            f"IP: {client_ip or 'unknown'}{details_str}"
        )


def setup_logging(log_level: str = "INFO", log_file: Path | None = None) -> None:
    """Configure application-wide logging."""
    settings = get_settings()
    
    # Create logs directory if needed
    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Console handler with formatting
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_format = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    console_handler.setFormatter(console_format)
    root_logger.addHandler(console_handler)
    
    # File handler (if specified)
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.DEBUG)
        file_format = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        file_handler.setFormatter(file_format)
        root_logger.addHandler(file_handler)
    
    # Suppress noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)


# Global logger instances
request_logger = RequestLogger()
performance_logger = PerformanceLogger()
security_logger = SecurityLogger()

