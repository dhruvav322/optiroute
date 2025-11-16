import { render, screen, fireEvent } from '@testing-library/react';
import SimulationCockpit from '../SimulationCockpit.jsx';

describe('SimulationCockpit', () => {
  const defaultValues = {
    order_cost: 50,
    holding_cost_per_unit_per_year: 2.5,
    lead_time_days: 10,
    service_level: 0.95,
  };

  it('renders all sliders', () => {
    render(<SimulationCockpit values={defaultValues} onChange={() => {}} isRunning={false} />);

    expect(screen.getByLabelText('Order Cost')).toBeInTheDocument();
    expect(screen.getByLabelText('Holding Cost per Unit / Year')).toBeInTheDocument();
    expect(screen.getByLabelText('Lead Time (days)')).toBeInTheDocument();
    expect(screen.getByLabelText('Service Level')).toBeInTheDocument();
  });

  it('fires onChange when slider value changes', () => {
    const handleChange = vi.fn();
    render(<SimulationCockpit values={defaultValues} onChange={handleChange} isRunning={false} />);

    const orderCostSlider = screen.getByLabelText('Order Cost');
    fireEvent.change(orderCostSlider, { target: { value: '75' } });

    expect(handleChange).toHaveBeenCalledWith({ order_cost: 75 });
  });
});
