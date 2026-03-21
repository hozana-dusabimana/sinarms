import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Navigation2, CheckCircle2, ChevronRight, CornerUpLeft, CornerUpRight, Maximize, Minimize } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import AIChatbot from '../../components/visitor/AIChatbot';
import { useSinarms } from '../../context/SinarmsContext';
import { getLocationMap, getLocationById, getNode } from '../../lib/sinarmsEngine';

import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';

// Leaflet default icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const customPinIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const activePersonIcon = L.divIcon({
  className: 'bg-transparent',
  html: `<div class="relative flex items-center justify-center w-6 h-6">
           <div class="absolute w-full h-full bg-blue-500 rounded-full animate-ping opacity-75"></div>
           <div class="relative w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-lg"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Fits the map view to show the entire route
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length >= 2) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 19 });
    } else if (positions.length === 1) {
      map.setView(positions[0], 19);
    }
  }, [map, positions]);
  return null;
}

// Builds the full route polyline positions using GPS trails from edges where available
function buildRoutePositions(map, routeNodeIds) {
  if (!routeNodeIds || routeNodeIds.length < 2) return [];

  const positions = [];
  for (let i = 0; i < routeNodeIds.length - 1; i++) {
    const fromId = routeNodeIds[i];
    const toId = routeNodeIds[i + 1];

    // Find the edge between these two nodes
    const edge = (map.edges || []).find(e =>
      (e.from === fromId && e.to === toId) ||
      (e.from === toId && e.to === fromId)
    );

    if (edge?.gpsTrail?.length > 1) {
      // Use the recorded GPS trail for this segment
      const trail = edge.from === fromId ? edge.gpsTrail : [...edge.gpsTrail].reverse();
      // Avoid duplicating the connecting point between segments
      if (positions.length > 0) {
        positions.push(...trail.slice(1));
      } else {
        positions.push(...trail);
      }
    } else {
      // Fallback: straight line between the two nodes using their real lat/lng
      const fromNode = getNode(map, fromId);
      const toNode = getNode(map, toId);
      if (fromNode && toNode) {
        const fromPos = getNodeLatLng(fromNode);
        const toPos = getNodeLatLng(toNode);
        if (positions.length > 0) {
          positions.push(toPos);
        } else {
          positions.push(fromPos, toPos);
        }
      }
    }
  }
  return positions;
}

// Gets the real lat/lng from a node, using stored lat/lng directly
function getNodeLatLng(node) {
  if (node.lat != null && node.lng != null) {
    return [node.lat, node.lng];
  }
  return null;
}

export default function MapNavigationPage() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { state, currentVisitor, setCurrentVisitor } = useSinarms();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [livePosition, setLivePosition] = useState(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    const visitorIdFromRoute = routerLocation.state?.visitorId;
    if (visitorIdFromRoute && currentVisitor?.id !== visitorIdFromRoute) {
      setCurrentVisitor(visitorIdFromRoute);
    }
  }, [currentVisitor?.id, routerLocation.state, setCurrentVisitor]);

  // Live GPS tracking of the visitor's actual position
  useEffect(() => {
    if (!navigator.geolocation) return;
    const wId = navigator.geolocation.watchPosition(
      (pos) => setLivePosition([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
    watchIdRef.current = wId;
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  if (!currentVisitor) {
    return <Navigate to="/visit" replace />;
  }

  const map = getLocationMap(state, currentVisitor.locationId);
  const location = getLocationById(state, currentVisitor.locationId);

  // Get real node positions
  const currentNode = getNode(map, currentVisitor.currentNodeId);
  const destinationNode = getNode(map, currentVisitor.destinationNodeId);

  const currentNodePos = currentNode ? getNodeLatLng(currentNode) : null;
  const destinationNodePos = destinationNode ? getNodeLatLng(destinationNode) : null;

  // Use live GPS position, fallback to current node position, fallback to location address
  const defaultCenter = (() => {
    if (livePosition) return livePosition;
    if (currentNodePos) return currentNodePos;
    if (location?.address) {
      const parts = location.address.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts;
    }
    return [-1.9443, 30.0621];
  })();

  const visitorPosition = livePosition || currentNodePos || defaultCenter;

  // Build route using real GPS trails from edges
  const routePositions = buildRoutePositions(map, currentVisitor.routeNodeIds);

  // All positions to fit bounds (route + current + destination)
  const allPositions = [
    ...routePositions,
    visitorPosition,
    ...(destinationNodePos ? [destinationNodePos] : []),
  ].filter(Boolean);

  // Build live steps from route data
  const currentIndex = (currentVisitor.routeNodeIds || []).indexOf(currentVisitor.currentNodeId);
  const nextStep = (currentVisitor.routeSteps || []).find((step) => {
    const stepIndex = (currentVisitor.routeNodeIds || []).indexOf(step.nodeId);
    return stepIndex > currentIndex;
  });
  const nextStepNodeId = nextStep?.nodeId || null;

  const liveSteps = currentVisitor.routeSteps?.length
    ? currentVisitor.routeSteps.map((step, index) => {
        const stepNodeIndex = (currentVisitor.routeNodeIds || []).indexOf(step.nodeId);
        const isDone = stepNodeIndex !== -1 && stepNodeIndex <= currentIndex;
        const isCurrent = step.nodeId === nextStepNodeId;

        let icon = <ChevronRight className="rotate-[-90deg]" size={24} />;
        if (step.direction === 'left') icon = <CornerUpLeft size={24} />;
        if (step.direction === 'right') icon = <CornerUpRight size={24} />;
        if (step.nodeId === currentVisitor.destinationNodeId) icon = <CheckCircle2 size={24} />;

        return {
          id: step.step || index + 1,
          text: step.instruction,
          icon,
          distance: Number(step.distanceM || 0),
          done: isDone,
          current: isCurrent,
        };
      })
    : [];

  const destinationLabel = destinationNode?.label || 'Destination';

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden relative">

      {/* Map Area */}
      <div className={`flex-1 relative glass-card overflow-hidden rounded-2xl border-4 border-slate-50 dark:border-slate-800 shadow-xl mb-4 bg-slate-100/50 dark:bg-slate-900 z-0 transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[500] rounded-none border-0 mb-0' : ''}`}>
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="absolute top-4 right-4 z-[400] bg-white dark:bg-slate-800 p-2.5 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>

        <MapContainer
          center={defaultCenter}
          zoom={19}
          scrollWheelZoom={true}
          className="w-full h-full z-0"
          style={{ width: '100%', height: '100%', minHeight: '400px' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Fit the map to show the full route */}
          <FitBounds positions={allPositions.length > 1 ? allPositions : [defaultCenter]} />

          {/* Route path — uses GPS trail from recorded edges */}
          {routePositions.length > 1 && (
            <Polyline
              positions={routePositions}
              pathOptions={{ color: '#cd5c5c', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
            />
          )}

          {/* Route node markers (intermediate waypoints) */}
          {(currentVisitor.routeNodeIds || []).map((nodeId) => {
            const node = getNode(map, nodeId);
            if (!node || nodeId === currentVisitor.currentNodeId || nodeId === currentVisitor.destinationNodeId) return null;
            const pos = getNodeLatLng(node);
            if (!pos) return null;
            return (
              <CircleMarker
                key={nodeId}
                center={pos}
                radius={5}
                pathOptions={{ color: '#cd5c5c', fillColor: '#ffffff', fillOpacity: 1, weight: 2 }}
              >
                <Popup><div className="text-center text-sm font-medium">{node.label}</div></Popup>
              </CircleMarker>
            );
          })}

          {/* Live Visitor Position */}
          <Marker position={visitorPosition} icon={activePersonIcon}>
            <Popup>
              <div className="text-center font-bold">You are here</div>
            </Popup>
          </Marker>

          {/* Destination marker */}
          {destinationNodePos && (
            <Marker position={destinationNodePos} icon={customPinIcon}>
              <Popup>
                <div className="text-center font-bold text-red-600">{destinationLabel}</div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Step by Step Navigation Drawer */}
      <div className="h-64 bg-white dark:bg-[#0b101e] border-t border-slate-200 dark:border-slate-800 shrink-0 rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] -mx-6 px-6 pt-6 pb-24 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Navigation2 size={20} className="text-[var(--color-brand-terracotta)] dark:text-red-500" />
            Route Instructions
          </h3>
          <button
            onClick={() => navigate('/visit/checkout')}
            className="text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-1.5 rounded-lg shadow-sm hover:scale-105 transition-transform"
          >
            End Visit
          </button>
        </div>

        {liveSteps.length > 0 ? (
          <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-6 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800 -ml-2 pl-2">
            {liveSteps.map((step) => (
              <div key={step.id} className={`flex items-start gap-4 relative z-10 ${step.done ? 'opacity-50' : 'opacity-100'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-4 border-white dark:border-[#0b101e] shadow-sm transition-colors ${
                  step.current ? 'bg-[var(--color-brand-terracotta)] text-white scale-110 shadow-[0_0_15px_rgba(205,92,92,0.4)] dark:bg-red-500 dark:shadow-[0_0_15px_rgba(239,68,68,0.4)]' :
                  step.done ? 'bg-green-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}>
                  {step.icon}
                </div>
                <div className={`mt-1 flex-1 ${step.current ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-500'}`}>
                  <p className={`font-semibold ${step.current && 'text-lg'}`}>{step.text}</p>
                  {step.distance > 0 && (
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60 mt-1">{step.distance} meters</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-sm">No route instructions available. Please ask at the Reception desk.</p>
        )}
      </div>

      {/* Slide-Up Chat Component */}
      <AIChatbot />
    </div>
  );
}
