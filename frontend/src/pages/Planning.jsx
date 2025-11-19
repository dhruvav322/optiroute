import PropTypes from 'prop-types';
import SimulationCockpit from '../components/SimulationCockpit.jsx';
import CostChart from '../components/CostChart.jsx';

export default function Planning({ 
  simulationParams,
  onSliderChange,
  costBreakdown,
  loadingSimulation 
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Inventory Planning</h1>
        <p className="text-muted text-sm mt-1">Configure parameters and analyze cost breakdowns.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface/50 border border-border p-6 rounded-lg">
          <SimulationCockpit
            values={simulationParams}
            onChange={onSliderChange}
            isRunning={loadingSimulation}
          />
        </div>
        <div className="bg-surface/50 border border-border p-6 rounded-lg">
          <CostChart data={costBreakdown} />
        </div>
      </div>
    </div>
  );
}

Planning.propTypes = {
  simulationParams: PropTypes.object.isRequired,
  onSliderChange: PropTypes.func.isRequired,
  costBreakdown: PropTypes.object,
  loadingSimulation: PropTypes.bool,
};

