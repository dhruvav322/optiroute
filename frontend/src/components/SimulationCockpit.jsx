import PropTypes from 'prop-types';
import { useMemo } from 'react';

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
    <div className="flex flex-col gap-6" aria-busy={isRunning}>
      <header>
        <h2 className="text-xl font-semibold text-blue-200 mb-1">Simulation Cockpit</h2>
        <p className="text-sm text-muted">Tweak the parameters to explore cost and risk trade-offs.</p>
      </header>

      <form className="grid grid-cols-1 md:grid-cols-2 gap-5" onSubmit={(event) => event.preventDefault()}>
        {sliders.map(({ key, label, description, min, max, step, value, format }) => (
          <label key={key} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3 cursor-pointer hover:border-zinc-700 transition-colors">
            <div className="flex justify-between items-baseline text-zinc-100">
              <span className="font-semibold text-sm">{label}</span>
              <span className="text-xs font-mono text-zinc-400">{format(value)}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              aria-label={label}
              onChange={(event) => onChange({ [key]: Number(event.target.value) })}
              className="w-full accent-blue-500"
            />
            <p className="text-xs text-muted">{description}</p>
          </label>
        ))}
      </form>
      {isRunning && <p className="text-sm text-blue-400">Recomputing optimal policy…</p>}
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
