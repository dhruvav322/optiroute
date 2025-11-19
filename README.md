# Optiroute — Supply Chain Optimization Platform

Optiroute is a comprehensive supply chain optimization platform that combines AI-powered demand forecasting, inventory optimization, and route planning. The FastAPI backend forecasts demand (Prophet or ARIMA), applies EOQ/ROP/Safety Stock formulas, optimizes delivery routes using OR-Tools with OSRM for real road distances, stores state in MongoDB, and exposes endpoints used by a React dashboard. The frontend features a **Linear/Vercel-style industrial aesthetic** with power user features, multi-page navigation, and real-time route visualization.

## ✨ Highlights
- **🎨 Industrial/Linear Aesthetic UI**: Deep blacks, high contrast borders, monospace fonts for data, electric accent colors, and micro-interactions
- **AI-Powered Forecasting**: Prophet-first demand model with ARIMA fallback, persisted to disk and metadata stored in MongoDB
- **Inventory Optimization**: EOQ, reorder point, and safety stock calculations with defensive handling for edge cases
- **Advanced Route Optimization**: TSP/VRP solvers with **real road distances via OSRM**, address geocoding, and dark mode map visualization
- **Power User Features**: Command Palette (Cmd+K), global keyboard shortcuts, page transitions, and optimistic UI updates
- **Multi-Tenancy**: JWT-based authentication with secure client isolation
- **Modern UI Stack**: React Router, Tailwind CSS, Framer Motion, React Leaflet, and Sonner toasts
- **Performance Optimized**: MongoDB indexes, LRU caching, GZip compression, and parallel API loading
- **MLOps Automation**: Background retraining, smart CSV column mapping, and experiment tracking
- **Containerized Stack**: Dockerfiles for backend/frontend and `docker-compose.yml` to spin up MongoDB + services
- **CI Ready**: GitHub Actions workflow exercising backend pytest, frontend lint, and vitest suites

## Repository layout
```
optiroute/
├─ backend/
│  ├─ app/
│  │  ├─ api/
│  │  │  ├─ endpoints.py
│  │  │  └─ auth.py          # JWT authentication
│  │  ├─ core/
│  │  │  ├─ config.py
│  │  │  ├─ security.py      # JWT token handling
│  │  │  ├─ db_indexes.py    # MongoDB performance indexes
│  │  │  └─ openapi_customization.py
│  │  ├─ services/
│  │  │  ├─ forecast.py
│  │  │  ├─ simulation.py
│  │  │  ├─ inventory.py
│  │  │  ├─ routing.py        # OSRM + OR-Tools integration
│  │  │  ├─ evaluation.py
│  │  │  ├─ features.py
│  │  │  └─ experiments.py
│  │  ├─ schemas.py
│  │  ├─ db.py
│  │  └─ tests/
│  ├─ requirements.txt
│  └─ Dockerfile
├─ frontend/
│  ├─ src/
│  │  ├─ App.jsx             # React Router setup
│  │  ├─ api/client.js       # API client with JWT
│  │  ├─ components/
│  │  │  ├─ ui/              # Linear-style UI components
│  │  │  ├─ DarkMap.jsx      # Dark mode map with geocoding
│  │  │  ├─ RouteOptimizer.jsx
│  │  │  ├─ NewDashboard.jsx
│  │  │  ├─ CommandMenu.jsx  # Cmd+K palette
│  │  │  ├─ GlobalHotkeys.jsx
│  │  │  ├─ PageTransition.jsx
│  │  │  └─ ...
│  │  ├─ pages/              # Multi-page structure
│  │  │  ├─ Overview.jsx
│  │  │  ├─ Planning.jsx
│  │  │  ├─ Forecast.jsx
│  │  │  ├─ Logistics.jsx
│  │  │  └─ Settings.jsx
│  │  ├─ layouts/
│  │  │  └─ DashboardLayout.jsx
│  │  ├─ utils/
│  │  │  └─ formatters.js    # Date formatting utilities
│  │  └─ index.css           # Tailwind + grid background
│  ├─ tailwind.config.js     # Linear color scheme
│  ├─ postcss.config.js
│  ├─ package.json
│  └─ Dockerfile
├─ scripts/
│  ├─ seed_data.py
│  ├─ sample_sales.csv
│  └─ fix_indexes.py
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

### 2. Frontend (React + Vite + Tailwind)
```bash
cd frontend
npm install
npm run dev
```
Vite serves the app on http://localhost:5173 with hot reloading. The frontend uses:
- **Tailwind CSS** for styling (Linear-style industrial aesthetic)
- **React Router** for multi-page navigation
- **React Leaflet** for dark mode maps
- **Framer Motion** for page transitions
- **CMDK** for command palette (Cmd+K)
- **Sonner** for toast notifications

Use `VITE_API_BASE_URL` environment variable if the backend isn't on the default port.

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

Optimize delivery routes (TSP example with authentication):
```bash
# First, get a JWT token
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_1", "client_id": "default"}' | jq -r '.access_token')

# Then optimize routes (returns to depot by default)
curl -X POST http://localhost:8000/api/v1/routes/optimize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "problem_type": "tsp",
    "locations": [
      {"id": "depot", "name": "Warehouse", "latitude": 37.7749, "longitude": -122.4194, "demand": 0},
      {"id": "loc1", "name": "Location 1", "latitude": 37.7849, "longitude": -122.4094, "demand": 50},
      {"id": "loc2", "name": "Location 2", "latitude": 37.7649, "longitude": -122.4294, "demand": 75}
    ],
    "depot_index": 0,
    "return_to_depot": true
  }'
```

**Note**: The API uses OSRM for real road distances (not straight-line). Falls back to Haversine if OSRM is unavailable.

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
6. **Route optimization**: Use the Route Optimizer panel to search addresses, add locations, configure vehicles (for VRP), and optimize delivery routes. View optimized routes with **real road distances** (OSRM) on dark mode maps with auto-centering.
7. **Forecast inspection**: Hit http://localhost:8000/docs to explore the OpenAPI schema and manually invoke endpoints.

## Environment variables
| Variable      | Service   | Default                 | Description                                     |
|---------------|-----------|-------------------------|-------------------------------------------------|
| `MONGO_URI`   | Backend   | `mongodb://mongo:27017` | MongoDB connection string                       |
| `MONGO_DB`    | Backend   | `optiroute`             | Database name                                   |
| `MODEL_PATH`  | Backend   | `models/model.pkl`      | Location of persisted forecast model            |
| `MODEL_DIR`   | Backend   | `models`                | Directory for model artifacts                   |
| `SECRET_KEY`  | Backend   | `insecure-secret`       | **Change this in production!** JWT signing key  |
| `VITE_API_BASE_URL` | Frontend | `http://localhost:8000`     | Base URL for API calls                           |
| `OSRM_URL`    | Backend   | `http://router.project-osrm.org` | OSRM routing service URL (optional)      |

## 🎯 Key Features

### 🎨 User Interface & Experience
- **Industrial/Linear Aesthetic**: Deep blacks, high contrast borders, monospace fonts for data
- **Command Palette (Cmd+K)**: Quick navigation and actions
- **Global Keyboard Shortcuts**: Power user navigation (e.g., `G+H` for Home, `G+L` for Logistics)
- **Page Transitions**: Smooth cross-fade animations between pages
- **Dark Mode Maps**: CartoDB Dark Matter tiles with route visualization
- **Address Geocoding**: Search addresses using OpenStreetMap Nominatim API
- **Skeleton Loaders**: Perceived performance improvements
- **Export Data**: CSV export for forecasts and inventory summaries

### 🤖 AI & Machine Learning
- **AI-Powered Forecasting**: Prophet and ARIMA models for accurate demand prediction
- **Feature Analysis**: Seasonality decomposition, outlier detection, and feature importance
- **Model Evaluation**: Comparative metrics and diagnostics
- **Experiment Tracking**: Log and compare model versions
- **Smart CSV Mapping**: Automatic column detection with manual override

### 📦 Inventory Optimization
- **EOQ Calculations**: Economic Order Quantity optimization
- **Reorder Point**: Automated reorder trigger calculations
- **Safety Stock**: Service level-based safety stock optimization
- **Cost Analysis**: Comprehensive cost breakdown (ordering, holding, purchase)
- **Real-time Simulation**: Adjust parameters and see instant results

### 🗺️ Route Optimization
- **Real Road Distances**: OSRM integration for accurate driving distances (not crow flies)
- **TSP Solver**: Single vehicle optimal route for all locations
- **VRP Solver**: Multi-vehicle routing with capacity constraints
- **Return to Depot**: Optional return to starting point
- **Route Visualization**: Dark mode map with neon route lines
- **Interactive Location Management**: Add, remove, and search addresses

### 🔒 Security & Multi-Tenancy
- **JWT Authentication**: Secure token-based authentication
- **Multi-Tenant Isolation**: Client data separation via JWT claims
- **Rate Limiting**: API protection against abuse
- **Input Validation**: Pydantic schemas for all endpoints
- **File Upload Security**: Sanitized filename handling

### ⚡ Performance
- **MongoDB Indexes**: Optimized queries with compound indexes
- **LRU Caching**: Function-level caching for routing calculations
- **GZip Compression**: Compressed JSON responses
- **Parallel API Loading**: `Promise.allSettled` for faster initial load
- **Optimistic UI**: Instant feedback for user actions

## 🚀 Power User Features

### Keyboard Shortcuts
- `Cmd/Ctrl + K`: Open command palette
- `G + H`: Navigate to Home/Overview
- `G + P`: Navigate to Planning
- `G + F`: Navigate to Forecast/Intelligence
- `G + L`: Navigate to Logistics
- `G + S`: Navigate to Settings
- `Ctrl + R`: Run simulation (when on Planning page)

### Command Palette (Cmd+K)
Quick access to:
- Navigation to all pages
- Run simulation
- Optimize routes
- Other common actions

### Multi-Page Navigation
- **Overview**: Main dashboard with KPIs and forecast visualization
- **Planning & Simulation**: Interactive sliders for cost/risk trade-offs
- **Intelligence**: Deep ML insights, model evaluation, feature analysis
- **Logistics**: Route optimizer with dark mode map
- **MLOps & Data**: Upload CSV, retrain models, view experiment history

### Export & Data Management
- **CSV Export**: Download forecasts or inventory summaries
- **Smart Column Mapping**: Automatically detect or manually map CSV columns
- **Drag & Drop Upload**: Easy CSV file uploads
- **Experiment History**: Track and compare model versions

## Tech Stack

### Frontend
- **React 18** with Vite
- **React Router DOM** for multi-page navigation
- **Tailwind CSS** for styling (Linear aesthetic)
- **Framer Motion** for animations and transitions
- **React Leaflet** for map visualization
- **Recharts** for data visualization
- **CMDK** for command palette
- **Sonner** for toast notifications
- **React Hotkeys Hook** for keyboard shortcuts
- **NProgress** for route progress indicators

### Backend
- **FastAPI** with async/await
- **Pydantic** for validation
- **Motor** (async MongoDB driver)
- **Prophet/ARIMA** for forecasting
- **OR-Tools** for TSP/VRP optimization
- **OSRM** for real road distances (optional)
- **JWT** (python-jose) for authentication
- **Redis** (optional) for caching

### Database & Infrastructure
- **MongoDB** for data storage
- **Docker** for containerization
- **GitHub Actions** for CI/CD

## Notes & Future Enhancements
- ✅ JWT authentication implemented (change `SECRET_KEY` in production!)
- ✅ Real road distances via OSRM integration
- ✅ Dark mode maps with geocoding
- ✅ Export functionality for forecasts and inventory
- ✅ Multi-tenancy with secure client isolation
- ⏳ Real-time traffic data integration for route optimization
- ⏳ WebSocket support for live retraining progress updates
- ⏳ Multi-echelon inventory modeling
- ⏳ Advanced analytics dashboard

## License
MIT — modify as desired for your organization.
