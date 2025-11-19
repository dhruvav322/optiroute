import PropTypes from 'prop-types';
import MLOpsPanel from '../components/MLOpsPanel.jsx';

export default function Settings({ 
  modelStatus,
  modelReady,
  onUploadSuccess,
  onRetrainSuccess 
}) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">System Settings</h1>
        <p className="text-muted text-sm mt-1">Manage ML models, upload data, and configure system parameters.</p>
      </div>

      <div className="bg-surface/50 border border-border p-6 rounded-lg">
        <MLOpsPanel
          onUploadSuccess={onUploadSuccess}
          onRetrainSuccess={onRetrainSuccess}
          modelStatus={modelStatus}
          modelReady={modelReady}
        />
      </div>
    </div>
  );
}

Settings.propTypes = {
  modelStatus: PropTypes.object,
  modelReady: PropTypes.bool,
  onUploadSuccess: PropTypes.func,
  onRetrainSuccess: PropTypes.func,
};

