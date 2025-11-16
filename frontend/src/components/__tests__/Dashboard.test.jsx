import { render, screen } from '@testing-library/react';
import Dashboard from '../Dashboard.jsx';

describe('Dashboard', () => {
  it('shows summary metrics', () => {
    const summary = {
      current_stock_level: 750,
      forecasted_30_day_demand: 1200,
      optimal_reorder_point: 420,
      safety_stock: 80,
    };

    render(<Dashboard summary={summary} loading={false} />);

    expect(screen.getByText('Current Stock Level')).toBeInTheDocument();
    expect(screen.getByText('750')).toBeInTheDocument();
    expect(screen.getByText('Forecasted 30-Day Demand')).toBeInTheDocument();
    expect(screen.getByText('1,200')).toBeInTheDocument();
  });

  it('renders loading state placeholder', () => {
    render(<Dashboard loading summary={null} />);

    expect(screen.getAllByText('—')).not.toHaveLength(0);
  });
});
