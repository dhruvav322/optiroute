#!/bin/bash

# Optiroute Startup Script
# This script makes it easy to start the entire application

set -e

echo "🚀 Starting Optiroute..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found. Please install Python 3.11+${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Python found${NC}"

# Check Node
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 20+${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js found${NC}"

# Check MongoDB
if ! pgrep -f mongod > /dev/null && ! docker ps | grep -q mongo; then
    echo -e "${YELLOW}⚠️  MongoDB not running. Starting MongoDB with Docker...${NC}"
    if command -v docker &> /dev/null; then
        docker run -d -p 27017:27017 --name optiroute-mongo mongo:7.0 2>/dev/null || echo "MongoDB container may already exist"
        sleep 2
    else
        echo -e "${YELLOW}⚠️  Docker not found. Please start MongoDB manually.${NC}"
    fi
fi
echo -e "${GREEN}✅ MongoDB ready${NC}"

echo ""
echo "🔧 Setting up backend..."

# Backend setup
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install dependencies if needed
if [ ! -f ".venv/.deps_installed" ]; then
    echo "Installing backend dependencies..."
    pip install -q -r requirements.txt
    touch .venv/.deps_installed
fi

# Create necessary directories
mkdir -p models storage/uploads

echo -e "${GREEN}✅ Backend ready${NC}"

# Start backend in background
echo "Starting backend server..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "Waiting for backend to start..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is running on http://localhost:8000${NC}"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Backend failed to start. Check backend.log for errors.${NC}"
        exit 1
    fi
done

echo ""
echo "🎨 Setting up frontend..."

# Frontend setup
cd ../frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo -e "${GREEN}✅ Frontend ready${NC}"

# Start frontend
echo "Starting frontend server..."
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
sleep 3

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Optiroute is running!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Frontend:  http://localhost:5173"
echo "📍 Backend:   http://localhost:8000"
echo "📍 API Docs:  http://localhost:8000/docs"
echo "📍 Health:    http://localhost:8000/health"
echo ""
echo "📝 Logs:"
echo "   - Backend:  tail -f backend.log"
echo "   - Frontend: tail -f frontend.log"
echo ""
echo "🛑 To stop:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Save PIDs to file for easy stopping
echo "$BACKEND_PID $FRONTEND_PID" > .pids

echo ""
echo "💡 Next steps:"
echo "   1. Open http://localhost:5173 in your browser"
echo "   2. Seed sample data: python scripts/seed_data.py --days 730"
echo "   3. Train model: Use the MLOps panel in the dashboard"
echo ""

