#!/bin/bash

# Stop Optiroute services

echo "🛑 Stopping Optiroute..."

# Stop using saved PIDs
if [ -f .pids ]; then
    PIDS=$(cat .pids)
    kill $PIDS 2>/dev/null || true
    rm .pids
fi

# Also kill any remaining processes
pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo "✅ Stopped all services"

