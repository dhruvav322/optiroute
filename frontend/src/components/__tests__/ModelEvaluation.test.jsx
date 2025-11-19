import { render, screen } from '@testing-library/react';
import ModelEvaluation from '../ModelEvaluation.jsx';

const SAMPLE_DATA = {
  evaluated_at: '2025-01-02T00:00:00Z',
  test_start: '2024-12-02T00:00:00Z',
  test_end: '2025-01-01T00:00:00Z',
  models: [
    {
      name: 'prophet',
      metrics: { mae: 5.2, rmse: 6.1, mape: 4.3, aic: 120.5, bic: 135.9 },
      horizon_metrics: [
        { horizon: 1, mae: 4.0, rmse: 5.1, mape: 3.0 },
        { horizon: 7, mae: 5.0, rmse: 6.0, mape: 4.0 },
      ],
      predictions: [
        {
          date: '2025-01-01T00:00:00',
          actual: 120,
          prediction: 118,
          lower: 110,
          upper: 125,
        },
      ],
      residuals: [2],
      residual_summary: { mean: 2, std: 0, median: 2, mad: 0 },
      histogram: [{ bin_start: 1.5, bin_end: 2.5, count: 1 }],
    },
  ],
  comparison: [
    { model: 'prophet', mae: 5.2, rmse: 6.1, mape: 4.3, aic: 120.5, bic: 135.9 },
    { model: 'arima', mae: 5.5, rmse: 6.4, mape: 4.6, aic: 130.1, bic: 142.3 },
  ],
  training_history: [],
  errors: null,
  model_selection_reason: 'Prophet leads.',
};

describe('ModelEvaluation', () => {
  it('renders metrics table and charts from fallback data', () => {
    render(<ModelEvaluation fallbackData={SAMPLE_DATA} />);
    expect(screen.getByText(/Model Evaluation/i)).toBeInTheDocument();
    // Use getAllByText since "PROPHET" appears multiple times (table row and elsewhere)
    const prophetElements = screen.getAllByText(/PROPHET/i);
    expect(prophetElements.length).toBeGreaterThan(0);
    expect(screen.getByText(/Forecast Horizons/i)).toBeInTheDocument();
    expect(screen.getByText(/Prophet leads./i)).toBeInTheDocument();
  });
});
