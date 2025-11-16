from pymongo import MongoClient
from pymongo.database import Database

from .core.config import get_settings
from .core.db_indexes import create_indexes

class MongoDB:
    def __init__(self, uri: str, db_name: str) -> None:
        try:
            self._client = MongoClient(uri, serverSelectionTimeoutMS=5000)
            # Test connection
            self._client.admin.command('ping')
            self._db = self._client[db_name]
            # Create indexes on first connection (non-blocking)
            try:
                create_indexes(self._db)
            except Exception:
                pass  # Indexes will be created when needed
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"MongoDB connection issue: {e}. Will retry on first use.")
            self._client = MongoClient(uri)
            self._db = self._client[db_name]

    @property
    def client(self) -> MongoClient:
        return self._client

    @property
    def db(self) -> Database:
        return self._db

def get_mongo() -> MongoDB:
    settings = get_settings()
    return MongoDB(str(settings.mongo_uri), settings.mongo_db)
