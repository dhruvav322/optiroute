import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from 'recharts';

import { getModelEvaluation } from '../api/client.js';
import './modelEvaluation.css';

const DEFAULT_EVALUATION = {
  evaluated_at: '',
  train_start: '',
  train_end: '',
  test_start: '',
  test_end: '',
  models: [],
  comparison: [],
  training_history: [],
  errors: null,
  model_selection_reason: '',
};

function formatNumber(value, digits = 2) {
  if (Number.isNaN(value) || value === null || value === undefined) {
    return '—';
  }
  return Number(value).toFixed(digits);
}

function formatPercent(value) {
  if (Number.isNaN(value) || value === null || value === undefined) {
    return '—';
  }
  return `${Number(value).toFixed(2)}%`;
}

function ModelEvaluation({ fallbackData = null } = {}) {
  const [evaluation, setEvaluation] = useState(fallbackData || DEFAULT_EVALUATION);
  const [loading, setLoading] = useState(!fallbackData);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (fallbackData) {
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const payload = await getModelEvaluation();
        if (!cancelled) {
          setEvaluation(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load evaluation data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fallbackData]);

  const metricsTable = useMemo(
    () =>
      evaluation.comparison.map((row) => ({
        model: row.model,
        mae: formatNumber(row.mae),
        rmse: formatNumber(row.rmse),
        mape: formatPercent(row.mape),
        aic: row.aic !== undefined && row.aic !== null ? formatNumber(row.aic) : '—',
        bic: row.bic !== undefined && row.bic !== null ? formatNumber(row.bic) : '—',
      })),
    [evaluation.comparison],
  );

  const selectedModel = evaluation.models[0];

  const residualHistogramData = useMemo(() => {
    if (!selectedModel || !selectedModel.histogram) {
      return [];
    }
    return selectedModel.histogram.map((bin) => ({
      range: `${formatNumber(bin.bin_start, 1)} – ${formatNumber(bin.bin_end, 1)}`,
      count: bin.count,
    }));
  }, [selectedModel]);

  const residualSeries = useMemo(() => {
    if (!selectedModel) {
      return [];
    }
    return selectedModel.predictions.map((point, index) => ({
      date: point.date,
      residual: selectedModel.residuals[index],
    }));
  }, [selectedModel]);

  if (loading) {
    return (
      <div className="evaluation-panel" aria-busy="true">
        Loading model evaluation…
      </div>
    );
  }

  if (error) {
    return <div className="evaluation-panel error">{error}</div>;
  }

  return (
    <section className="evaluation-panel">
      <header>
        <div>
          <h2>Model Evaluation</h2>
          <p>
            Evaluated at {new Date(evaluation.evaluated_at).toLocaleString()} on forecast window{' '}
            {new Date(evaluation.test_start).toLocaleDateString()} – {new Date(evaluation.test_end).toLocaleDateString()}.
          </p>
        </div>
        <div className="model-reason">{evaluation.model_selection_reason}</div>
      </header>

      {evaluation.errors && (
        <div className="evaluation-alert">Some models failed to evaluate: {evaluation.errors.join(', ')}</div>
      )}

      <div className="metrics-grid">
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>MAE</th>
              <th>RMSE</th>
              <th>MAPE</th>
              <th>AIC</th>
              <th>BIC</th>
            </tr>
          </thead>
          <tbody>
            {metricsTable.map((row) => (
              <tr key={row.model}>
                <td>{row.model.toUpperCase()}</td>
                <td>{row.mae}</td>
                <td>{row.rmse}</td>
                <td>{row.mape}</td>
                <td>{row.aic}</td>
                <td>{row.bic}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {selectedModel && (
          <div className="horizon-summary">
            <h3>Forecast Horizons</h3>
            <ul>
              {selectedModel.horizon_metrics.map((item) => (
                <li key={item.horizon}>
                  {item.horizon}-day horizon: MAE {formatNumber(item.mae)}, RMSE {formatNumber(item.rmse)}, MAPE{' '}
                  {formatPercent(item.mape)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {selectedModel && (
        <div className="chart-grid">
          <div className="chart-card">
            <h3>Actual vs Predicted</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={selectedModel.predictions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString()} minTickGap={32} />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value, name) => {
                    if (name === 'prediction') return [formatNumber(value), 'Prediction'];
                    if (name === 'actual') return [formatNumber(value), 'Actual'];
                    if (name === 'upper') return [formatNumber(value), 'Upper 95%'];
                    if (name === 'lower') return [formatNumber(value), 'Lower 95%'];
                    return value;
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="actual" stroke="#60a5fa" fillOpacity={0.2} fill="#60a5fa" />
                <Area type="monotone" dataKey="prediction" stroke="#f97316" fillOpacity={0.2} fill="#f97316" />
                <Area type="monotone" dataKey="upper" stroke="#22c55e" fillOpacity={0} strokeDasharray="4" />
                <Area type="monotone" dataKey="lower" stroke="#22c55e" fillOpacity={0} strokeDasharray="4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Residuals Over Time</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={residualSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString()} minTickGap={32} />
                <YAxis />
                <Tooltip labelFormatter={(value) => new Date(value).toLocaleString()} formatter={(value) => formatNumber(value)} />
                <Legend />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                <Area type="linear" dataKey="residual" stroke="#22d3ee" fillOpacity={0.2} fill="#22d3ee" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Residual Distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={residualHistogramData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#a855f7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <section className="evaluation-notes">
        <h3>How we choose a champion</h3>
        <p>
          We compare Prophet and ARIMA on MAE, RMSE, MAPE, and information criteria (AIC/BIC). Horizon metrics capture how
          forecasts degrade over 1, 7, and 30 days. Residual diagnostics highlight bias and variance. The champion model
          minimizes RMSE while keeping MAPE within tolerance across horizons.
        </p>
      </section>
    </section>
  );
}

ModelEvaluation.propTypes = {
  fallbackData: PropTypes.shape({
    evaluated_at: PropTypes.string,
    train_start: PropTypes.string,
    train_end: PropTypes.string,
    test_start: PropTypes.string,
    test_end: PropTypes.string,
    models: PropTypes.arrayOf(PropTypes.object),
    comparison: PropTypes.arrayOf(PropTypes.object),
    training_history: PropTypes.arrayOf(PropTypes.object),
    errors: PropTypes.arrayOf(PropTypes.string),
    model_selection_reason: PropTypes.string,
  }),
};

// Default props removed - using default parameters instead

export default ModelEvaluation;
