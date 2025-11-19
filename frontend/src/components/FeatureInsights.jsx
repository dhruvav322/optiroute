import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getFeatureAnalysis } from '../api/client.js';

const DEFAULT_ANALYSIS = {
  analyzed_at: '',
  data_points: 0,
  seasonality_decomposition: {
    trend: [],
    seasonal: [],
    resid: [],
    observed: [],
  },
  features: {
    lags: [],
    rolling: [],
    holidays: [],
  },
  feature_importance: [],
  correlation_matrix: [],
  outliers: {
    z_score_outliers: [],
    iqr_outliers: [],
    stats: {
      mean: 0,
      std: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
    },
  },
};

function formatPercent(value) {
  if (Number.isNaN(value) || value === null || value === undefined) {
    return '—';
  }
  return `${Number(value).toFixed(2)}%`;
}

function FeatureInsights({ fallbackData = null } = {}) {
  const [analysis, setAnalysis] = useState(fallbackData || DEFAULT_ANALYSIS);
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
        const payload = await getFeatureAnalysis();
        if (!cancelled) {
          setAnalysis(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load feature analysis');
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

  const correlationHeaders = useMemo(() => {
    if (!analysis.correlation_matrix.length) {
      return [];
    }
    return Object.keys(analysis.correlation_matrix[0].correlations);
  }, [analysis.correlation_matrix]);

  if (loading) {
    return (
      <section className="feature-panel" aria-busy="true">
        Computing feature insights…
      </section>
    );
  }

  if (error) {
    return <section className="feature-panel error">{error}</section>;
  }

  return (
    <section className="feature-panel">
      <header>
        <div>
          <h2>Feature Insights</h2>
          <p>
            Built from {analysis.data_points} observations. Last analyzed{' '}
            {new Date(analysis.analyzed_at).toLocaleString()}.
          </p>
        </div>
      </header>

      <div className="feature-grid">
        <div className="panel-card">
          <h3>Seasonality</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={analysis.seasonality_decomposition.seasonal}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" minTickGap={36} />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#f97316" fill="#fb923c" fillOpacity={0.35} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="insight-text">
            Seasonal decomposition surfaces weekly demand pulses. Trend/residual components are included in the API response
            for advanced analysis.
          </p>
        </div>

        <div className="panel-card">
          <h3>Feature Importance</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={analysis.feature_importance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={formatPercent} />
              <YAxis dataKey="feature" type="category" width={140} />
              <Tooltip formatter={formatPercent} />
              <Bar dataKey="weight_pct" fill="#60a5fa" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="insight-text">
            RandomForest-derived importances highlight which engineered features contribute most to predictive power.
          </p>
        </div>

        <div className="panel-card">
          <h3>Correlation Matrix</h3>
          {analysis.correlation_matrix.length ? (
            <div className="heatmap-container">
              <table>
                <thead>
                  <tr>
                    <th>Feature</th>
                    {correlationHeaders.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analysis.correlation_matrix.map((row) => (
                    <tr key={row.feature}>
                      <td>{row.feature}</td>
                      {correlationHeaders.map((header) => {
                        const value = row.correlations[header];
                        const intensity = Math.round(Math.abs(value) * 200);
                        const color = value >= 0 ? `rgba(59,130,246,${intensity / 255})` : `rgba(220,38,38,${intensity / 255})`;
                        return (
                          <td key={header} style={{ background: color }}>{value.toFixed(2)}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="insight-text">Correlation data unavailable.</p>
          )}
          <p className="insight-text">
            Use correlations to spot collinearity and interactions before feeding features into the forecasting model.
          </p>
        </div>

        <div className="panel-card">
          <h3>Holiday Effects</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={analysis.features.holidays}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" minTickGap={36} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="is_holiday" stroke="#facc15" fill="#fef08a" fillOpacity={0.35} />
              <Area type="monotone" dataKey="days_until_holiday" stroke="#2563eb" fillOpacity={0.1} />
              <Area type="monotone" dataKey="days_since_holiday" stroke="#22d3ee" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="insight-text">
            Holiday lead/lag indicators help capture promotional spikes and supply constraints around key dates.
          </p>
        </div>

        <div className="panel-card">
          <h3>Outlier Diagnostics</h3>
          <div className="outlier-summary">
            <div>
              <span>Mean</span>
              <strong>{analysis.outliers.stats.mean.toFixed(2)}</strong>
            </div>
            <div>
              <span>Std Dev</span>
              <strong>{analysis.outliers.stats.std.toFixed(2)}</strong>
            </div>
            <div>
              <span>IQR</span>
              <strong>{analysis.outliers.stats.iqr.toFixed(2)}</strong>
            </div>
          </div>
          <p className="insight-text">
            Z-score and IQR methods expose extreme demand days. Review them before model training to avoid skewed parameters.
          </p>
        </div>
      </div>

      <footer className="feature-footer">
        <h3>Why this matters</h3>
        <p>
          Feature engineering translates operational signal into ML-ready inputs. These diagnostics make it easy to explain and
          justify improvements in forecast accuracy to business stakeholders.
        </p>
      </footer>
    </section>
  );
}

FeatureInsights.propTypes = {
  fallbackData: PropTypes.shape({
    analyzed_at: PropTypes.string,
    data_points: PropTypes.number,
    seasonality_decomposition: PropTypes.object,
    features: PropTypes.object,
    feature_importance: PropTypes.arrayOf(PropTypes.object),
    correlation_matrix: PropTypes.arrayOf(PropTypes.object),
    outliers: PropTypes.object,
  }),
};

// Default props removed - using default parameters instead

export default FeatureInsights;
