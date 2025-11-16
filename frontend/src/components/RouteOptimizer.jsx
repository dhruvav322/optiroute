import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { optimizeRoutes } from '../api/client.js';
import './routeOptimizer.css';

const DEFAULT_LOCATIONS = [
  { id: 'depot', name: 'Warehouse', latitude: 37.7749, longitude: -122.4194, demand: 0 },
  { id: 'loc1', name: 'Location 1', latitude: 37.7849, longitude: -122.4094, demand: 50 },
  { id: 'loc2', name: 'Location 2', latitude: 37.7649, longitude: -122.4294, demand: 75 },
  { id: 'loc3', name: 'Location 3', latitude: 37.7949, longitude: -122.4394, demand: 100 },
  { id: 'loc4', name: 'Location 4', latitude: 37.7549, longitude: -122.3994, demand: 60 },
];

function RouteOptimizer() {
  const [locations, setLocations] = useState(DEFAULT_LOCATIONS);
  const [problemType, setProblemType] = useState('tsp');
  const [vehicles, setVehicles] = useState([
    { id: 'vehicle1', capacity: 200, cost_per_km: 1.5 },
    { id: 'vehicle2', capacity: 200, cost_per_km: 1.5 },
  ]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleOptimize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        locations: locations.map(loc => ({
          id: loc.id,
          name: loc.name,
          latitude: loc.latitude,
          longitude: loc.longitude,
          demand: loc.demand || 0,
        })),
        depot_index: 0,
        problem_type: problemType,
        ...(problemType === 'vrp' && { vehicles }),
      };
      const response = await optimizeRoutes(payload);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to optimize routes');
    } finally {
      setLoading(false);
    }
  }, [locations, problemType, vehicles]);

  const updateLocation = useCallback((index, field, value) => {
    setLocations(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: parseFloat(value) || value };
      return updated;
    });
  }, []);

  const addLocation = useCallback(() => {
    setLocations(prev => [
      ...prev,
      {
        id: `loc${prev.length}`,
        name: `Location ${prev.length}`,
        latitude: 37.7749 + (Math.random() - 0.5) * 0.1,
        longitude: -122.4194 + (Math.random() - 0.5) * 0.1,
        demand: 50,
      },
    ]);
  }, []);

  const removeLocation = useCallback((index) => {
    if (locations.length > 1 && index !== 0) {
      setLocations(prev => prev.filter((_, i) => i !== index));
    }
  }, [locations.length]);

  const mapUrl = useMemo(() => {
    if (!result) return null;
    
    const route = problemType === 'tsp' 
      ? result.tsp_result?.route || []
      : result.vrp_result?.vehicle_routes?.[0]?.route || [];
    
    if (route.length === 0) return null;

    const path = route
      .map(loc => `${loc.latitude},${loc.longitude}`)
      .join('/');
    
    const markers = route
      .map((loc, idx) => `label:${idx + 1}|${loc.latitude},${loc.longitude}`)
      .join('&markers=');

    return `https://www.google.com/maps/dir/${path}?waypoints=${markers}`;
  }, [result, problemType]);

  return (
    <div className="route-optimizer">
      <header className="route-optimizer-header">
        <h2>Route Optimizer</h2>
        <p className="subtitle">Optimize delivery routes using TSP or VRP algorithms</p>
      </header>

      <div className="route-optimizer-content">
        <div className="route-optimizer-controls">
          <div className="control-group">
            <label>
              Problem Type:
              <select
                value={problemType}
                onChange={(e) => setProblemType(e.target.value)}
                className="select-input"
              >
                <option value="tsp">TSP (Single Vehicle)</option>
                <option value="vrp">VRP (Multiple Vehicles)</option>
              </select>
            </label>
          </div>

          <div className="locations-section">
            <div className="section-header">
              <h3>Locations</h3>
              <button onClick={addLocation} className="btn-add" type="button">
                + Add Location
              </button>
            </div>
            <div className="locations-list">
              {locations.map((loc, idx) => (
                <div key={loc.id} className="location-item">
                  <div className="location-inputs">
                    <input
                      type="text"
                      value={loc.name}
                      onChange={(e) => updateLocation(idx, 'name', e.target.value)}
                      placeholder="Location name"
                      className="input-text"
                    />
                    <input
                      type="number"
                      step="0.0001"
                      value={loc.latitude}
                      onChange={(e) => updateLocation(idx, 'latitude', e.target.value)}
                      placeholder="Latitude"
                      className="input-number"
                    />
                    <input
                      type="number"
                      step="0.0001"
                      value={loc.longitude}
                      onChange={(e) => updateLocation(idx, 'longitude', e.target.value)}
                      placeholder="Longitude"
                      className="input-number"
                    />
                    {problemType === 'vrp' && (
                      <input
                        type="number"
                        value={loc.demand}
                        onChange={(e) => updateLocation(idx, 'demand', e.target.value)}
                        placeholder="Demand"
                        className="input-number"
                      />
                    )}
                    {idx !== 0 && (
                      <button
                        onClick={() => removeLocation(idx)}
                        className="btn-remove"
                        type="button"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {problemType === 'vrp' && (
            <div className="vehicles-section">
              <h3>Vehicles</h3>
              {vehicles.map((vehicle, idx) => (
                <div key={vehicle.id} className="vehicle-item">
                  <input
                    type="number"
                    value={vehicle.capacity}
                    onChange={(e) => {
                      const updated = [...vehicles];
                      updated[idx].capacity = parseFloat(e.target.value) || 0;
                      setVehicles(updated);
                    }}
                    placeholder="Capacity"
                    className="input-number"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={vehicle.cost_per_km}
                    onChange={(e) => {
                      const updated = [...vehicles];
                      updated[idx].cost_per_km = parseFloat(e.target.value) || 0;
                      setVehicles(updated);
                    }}
                    placeholder="Cost/km"
                    className="input-number"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleOptimize}
            disabled={loading || locations.length < 2}
            className="btn-optimize"
            type="button"
          >
            {loading ? 'Optimizing...' : 'Optimize Routes'}
          </button>

          {error && <div className="error-message">{error}</div>}
        </div>

        {result && (
          <div className="route-results">
            <h3>Optimization Results</h3>
            
            {problemType === 'tsp' && result.tsp_result && (
              <div className="result-summary">
                <div className="metric">
                  <span className="metric-label">Total Distance:</span>
                  <span className="metric-value">{result.tsp_result.total_distance_km} km</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Number of Stops:</span>
                  <span className="metric-value">{result.tsp_result.number_of_stops}</span>
                </div>
                <div className="route-sequence">
                  <h4>Route Sequence:</h4>
                  <ol>
                    {result.tsp_result.route.map((stop, idx) => (
                      <li key={`${stop.id}-${idx}`}>
                        {idx + 1}. {stop.name} ({stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)})
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}

            {problemType === 'vrp' && result.vrp_result && (
              <div className="result-summary">
                <div className="metric">
                  <span className="metric-label">Total Distance:</span>
                  <span className="metric-value">{result.vrp_result.total_distance_km} km</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Vehicles Used:</span>
                  <span className="metric-value">
                    {result.vrp_result.vehicles_used} / {result.vrp_result.total_vehicles}
                  </span>
                </div>
                {result.vrp_result.vehicle_routes.map((vehicleRoute) => (
                  <div key={vehicleRoute.vehicle_id} className="vehicle-route">
                    <h4>Vehicle {vehicleRoute.vehicle_id}</h4>
                    <div className="metric">
                      <span className="metric-label">Distance:</span>
                      <span className="metric-value">{vehicleRoute.distance_km} km</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Stops:</span>
                      <span className="metric-value">{vehicleRoute.number_of_stops}</span>
                    </div>
                    <div className="route-sequence">
                      <ol>
                        {vehicleRoute.route.map((stop, idx) => (
                          <li key={`${vehicleRoute.vehicle_id}-${stop.id}-${idx}`}>
                            {idx + 1}. {stop.name}
                            {stop.demand && ` (Demand: ${stop.demand})`}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {mapUrl && (
              <div className="map-link">
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-map"
                >
                  View Route on Google Maps
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

RouteOptimizer.propTypes = {
  // Component doesn't take props currently
};

export default RouteOptimizer;

