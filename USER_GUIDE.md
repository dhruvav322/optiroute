# 👤 User Guide - Running Optiroute

## 🚀 Quickest Way to Start

### Option 1: One-Command Start (Recommended)

```bash
# macOS/Linux:
./start.sh

# Windows:
start.bat
```

That's it! The script handles everything:
- ✅ Checks prerequisites
- ✅ Sets up Python virtual environment
- ✅ Installs dependencies
- ✅ Starts MongoDB (if needed)
- ✅ Starts backend server
- ✅ Starts frontend server

**Then open:** http://localhost:5173

### Option 2: Docker (If you have Docker Desktop)

```bash
docker compose up --build
```

### Option 3: Manual Start

See [QUICK_START.md](QUICK_START.md) for step-by-step instructions.

## 📋 Prerequisites Check

Before running, make sure you have:

- ✅ **Python 3.9+** (3.11+ recommended)
  ```bash
  python3 --version
  ```

- ✅ **Node.js 20+**
  ```bash
  node --version
  ```

- ✅ **MongoDB 7.x** (or use Docker)
  ```bash
  mongosh --version
  # Or check if running:
  pgrep -f mongod
  ```

## 🔧 Troubleshooting

### Backend Won't Start?

1. **Check MongoDB is running:**
   ```bash
   # Try connecting:
   mongosh
   # Or start with Docker:
   docker run -d -p 27017:27017 --name optiroute-mongo mongo:7.0
   ```

2. **Check port 8000 is free:**
   ```bash
   lsof -i :8000
   # Kill if needed:
   kill <PID>
   ```

3. **Check Python version:**
   ```bash
   python3 --version  # Should be 3.9+
   ```

4. **Reinstall dependencies:**
   ```bash
   cd backend
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

### Frontend Won't Start?

1. **Check Node version:**
   ```bash
   node --version  # Should be 20+
   ```

2. **Reinstall dependencies:**
   ```bash
   cd frontend
   npm install
   ```

3. **Check port 5173 is free:**
   ```bash
   lsof -i :5173
   ```

### Can't Connect to Backend?

1. **Wait a few seconds** - Backend takes 5-10 seconds to start

2. **Check backend is running:**
   ```bash
   curl http://localhost:8000/health
   # Should return: {"status":"healthy",...}
   ```

3. **Check logs:**
   ```bash
   tail -f backend.log  # If using start.sh
   ```

## ✅ Verification

After starting, verify everything works:

1. **Backend Health:**
   ```bash
   curl http://localhost:8000/health
   ```

2. **API Docs:**
   Open http://localhost:8000/docs in browser

3. **Frontend:**
   Open http://localhost:5173 in browser

## 🛑 Stopping the Application

### If using start.sh:
```bash
./stop.sh
```

### Manual stop:
```bash
# Find and kill processes
pkill -f "uvicorn app.main:app"
pkill -f "vite"
```

## 📝 First Time Setup

1. **Start the application** (using start.sh or manually)

2. **Seed sample data** (optional):
   ```bash
   python scripts/seed_data.py --days 730 --csv scripts/sample_sales.csv
   ```

3. **Train the model:**
   - Open http://localhost:5173
   - Go to MLOps Panel
   - Click "Retrain Forecast Model"
   - Wait for training to complete

4. **Start using:**
   - View dashboard KPIs
   - Run simulations with sliders
   - Optimize routes
   - Upload your own data

## 🎯 Common Issues

### "Module not found" errors
- Make sure virtual environment is activated
- Run `pip install -r requirements.txt` again

### "MongoDB connection failed"
- Start MongoDB: `mongod` or use Docker
- Check MongoDB is on port 27017

### "Port already in use"
- Kill the process using the port
- Or change ports in configuration

### Frontend shows "Failed to fetch"
- Wait for backend to fully start (10-15 seconds)
- Check backend is running: `curl http://localhost:8000/health`
- Check browser console for errors

## 💡 Tips

- **Keep terminal windows open** - They show logs
- **Check logs** if something doesn't work
- **Use Docker** if you have issues with local setup
- **Start MongoDB first** if running manually

## 📞 Need Help?

1. Check [QUICK_START.md](QUICK_START.md)
2. Check [README.md](README.md)
3. Check backend.log and frontend.log files
4. Verify all prerequisites are installed

