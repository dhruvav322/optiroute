import RouteOptimizer from '../components/RouteOptimizer.jsx';

export default function Logistics() {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Route Logistics</h1>
        <p className="text-muted text-sm mt-1">Optimize delivery routes using TSP or VRP algorithms with live map visualization.</p>
      </div>
      
      <div className="flex-1 min-h-0">
        <RouteOptimizer />
      </div>
    </div>
  );
}

