import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { formatDate } from '../utils/formatters.js';

import {
  getExperimentsHistory,
  getExperimentsBest,
  getExperimentsCompare,
} from '../api/client.js';

const DEFAULT_STATE = {
  experiments: [],
  champion: null,
  selected: [],
};

function formatNumber(value) {
  if (value === null || value === undefined) {
    return '—';
  }
  return Number(value).toFixed(3);
}

function ExperimentHistory({ fallbackData = null } = {}) {
  const [state, setState] = useState(fallbackData || DEFAULT_STATE);
  const [loading, setLoading] = useState(!fallbackData);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    if (fallbackData) {
      setSelectedIds(fallbackData.selected || []);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [historyPayload, championPayload] = await Promise.all([
          getExperimentsHistory(50),
          getExperimentsBest(),
        ]);
        if (!cancelled) {
          setState({
            experiments: historyPayload.experiments,
            champion: championPayload.experiment,
            selected: [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load experiment history');
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

  const comparison = useMemo(() => {
    if (!selectedIds.length) {
      return [];
    }
    return state.experiments.filter((item) => selectedIds.includes(item.id));
  }, [state.experiments, selectedIds]);

  async function handleSelection(id) {
    const exists = selectedIds.includes(id);
    const next = exists ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
    setSelectedIds(next);
    try {
      if (next.length) {
        const payload = await getExperimentsCompare(next);
        setState((prev) => ({ ...prev, selected: payload.experiments }));
      } else {
        setState((prev) => ({ ...prev, selected: [] }));
      }
    } catch (err) {
      setError(err.message || 'Failed to compare experiments');
    }
  }

  if (loading) {
    return (
      <section className="experiment-panel" aria-busy="true">
        Loading experiments…
      </section>
    );
  }

  if (error) {
    return <section className="experiment-panel error">{error}</section>;
  }

  return (
    <section className="experiment-panel">
      <header>
        <div>
          <h2>Experiment History</h2>
          <p>
            Track champion vs. challenger models. Select rows to compare metrics across training and validation periods.
          </p>
        </div>
        {state.champion && (
          <div className="champion-card">
            <span className="label">Current Champion</span>
            <strong>{state.champion.model_type}</strong>
            <span className="metric">Validation RMSE: {formatNumber(state.champion.metrics?.validation?.rmse)}</span>
          </div>
        )}
      </header>

      <div className="experiment-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Compare</th>
              <th>Model</th>
              <th>Train RMSE</th>
              <th>Val RMSE</th>
              <th>Data Size</th>
              <th>Range</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {state.experiments.map((experiment) => (
              <tr key={experiment.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(experiment.id)}
                    onChange={() => handleSelection(experiment.id)}
                  />
                </td>
                <td>{experiment.model_type}</td>
                <td>{formatNumber(experiment.metrics?.train?.rmse)}</td>
                <td>{formatNumber(experiment.metrics?.validation?.rmse)}</td>
                <td>{experiment.data_profile?.size ?? '—'}</td>
                <td>
                  {experiment.data_profile?.date_range
                    ? `${experiment.data_profile.date_range[0]} → ${experiment.data_profile.date_range[1]}`
                    : '—'}
                </td>
                <td>{formatDate(experiment.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {comparison.length > 0 && (
        <div className="comparison-panel">
          <h3>Champion vs Challengers</h3>
          <div className="comparison-grid">
            {comparison.map((experiment) => (
              <div key={experiment.id} className="comparison-card">
                <header>
                  <h4>{experiment.model_type}</h4>
                  <p>{experiment.description || 'No description provided.'}</p>
                </header>
                <ul>
                  <li>
                    <span>Validation RMSE</span>
                    <strong>{formatNumber(experiment.metrics?.validation?.rmse)}</strong>
                  </li>
                  <li>
                    <span>Validation MAPE</span>
                    <strong>{formatNumber(experiment.metrics?.validation?.mape)}</strong>
                  </li>
                  <li>
                    <span>Training Duration</span>
                    <strong>
                      {experiment.training_duration_seconds
                        ? `${experiment.training_duration_seconds.toFixed(1)} s`
                        : '—'}
                    </strong>
                  </li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

ExperimentHistory.propTypes = {
  fallbackData: PropTypes.shape({
    experiments: PropTypes.arrayOf(PropTypes.object),
    champion: PropTypes.object,
    selected: PropTypes.arrayOf(PropTypes.object),
  }),
};

// Default props removed - using default parameters instead

export default ExperimentHistory;
