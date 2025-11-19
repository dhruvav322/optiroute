import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import PropTypes from 'prop-types';

// Fix for default leaflet marker icons in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

/**
 * Auto-center component that calculates bounds from locations and smoothly animates to them.
 * This makes the map intelligently zoom to show all locations instead of defaulting to San Francisco.
 */
function AutoCenter({ locations }) {
  const map = useMap();

  useEffect(() => {
    if (!locations || locations.length === 0) return;

    // Extract coordinates from locations (handle both lat/lng objects and [lat, lng] arrays)
    const coords = locations.map(loc => {
      if (Array.isArray(loc)) {
        return loc; // Already [lat, lng]
      }
      // Handle { latitude, longitude } or { lat, lng } objects
      return [
        loc.latitude ?? loc.lat ?? loc[0],
        loc.longitude ?? loc.lng ?? loc[1]
      ];
    }).filter(coord => coord[0] != null && coord[1] != null);

    if (coords.length === 0) return;

    // Create a bounds object from all coordinates
    const bounds = L.latLngBounds(coords);

    // Smoothly fly to the bounds with animation (Apple-like glide)
    map.flyToBounds(bounds, {
      padding: [50, 50], // Add padding so markers aren't on the edge
      duration: 1.5,     // Smooth animation duration
      maxZoom: 14        // Don't zoom in too close if there's only 1 point
    });
  }, [locations, map]);

  return null;
}

AutoCenter.propTypes = {
  locations: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.number), // [lat, lng]
      PropTypes.shape({
        latitude: PropTypes.number,
        longitude: PropTypes.number,
        lat: PropTypes.number,
        lng: PropTypes.number,
      }),
    ])
  ),
};

export default function DarkMap({ routes = [], locations = [], center = [37.7749, -122.4194], zoom = 11 }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Ensure Leaflet CSS is loaded
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      document.head.appendChild(link);
    }
  }, []);

  if (!isClient) {
    return (
      <div className="h-full w-full rounded-lg overflow-hidden border border-[#27272a] bg-[#09090b] flex items-center justify-center">
        <span className="text-zinc-500 text-sm">Loading map...</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-lg overflow-hidden border border-[#27272a] relative z-0">
      <MapContainer 
        center={center} 
        zoom={zoom} 
        scrollWheelZoom={false} 
        className="h-full w-full bg-[#09090b]"
        style={{ backgroundColor: '#09090b' }}
      >
        {/* CartoDB Dark Matter - Free dark map tiles that match Linear aesthetic */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {/* Auto-center map based on locations - intelligently zooms to fit all locations */}
        <AutoCenter locations={locations} />
        
        {/* Render Routes if available */}
        {routes.map((route, i) => {
          if (!route.coordinates || route.coordinates.length === 0) return null;
          
          // Color coding: green for optimal, red for delayed
          const color = route.status === 'delayed' ? '#ef4444' : '#22c55e';
          
          return (
            <Polyline 
              key={i} 
              positions={route.coordinates} 
              pathOptions={{ color, weight: 3, opacity: 0.7 }} 
            />
          );
        })}

        {/* Markers for route points */}
        {routes.map((route, routeIdx) => 
          route.coordinates?.map((coord, coordIdx) => (
            <Marker key={`${routeIdx}-${coordIdx}`} position={coord}>
              <Popup>
                <span className="font-mono text-xs">
                  {route.name || `Stop ${coordIdx + 1}`}
                </span>
              </Popup>
            </Marker>
          ))
        )}
      </MapContainer>
      
      {/* Overlay Badge */}
      <div className="absolute top-4 right-4 z-[400] bg-black/80 backdrop-blur border border-white/10 px-3 py-1 rounded text-xs font-mono text-white">
        LIVE TRAFFIC
      </div>
    </div>
  );
}

