import { useState } from 'react';
import PropTypes from 'prop-types';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { calculateBusinessImpact } from '../api/client.js';

const DEFAULT_BASELINE = {
  annual_demand: 12000,
  order_quantity: 500,
  order_cost: 75,
  holding_cost_per_unit: 2.5,
  unit_cost: 10,
  service_level: 0.9,
  safety_stock: 150,
  average_inventory: 400,
  stockout_cost_per_unit: 15,
  obsolescence_rate: 0.02,
};

const DEFAULT_OPTIMIZED = {
  annual_demand: 12000,
  order_quantity: 400,
  order_cost: 70,
  holding_cost_per_unit: 2.3,
  unit_cost: 10,
  service_level: 0.95,
  safety_stock: 180,
  average_inventory: 350,
  stockout_cost_per_unit: 15,
  obsolescence_rate: 0.015,
};

const INITIAL_RESULT = {
  baseline: { costs: {} },
  optimized: { costs: {} },
  savings: { annual_savings: 0, improvement_pct: 0, roi_pct: 0 },
};

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function ImpactDashboard({ fallbackBaseline = null, fallbackOptimized = null } = {}) {
  const [baseline, setBaseline] = useState(fallbackBaseline || DEFAULT_BASELINE);
  const [optimized, setOptimized] = useState(fallbackOptimized || DEFAULT_OPTIMIZED);
  const [result, setResult] = useState(INITIAL_RESULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(policy, field, value) {
    const parsed = value === '' ? '' : parseFloat(value);
    const updateValue = Number.isNaN(parsed) ? '' : parsed;
    if (policy === 'baseline') {
      setBaseline((prev) => ({ ...prev, [field]: updateValue }));
    } else {
      setOptimized((prev) => ({ ...prev, [field]: updateValue }));
    }
  }

  async function handleCalculate(event) {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const payload = {
        baseline,
        optimized,
        implementation_cost: 25000,
      };
      const response = await calculateBusinessImpact(payload);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Unable to compute business impact');
    } finally {
      setLoading(false);
    }
  }

  const chartData = [
    { name: 'Ordering', baseline: result.baseline.costs?.ordering_cost, optimized: result.optimized.costs?.ordering_cost },
    { name: 'Holding', baseline: result.baseline.costs?.holding_cost, optimized: result.optimized.costs?.holding_cost },
    { name: 'Purchase', baseline: result.baseline.costs?.purchase_cost, optimized: result.optimized.costs?.purchase_cost },
    { name: 'Stockout', baseline: result.baseline.costs?.stockout_cost, optimized: result.optimized.costs?.stockout_cost },
    { name: 'Obsolescence', baseline: result.baseline.costs?.obsolescence_cost, optimized: result.optimized.costs?.obsolescence_cost },
  ];

  return (
    <section className="impact-panel">
      <header>
        <div>
          <h2>Business Impact Calculator</h2>
          <p>Quantify cost savings and ROI when shifting from the current inventory policy to the optimized recommendation.</p>
        </div>
      </header>

      <form className="impact-grid" onSubmit={handleCalculate}>
        <fieldset>
          <legend>Baseline Policy</legend>
          {Object.entries(baseline).map(([key, value]) => (
            <label key={`baseline-${key}`}>
              <span>{key.replace(/_/g, ' ')}</span>
              <input
                type="number"
                step="0.01"
                value={value}
                onChange={(event) => handleChange('baseline', key, event.target.value)}
                required
              />
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Optimized Policy</legend>
          {Object.entries(optimized).map(([key, value]) => (
            <label key={`optimized-${key}`}>
              <span>{key.replace(/_/g, ' ')}</span>
              <input
                type="number"
                step="0.01"
                value={value}
                onChange={(event) => handleChange('optimized', key, event.target.value)}
                required
              />
            </label>
          ))}
        </fieldset>

        <div className="controls">
          <button type="submit" className="primary" disabled={loading}>
            {loading ? 'Calculating…' : 'Calculate Impact'}
          </button>
          {error && <p className="error-text">{error}</p>}
        </div>
      </form>

      <div className="summary-grid">
          <div className="summary-card">
            <h3>Baseline Total Cost</h3>
            <strong>{formatCurrency(result.baseline.costs?.total)}</strong>
          </div>
          <div className="summary-card">
            <h3>Optimized Total Cost</h3>
            <strong>{formatCurrency(result.optimized.costs?.total)}</strong>
          </div>
          <div className="summary-card highlight">
            <h3>Annual Savings</h3>
            <strong>{formatCurrency(result.savings.annual_savings)}</strong>
            <span>{result.savings.improvement_pct.toFixed(2)}% improvement</span>
          </div>
          <div className="summary-card">
            <h3>ROI</h3>
            <strong>{result.savings.roi_pct.toFixed(2)}%</strong>
          </div>
      </div>

      <div className="impact-chart">
        <h3>Cost Breakdown Comparison</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey="baseline" fill="#60a5fa" radius={[6, 6, 0, 0]} name="Baseline" />
            <Bar dataKey="optimized" fill="#34d399" radius={[6, 6, 0, 0]} name="Optimized" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <footer className="impact-footer">
        <h3>What this means</h3>
        <p>
          Ordering, holding, and stockout costs respond directly to service-level and order-quantity decisions. Use this analysis
          to translate forecast accuracy improvements into actionable financial outcomes.
        </p>
      </footer>
    </section>
  );
}

ImpactDashboard.propTypes = {
  fallbackBaseline: PropTypes.object,
  fallbackOptimized: PropTypes.object,
};

// Default props removed - using default parameters instead

export default ImpactDashboard;
