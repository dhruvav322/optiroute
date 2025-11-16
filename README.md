# Optiroute — Supply Chain Optimization Platform

Optiroute is a comprehensive supply chain optimization platform that combines AI-powered demand forecasting, inventory optimization, and route planning. The FastAPI backend forecasts demand (Prophet or ARIMA), applies EOQ/ROP/Safety Stock formulas, optimizes delivery routes using OR-Tools, stores state in MongoDB, and exposes endpoints used by a React dashboard. The frontend lets planners run real-time "what-if" experiments, visualize costs, optimize routes, and manage MLOps tasks such as data uploads and retraining.

## Highlights
- **AI-Powered Forecasting**: Prophet-first demand model with ARIMA fallback, persisted to disk and metadata stored in MongoDB.
- **Inventory Optimization**: EOQ, reorder point, and safety stock calculations with defensive handling for edge cases.
- **Route Optimization**: Vehicle Routing Problem (VRP) and Traveling Salesman Problem (TSP) solvers using Google OR-Tools for optimal delivery routes.
- **Interactive UI**: React + Vite dashboard with live sliders, cost breakdown charts, KPI cards, route visualizations, and an MLOps control center.
- **MLOps automation**: Background retraining triggered via API, synthetic seed data, and CSV ingestion pipeline.
- **Containerized stack**: Dockerfiles for backend/frontend and `docker-compose.yml` to spin up MongoDB + services.
- **CI ready**: GitHub Actions workflow exercising backend pytest, frontend lint, and vitest suites.

## Repository layout
```
optiroute/
├─ backend/
│  ├─ app/
│  │  ├─ api/endpoints.py
│  │  ├─ core/config.py
│  │  ├─ services/{forecast,simulation,inventory,routing}.py
│  │  ├─ schemas.py
│  │  ├─ db.py
│  │  └─ tests/
│  ├─ requirements.txt
│  └─ Dockerfile
├─ frontend/
│  ├─ src/{App.jsx, components/, api/}
│  ├─ package.json
│  └─ Dockerfile
├─ scripts/
│  ├─ seed_data.py
│  └─ sample_sales.csv
├─ docker-compose.yml
├─ .github/workflows/ci.yml
└─ README.md
```

## Prerequisites
- Python 3.11+
- Node.js 20+
- MongoDB 7.x (local or via Docker)
- (Optional) Redis for distributed caching
- (Optional) `bottleneck>=1.3.6` to silence pandas performance warnings.

## Quick Start

**Easiest way to get started (recommended):**

```bash
# On macOS/Linux:
./start.sh

# On Windows:
start.bat

# Or using Docker:
docker compose up --build
```

The script will:
- ✅ Check prerequisites
- ✅ Set up virtual environment
- ✅ Install dependencies
- ✅ Start MongoDB (if needed)
- ✅ Start backend and frontend

**Access the app at http://localhost:5173**

### First Time Setup

1. **Upload Data**: Use the MLOps Panel to upload a CSV file with `date,quantity` columns
   - Sample file included: `sample_sales_data.csv`
   - Minimum 60 rows recommended
   - See [CSV_FORMAT.md](CSV_FORMAT.md) for details

2. **Train Model**: Click "Retrain Forecast Model" in the MLOps Panel
   - Wait ~30 seconds for training to complete
   - ARIMA will be used if Prophet has issues (this is normal)

3. **Start Using**: 
   - View forecasts in the dashboard
   - Run simulations with the Simulation Cockpit
   - Optimize routes with the Route Optimizer

For detailed setup, see [QUICK_START.md](QUICK_START.md)

## Local development

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Server runs at http://localhost:8000 with automatic OpenAPI docs.

### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Vite serves the app on http://localhost:5173 with hot reloading. Use `VITE_API_BASE_URL` environment variable if the backend isn’t on the default port.

### 3. MongoDB seed data
```bash
cd ..
python scripts/seed_data.py --days 730 --csv scripts/sample_sales.csv
```
This generates synthetic daily demand, stores it in Mongo, and exports the same CSV for upload demos.

## Running the full stack with Docker Compose
```bash
docker compose up --build
```
- Backend: http://localhost:8000
- Frontend: http://localhost:5173 (served from the built assets via `npm run preview`)
- MongoDB: localhost:27017
Volumes persist trained models and uploads (`backend-models`, `backend-uploads`).

## Quick Start Tutorial
1. **Seed sample data**
   ```bash
   python scripts/seed_data.py --days 730 --csv scripts/sample_sales.csv
   ```
2. **Retrain the forecasting model**
   ```bash
   curl -X POST http://localhost:8000/model/retrain \
     -H "Content-Type: application/json" \
     -d '{"train_from_uploaded_data": true}'
   ```
3. **Explore the dashboard** – `npm run dev` in `frontend/`, open the URL printed in the console.
   - Dashboard KPIs update from `/inventory/summary`.
   - Simulation sliders post to `/simulation/run` for instant EOQ/ROP adjustments.
   - Route Optimizer lets you solve TSP/VRP problems with interactive location management.
   - Model evaluation + feature insights panels explain forecast behaviour.
   - Impact calculator ties optimised policy to ROI.

## API Examples
Perform a current forecast (7-day horizon):
```bash
curl "http://localhost:8000/forecast/current?days=7"
```

Compare experiment runs:
```bash
curl "http://localhost:8000/experiments/history?limit=5"
```

Estimate business impact:
```bash
curl -X POST http://localhost:8000/analysis/business-impact \
  -H "Content-Type: application/json" \
  -d @scripts/sample_impact_payload.json
```

Optimize delivery routes (TSP example):
```bash
curl -X POST http://localhost:8000/routes/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "problem_type": "tsp",
    "locations": [
      {"id": "depot", "name": "Warehouse", "latitude": 37.7749, "longitude": -122.4194, "demand": 0},
      {"id": "loc1", "name": "Location 1", "latitude": 37.7849, "longitude": -122.4094, "demand": 50},
      {"id": "loc2", "name": "Location 2", "latitude": 37.7649, "longitude": -122.4294, "demand": 75}
    ],
    "depot_index": 0
  }'
```

Additional architecture notes live in [`docs/technical-deepdive.md`](docs/technical-deepdive.md). The full modelling notebook is under [`notebooks/model-development.ipynb`](notebooks/model-development.ipynb).

## Testing & linting
```bash
# Backend
cd backend
pytest

# Frontend
dcd frontend
npm run lint
npm run test -- --run
```
Continuous integration runs these commands automatically via `.github/workflows/ci.yml`.

## Demo walkthrough
1. **Load dashboard**: Start both services (local or Docker). Visit http://localhost:5173 and view KPI cards populated from `/inventory/summary` and `/forecast/current`.
2. **What-if simulation**: Move sliders in the Simulation Cockpit (Order Cost, Holding Cost, Lead Time, Service Level). The UI debounces requests, calls `/simulation/run`, and updates KPIs/Chart instantly.
3. **Cost analysis**: Review the cost breakdown chart showing ordering, holding, and purchase cost components along with total projected cost.
4. **Upload new history**: In MLOps Control Center, upload `scripts/sample_sales.csv` (or your own CSV with `date,quantity`). The backend stores the file, ingests data, and the dashboard confirms success.
5. **Retrain model**: Click “Retrain Forecast Model”. A toast confirms background training; the frontend polls `/model/status` to display the latest metrics when ready.
6. **Route optimization**: Use the Route Optimizer panel to add locations, configure vehicles (for VRP), and optimize delivery routes. View optimized routes with distance metrics and Google Maps integration.
7. **Forecast inspection**: Hit http://localhost:8000/docs to explore the OpenAPI schema and manually invoke endpoints.

## Environment variables
| Variable      | Service   | Default                 | Description                                     |
|---------------|-----------|-------------------------|-------------------------------------------------|
| `MONGO_URI`   | Backend   | `mongodb://mongo:27017` | MongoDB connection string                       |
| `MONGO_DB`    | Backend   | `optiroute`             | Database name                                   |
| `MODEL_PATH`  | Backend   | `models/model.pkl`      | Location of persisted forecast model            |
| `MODEL_DIR`   | Backend   | `models`                | Directory for model artifacts                   |
| `SECRET_KEY`  | Backend   | `insecure-secret`       | Placeholder secret for future auth              |
| `VITE_API_BASE_URL` | Frontend | `http://localhost:8000`     | Base URL for API calls                           |

## 🎯 Key Features

- **AI-Powered Forecasting**: Prophet and ARIMA models for accurate demand prediction
- **Inventory Optimization**: EOQ, Reorder Point, and Safety Stock calculations
- **Route Optimization**: TSP and VRP algorithms for efficient delivery planning
- **Interactive Dashboard**: Real-time KPIs, charts, and visualizations
- **MLOps Panel**: Easy data upload and model retraining
- **Feature Analysis**: Seasonality decomposition, outlier detection, and feature importance
- **Model Evaluation**: Comparative metrics and diagnostics
- **Business Impact**: Cost analysis and policy optimization

## Features Overview

### Inventory Intelligence
- **Demand Forecasting**: ML-powered time series forecasting with Prophet/ARIMA
- **EOQ Optimization**: Economic Order Quantity calculations
- **Safety Stock**: Service level-based safety stock optimization
- **Cost Analysis**: Comprehensive cost breakdown (ordering, holding, purchase)

### Route Optimization
- **TSP Solver**: Single vehicle optimal route for all locations
- **VRP Solver**: Multi-vehicle routing with capacity constraints
- **Distance Calculation**: Haversine formula for accurate geographic distances
- **Route Visualization**: Google Maps integration for route viewing

### MLOps & Analytics
- **Model Retraining**: Background model training with outlier handling
- **Experiment Tracking**: Log and compare model versions
- **Feature Analysis**: Seasonality decomposition and feature importance
- **Business Impact**: ROI calculations for optimized policies

## Notes & future enhancements
- Upgrade `bottleneck` to remove pandas warnings (`pip install --upgrade bottleneck`).
- Consider enabling authentication for sensitive endpoints (nice-to-have mentioned in the brief).
- Extend websocket/WebPush support for retraining progress updates.
- Add real-time traffic data integration for route optimization.
- Implement multi-echelon inventory modeling.

## License
MIT — modify as desired for your organization.
