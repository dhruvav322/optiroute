import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MLOpsPanel from '../MLOpsPanel.jsx';

vi.mock('../../api/client.js', () => ({
  uploadHistoricalCsv: vi.fn(),
  retrainModel: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const { uploadHistoricalCsv, retrainModel } = await import('../../api/client.js');

describe('MLOpsPanel', () => {
  beforeEach(() => {
    uploadHistoricalCsv.mockReset();
    retrainModel.mockReset();
  });

  it('uploads selected CSV file', async () => {
    uploadHistoricalCsv.mockResolvedValue({ status: 'uploaded', records_added: 2 });

    const onUploadSuccess = vi.fn();
    const { container } = render(
      <MLOpsPanel
        onUploadSuccess={onUploadSuccess}
        onRetrainSuccess={vi.fn()}
        modelStatus={null}
        modelReady={false}
      />,
    );

    // Find the file input by its id (since getByLabelText might not work with aria-label on file inputs)
    const fileInput = container.querySelector('#csv-upload-input') || 
                      screen.getByLabelText(/upload historical sales csv/i);
    const file = new File(['date,quantity\n2024-01-01,10'], 'sales.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    
    // Wait for FileReader to parse CSV headers (component parses headers asynchronously)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Upload & Ingest' })).not.toBeDisabled();
    }, { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: 'Upload & Ingest' }));

    await waitFor(() => {
      // uploadHistoricalCsv is called with file and optional columnMapping (null in this test since headers match)
      expect(uploadHistoricalCsv).toHaveBeenCalledWith(file, null);
      expect(onUploadSuccess).toHaveBeenCalled();
    });
  });

  it('triggers retrain on button click', async () => {
    retrainModel.mockResolvedValue({ status: 'training_completed' });

    const onRetrainSuccess = vi.fn();
    render(
      <MLOpsPanel
        onUploadSuccess={vi.fn()}
        onRetrainSuccess={onRetrainSuccess}
        modelStatus={null}
        modelReady={true}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retrain Forecast Model' }));

    await waitFor(() => {
      // Component calls retrainModel with both train_from_uploaded_data and outlier_handling (default: 'winsorize')
      expect(retrainModel).toHaveBeenCalledWith({ 
        train_from_uploaded_data: true,
        outlier_handling: 'winsorize' 
      });
      expect(onRetrainSuccess).toHaveBeenCalled();
    });
  });
});
