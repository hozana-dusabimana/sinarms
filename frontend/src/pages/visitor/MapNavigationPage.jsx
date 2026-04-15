import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronRight, CornerUpLeft, CornerUpRight, Maximize, Minimize, Play, Pause, MapPin, Route, Target, ShieldCheck, Map as MapLucide, MessageCircle, Bell, X, Phone, AlertTriangle, User } from 'lucide-react';
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

// Inline SVG pin as a base64 data-URL — no network dependency, renders reliably.
const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44"><path d="M16 2C8 2 2 8 2 16c0 10 14 26 14 26s14-16 14-26C30 8 24 2 16 2z" fill="#cd5c5c" stroke="#ffffff" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#ffffff"/></svg>`;
const customPinIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(pinSvg)}`,
  iconSize: [32, 44],
  iconAnchor: [16, 42],
  popupAnchor: [0, -38],
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
    const valid = (positions || []).filter(
      (p) => Array.isArray(p) && p.length === 2
        && typeof p[0] === 'number' && !Number.isNaN(p[0])
        && typeof p[1] === 'number' && !Number.isNaN(p[1])
    );
    if (valid.length >= 2) {
      map.fitBounds(L.latLngBounds(valid), { padding: [50, 50], maxZoom: 19 });
    } else if (valid.length === 1) {
      map.setView(valid[0], 19);
    }
  }, [map, positions]);
  return null;
}

function isValidLatLng(pos) {
  return Array.isArray(pos)
    && pos.length === 2
    && typeof pos[0] === 'number' && !Number.isNaN(pos[0])
    && typeof pos[1] === 'number' && !Number.isNaN(pos[1]);
}

// Haversine distance in meters.
function distanceMeters(a, b) {
  if (!isValidLatLng(a) || !isValidLatLng(b)) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Builds the full route polyline positions using GPS trails from edges where available
function buildRoutePositions(map, routeNodeIds) {
  if (!routeNodeIds || routeNodeIds.length < 2) return [];

  const positions = [];
  const push = (pos) => {
    if (isValidLatLng(pos)) positions.push(pos);
  };

  for (let i = 0; i < routeNodeIds.length - 1; i++) {
    const fromId = routeNodeIds[i];
    const toId = routeNodeIds[i + 1];

    const edge = (map.edges || []).find(e =>
      (e.from === fromId && e.to === toId) ||
      (e.from === toId && e.to === fromId)
    );

    if (edge?.gpsTrail?.length > 1) {
      const trail = (edge.from === fromId ? edge.gpsTrail : [...edge.gpsTrail].reverse())
        .filter(isValidLatLng);
      const toAppend = positions.length > 0 ? trail.slice(1) : trail;
      toAppend.forEach(push);
    } else {
      const fromNode = getNode(map, fromId);
      const toNode = getNode(map, toId);
      const fromPos = fromNode ? getNodeLatLng(fromNode) : null;
      const toPos = toNode ? getNodeLatLng(toNode) : null;
      if (positions.length === 0) push(fromPos);
      push(toPos);
    }
  }
  return positions;
}

// Gets the real lat/lng from a node, using stored lat/lng directly
function getNodeLatLng(node) {
  if (node && node.lat != null && node.lng != null) {
    const pos = [Number(node.lat), Number(node.lng)];
    return isValidLatLng(pos) ? pos : null;
  }
  return null;
}

export default function MapNavigationPage() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { state, currentVisitor, setCurrentVisitor, moveVisitor, isReady } = useSinarms();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [livePosition, setLivePosition] = useState(null);
  const [simulatedPosition, setSimulatedPosition] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [activeRail, setActiveRail] = useState('map');
  const watchIdRef = useRef(null);
  const simulationTimerRef = useRef(null);
  const lastAdvancedNodeRef = useRef(null);
  const advanceInFlightRef = useRef(false);
  const mapRef = useRef(null);
  const routeListRef = useRef(null);

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

  // Snap the live/simulated position to the next route node and advance the
  // backend's currentNodeId when within 8 m — that keeps the step list in sync.
  const SNAP_RADIUS_M = 8;
  useEffect(() => {
    if (!currentVisitor?.id) return;
    const probe = simulatedPosition || livePosition;
    if (!isValidLatLng(probe)) return;
    const mapObj = getLocationMap(state, currentVisitor.locationId);
    const routeIds = currentVisitor.routeNodeIds || [];
    if (!mapObj || routeIds.length < 2) return;

    const currentIdx = routeIds.indexOf(currentVisitor.currentNodeId);
    // Look only at nodes ahead of the current one.
    for (let i = currentIdx + 1; i < routeIds.length; i++) {
      const nodeId = routeIds[i];
      if (nodeId === lastAdvancedNodeRef.current) continue;
      const node = getNode(mapObj, nodeId);
      const pos = node ? getNodeLatLng(node) : null;
      if (!isValidLatLng(pos)) continue;
      if (distanceMeters(probe, pos) <= SNAP_RADIUS_M) {
        if (advanceInFlightRef.current) break;
        advanceInFlightRef.current = true;
        lastAdvancedNodeRef.current = nodeId;
        moveVisitor(currentVisitor.id, nodeId, 'gps')
          .catch(() => { lastAdvancedNodeRef.current = null; })
          .finally(() => { advanceInFlightRef.current = false; });
        break;
      }
    }
  }, [simulatedPosition, livePosition, currentVisitor?.id, currentVisitor?.currentNodeId, currentVisitor?.routeNodeIds, currentVisitor?.locationId, state, moveVisitor]);

  // Reset snap guard whenever the route changes (e.g. reroute / switch location).
  useEffect(() => {
    lastAdvancedNodeRef.current = null;
  }, [currentVisitor?.destinationNodeId, currentVisitor?.locationId]);

  // Indoor-demo walk: animates the blue dot along the polyline so the full
  // flow can be shown without real GPS. Stops automatically at the destination.
  useEffect(() => {
    if (!isSimulating) {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
      setSimulatedPosition(null);
      return;
    }
    if (!currentVisitor?.id) return;
    const mapObj = getLocationMap(state, currentVisitor.locationId);
    const positions = buildRoutePositions(mapObj, currentVisitor.routeNodeIds);
    if (positions.length < 2) {
      setIsSimulating(false);
      return;
    }
    let i = 0;
    setSimulatedPosition(positions[0]);
    simulationTimerRef.current = setInterval(() => {
      i += 1;
      if (i >= positions.length) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
        setIsSimulating(false);
        return;
      }
      setSimulatedPosition(positions[i]);
    }, 700);
    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
    };
  }, [isSimulating, currentVisitor?.id, currentVisitor?.routeNodeIds, currentVisitor?.locationId, state]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)] text-slate-500 dark:text-slate-400 text-sm">
        Loading your route...
      </div>
    );
  }

  if (!currentVisitor) {
    return <Navigate to="/visit" replace />;
  }

  const map = getLocationMap(state, currentVisitor.locationId);
  const location = getLocationById(state, currentVisitor.locationId);

  // Get real node positions
  const currentNode = getNode(map, currentVisitor.currentNodeId);
  const destinationNode = getNode(map, currentVisitor.destinationNodeId);

  const currentNodePos = currentNode ? getNodeLatLng(currentNode) : null;
  // Fall back to the final node in the route if destinationNodeId itself didn't resolve.
  const routeFallbackNode = (() => {
    const ids = currentVisitor.routeNodeIds || [];
    for (let i = ids.length - 1; i >= 0; i--) {
      const n = getNode(map, ids[i]);
      if (n && getNodeLatLng(n)) return n;
    }
    return null;
  })();
  const destinationNodePos = destinationNode
    ? getNodeLatLng(destinationNode)
    : (routeFallbackNode ? getNodeLatLng(routeFallbackNode) : null);

  // Prefer the building's node/destination so the map opens on the site, not on the
  // visitor's outdoor GPS. livePosition is used only as a "you are here" marker.
  const defaultCenter = (() => {
    if (isValidLatLng(currentNodePos)) return currentNodePos;
    if (isValidLatLng(destinationNodePos)) return destinationNodePos;
    if (location?.address) {
      const parts = location.address.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts;
    }
    return [-1.99585, 30.04020];
  })();

  // Priority: simulated walk > real GPS > current node (server) > map default
  const visitorPositionCandidate = simulatedPosition || livePosition || currentNodePos || defaultCenter;
  const visitorPosition = isValidLatLng(visitorPositionCandidate) ? visitorPositionCandidate : defaultCenter;

  // Build route using real GPS trails from edges
  const routePositions = buildRoutePositions(map, currentVisitor.routeNodeIds);

  // Fit only to the building's route/nodes — never include outdoor GPS (livePosition),
  // otherwise Leaflet zooms out to fit the user's real-world location and the building.
  const indoorPositions = [
    ...routePositions,
    ...(isValidLatLng(currentNodePos) ? [currentNodePos] : []),
    ...(isValidLatLng(destinationNodePos) ? [destinationNodePos] : []),
  ].filter(isValidLatLng);

  const allPositions = indoorPositions.length
    ? indoorPositions
    : [defaultCenter].filter(isValidLatLng);

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

  const destinationLabel = destinationNode?.label || routeFallbackNode?.label || 'Destination';
  const currentNodeLabel = currentNode?.label || 'Current location';
  const totalSteps = liveSteps.length;
  const completedSteps = liveSteps.filter((step) => step.done).length;
  const remainingDistance = liveSteps
    .filter((step) => !step.done)
    .reduce((total, step) => total + (step.distance || 0), 0);
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const totalRouteDistance = liveSteps.reduce((total, step) => total + (step.distance || 0), 0);
  const completedDistance = Math.max(0, totalRouteDistance - remainingDistance);
  const etaMinutes = Math.max(1, Math.round(remainingDistance / 70)); // ~70m/min walking pace
  const currentStep = liveSteps.find((step) => step.current) || liveSteps.find((step) => !step.done);
  const corridorHint = currentStep?.text || 'Follow posted signage';

  const handleRecenterMap = () => {
    setActiveRail('map');
    const m = mapRef.current;
    if (!m) return;
    const valid = allPositions.filter(isValidLatLng);
    if (valid.length >= 2) {
      m.fitBounds(L.latLngBounds(valid), { padding: [40, 40], maxZoom: 19 });
    } else if (valid.length === 1) {
      m.setView(valid[0], 19);
    }
  };

  const handleScrollTop = () => {
    const el = routeListRef.current || mapRef.current?.getContainer?.();
    let scroller = el?.parentElement;
    while (scroller && scroller !== document.body) {
      const style = window.getComputedStyle(scroller);
      if (/(auto|scroll)/.test(style.overflowY)) break;
      scroller = scroller.parentElement;
    }
    if (scroller && scroller !== document.body) {
      scroller.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFocusRoute = () => {
    setActiveRail('route');
    const el = routeListRef.current;
    if (!el) return;
    // Scroll only the main column (the nearest overflow-y-auto ancestor) so the
    // route card is visible — avoid scrollIntoView, which can nudge outer
    // layout scrollers and appear to hide the top bar.
    let scroller = el.parentElement;
    while (scroller && scroller !== document.body) {
      const style = window.getComputedStyle(scroller);
      if (/(auto|scroll)/.test(style.overflowY)) break;
      scroller = scroller.parentElement;
    }
    if (scroller && scroller !== document.body) {
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      scroller.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
    }
    const currentEl = el.querySelector('[data-step-current="true"]');
    if (currentEl && scroller && scroller !== document.body) {
      setTimeout(() => {
        const cTop = currentEl.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
        scroller.scrollTo({ top: Math.max(0, cTop - scroller.clientHeight / 2), behavior: 'smooth' });
      }, 260);
    }
  };

  const handleOpenChat = () => {
    setActiveRail('chat');
    setIsChatOpen(true);
  };

  const handleOpenAlerts = () => {
    setActiveRail('alerts');
    setIsAlertsOpen(true);
  };

  const railItems = [
    { key: 'map', icon: <MapLucide size={18} />, label: 'Recenter map', onClick: handleRecenterMap },
    { key: 'route', icon: <Route size={18} />, label: 'Focus route', onClick: handleFocusRoute },
    { key: 'chat', icon: <MessageCircle size={18} />, label: 'Ask assistant', onClick: handleOpenChat },
    { key: 'alerts', icon: <Bell size={18} />, label: 'Alerts & info', onClick: handleOpenAlerts },
  ];

  return (
    <div className={`relative ${isFullscreen ? '' : 'flex gap-4 flex-1 min-h-0 h-full md:pl-20'}`}>

      {/* Left Icon Rail — fixed to viewport so it never scrolls with content */}
      {!isFullscreen && (
        <aside className="hidden md:flex flex-col items-center gap-2 w-16 py-4 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm fixed left-4 sm:left-6 top-20 bottom-20 z-[400] overflow-y-auto custom-scrollbar">
          <button
            type="button"
            onClick={handleScrollTop}
            title="Scroll to top"
            className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 flex items-center justify-center shadow-md shadow-red-500/30 mb-2 hover:scale-105 transition-transform"
          >
            <ShieldCheck size={20} className="text-white" strokeWidth={2.4} />
          </button>
          <div className="w-8 h-px bg-slate-200 dark:bg-slate-800 my-1" />
          {railItems.map((item) => (
            <button
              key={item.key}
              title={item.label}
              onClick={item.onClick}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                activeRail === item.key
                  ? 'bg-red-50 dark:bg-red-500/15 text-[var(--color-brand-terracotta)] dark:text-red-400 shadow-sm border border-red-100 dark:border-red-500/30'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {item.icon}
            </button>
          ))}
        </aside>
      )}

      {/* Main content column — scrolls independently; rail stays pinned via sticky */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 min-h-0 overflow-y-auto custom-scrollbar pr-1">

      {/* Map Area */}
      <div className={`relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl bg-slate-100/50 dark:bg-slate-900 z-0 transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[500] rounded-none border-0' : 'h-[55vh] min-h-[320px] flex-shrink-0'}`}>
        <div className="absolute top-4 right-4 z-[650] flex gap-2">
          <button
            onClick={() => setIsSimulating((prev) => !prev)}
            aria-label={isSimulating ? 'Stop simulated walk' : 'Start simulated walk'}
            title={isSimulating ? 'Stop simulated walk' : 'Simulate walking the route (demo)'}
            className={`p-2.5 rounded-xl shadow-lg border transition-colors ${
              isSimulating
                ? 'bg-[var(--color-brand-terracotta)] dark:bg-red-500 border-transparent text-white'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {isSimulating ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="bg-white dark:bg-slate-800 p-2.5 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>

        <MapContainer
          ref={mapRef}
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
            if (!isValidLatLng(pos)) return null;
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
          {isValidLatLng(visitorPosition) && (
            <Marker position={visitorPosition} icon={activePersonIcon}>
              <Popup>
                <div className="text-center font-bold">You are here</div>
              </Popup>
            </Marker>
          )}

          {/* Destination marker */}
          {isValidLatLng(destinationNodePos) && (
            <Marker position={destinationNodePos} icon={customPinIcon}>
              <Popup>
                <div className="text-center font-bold text-red-600">{destinationLabel}</div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Floating location pill at bottom of map */}
        {!isFullscreen && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[650] flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-lg">
            <MapPin size={14} className="text-[var(--color-brand-terracotta)] dark:text-red-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{currentNodeLabel}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{Math.round(remainingDistance)}m away</span>
          </div>
        )}
      </div>

      {/* Bottom Grid: Route Instructions + Stats Stack */}
      {!isFullscreen && (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 flex-shrink-0">
          {/* Route Instructions */}
          <div ref={routeListRef} className="glass-card px-6 pt-5 pb-6 custom-scrollbar flex flex-col max-h-[60vh]">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10 text-[var(--color-brand-terracotta)] dark:text-red-400 flex items-center justify-center">
                  <Route size={16} strokeWidth={2.5} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Route Instructions</h3>
              </div>
              <button
                onClick={() => navigate('/visit/checkout')}
                className="text-xs font-bold bg-white dark:bg-slate-100 text-slate-900 px-4 py-2 rounded-lg shadow-sm hover:scale-105 transition-transform border border-slate-200 dark:border-transparent"
              >
                End Visit
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              {liveSteps.length > 0 ? (
                <div className="space-y-4 relative before:absolute before:top-5 before:bottom-5 before:left-5 before:w-[2px] before:bg-gradient-to-b before:from-slate-200 before:to-transparent dark:before:from-slate-700/50">
                  {liveSteps.map((step) => (
                    <div key={step.id} data-step-current={step.current ? 'true' : 'false'} className={`flex items-start gap-4 relative z-10 transition-opacity ${step.done ? 'opacity-40' : 'opacity-100'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-4 border-white dark:border-slate-900 shadow-sm transition-all ${
                        step.current
                          ? 'bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 text-white scale-110 shadow-[0_0_18px_rgba(205,92,92,0.5)]'
                          : step.done
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {step.icon}
                      </div>
                      <div className={`mt-1 flex-1 min-w-0 ${step.current ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                        <p className={`font-semibold ${step.current ? 'text-base' : 'text-sm'}`}>{step.text}</p>
                        {step.distance > 0 && (
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">
                            {step.distance} meters
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 dark:text-slate-400 text-sm">No route instructions available. Please ask at the Reception desk.</p>
              )}
            </div>
          </div>

          {/* Stats Stack */}
          <div className="flex flex-col gap-4 min-h-0">
            {/* Progress Card */}
            <div className="glass-card p-5 relative overflow-hidden">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Progress</p>
              <div className="mt-1 flex items-baseline gap-1">
                <p className="text-4xl font-extrabold text-slate-900 dark:text-white leading-none">{progressPercent}</p>
                <span className="text-lg font-bold text-slate-500 dark:text-slate-400">%</span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                {Math.round(completedDistance)} of {Math.round(totalRouteDistance)} meters
              </p>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-gradient-to-r from-[var(--color-brand-terracotta)] to-red-600 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* ETA Card */}
            <div className="glass-card p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">ETA</p>
              <div className="mt-1 flex items-baseline gap-1">
                <p className="text-4xl font-extrabold text-slate-900 dark:text-white leading-none">{etaMinutes}</p>
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">min</span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">
                {corridorHint}
              </p>
            </div>

            {/* Destination Info Card */}
            <div className="glass-card p-5 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Destination</p>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-red-500/20">
                  <Target size={18} className="text-white" strokeWidth={2.4} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{destinationLabel}</p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    {totalSteps} step{totalSteps === 1 ? '' : 's'} • {Math.round(totalRouteDistance)}m total
                  </p>
                </div>
              </div>
              <div className="mt-4 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Visitor</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate mt-0.5">{currentVisitor.name}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Slide-Up Chat Component (controlled by rail, with its own floating launcher) */}
      <AIChatbot
        organizationId={currentVisitor?.organizationId}
        locationId={currentVisitor?.locationId}
        open={isChatOpen}
        onOpenChange={setIsChatOpen}
      />

      {/* Alerts & Info Modal */}
      <AnimatePresence>
        {isAlertsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[700] bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
            onClick={() => setIsAlertsOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full md:max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-[var(--color-brand-terracotta)] to-slate-900 p-4 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">Alerts & Info</h3>
                    <p className="text-xs text-slate-200/80 font-medium">Your current visit</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAlertsOpen(false)}
                  aria-label="Close alerts"
                  className="w-10 h-10 flex items-center justify-center bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-md transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Visitor</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-200 dark:to-slate-400 flex items-center justify-center text-white dark:text-slate-900">
                      <User size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{currentVisitor.name}</p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                        {location?.name || 'On site'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Destination</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{destinationLabel}</p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    {Math.round(remainingDistance)}m remaining • ~{etaMinutes} min
                  </p>
                </div>

                <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-brand-terracotta)] dark:text-red-400">Emergency</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    If you feel unsafe or lost, contact Reception immediately.
                  </p>
                  <a
                    href="tel:+250788000000"
                    className="mt-3 inline-flex items-center gap-2 text-xs font-bold bg-[var(--color-brand-terracotta)] dark:bg-red-500 text-white px-4 py-2 rounded-full shadow-sm hover:scale-105 transition-transform"
                  >
                    <Phone size={14} /> Call Reception
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
