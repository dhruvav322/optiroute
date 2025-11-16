import PropTypes from 'prop-types';

import './dashboard.css';

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

function Dashboard({ summary = null, simulation = null, forecast = null, loading = false }) {
  const totalForecastDemand = forecast?.forecast?.reduce(
    (acc, point) => acc + (point?.demand ?? 0),
    0,
  );

  const cards = [
    {
      label: 'Current Stock Level',
      value: summary?.current_stock_level ?? 0,
      description: 'Units available in storage',
    },
    {
      label: 'Forecasted 30-Day Demand',
      value: totalForecastDemand ?? summary?.forecasted_30_day_demand ?? 0,
      description: 'Projected demand using latest forecast model',
    },
    {
      label: 'Optimal Reorder Point',
      value: simulation?.new_reorder_point ?? summary?.optimal_reorder_point ?? 0,
      description: 'Target inventory position prior to reordering',
    },
    {
      label: 'Safety Stock',
      value: simulation?.safety_stock ?? summary?.safety_stock ?? 0,
      description: 'Buffer inventory to maintain service level',
    },
  ];

  return (
    <section className="dashboard-grid" aria-live="polite">
      {cards.map(({ label, value, description }) => (
        <article key={label} className="kpi-card" aria-busy={loading}>
          <header>
            <h2>{label}</h2>
          </header>
          <p className={`kpi-value ${loading ? 'loading' : ''}`}>
            {loading ? '—' : numberFormatter.format(value)}
          </p>
          <p className="kpi-description">{description}</p>
        </article>
      ))}
    </section>
  );
}

Dashboard.propTypes = {
  summary: PropTypes.shape({
    current_stock_level: PropTypes.number,
    forecasted_30_day_demand: PropTypes.number,
    optimal_reorder_point: PropTypes.number,
    safety_stock: PropTypes.number,
  }),
  simulation: PropTypes.shape({
    new_reorder_point: PropTypes.number,
    safety_stock: PropTypes.number,
  }),
  forecast: PropTypes.shape({
    forecast: PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.string,
        demand: PropTypes.number,
      }),
    ),
  }),
  loading: PropTypes.bool,
};

export default Dashboard;
