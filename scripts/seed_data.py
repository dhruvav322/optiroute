"""Seed MongoDB with synthetic historical sales data for Optiroute."""

from __future__ import annotations

import argparse
import os
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from pymongo import MongoClient

DEFAULT_DAYS = 730
RNG = np.random.default_rng()


def generate_series(days: int, start_date: datetime | None = None) -> pd.DataFrame:
    start = start_date or (datetime.utcnow() - timedelta(days=days))
    dates = pd.date_range(start=start, periods=days, freq="D")

    trend = np.linspace(50, 80, num=days)
    seasonal_weekly = 10 * np.sin(2 * np.pi * dates.dayofweek / 7)
    seasonal_yearly = 15 * np.sin(2 * np.pi * dates.dayofyear / 365)
    noise = RNG.normal(0, 5, size=days)

    demand = np.maximum(trend + seasonal_weekly + seasonal_yearly + noise, 1)
    df = pd.DataFrame({"date": dates, "quantity": demand.round().astype(int)})
    return df


def seed_database(uri: str, database: str, collection: str, frame: pd.DataFrame) -> int:
    client = MongoClient(uri)
    coll = client[database][collection]
    docs = [
        {
            "date": row.date.to_pydatetime(),
            "quantity": int(row.quantity),
            "source_file": "seed_script",
            "uploaded_at": datetime.utcnow(),
        }
        for row in frame.itertuples(index=False)
    ]
    if docs:
        coll.delete_many({"source_file": "seed_script"})
        coll.insert_many(docs)
    return len(docs)


def write_csv(path: str, frame: pd.DataFrame) -> None:
    frame.to_csv(path, index=False, date_format="%Y-%m-%d")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed MongoDB with synthetic demand data")
    parser.add_argument("--mongo-uri", default=os.getenv("MONGO_URI", "mongodb://localhost:27017"))
    parser.add_argument("--database", default=os.getenv("MONGO_DB", "optiroute"))
    parser.add_argument("--collection", default="historical_sales")
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS)
    parser.add_argument("--csv", type=str, help="Optional path to also write the generated CSV")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    frame = generate_series(args.days)
    inserted = seed_database(args.mongo_uri, args.database, args.collection, frame)
    if args.csv:
        write_csv(args.csv, frame)
    print(f"Inserted {inserted} historical_sales records")
    if args.csv:
        print(f"CSV written to {args.csv}")


if __name__ == "__main__":
    main()
