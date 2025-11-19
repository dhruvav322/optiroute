import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import NewDashboard from '../components/NewDashboard.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';

export default function Overview({ 
  inventorySummary, 
  simulation, 
  forecast, 
  onRunSimulation,
  loading 
}) {
  const navigate = useNavigate();

  // Show empty state if no data is loaded and not currently loading
  if (!loading && !inventorySummary) {
    return (
      <EmptyState 
        title="No Inventory Data Found"
        description="Upload your historical sales CSV to generate your first forecast and optimization plan."
        actionLabel="Go to Upload"
        onAction={() => navigate('/settings')}
        icon="database"
      />
    );
  }

  return (
    <NewDashboard 
      inventorySummary={inventorySummary}
      simulation={simulation}
      forecast={forecast}
      onRunSimulation={onRunSimulation}
      loading={loading}
    />
  );
}

Overview.propTypes = {
  inventorySummary: PropTypes.object,
  simulation: PropTypes.object,
  forecast: PropTypes.object,
  onRunSimulation: PropTypes.func,
  loading: PropTypes.bool,
};

