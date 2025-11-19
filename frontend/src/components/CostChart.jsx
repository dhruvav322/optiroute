import PropTypes from 'prop-types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { CustomTooltip } from './ui/ChartTooltip.jsx';

function CostChart({ data = null }) {
  if (!data) {
    return (
      <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl p-8 text-center text-muted" role="status">
        Adjust the sliders to run a simulation and see cost impacts.
      </div>
    );
  }

  const chartData = [
    { name: 'Ordering', value: Math.round(data.orderingCost) },
    { name: 'Holding', value: Math.round(data.holdingCost) },
    { name: 'Purchase', value: Math.round(data.purchaseCost) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex justify-between items-baseline flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-amber-400">Cost Impact</h2>
        <p className="text-sm text-muted">Total projected cost: ${Math.round(data.total).toLocaleString()}</p>
      </header>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis 
            dataKey="name" 
            stroke="#52525b" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#52525b" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value.toLocaleString()}`} 
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#27272a', strokeWidth: 1 }}
          />
          <Legend wrapperStyle={{ color: '#a1a1aa' }} />
          <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

CostChart.propTypes = {
  data: PropTypes.shape({
    orderingCost: PropTypes.number.isRequired,
    holdingCost: PropTypes.number.isRequired,
    purchaseCost: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
  }),
};

export default CostChart;
