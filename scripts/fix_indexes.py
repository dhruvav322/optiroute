"""Create database indexes for optimal multi-tenant query performance.

This script creates indexes on client_id fields to ensure fast filtering
when querying data for specific users. Without these indexes, MongoDB will
perform collection scans which are extremely slow on large datasets.
"""

from pymongo import MongoClient, ASCENDING, DESCENDING, IndexModel
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get MongoDB URI from environment or use default
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "optiroute")


def fix_indexes():
    """Create all necessary indexes for multi-tenant queries."""
    print("🔌 Connecting to MongoDB...")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    print("⚡ Creating 'client_id' indexes for multi-tenant performance...")
    print()
    
    # 1. Historical Sales (The big one - most frequently queried)
    # Compound index: First filter by client, then sort by date (FASTEST)
    try:
        db.historical_sales.create_index(
            [("client_id", ASCENDING), ("date", ASCENDING)],
            name="client_id_date_idx",
            background=False  # Foreground to force it to finish now
        )
        print("✅ historical_sales index created: (client_id, date)")
    except Exception as e:
        if "already exists" in str(e).lower() or "IndexOptionsConflict" in str(e):
            print("✅ historical_sales index already exists")
        else:
            print(f"⚠️  historical_sales index: {e}")
    
    # Also create a single index on client_id for queries that don't sort by date
    try:
        db.historical_sales.create_index(
            [("client_id", ASCENDING)],
            name="client_id_idx",
            background=False
        )
        print("✅ historical_sales single index created: (client_id)")
    except Exception as e:
        print(f"⚠️  historical_sales single index: {e}")

    # 2. Model Parameters (For retrieving latest model for a client)
    try:
        db.model_parameters.create_index(
            [("client_id", ASCENDING), ("trained_at", DESCENDING)],
            name="client_id_trained_at_idx",
            background=False
        )
        print("✅ model_parameters index created: (client_id, trained_at)")
    except Exception as e:
        print(f"⚠️  model_parameters index: {e}")

    # 3. Experiments (For listing and comparing experiments per client)
    try:
        db.experiments.create_index(
            [("client_id", ASCENDING), ("created_at", DESCENDING)],
            name="client_id_created_at_idx",
            background=False
        )
        print("✅ experiments index created: (client_id, created_at)")
    except Exception as e:
        if "already exists" in str(e).lower() or "IndexOptionsConflict" in str(e):
            print("✅ experiments index already exists")
        else:
            print(f"⚠️  experiments index: {e}")

    # 4. Feature Analysis (For retrieving feature insights per client)
    try:
        db.feature_analysis.create_index(
            [("client_id", ASCENDING)],
            name="client_id_idx",
            background=False
        )
        print("✅ feature_analysis index created: (client_id)")
    except Exception as e:
        print(f"⚠️  feature_analysis index: {e}")
    
    # 5. Simulation Parameters (For retrieving latest simulation per client)
    try:
        db.simulation_parameters.create_index(
            [("client_id", ASCENDING), ("saved_at", DESCENDING)],
            name="client_id_saved_at_idx",
            background=False
        )
        print("✅ simulation_parameters index created: (client_id, saved_at)")
    except Exception as e:
        if "already exists" in str(e).lower() or "IndexOptionsConflict" in str(e):
            print("✅ simulation_parameters index already exists")
        else:
            print(f"⚠️  simulation_parameters index: {e}")
    
    # 6. Inventory State (For retrieving current stock per client)
    try:
        db.inventory_state.create_index(
            [("client_id", ASCENDING), ("updated_at", DESCENDING)],
            name="client_id_updated_at_idx",
            background=False
        )
        print("✅ inventory_state index created: (client_id, updated_at)")
    except Exception as e:
        if "already exists" in str(e).lower() or "IndexOptionsConflict" in str(e):
            print("✅ inventory_state index already exists")
        else:
            print(f"⚠️  inventory_state index: {e}")
    
    print()
    print("🚀 All indexes created! Your dashboard should be fast now.")
    print()
    print("💡 Tip: Indexes are automatically maintained by MongoDB.")
    print("   They make queries instant but slightly slow down writes.")
    print("   For multi-tenant apps, this is the correct trade-off.")


if __name__ == "__main__":
    try:
        fix_indexes()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nMake sure MongoDB is running and accessible at:", MONGO_URI)
        exit(1)

