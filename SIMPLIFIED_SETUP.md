# Simplified Setup Guide

## Do You Need the API?

**Short answer: YES, but you can simplify the security features.**

### Why the API is Necessary:
- Your React frontend needs to communicate with the Python backend
- The frontend makes HTTP requests to get forecasts, run simulations, optimize routes
- This is standard architecture: Frontend (React) ↔ API (FastAPI) ↔ Database (MongoDB)

### What You Can Simplify:

#### Option 1: Keep API, Simplify Security (Recommended for Portfolio)
- ✅ Keep the REST API endpoints (they're essential)
- ✅ Keep basic validation (prevents crashes)
- ⚠️ Make authentication optional (disable for demo)
- ⚠️ Reduce rate limiting (or disable for local dev)
- ✅ Keep file upload security (prevents attacks)

#### Option 2: Full Security (For Production)
- ✅ All security features enabled
- ✅ Authentication required
- ✅ Rate limiting active
- ✅ Full validation

## Current authentication setup

Development may issue local test JWTs so the sample frontend can run. Production
password login is deliberately disabled until a real identity provider is
configured; arbitrary user and tenant identifiers must never mint production
tokens. Protected API routes require a bearer token in every environment.

## What's Actually Required

### ✅ Essential (Can't Remove):
1. **REST API endpoints** - Frontend needs these
2. **Basic validation** - Prevents crashes from bad input
3. **Error handling** - Better user experience

### ⚠️ Environment-dependent:
1. **Development login** - local-only convenience for the demo frontend
2. **Production identity provider** - required before deploying user access
3. **Distributed rate limiting** - recommended when running multiple API instances

### 🎯 Recommended for Portfolio:
- Keep the API structure (it's professional)
- Keep basic validation (shows good practices)
- Use local development authentication only; never deploy it
- Keep file upload security (shows security awareness)

## Quick Start (Simplified)

1. **Start Backend:**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```
   - API available at `http://localhost:8000`
   - Docs at `http://localhost:8000/docs`

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```
   - Frontend at `http://localhost:5173`
   - Automatically calls the API

3. **That's it!** No authentication needed for demo.

## API Endpoints (What You Have)

Your frontend uses these endpoints:

- `GET /api/v1/forecast/current` - Get demand forecast
- `GET /api/v1/inventory/summary` - Get inventory summary
- `POST /api/v1/simulation/run` - Run inventory simulation
- `POST /api/v1/routes/optimize` - Optimize delivery routes
- `POST /api/v1/model/retrain` - Retrain forecasting model
- `POST /api/v1/data/upload` - Upload CSV data
- `GET /api/v1/model/status` - Get model status
- And more...

**These are all essential** - your frontend depends on them!

## Summary

- ✅ **API is REQUIRED** - Frontend needs it to work
- ⚠️ **Security is OPTIONAL** - Can disable for demo
- 🎯 **Current setup is good** - Works without authentication by default
- 📝 **For portfolio** - Keep API, disable auth, show it works

The API structure you have is actually a **strength** for your portfolio - it shows:
- Full-stack development skills
- REST API design
- Separation of concerns
- Professional architecture
