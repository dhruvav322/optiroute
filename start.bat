@echo off
REM Optiroute Startup Script for Windows

echo Starting Optiroute...
echo.

REM Check prerequisites
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.11+
    exit /b 1
)
echo [OK] Python found

node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Please install Node.js 20+
    exit /b 1
)
echo [OK] Node.js found

echo.
echo Setting up backend...
cd backend

REM Create virtual environment if needed
if not exist .venv (
    echo Creating Python virtual environment...
    python -m venv .venv
)

REM Activate virtual environment
call .venv\Scripts\activate.bat

REM Install dependencies if needed
if not exist .venv\.deps_installed (
    echo Installing backend dependencies...
    pip install -q -r requirements.txt
    type nul > .venv\.deps_installed
)

REM Create directories
if not exist models mkdir models
if not exist storage\uploads mkdir storage\uploads

echo [OK] Backend ready

REM Start backend
echo Starting backend server...
start "Optiroute Backend" cmd /k "uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

REM Wait a bit
timeout /t 5 /nobreak >nul

echo.
echo Setting up frontend...
cd ..\frontend

REM Install dependencies if needed
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
)

echo [OK] Frontend ready

REM Start frontend
echo Starting frontend server...
start "Optiroute Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo Optiroute is starting!
echo ========================================
echo.
echo Frontend:  http://localhost:5173
echo Backend:   http://localhost:8000
echo API Docs:  http://localhost:8000/docs
echo.
echo Open http://localhost:5173 in your browser
echo.

