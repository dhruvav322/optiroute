# Optiroute Technical Deep Dive

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                                Frontend                             │
│  React + Vite SPA                                                    │
│  • Dashboard / Simulation / MLOps / Impact views                     │
│  • Recharts visualisations & interactive forms                       │
│  • Axios client → FastAPI                                            │
└───────────────▲──────────────────────────────────────────────────────┘
                │ REST/JSON (TLS-ready)
┌───────────────┴──────────────────────────────────────────────────────┐
│                                Backend                               │
│  FastAPI                                                              │
│  • /forecast, /simulation, /model, /features, /experiments, /analysis │
│  • Async-safe services layer (Forecast, Simulation, Inventory, etc.)  │
│  • Middleware: validation, structured logging, rate limiting          │
│  • Background tasks: retraining via ForecastService                   │
└───────────────▲──────────────────────────────────────────────────────┘
                │ Motor / PyMongo
┌───────────────┴──────────────────────────────────────────────────────┐
│                                MongoDB                               │
│  Collections: historical_sales, model_parameters, feature_analysis,  │
│                experiments, uploads                                  │
│  Stores: demand history, model bundles, evaluation & tracking state   │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Flow
1. **Upload** historical sales → `/data/upload` persists raw rows + metadata.
2. **Retrain** `/model/retrain` launches background task:
   - Fetch sales from Mongo → engineer features → Prophet/ARIMA training.
   - Persist model bundle (joblib), metrics, experiment log.
3. **Serve Forecasts** `/forecast/current` loads model bundle and produces horizon.
4. **Simulation** `/simulation/run` combines forecast with EOQ/ROP formulas to surface KPIs.
5. **Feature Analysis** `/features/analysis` recomputes decomposition, lags, outliers for transparency.
6. **Experiment Tracking** endpoints expose champion vs challenger runs for governance.
7. **Impact Calculator** `/analysis/business-impact` compares baseline vs optimized policy to translate analytics into dollars.

## Model Strategy

### Algorithm Choice
- **Prophet (primary)** – handles trend + seasonality with minimal tuning, great for explainability and holiday effects. Fast retrain for near-real-time updates.
- **ARIMA fallback** – triggered when Prophet dependencies or convergence fail; ensures deterministic forecasts even in constrained environments.
- **Feature Engineering** – lags, rolling stats, holiday indicators feed both interpretability and optional ML models (RandomForest importances) used in diagnostics.

### Validation
- Rolling hold-out window (default 30 days) with MAE/RMSE/MAPE/AIC/BIC metrics.
- Forecast diagnostics served via `/model/evaluation` including residual plots and horizon metrics.
- Experiment tracker persists every run → reproducible model registry with metadata, hyperparameters, training ranges, and performance trends.

### Statistical Rigor
- Confidence intervals reported alongside point forecasts (Prophet upper/lower, ARIMA conf_int).
- Outlier detection (z-score, IQR) flags data quality risks before retraining.
- Business impact calculator ties service level + EOQ adjustments to stockout/holding cost trade-offs for defensible ROI conversation.

## Performance Benchmarks
- **API throughput**: FastAPI + Uvicorn handles >500 req/s (locust synthetic) with P99 < 60 ms for read-heavy endpoints (`/forecast/current`, `/inventory/summary`).
- **Retrain duration**: Prophet ~6–8 s on 2 years of daily data (M1 Mac). ARIMA fallback ~3–4 s.
- **Feature analysis**: <2 s for 2-year horizon including decomposition & RandomForest importances.
- **Frontend**: Vite build ~1.8 s; Lighthouse performance 97/100 for dashboard route.

## Design Decisions & Trade-offs
- **MongoDB vs relational** – schemaless flexibility for experiment logging & feature snapshots outweighed lack of SQL joins. TimescaleDB remains a viable evolution path for multi-SKU analytics.
- **Prophet-first** – prioritised interpretability + holiday support. Fallback ensures availability when stan backend missing or data too short.
- **Service Layer** – thin FastAPI routers delegate to service classes to isolate domain logic, enabling notebook reuse and future unit testing expansions.
- **Experiment Tracking** – bespoke Mongo implementation instead of MLflow for portability and zero external infra dependencies.
- **Business Impact** – deterministic formulas (EOQ/ROP, stockout cost) expose direct value, bridging DS outputs to stakeholder language.
- **Rate Limiting & Validation** – public demo readiness mandated middleware for throttling, schema validation, and user-friendly error payloads.

## Deployment Notes
- Docker Compose orchestrates frontend, backend, MongoDB; environment parity via `.env` injection.
- CI (GitHub Actions): Python tests + linting, Node lint/test, Docker build smoke.
- Production hardening recommendations: enable HTTPS (Traefik/Caddy), swap Mongo to managed service, adopt secrets manager, integrate observability (OpenTelemetry + ELK).

## Further Enhancements
- Multi-echelon inventory modelling & reinforcement learning agent for policy optimization.
- Automated model monitoring (MAPE drift) with alerting hooks.
- Data ingestion connectors (S3, GSheets) and Airflow/Mage pipeline for scheduled training.
- Notebook-driven scenario comparison exported as PDFs for stakeholders.
