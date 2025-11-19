"""Security utilities for authentication, authorization, and validation."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from .config import get_settings

security = HTTPBearer()


class TokenData(BaseModel):
    """Token payload structure."""
    user_id: str
    client_id: str
    scopes: list[str] = []


def create_access_token(
    user_id: str,
    client_id: str,
    scopes: list[str] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Create JWT access token."""
    settings = get_settings()
    if expires_delta is None:
        expires_delta = timedelta(hours=24)
    
    expire = datetime.utcnow() + expires_delta
    
    to_encode = {
        "sub": user_id,
        "client_id": client_id,
        "scopes": scopes or [],
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm="HS256"
    )
    return encoded_jwt


def verify_token(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> TokenData:
    """Verify and decode JWT token."""
    settings = get_settings()
    
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.secret_key,
            algorithms=["HS256"]
        )
        user_id: str = payload.get("sub")
        client_id: str = payload.get("client_id", "default")
        scopes: list[str] = payload.get("scopes", [])
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return TokenData(user_id=user_id, client_id=client_id, scopes=scopes)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_scope(required_scope: str):
    """Dependency to require specific scope."""
    def scope_checker(token_data: TokenData = Depends(verify_token)) -> TokenData:
        if required_scope not in token_data.scopes and "admin" not in token_data.scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required scope: {required_scope}",
            )
        return token_data
    return scope_checker


def generate_api_key() -> str:
    """Generate a secure API key."""
    return secrets.token_urlsafe(32)


def hash_api_key(api_key: str) -> str:
    """Hash API key for storage."""
    settings = get_settings()
    return hmac.new(
        settings.secret_key.encode(),
        api_key.encode(),
        hashlib.sha256
    ).hexdigest()


def verify_api_key(api_key: str, hashed_key: str) -> bool:
    """Verify API key against hash."""
    return hmac.compare_digest(hash_api_key(api_key), hashed_key)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> TokenData:
    """Dependency to get current authenticated user from JWT token.
    
    Extracts client_id from token - this is the secure way to identify users.
    Never trust client_id from request body/query params.
    """
    return verify_token(credentials)


# Optional: For development/testing - allows bypassing auth
def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(HTTPBearer(auto_error=False))
) -> Optional[TokenData]:
    """Optional authentication for development.
    
    Returns None if no token provided. Use this only for development/testing.
    """
    if credentials is None:
        return None
    try:
        return verify_token(credentials)
    except HTTPException:
        return None

