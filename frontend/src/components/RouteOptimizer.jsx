import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { optimizeRoutes } from '../api/client.js';
import DarkMap from './DarkMap.jsx';
import { Card, Button, Badge } from './ui/LinearComponents.jsx';
import { Plus, X, Zap, Route, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
  const [returnToDepot, setReturnToDepot] = useState(true); // Return to depot by default
  const [searchingAddresses, setSearchingAddresses] = useState({}); // Track which location is being searched
  const [addressSearches, setAddressSearches] = useState({}); // Track search input for each location

  const updateLocation = useCallback((index, field, value) => {
    setLocations(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: parseFloat(value) || value };
      return updated;
    });
  }, []);

  // Geocoding: Search for address and auto-fill coordinates
  const searchAddress = useCallback(async (locationIndex, addressQuery) => {
    if (!addressQuery || addressQuery.trim().length < 3) {
      toast.warning('Please enter at least 3 characters to search');
      return;
    }

    setSearchingAddresses(prev => ({ ...prev, [locationIndex]: true }));

    try {
      // Use OpenStreetMap Nominatim API (free, no API key required)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}&limit=1`,
        {
          headers: {
            'User-Agent': 'Optiroute/1.0' // Nominatim requires a User-Agent
          }
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        toast.error('Address not found', {
          description: 'Try a more specific address or landmark name',
        });
        return;
      }

      const result = data[0];
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      const displayName = result.display_name;

      // Auto-fill coordinates for this location
      updateLocation(locationIndex, 'latitude', lat);
      updateLocation(locationIndex, 'longitude', lon);
      
      // Update name with the found address if name is empty or generic
      const currentName = locations[locationIndex]?.name || '';
      if (!currentName || currentName.match(/Location \d+/)) {
        // Extract a shorter name from display_name (usually first part before comma)
        const shortName = displayName.split(',')[0].trim();
        updateLocation(locationIndex, 'name', shortName);
      }

      toast.success('Address found', {
        description: displayName,
      });
    } catch (err) {
      console.error('Geocoding error:', err);
      toast.error('Failed to search address', {
        description: err.message || 'Please check your internet connection',
      });
    } finally {
      setSearchingAddresses(prev => {
        const updated = { ...prev };
        delete updated[locationIndex];
        return updated;
      });
    }
  }, [locations, updateLocation]);

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
        return_to_depot: returnToDepot, // Include return to depot preference
        ...(problemType === 'vrp' && { vehicles }),
      };
      const response = await optimizeRoutes(payload);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to optimize routes');
    } finally {
      setLoading(false);
    }
  }, [locations, problemType, vehicles, returnToDepot]);

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

  // Convert route results to DarkMap format
  const mapRoutes = useMemo(() => {
    if (!result) return [];
    
    if (problemType === 'tsp' && result.tsp_result?.route) {
      const route = result.tsp_result.route;
      return [{
        name: 'Optimized Route',
        status: 'optimal',
        coordinates: route.map(loc => [loc.latitude, loc.longitude]),
      }];
    }

    if (problemType === 'vrp' && result.vrp_result?.vehicle_routes) {
      return result.vrp_result.vehicle_routes.map((vehicleRoute, idx) => ({
        name: `Vehicle ${vehicleRoute.vehicle_id}`,
        status: 'optimal',
        coordinates: vehicleRoute.route.map(loc => [loc.latitude, loc.longitude]),
      }));
    }

    return [];
  }, [result, problemType]);

  // Calculate center point from all locations
  const mapCenter = useMemo(() => {
    if (locations.length === 0) return [37.7749, -122.4194];
    
    const avgLat = locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length;
    const avgLng = locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length;
    
    return [avgLat, avgLng];
  }, [locations]);

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Sidebar Controls - 1/3 width */}
      <div className="lg:col-span-1 space-y-6 overflow-y-auto pr-2">
        <Card>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-2">
                Problem Type
              </label>
              <select
                value={problemType}
                onChange={(e) => setProblemType(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="tsp" className="bg-zinc-900">TSP (Single Vehicle)</option>
                <option value="vrp" className="bg-zinc-900">VRP (Multiple Vehicles)</option>
              </select>
            </div>

            {/* Return to Depot Option */}
            <div className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-md">
              <input
                type="checkbox"
                id="return-to-depot"
                checked={returnToDepot}
                onChange={(e) => setReturnToDepot(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-zinc-900 focus:ring-1 cursor-pointer"
              />
              <label htmlFor="return-to-depot" className="text-sm text-white cursor-pointer select-none">
                Return to depot
              </label>
              <span className="text-xs text-muted ml-auto">
                {returnToDepot ? 'Closed loop route' : 'Route ends at last stop'}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white">Locations</h3>
                <Button 
                  variant="secondary" 
                  onClick={addLocation}
                  className="h-7 px-2 text-xs"
                  type="button"
                >
                  <Plus size={12} />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
              {locations.map((loc, idx) => {
                const isSearching = searchingAddresses[idx];

                return (
                  <Card key={loc.id} className="p-3" noPadding>
                    <div className="space-y-2">
                      {/* Address Search - Premium Feature */}
                      <div className="relative">
                        <input
                          type="text"
                          value={addressSearches[idx] || ''}
                          onChange={(e) => setAddressSearches(prev => ({ ...prev, [idx]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && addressSearches[idx]?.trim()) {
                              e.preventDefault();
                              searchAddress(idx, addressSearches[idx].trim());
                            }
                          }}
                          placeholder="🔍 Search address (e.g., 'Cubbon Park, Bangalore')"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 pr-8 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                        {isSearching ? (
                          <Loader2 size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 animate-spin" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => searchAddress(idx, addressSearches[idx]?.trim() || '')}
                            disabled={!addressSearches[idx]?.trim() || isSearching}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Search address"
                          >
                            <Search size={16} />
                          </button>
                        )}
                      </div>
                      
                      <input
                        type="text"
                        value={loc.name}
                        onChange={(e) => updateLocation(idx, 'name', e.target.value)}
                        placeholder="Location name"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                      
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          step="0.0001"
                          value={loc.latitude}
                          onChange={(e) => updateLocation(idx, 'latitude', e.target.value)}
                          placeholder="Lat"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                        <input
                          type="number"
                          step="0.0001"
                          value={loc.longitude}
                          onChange={(e) => updateLocation(idx, 'longitude', e.target.value)}
                          placeholder="Lng"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                      </div>
                    {problemType === 'vrp' && (
                      <input
                        type="number"
                        value={loc.demand}
                        onChange={(e) => updateLocation(idx, 'demand', e.target.value)}
                        placeholder="Demand"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    )}
                    {idx !== 0 && (
                      <button
                        onClick={() => removeLocation(idx)}
                          className="w-full flex items-center justify-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs font-medium hover:bg-red-500/20 transition-colors"
                        type="button"
                      >
                          <X size={12} />
                          Remove
                      </button>
                    )}
                  </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {problemType === 'vrp' && (
              <div>
                <h3 className="text-sm font-medium text-white mb-3">Vehicles</h3>
                <div className="space-y-2">
              {vehicles.map((vehicle, idx) => (
                    <Card key={vehicle.id} className="p-3" noPadding>
                      <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={vehicle.capacity}
                    onChange={(e) => {
                      const updated = [...vehicles];
                      updated[idx].capacity = parseFloat(e.target.value) || 0;
                      setVehicles(updated);
                    }}
                    placeholder="Capacity"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                      </div>
                    </Card>
                  ))}
                </div>
            </div>
          )}

            <Button
            onClick={handleOptimize}
            disabled={loading || locations.length < 2}
              variant="primary"
              className="w-full"
            type="button"
          >
              {loading ? (
                <>
                  <Zap size={14} className="animate-pulse" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Route size={14} />
                  Optimize Routes
                </>
              )}
            </Button>

            {error && (
              <div className="p-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs">
                {error}
              </div>
            )}
        </div>
        </Card>

        {/* Results Summary Sidebar */}
        {result && (
          <Card>
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white">Optimization Results</h3>
            
            {problemType === 'tsp' && result.tsp_result && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-zinc-900/50 rounded border border-border">
                    <span className="text-xs text-muted">Total Distance</span>
                    <span className="text-sm font-mono text-white">{result.tsp_result.total_distance_km.toFixed(2)} km</span>
                </div>
                  <div className="flex justify-between items-center p-2 bg-zinc-900/50 rounded border border-border">
                    <span className="text-xs text-muted">Stops</span>
                    <span className="text-sm font-mono text-white">{result.tsp_result.number_of_stops}</span>
                </div>
                  <div className="border-t border-border pt-3">
                    <h4 className="text-xs font-medium text-muted mb-2">Route Sequence</h4>
                    <ol className="space-y-1 text-xs font-mono text-zinc-400">
                    {result.tsp_result.route.map((stop, idx) => (
                      <li key={`${stop.id}-${idx}`}>
                          {idx + 1}. {stop.name}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}

            {problemType === 'vrp' && result.vrp_result && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-2 bg-zinc-900/50 rounded border border-border">
                    <span className="text-xs text-muted">Total Distance</span>
                    <span className="text-sm font-mono text-white">{result.vrp_result.total_distance_km.toFixed(2)} km</span>
                </div>
                  <div className="flex justify-between items-center p-2 bg-zinc-900/50 rounded border border-border">
                    <span className="text-xs text-muted">Vehicles Used</span>
                    <span className="text-sm font-mono text-white">
                    {result.vrp_result.vehicles_used} / {result.vrp_result.total_vehicles}
                  </span>
                </div>
                {result.vrp_result.vehicle_routes.map((vehicleRoute) => (
                    <Card key={vehicleRoute.vehicle_id} className="p-3" noPadding>
                      <h4 className="text-xs font-medium text-white mb-2">Vehicle {vehicleRoute.vehicle_id}</h4>
                      <div className="space-y-1 text-xs font-mono text-zinc-400">
                        <div className="flex justify-between">
                          <span className="text-muted">Distance:</span>
                          <span className="text-white">{vehicleRoute.distance_km.toFixed(2)} km</span>
                    </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Stops:</span>
                          <span className="text-white">{vehicleRoute.number_of_stops}</span>
                    </div>
                  </div>
                    </Card>
                ))}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Map Area - 2/3 width */}
      <div className="lg:col-span-2 bg-surface/50 rounded-lg border border-border overflow-hidden relative h-full min-h-[500px]">
        <DarkMap 
          routes={mapRoutes} 
          locations={locations.map(loc => ({ latitude: loc.latitude, longitude: loc.longitude }))}
          center={mapCenter} 
          zoom={12} 
        />
        
        {/* Empty state overlay */}
        {mapRoutes.length === 0 && locations.length > 1 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/60 backdrop-blur border border-white/10 px-4 py-2 rounded text-center">
              <Route className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">Click "Optimize Routes" to see optimized path</p>
            </div>
          </div>
        )}

        {/* Results Overlay HUD */}
        {result && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-xl border border-white/10 p-4 rounded-lg text-white z-[1000] shadow-2xl">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-zinc-400 uppercase mb-1">Total Distance</p>
                <p className="text-2xl font-mono font-bold">
                  {problemType === 'tsp' 
                    ? `${result.tsp_result?.total_distance_km.toFixed(2)} km`
                    : `${result.vrp_result?.total_distance_km.toFixed(2)} km`}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="success">OPTIMIZED</Badge>
                <Button variant="secondary" className="h-8 px-3 text-xs">
                  Export Route
                </Button>
              </div>
            </div>
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
