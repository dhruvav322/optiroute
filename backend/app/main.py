from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from .api.endpoints import router as api_router
from .core.rate_limit import RateLimitMiddleware
from .core.config import get_settings
from .core.logging_config import setup_logging
from .core.middleware import RequestLoggingMiddleware

# Configure logging
setup_logging()
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    
    app = FastAPI(
        title="Optiroute — Supply Chain Optimization",
        description=(
            "AI-powered supply chain optimization platform providing demand forecasts, "
            "inventory optimization, route planning, and MLOps utilities."
        ),
        version="0.2.0",
    )

    # Security: Configure CORS (hardened)
    allowed_origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
    ]
    
    # Add production origins from environment if set
    if hasattr(settings, 'allowed_origins'):
        allowed_origins.extend(settings.allowed_origins.split(',') if settings.allowed_origins else [])
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],  # Allow all methods for easier setup
        allow_headers=["*"],  # Allow all headers for easier setup
        expose_headers=["*"],
    )

    # Security: Add rate limiting (optional - can disable for local dev)
    # Uncomment for production or if you want rate limiting
    # app.add_middleware(RateLimitMiddleware, requests_per_minute=60)

    # Monitoring: Add request logging middleware
    app.add_middleware(RequestLoggingMiddleware)

    # Security: Global exception handler to prevent information leakage
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        # Log full error details (not exposed to user)
        logger.error(
            f"Unhandled exception: {type(exc).__name__} | "
            f"Path: {request.url.path} | "
            f"Method: {request.method} | "
            f"Error: {str(exc)}",
            exc_info=True
        )
        
        # Return sanitized error message
        error_id = id(exc)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "An internal error occurred. Please try again later.",
                "error_id": str(error_id)[:8]  # Shortened for user
            }
        )
    
    # Security: Handle validation errors
    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        logger.warning(f"Validation error: {exc} | Path: {request.url.path}")
        return JSONResponse(
            status_code=400,
            content={"detail": str(exc)}
        )

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint for monitoring."""
        try:
            # Check MongoDB connection
            from .db import get_mongo
            db = get_mongo().db
            db.admin.command('ping')
            db_status = "connected"
        except Exception:
            db_status = "disconnected"
        
        return {
            "status": "healthy",
            "service": "optiroute",
            "database": db_status,
            "version": "0.2.0"
        }

    # Include router (with optional prefix for versioning)
    app.include_router(api_router)

    return app


app = create_app()
