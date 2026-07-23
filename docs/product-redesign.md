# Optiroute Product Redesign

## Product decision

Optiroute should launch as an **inventory decision-support product**, not as a
general-purpose supply-chain operating system. Its core promise is:

> Turn demand history into a clear recommendation for what to order, when to
> order it, and the cost of delaying that decision.

Demand forecasting, inventory policy, and financial impact belong in this
workflow. Route optimization is useful, but serves a separate logistics
workflow and should not compete with the inventory decision in the initial
product.

## Primary users

| User | Main question | Product access |
| --- | --- | --- |
| Inventory planner | What must I reorder now, and why? | Decision Center and planning views |
| Operations manager | What is the risk and expected financial impact? | Executive summary and approvals |
| Data/admin user | Is the input data and model healthy? | Data and model administration |
| Logistics planner | How should deliveries be sequenced? | Separate future Logistics module |

## Information architecture

### 1. Decision Center (default landing page)

This is the primary product screen. It must answer the next action in under a
minute.

- **Action banner:** `Order now`, `Monitor`, or `No action required`.
- **Recommended policy:** reorder date, quantity, reorder point, safety stock.
- **Risk:** days of cover, stockout probability/risk, excess-stock risk.
- **Impact:** annual cost before/after and savings estimate.
- **Why this recommendation:** forecast trend, lead time, and service level.
- **Actions:** adjust assumptions, approve/export recommendation, open details.

Limit the initial screen to a small KPI set and one demand/stock projection.
Every visual must support an action, risk assessment, financial impact, or
trust explanation.

### 2. Planning (focused what-if workspace)

- Assumptions: lead time, service level, order cost, holding cost, unit cost.
- Before/after comparison of the recommendation.
- A scenario can be saved with a name and versioned inputs.
- No raw model diagnostics or operational administration on this screen.

### 3. Data & Forecast (planner-facing detail)

- Dataset status, coverage, quality warnings, and latest upload.
- Forecast chart with uncertainty and a plain-language forecast summary.
- Retrain action with progress and resulting model/data version.

### 4. Administration (restricted / advanced)

- User and tenant management, API keys, integrations, data retention.
- Model evaluation, feature analysis, residuals, experiments, and system health.
- Advanced diagnostics are available, but not placed in the planner workflow.

### 5. Logistics (future, separately enabled module)

Keep the existing route optimizer behind a module boundary until inventory and
fulfilment data have a defined connection. Do not show it as a peer of the
core reorder decision in the initial navigation.

## Existing UI migration

| Current area | Decision | New home |
| --- | --- | --- |
| Dashboard / KPI grid | Rebuild | Decision Center |
| Simulation Cockpit / Cost Chart | Keep and simplify | Planning |
| MLOps Panel | Split | Data & Forecast plus Administration |
| Model Evaluation / Feature Insights / Experiment History | Keep, hide by default | Administration |
| Route Optimizer / map | Defer from main product | Future Logistics module |
| Command palette / global shortcuts | Keep only if they accelerate frequent planner actions | Shell-level enhancement |

## Target domain model

The current global/default-item flow is demo-oriented. Production logic should
be based on versioned domain records:

```text
Tenant
  └─ SKU
      ├─ DatasetVersion (source, validation result, normalized demand history)
      ├─ ForecastModelVersion (dataset hash, metrics, artifact, status)
      ├─ InventoryPolicy (lead time, service level, cost assumptions)
      ├─ Recommendation (quantity, reorder date, risk, impact, status)
      └─ Scenario (planner what-if inputs and saved result)
```

This supports reproducible recommendations: every recommendation identifies
the dataset, model, and inventory-policy inputs that produced it.

## Demand definition and data-quality contract

### Forecast the demand that customers requested

The forecasting target must be **unconstrained customer demand**: the quantity
requested by customers on a business day, before stock availability limits what
can be fulfilled. Do not train the demand forecast on fulfilled shipments alone.
When an item is unavailable, shipments fall to zero even though demand may
remain; treating that as zero demand systematically under-forecasts popular
out-of-stock items.

Keep the following fields separate in the normalized demand record:

| Field | Meaning | Use |
| --- | --- | --- |
| `requested_quantity` | Customer-requested quantity, less confirmed cancellations | Forecast target |
| `fulfilled_quantity` | Quantity actually shipped/sold | Service and revenue reporting |
| `backordered_quantity` | Demand promised for later fulfilment | Inventory position and service risk |
| `lost_sales_quantity` | Known demand that could not be fulfilled | Demand correction and stockout cost |
| `returned_quantity` | Quantity returned after fulfilment | Revenue/fulfilment adjustment, not direct demand subtraction |
| `stockout_flag` | Whether availability constrained fulfilment | Forecast-quality and intervention signal |

If requested demand is unavailable, the system must label the observation as
`censored_by_stockout` rather than silently treating fulfilled quantity as
demand. Early versions may forecast fulfilled demand only when they visibly
warn that stockout-censored periods can bias recommendations downward.

### Required grain and validation rules

The normalized baseline grain is one record per:

```text
tenant + SKU + inventory location + business date
```

Each record must identify its source/version and use a defined unit of measure,
currency, and business timezone. The ingestion process must:

1. reject duplicate keys unless an explicit aggregation rule is selected;
2. reject non-finite or negative quantities where the business event forbids
   them;
3. distinguish a missing observation from a verified zero-demand day;
4. flag date gaps, impossible inventory balances, and outlier values instead
   of silently dropping them;
5. preserve raw uploaded data and create an immutable normalized dataset
   version with validation results;
6. make upload behaviour explicit: append a new version, replace a version,
   or merge by an idempotency key—never silently double-count history.

For a usable first production dataset, require:

```csv
date,sku,location,requested_quantity,fulfilled_quantity,on_hand,
on_order,lead_time_days,unit_cost,order_cost,holding_cost_per_unit,service_level
```

Supplier minimum order quantity, order multiple, lead-time variability,
backorders, promotions, and holidays should be added next. Price, campaign,
weather, and similar drivers are optional and should be included only where
there is evidence that they materially explain demand.

## Target technical boundaries

- **API:** versioned routes grouped by `recommendations`, `scenarios`,
  `datasets`, `forecasts`, `admin`, and later `logistics`.
- **Services:** separate orchestration from calculations; calculator services
  remain pure and independently testable.
- **Jobs:** upload validation and training run asynchronously with durable job
  status. A `202` response must mean work was queued, not already completed.
- **Storage:** persist Mongo clients at application lifecycle boundaries;
  model artifacts and upload records need explicit version metadata.
- **Cache:** key cache entries by tenant, SKU, dataset/model version and
  horizon; invalidate them after any input/model mutation.
- **Frontend:** organize by product feature rather than a growing shared
  components directory. Screens compose feature modules and call typed API
  functions.

## Frontend redesign

The frontend should not be a dashboard that exposes every backend capability.
It should be a guided decision workspace: a planner lands on the next action,
opens detail only when needed, and reaches technical administration only
through an advanced area.

### Navigation and visual priority

- Default route: **Decision Center**.
- Primary navigation: Decision Center, Planning, Data & Forecast.
- Secondary/restricted navigation: Administration.
- Hide Logistics until it becomes a separately enabled module.
- Use one primary chart per page. Supporting numbers must explain the decision,
  not duplicate chart information.
- Show empty states as guided setup steps: upload data, resolve validation
  warnings, configure policy, train, then review recommendation.
- Replace the automatic browser login with a real signed-in/out state and a
  visible tenant/user context.

### Feature-based code structure

```text
src/
  app/                 # router, providers, application shell
  features/
    decision-center/   # recommendation banner, KPIs, risk, approval/export
    planning/          # assumptions and scenario comparison
    datasets/          # upload, mapping, quality status, versions
    forecasts/         # chart, summary, model run status
    administration/    # users, keys, diagnostics, experiments
    logistics/         # future isolated module
  shared/
    api/               # typed request client and generated/domain contracts
    ui/                # small reusable primitives only
    formatters/
```

Feature components own their local state, API hooks, and tests. `shared/ui`
must contain presentation primitives only; it must not become a second home for
feature-specific dashboard panels. Use explicit loading, empty, error, and
success states for every workflow.

## Mandatory integrity fixes before feature expansion

1. Require a strong runtime secret and remove insecure development secrets
   from Compose.
2. Replace arbitrary JWT minting and auto-login with a real identity boundary;
   derive tenant membership server-side.
3. Require authorization and limits for every resource-intensive endpoint.
4. Correct open-route solving instead of hiding a closed-route depot leg.
5. Invalidate forecast caches after uploads and retraining.
6. Fix the frontend container build and add a Docker build check to CI.
7. Validate depot indices, infeasible capacities, duplicate locations, and
   finite numeric inputs with client-safe 4xx responses.
8. Define idempotent/versioned upload behavior so repeated uploads cannot
   silently double historical demand.

## Delivery phases

### Phase A — Foundation

Secure authentication, deployment configuration, cache invalidation, routing
correctness, and test coverage for those behaviours.

**Exit criteria:** Compose builds; unauthenticated or cross-tenant requests
are rejected; retraining refreshes results; open and closed routes report
correct paths and distances.

### Phase B — Inventory decision vertical slice

Implement a single-SKU Decision Center using a versioned dataset, forecast,
inventory policy, recommendation, and scenario.

**Exit criteria:** a planner can upload demand history, review quality,
produce a recommendation, test an assumption change, and export/approve the
result without visiting an admin screen.

### Phase C — Operational maturity

Add asynchronous jobs, model/data provenance, observability, SKU selection,
saved scenarios, and role-based access.

### Phase D — Logistics module

Only after the inventory workflow is stable, introduce route optimization as a
separately navigated module with its own permissions, routing provider, and
fulfilment-data contract.

## Success measures

- Time from upload to a usable recommendation.
- Percentage of recommendations with complete data/model provenance.
- Forecast accuracy by SKU and forecast horizon.
- Stockout and excess-stock cost avoided after approved recommendations.
- Planner adoption: recommendations reviewed, approved, exported, or adjusted.
