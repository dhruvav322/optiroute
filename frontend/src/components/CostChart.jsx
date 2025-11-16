import PropTypes from 'prop-types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

import './costChart.css';

function CostChart({ data = null }) {
  if (!data) {
    return (
      <div className="chart-placeholder" role="status">
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
    <div className="cost-chart">
      <header>
        <h2>Cost Impact</h2>
        <p>Total projected cost: ${Math.round(data.total).toLocaleString()}</p>
      </header>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
          <XAxis dataKey="name" stroke="#cbd5f5" />
          <YAxis stroke="#cbd5f5" tickFormatter={(value) => `$${value.toLocaleString()}`} />
          <Tooltip
            cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
            contentStyle={{ background: '#0f172a', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#f8fafc' }}
            formatter={(value) => [`$${Math.round(value).toLocaleString()}`, 'Cost']}
          />
          <Legend wrapperStyle={{ color: '#cbd5f5' }} />
          <Bar dataKey="value" fill="#38bdf8" radius={[8, 8, 0, 0]} />
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
