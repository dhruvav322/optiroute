import PropTypes from 'prop-types';
import { useMemo } from 'react';

import './simulationCockpit.css';

const sliderConfig = [
  {
    key: 'order_cost',
    label: 'Order Cost',
    min: 10,
    max: 200,
    step: 1,
    description: 'Cost per purchase order (S)',
    format: (value) => `$${value.toFixed(0)}`,
  },
  {
    key: 'holding_cost_per_unit_per_year',
    label: 'Holding Cost per Unit / Year',
    min: 0.5,
    max: 10,
    step: 0.1,
    description: 'Annual holding cost (H)',
    format: (value) => `$${value.toFixed(2)}`,
  },
  {
    key: 'lead_time_days',
    label: 'Lead Time (days)',
    min: 1,
    max: 60,
    step: 1,
    description: 'Supplier lead time',
    format: (value) => `${value.toFixed(0)} days`,
  },
  {
    key: 'service_level',
    label: 'Service Level',
    min: 0.5,
    max: 0.999,
    step: 0.001,
    description: 'Probability of not stocking out',
    format: (value) => `${(value * 100).toFixed(1)}%`,
  },
];

function SimulationCockpit({ values, onChange, isRunning = false }) {
  const sliders = useMemo(
    () =>
      sliderConfig.map((config) => ({
        ...config,
        value: values[config.key],
      })),
    [values],
  );

  return (
    <div className="cockpit" aria-busy={isRunning}>
      <header>
        <h2>Simulation Cockpit</h2>
        <p>Tweak the parameters to explore cost and risk trade-offs.</p>
      </header>

      <form className="slider-grid" onSubmit={(event) => event.preventDefault()}>
        {sliders.map(({ key, label, description, min, max, step, value, format }) => (
          <label key={key} className="slider-card">
            <div className="slider-head">
              <span className="slider-label">{label}</span>
              <span className="slider-value">{format(value)}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              aria-label={label}
              onChange={(event) => onChange({ [key]: Number(event.target.value) })}
            />
            <p className="slider-description">{description}</p>
          </label>
        ))}
      </form>
      {isRunning && <p className="running-indicator">Recomputing optimal policy…</p>}
    </div>
  );
}

SimulationCockpit.propTypes = {
  values: PropTypes.shape({
    order_cost: PropTypes.number.isRequired,
    holding_cost_per_unit_per_year: PropTypes.number.isRequired,
    lead_time_days: PropTypes.number.isRequired,
    service_level: PropTypes.number.isRequired,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  isRunning: PropTypes.bool,
};

export default SimulationCockpit;
