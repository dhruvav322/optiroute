import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'sonner';
import { formatDate } from '../utils/formatters.js';

import { retrainModel, uploadHistoricalCsv } from '../api/client.js';
import { DragDropUpload } from './ui/DragDropUpload.jsx';
import { ColumnMappingModal } from './ui/ColumnMappingModal.jsx';
import { Button, Card } from './ui/LinearComponents.jsx';

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
    return <p className="text-muted text-sm">No metrics recorded yet.</p>;
  }

  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
      {Object.entries(metrics).map(([key, value]) => (
        <div key={key} className="bg-zinc-900/50 border border-blue-500/10 rounded-lg p-3">
          <dt className="text-xs text-muted mb-1">{key}</dt>
          <dd className="text-sm font-mono text-white">{formatMetric(value)}</dd>
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
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [outlierHandling, setOutlierHandling] = useState('winsorize');

  const outlierDescription = useMemo(
    () => OUTLIER_OPTIONS.find((option) => option.value === outlierHandling)?.description,
    [outlierHandling],
  );

  const parseCsvHeaders = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const firstLine = text.split('\n')[0];
          const headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
          resolve(headers);
        } catch (err) {
          reject(new Error('Failed to parse CSV headers'));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      // Only read first line (1024 bytes should be enough for headers)
      reader.readAsText(file.slice(0, 1024));
    });
  };

  const checkHeadersMatch = (headers) => {
    const normalized = headers.map(h => h.toLowerCase().trim());
    const hasDate = normalized.some(h => h === 'date');
    const hasQuantity = normalized.some(h => h === 'quantity');
    return hasDate && hasQuantity;
  };

  const handleFileSelect = async (file, error) => {
    if (error) {
      toast.error('Invalid file type', {
        description: error.message || 'Only CSV files are allowed',
      });
      setSelectedFile(null);
      setCsvHeaders([]);
      setColumnMapping(null);
      return;
    }

    if (!file) {
      setSelectedFile(null);
      setCsvHeaders([]);
      setColumnMapping(null);
      return;
    }

    // Parse CSV headers
    try {
      const headers = await parseCsvHeaders(file);
      setCsvHeaders(headers);
      setSelectedFile(file);

      // Check if headers match exactly - if not, show mapping modal
      if (!checkHeadersMatch(headers)) {
        setShowMappingModal(true);
        setColumnMapping(null); // Reset mapping if file changes
      } else {
        // Headers match, no mapping needed
        setColumnMapping(null);
      }
    } catch (err) {
      toast.error('Failed to parse CSV', {
        description: err.message || 'Could not read CSV headers',
      });
      setSelectedFile(null);
      setCsvHeaders([]);
      setColumnMapping(null);
    }
  };

  const handleMappingConfirm = (mapping) => {
    setColumnMapping(mapping);
    setShowMappingModal(false);
    toast.success('Column mapping saved', {
      description: 'Ready to upload. Click "Upload & Ingest" to proceed.',
    });
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      toast.warning('Select a CSV file before uploading');
      return;
    }
    
    // Validate file type
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Invalid file type', {
        description: 'Please select a CSV file (.csv extension required)',
      });
      return;
    }
    
    // Check if mapping is needed but not provided
    if (!checkHeadersMatch(csvHeaders) && !columnMapping) {
      toast.warning('Column mapping required', {
        description: 'Please map your CSV columns before uploading',
      });
      setShowMappingModal(true);
      return;
    }
    
    setUploading(true);
    try {
      const response = await uploadHistoricalCsv(selectedFile, columnMapping);
      toast.success('Upload complete', {
        description: `Uploaded ${response.records_added} records`,
      });
      onUploadSuccess?.();
      setSelectedFile(null);
      setCsvHeaders([]);
      setColumnMapping(null);
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error.message || error.payload?.detail || 'Upload failed';
      toast.error('Upload failed', {
        description: errorMessage,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRetrain = async () => {
    // Optimistic UI: Show success state immediately
    setRetraining(true);
    const optimisticToast = toast.loading('Scheduling retraining...', {
      description: 'Model will be retrained in the background',
    });

    try {
      // client_id removed - now extracted from JWT token on backend
      const response = await retrainModel({
        train_from_uploaded_data: true,
        outlier_handling: outlierHandling,
      });

      // Dismiss loading toast and show success
      toast.dismiss(optimisticToast);

      if (response?.outlier_stats) {
        const { method, outliers_detected, outliers_removed, outliers_capped } = response.outlier_stats;
        const parts = [
          `method: ${method}`,
          `detected: ${outliers_detected}`,
          outlierHandling === 'remove' ? `removed: ${outliers_removed}` : null,
          outlierHandling === 'winsorize' ? `capped: ${outliers_capped}` : null,
        ].filter(Boolean);
        toast.success('Retraining complete', {
          description: parts.join(', '),
        });
      } else {
        toast.success('Retraining complete');
      }

      // Trigger callback optimistically
      onRetrainSuccess?.();
    } catch (error) {
      // Dismiss loading toast and show error
      toast.dismiss(optimisticToast);
      toast.error('Retrain failed', {
        description: error.message || 'Unknown error occurred',
      });
    } finally {
      setRetraining(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ColumnMappingModal
        open={showMappingModal}
        onOpenChange={setShowMappingModal}
        csvHeaders={csvHeaders}
        onConfirm={handleMappingConfirm}
      />

      <header>
        <h2 className="text-xl font-semibold text-amber-300 mb-1">MLOps Control Center</h2>
        <p className="text-sm text-muted max-w-2xl">Upload new demand history and trigger retraining without downtime.</p>
      </header>

      <form className="flex flex-wrap gap-4 items-end" onSubmit={handleUpload}>
        <div className="flex-1 min-w-[300px]">
          <DragDropUpload onFileSelect={handleFileSelect} />
          {selectedFile && !checkHeadersMatch(csvHeaders) && !columnMapping && (
            <p className="text-xs text-amber-400/75 mt-2">
              ⚠️ Column mapping required for this file
            </p>
          )}
          {columnMapping && (
            <p className="text-xs text-green-400/75 mt-2">
              ✓ Columns mapped: {columnMapping.date} → date, {columnMapping.quantity} → quantity
              {columnMapping.sku && `, ${columnMapping.sku} → sku`}
            </p>
          )}
        </div>
        <Button 
          type="submit" 
          variant="primary" 
          disabled={uploading || !selectedFile || (!checkHeadersMatch(csvHeaders) && !columnMapping)}
        >
          {uploading ? 'Uploading…' : 'Upload & Ingest'}
        </Button>
      </form>

      <section className="space-y-4" aria-label="Outlier handling strategy">
        <h3 className="text-sm font-medium text-white">Outlier Handling</h3>
        <div className="space-y-2" role="radiogroup" aria-label="Select outlier handling strategy">
          {OUTLIER_OPTIONS.map((option) => (
            <label 
              key={option.value} 
              className="flex items-start gap-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg cursor-pointer hover:border-zinc-700 transition-colors"
            >
              <input
                type="radio"
                name="outlier-handling"
                value={option.value}
                checked={outlierHandling === option.value}
                onChange={(event) => setOutlierHandling(event.target.value)}
                className="mt-0.5 accent-blue-500"
              />
              <div className="flex-1">
                <span className="block text-sm font-medium text-white mb-1">{option.label}</span>
                <span className="block text-xs text-muted">{option.description}</span>
              </div>
            </label>
          ))}
        </div>
        {outlierDescription && (
          <p className="text-xs text-amber-400/75">{outlierDescription}</p>
        )}
      </section>

      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="secondary"
          onClick={handleRetrain}
          disabled={retraining}
          aria-disabled={retraining}
        >
          {retraining ? 'Scheduling…' : 'Retrain Forecast Model'}
        </Button>
        {!modelReady && !retraining && (
          <span className="text-xs text-amber-400/75">Upload data and retrain to unlock simulations.</span>
        )}
      </div>

      <Card className="p-5">
        <section className="flex flex-col gap-4" aria-live="polite">
          <h3 className="text-sm font-medium text-white">Latest Model Snapshot</h3>
        {modelStatus ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-muted">Model Type</span>
                <span className="text-sm text-white">{modelStatus.model_type}</span>
            </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-muted">Last Trained</span>
                <span className="text-sm text-white">
                {formatDate(modelStatus.trained_at)}
              </span>
            </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-muted">Model Path</span>
                <span className="text-xs font-mono text-white">{modelStatus.model_path}</span>
            </div>
            {modelStatus.notes && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-muted">Notes</span>
                  <span className="text-sm text-white">{modelStatus.notes}</span>
              </div>
            )}
          </div>
        ) : (
            <p className="text-sm text-muted">No trained model detected yet.</p>
        )}

          <div className="border-t border-border pt-4 mt-2">
            <h4 className="text-xs font-medium text-white mb-3">Training Metrics</h4>
        <MetricsTable metrics={modelStatus?.train_metrics} />
          </div>
      </section>
      </Card>
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
