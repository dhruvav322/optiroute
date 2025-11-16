"""Experiment tracking utilities for forecasting models."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from bson import ObjectId
from fastapi import HTTPException, status


@dataclass
class ExperimentTrackerConfig:
    collection_name: str = "experiments"
    default_sort_metric: str = "rmse"
    history_limit: int = 100


class ExperimentTracker:
    def __init__(self, db, config: ExperimentTrackerConfig | None = None) -> None:
        self.db = db
        self.config = config or ExperimentTrackerConfig()
        self.collection = self.db[self.config.collection_name]

    def log_experiment(self, payload: Dict[str, Any]) -> str:
        created_at = payload.get("created_at", datetime.utcnow())
        if created_at is None:
            created_at = datetime.utcnow()
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at)
            except ValueError as exc:  # noqa: BLE001
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="created_at must be ISO formatted",
                ) from exc

        document = {
            **payload,
            "created_at": created_at,
        }
        if "_id" in document:
            document.pop("_id")
        result = self.collection.insert_one(document)
        return str(result.inserted_id)

    def history(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        limit = limit or self.config.history_limit
        cursor = (
            self.collection.find().sort("created_at", -1).limit(max(1, limit))
        )
        return [self._serialize(doc) for doc in cursor]

    def compare(self, ids: Iterable[str]) -> List[Dict[str, Any]]:
        object_ids = self._parse_object_ids(ids)
        if not object_ids:
            return []
        cursor = self.collection.find({"_id": {"$in": object_ids}})
        documents = [self._serialize(doc) for doc in cursor]
        if len(documents) != len(object_ids):
            missing = set(object_ids) - {
                ObjectId(doc["id"]) for doc in documents if "id" in doc
            }
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Experiments not found for IDs: {', '.join(str(item) for item in missing)}",
            )
        return documents

    def best(self, metric: Optional[str] = None) -> Optional[Dict[str, Any]]:
        metric = metric or self.config.default_sort_metric
        cursor = self.collection.find().sort(
            [(f"metrics.validation.{metric}", 1), (f"metrics.train.{metric}", 1)]
        )
        doc = next(cursor, None)
        return self._serialize(doc) if doc else None

    def _serialize(self, document: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not document:
            return None
        doc = document.copy()
        doc["id"] = str(doc.pop("_id"))
        created_at = doc.get("created_at")
        if isinstance(created_at, datetime):
            doc["created_at"] = created_at.isoformat()
        return doc

    @staticmethod
    def _parse_object_ids(ids: Iterable[str]) -> List[ObjectId]:
        object_ids: List[ObjectId] = []
        for value in ids:
            try:
                object_ids.append(ObjectId(value))
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid experiment id: {value}",
                ) from exc
        return object_ids
