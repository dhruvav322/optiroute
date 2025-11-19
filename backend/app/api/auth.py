"""Authentication endpoints for user login and token generation."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..core.security import create_access_token, get_current_user, TokenData
from ..core.config import get_settings

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    """Login request with user credentials."""
    user_id: str
    client_id: str  # For development - in production, derive from user_id
    password: Optional[str] = None  # Optional for development


class LoginResponse(BaseModel):
    """Login response with access token."""
    access_token: str
    token_type: str = "bearer"
    user_id: str
    client_id: str
    expires_in: int = 86400  # 24 hours in seconds


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate user and get access token",
    status_code=status.HTTP_200_OK,
)
def login(request: LoginRequest) -> LoginResponse:
    """Authenticate user and return JWT token.
    
    For development/testing: Accepts user_id and client_id directly.
    In production, this should validate credentials against a user database.
    """
    # For development: Simple token generation
    # In production, validate credentials here:
    # - Check user exists in database
    # - Verify password hash
    # - Derive client_id from user_id or user's organization
    
    if not request.user_id or not request.client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id and client_id are required",
        )
    
    # Generate JWT token with user_id and client_id
    access_token = create_access_token(
        user_id=request.user_id,
        client_id=request.client_id,
        scopes=[],
    )
    
    return LoginResponse(
        access_token=access_token,
        user_id=request.user_id,
        client_id=request.client_id,
    )


@router.get(
    "/me",
    response_model=TokenData,
    summary="Get current authenticated user info",
)
def get_current_user_info(
    current_user: TokenData = Depends(get_current_user),
) -> TokenData:
    """Get information about the currently authenticated user."""
    return current_user

