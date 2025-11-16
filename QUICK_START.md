# 🚀 Quick Start Guide

Get Optiroute running in 5 minutes!

## Prerequisites

- Python 3.11+
- Node.js 20+
- MongoDB 7.x (or use Docker)

## Option 1: Docker (Recommended)

```bash
# Clone and navigate
cd optiroute

# Start everything
docker compose up --build

# Access:
# - Frontend: http://localhost:5173
# - Backend API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
```

## Option 2: Local Development

### 1. Setup Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Copy environment file
cp ../.env.example .env
# Edit .env with your settings

# Start backend
uvicorn app.main:app --reload
```

### 2. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Setup MongoDB

```bash
# Using Docker
docker run -d -p 27017:27017 --name optiroute-mongo mongo:7.0

# Or install MongoDB locally
```

### 4. Seed Sample Data

```bash
# From project root
python scripts/seed_data.py --days 730 --csv scripts/sample_sales.csv
```

### 5. Train Initial Model

```bash
curl -X POST http://localhost:8000/api/v1/model/retrain \
  -H "Content-Type: application/json" \
  -d '{"client_id": "default", "train_from_uploaded_data": true}'
```

## 🎯 First Steps

1. **Open the dashboard**: http://localhost:5173
2. **Upload data**: Use MLOps panel to upload `scripts/sample_sales.csv`
3. **Retrain model**: Click "Retrain Forecast Model"
4. **Run simulation**: Adjust sliders in Simulation Cockpit
5. **Optimize routes**: Add locations in Route Optimizer

## 📚 Next Steps

- Read [README.md](README.md) for full documentation
- Check [SECURITY_SUMMARY.md](SECURITY_SUMMARY.md) for security setup
- See [IMPROVEMENTS.md](IMPROVEMENTS.md) for future enhancements

## 🐛 Troubleshooting

**Backend won't start?**
- Check MongoDB is running: `docker ps` or `mongosh`
- Verify port 8000 is free: `lsof -i :8000`

**Frontend can't connect?**
- Check `VITE_API_BASE_URL` in frontend/.env
- Verify backend is running on port 8000

**No data showing?**
- Seed sample data first
- Retrain the model after seeding

## ✅ Verify Installation

```bash
# Check backend health
curl http://localhost:8000/health

# Should return: {"status":"healthy","service":"optiroute"}
```

