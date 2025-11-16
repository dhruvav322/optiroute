"""API key management for external integrations."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from pymongo.database import Database

from .config import get_settings
from .security import hash_api_key, verify_api_key

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


class APIKeyManager:
    """Manage API keys for external integrations."""
    
    def __init__(self, db: Database):
        self.db = db
        self.collection = db.api_keys
    
    def create_api_key(
        self,
        name: str,
        client_id: str,
        expires_days: Optional[int] = None,
        scopes: list[str] | None = None,
    ) -> dict:
        """Create a new API key."""
        from .security import generate_api_key
        
        api_key = generate_api_key()
        hashed_key = hash_api_key(api_key)
        
        expires_at = None
        if expires_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_days)
        
        key_doc = {
            "name": name,
            "client_id": client_id,
            "hashed_key": hashed_key,
            "scopes": scopes or [],
            "created_at": datetime.utcnow(),
            "expires_at": expires_at,
            "is_active": True,
            "last_used": None,
        }
        
        result = self.collection.insert_one(key_doc)
        
        # Return the plain API key (only shown once)
        return {
            "id": str(result.inserted_id),
            "api_key": api_key,  # Only returned on creation
            "name": name,
            "client_id": client_id,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "scopes": scopes or [],
        }
    
    def verify_api_key(self, api_key: str) -> Optional[dict]:
        """Verify an API key and return key metadata."""
        # Get all active API keys for this client
        keys = list(self.collection.find({"is_active": True}))
        
        for key_doc in keys:
            if verify_api_key(api_key, key_doc["hashed_key"]):
                # Check expiration
                if key_doc.get("expires_at") and key_doc["expires_at"] < datetime.utcnow():
                    continue
                
                # Update last used
                self.collection.update_one(
                    {"_id": key_doc["_id"]},
                    {"$set": {"last_used": datetime.utcnow()}}
                )
                
                return {
                    "client_id": key_doc["client_id"],
                    "scopes": key_doc.get("scopes", []),
                    "name": key_doc.get("name"),
                }
        
        return None
    
    def revoke_api_key(self, key_id: str, client_id: str) -> bool:
        """Revoke an API key."""
        result = self.collection.update_one(
            {"_id": key_id, "client_id": client_id},
            {"$set": {"is_active": False}}
        )
        return result.modified_count > 0
    
    def list_api_keys(self, client_id: str) -> list[dict]:
        """List all API keys for a client."""
        keys = list(
            self.collection.find(
                {"client_id": client_id},
                {"hashed_key": 0}  # Don't return hashed keys
            ).sort("created_at", -1)
        )
        
        return [
            {
                "id": str(k["_id"]),
                "name": k.get("name"),
                "scopes": k.get("scopes", []),
                "created_at": k["created_at"].isoformat(),
                "expires_at": k.get("expires_at").isoformat() if k.get("expires_at") else None,
                "is_active": k.get("is_active", True),
                "last_used": k.get("last_used").isoformat() if k.get("last_used") else None,
            }
            for k in keys
        ]


def get_api_key_manager(db: Database = None) -> APIKeyManager:
    """Get API key manager instance."""
    from ..db import get_mongo
    if db is None:
        db = get_mongo().db
    return APIKeyManager(db)


async def verify_api_key_dependency(
    api_key: Optional[str] = Security(api_key_header),
    db: Database = None,
) -> dict:
    """Dependency to verify API key from header."""
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required. Provide X-API-Key header.",
        )
    
    manager = get_api_key_manager(db)
    key_data = manager.verify_api_key(api_key)
    
    if not key_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key.",
        )
    
    return key_data

