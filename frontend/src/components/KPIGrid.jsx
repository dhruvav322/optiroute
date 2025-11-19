import PropTypes from 'prop-types';
import { TrendingUp, TrendingDown, Package, AlertCircle } from 'lucide-react';

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

function KPIGrid({ summary = null, simulation = null, forecast = null, loading = false }) {
  const totalForecastDemand = forecast?.forecast?.reduce(
    (acc, point) => acc + (point?.demand ?? 0),
    0,
  );

  const cards = [
    {
      label: 'Current Stock Level',
      value: summary?.current_stock_level ?? 0,
      description: 'Units available in storage',
      icon: Package,
      trend: null,
    },
    {
      label: 'Forecasted 30-Day Demand',
      value: totalForecastDemand ?? summary?.forecasted_30_day_demand ?? 0,
      description: 'Projected demand using latest forecast model',
      icon: TrendingUp,
      trend: 'up',
    },
    {
      label: 'Optimal Reorder Point',
      value: simulation?.new_reorder_point ?? summary?.optimal_reorder_point ?? 0,
      description: 'Target inventory position prior to reordering',
      icon: AlertCircle,
      trend: null,
    },
    {
      label: 'Safety Stock',
      value: simulation?.safety_stock ?? summary?.safety_stock ?? 0,
      description: 'Buffer inventory to maintain service level',
      icon: Package,
      trend: null,
    },
  ];

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" aria-live="polite">
      {cards.map(({ label, value, description, icon: Icon, trend }) => (
        <article
          key={label}
          className="relative bg-zinc-900 border border-zinc-800 p-4 transition-all duration-150 hover:border-white hover:bg-zinc-950"
          aria-busy={loading}
        >
          <header className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              {label}
            </h3>
            {Icon && (
              <Icon className="w-4 h-4 text-zinc-600" strokeWidth={1.5} />
            )}
          </header>
          
          <p className={`text-3xl font-mono-numbers font-semibold mb-2 ${loading ? 'text-zinc-800' : 'text-white'}`}>
            {loading ? '—' : numberFormatter.format(value)}
          </p>
          
          <p className="text-xs text-zinc-500 leading-relaxed">
            {description}
          </p>

          {trend && (
            <div className="absolute top-4 right-4">
              {trend === 'up' && (
                <TrendingUp className="w-4 h-4 text-accent-electric" strokeWidth={2} />
              )}
              {trend === 'down' && (
                <TrendingDown className="w-4 h-4 text-red-500" strokeWidth={2} />
              )}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

KPIGrid.propTypes = {
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

export default KPIGrid;

