import ModelEvaluation from '../components/ModelEvaluation.jsx';
import FeatureInsights from '../components/FeatureInsights.jsx';

export default function Forecast() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Model Intelligence</h1>
        <p className="text-muted text-sm mt-1">Deep analytical insights into forecast accuracy and feature importance.</p>
      </div>

      <div className="bg-surface/50 border border-border p-6 rounded-lg">
        <ModelEvaluation />
      </div>

      <div className="bg-surface/50 border border-border p-6 rounded-lg">
        <FeatureInsights />
      </div>
    </div>
  );
}

