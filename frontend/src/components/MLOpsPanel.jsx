import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';

import { retrainModel, uploadHistoricalCsv } from '../api/client.js';
import './mlopsPanel.css';

function formatMetric(value) {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toString() : value.toFixed(3);
  }
  return String(value);
}

function MetricsTable({ metrics = null }) {
  if (!metrics || Object.keys(metrics).length === 0) {
    return <p className="metric-empty">No metrics recorded yet.</p>;
  }

  return (
    <dl className="metrics-grid">
      {Object.entries(metrics).map(([key, value]) => (
        <div className="metrics-row" key={key}>
          <dt>{key}</dt>
          <dd>{formatMetric(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

MetricsTable.propTypes = {
  metrics: PropTypes.object,
};

const OUTLIER_OPTIONS = [
  {
    value: 'keep',
    label: 'Keep',
    description: 'Preserve all data (recommended for small datasets)',
  },
  {
    value: 'winsorize',
    label: 'Winsorize',
    description: 'Cap extreme values (recommended for most cases)',
  },
  {
    value: 'remove',
    label: 'Remove',
    description: 'Exclude outliers (use if data quality is poor)',
  },
];

function MLOpsPanel({ onUploadSuccess, onRetrainSuccess, modelStatus = null, modelReady = false }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [outlierHandling, setOutlierHandling] = useState('winsorize');

  const outlierDescription = useMemo(
    () => OUTLIER_OPTIONS.find((option) => option.value === outlierHandling)?.description,
    [outlierHandling],
  );

  const handleFileChange = (event) => {
    const [file] = event.target.files;
    setSelectedFile(file ?? null);
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      toast.warn('Select a CSV file before uploading');
      return;
    }
    
    // Validate file type
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file (.csv extension required)');
      return;
    }
    
    setUploading(true);
    try {
      const response = await uploadHistoricalCsv(selectedFile);
      toast.success(`Uploaded ${response.records_added} records`);
      onUploadSuccess?.();
      setSelectedFile(null);
      // Reset file input
      event.target.reset();
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error.message || error.payload?.detail || 'Upload failed';
      toast.error(`Upload failed: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const response = await retrainModel({
        train_from_uploaded_data: true,
        outlier_handling: outlierHandling,
      });

      if (response?.outlier_stats) {
        const { method, outliers_detected, outliers_removed, outliers_capped } = response.outlier_stats;
        const parts = [
          `method: ${method}`,
          `detected: ${outliers_detected}`,
          outlierHandling === 'remove' ? `removed: ${outliers_removed}` : null,
          outlierHandling === 'winsorize' ? `capped: ${outliers_capped}` : null,
        ].filter(Boolean);
        toast.success(`Retraining complete (${parts.join(', ')})`);
      } else {
        toast.success('Retraining complete.');
      }

      onRetrainSuccess?.();
    } catch (error) {
      toast.error(error.message || 'Retrain failed');
    } finally {
      setRetraining(false);
    }
  };

  return (
    <div className="mlops-panel">
      <header>
        <h2>MLOps Control Center</h2>
        <p>Upload new demand history and trigger retraining without downtime.</p>
      </header>

      <form className="upload-form" onSubmit={handleUpload}>
        <label className="file-input">
          <span>Historical sales CSV</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            aria-label="Upload historical sales CSV"
          />
        </label>
        <button type="submit" className="primary" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload & Ingest'}
        </button>
      </form>

      <section className="outlier-control" aria-label="Outlier handling strategy">
        <h3>Outlier Handling</h3>
        <div className="outlier-options" role="radiogroup" aria-label="Select outlier handling strategy">
          {OUTLIER_OPTIONS.map((option) => (
            <label key={option.value} className="outlier-option">
              <input
                type="radio"
                name="outlier-handling"
                value={option.value}
                checked={outlierHandling === option.value}
                onChange={(event) => setOutlierHandling(event.target.value)}
              />
              <span className="option-label">{option.label}</span>
              <span className="option-hint">{option.description}</span>
            </label>
          ))}
        </div>
        {outlierDescription && <p className="outlier-description">{outlierDescription}</p>}
      </section>

      <div className="panel-actions">
        <button
          type="button"
          className="secondary"
          onClick={handleRetrain}
          disabled={retraining}
          aria-disabled={retraining}
        >
          {retraining ? 'Scheduling…' : 'Retrain Forecast Model'}
        </button>
        {!modelReady && !retraining && (
          <span className="panel-hint">Upload data and retrain to unlock simulations.</span>
        )}
      </div>

      <section className="panel-status" aria-live="polite">
        <h3>Latest Model Snapshot</h3>
        {modelStatus ? (
          <div className="status-grid">
            <div>
              <span className="status-label">Model Type</span>
              <span className="status-value">{modelStatus.model_type}</span>
            </div>
            <div>
              <span className="status-label">Last Trained</span>
              <span className="status-value">
                {modelStatus.trained_at ? new Date(modelStatus.trained_at).toLocaleString() : '—'}
              </span>
            </div>
            <div>
              <span className="status-label">Model Path</span>
              <span className="status-value mono">{modelStatus.model_path}</span>
            </div>
            {modelStatus.notes && (
              <div>
                <span className="status-label">Notes</span>
                <span className="status-value">{modelStatus.notes}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="metric-empty">No trained model detected yet.</p>
        )}

        <h4>Training Metrics</h4>
        <MetricsTable metrics={modelStatus?.train_metrics} />
      </section>
    </div>
  );
}

MLOpsPanel.propTypes = {
  onUploadSuccess: PropTypes.func,
  onRetrainSuccess: PropTypes.func,
  modelStatus: PropTypes.shape({
    model_type: PropTypes.string,
    trained_at: PropTypes.string,
    model_path: PropTypes.string,
    notes: PropTypes.string,
    train_metrics: PropTypes.object,
  }),
  modelReady: PropTypes.bool,
};

export default MLOpsPanel;
