import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MLOpsPanel from '../MLOpsPanel.jsx';

vi.mock('../../api/client.js', () => ({
  uploadHistoricalCsv: vi.fn(),
  retrainModel: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
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
    render(
      <MLOpsPanel
        onUploadSuccess={onUploadSuccess}
        onRetrainSuccess={vi.fn()}
        modelStatus={null}
        modelReady={false}
      />,
    );

    const fileInput = screen.getByLabelText('Upload historical sales CSV');
    const file = new File(['date,quantity\n2024-01-01,10'], 'sales.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload & Ingest' }));

    await waitFor(() => {
      expect(uploadHistoricalCsv).toHaveBeenCalledWith(file);
      expect(onUploadSuccess).toHaveBeenCalled();
    });
  });

  it('triggers retrain on button click', async () => {
    retrainModel.mockResolvedValue({ status: 'training_started' });

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
      expect(retrainModel).toHaveBeenCalledWith({ train_from_uploaded_data: true });
      expect(onRetrainSuccess).toHaveBeenCalled();
    });
  });
});
