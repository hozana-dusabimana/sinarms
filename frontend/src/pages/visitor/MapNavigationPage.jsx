import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronRight, CornerUpLeft, CornerUpRight, Maximize, Minimize, MapPin, Route, Target, ShieldCheck, Map as MapLucide, MessageCircle, Bell, X, Phone, AlertTriangle, User, PartyPopper, LocateFixed, Loader2, Navigation } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import AIChatbot from '../../components/visitor/AIChatbot';
import { useSinarms } from '../../context/SinarmsContext';
import { useLanguage } from '../../context/LanguageContext';
import { getLocationMap, getLocationById, getNode } from '../../lib/sinarmsEngine';
import { CHECKOUT_RADIUS_M, CHECKOUT_DEBOUNCE_MS } from '../../lib/geo';

import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Rectangle, ImageOverlay, useMap } from 'react-leaflet';
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

// Fits the map view to the route + visitor + destination — but only when the
// route itself changes (or GPS first becomes available). Without a stable
// fitKey, every GPS tick would re-fit and fight any manual panning.
function FitBounds({ positions, fitKey }) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);
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

// Softens the route polyline by rounding each turn with a short quadratic
// curve, so the line reads as a guided path rather than rigid straight chords
// between node centres. This is purely cosmetic — it does NOT add real path
// data. Segments that are already straight (collinear nodes, e.g. the corridor
// spine) stay straight because the curve's control points are collinear too.
// When an edge gains a real surveyed gpsTrail (>2 points), that geometry is
// used as-is by buildRoutePositions and this just rounds whatever it gets.
function roundRouteCorners(points, radiusFrac = 0.3, samples = 8) {
  if (!Array.isArray(points) || points.length < 3) return points || [];
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1];
    const v = points[i];
    const b = points[i + 1];
    const dAV = Math.hypot(v[0] - a[0], v[1] - a[1]);
    const dVB = Math.hypot(b[0] - v[0], b[1] - v[1]);
    if (dAV === 0 || dVB === 0) { out.push(v); continue; }
    const fA = (Math.min(radiusFrac, 0.5) * dAV) / dAV;
    const fB = (Math.min(radiusFrac, 0.5) * dVB) / dVB;
    const start = [v[0] + (a[0] - v[0]) * fA, v[1] + (a[1] - v[1]) * fA];
    const end = [v[0] + (b[0] - v[0]) * fB, v[1] + (b[1] - v[1]) * fB];
    out.push(start);
    for (let s = 1; s < samples; s++) {
      const t = s / samples;
      const mt = 1 - t;
      out.push([
        mt * mt * start[0] + 2 * mt * t * v[0] + t * t * end[0],
        mt * mt * start[1] + 2 * mt * t * v[1] + t * t * end[1],
      ]);
    }
    out.push(end);
  }
  out.push(points[points.length - 1]);
  return out;
}

export default function MapNavigationPage() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { state, currentVisitor, setCurrentVisitor, moveVisitor, checkoutVisitor, isReady } = useSinarms();
  const { t, language } = useLanguage();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [livePosition, setLivePosition] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locationRetryToken, setLocationRetryToken] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [activeRail, setActiveRail] = useState('map');
  const [arrivalToast, setArrivalToast] = useState(null);
  const [approachRoute, setApproachRoute] = useState(null); // real-road [[lat,lng],…] to the gate
  const [approachInfo, setApproachInfo] = useState(null); // { distanceM, durationMin }
  const watchIdRef = useRef(null);
  const lastAdvancedNodeRef = useRef(null);
  const advanceInFlightRef = useRef(false);
  const arrivalAnnouncedRef = useRef(null);
  const outsideSinceRef = useRef(null);
  const autoCheckoutInFlightRef = useRef(false);
  const mapRef = useRef(null);
  const routeListRef = useRef(null);
  const lastRouteOriginRef = useRef(null);

  // Tracks whether we've already tried to hydrate currentVisitor from the
  // route state's visitorId. Without it, a slow refresh would leave us stuck
  // on the loading screen forever if the visitor really doesn't exist.
  const [routeHydrationAttempted, setRouteHydrationAttempted] = useState(false);

  useEffect(() => {
    const visitorIdFromRoute = routerLocation.state?.visitorId;
    if (visitorIdFromRoute && currentVisitor?.id !== visitorIdFromRoute) {
      Promise.resolve(setCurrentVisitor(visitorIdFromRoute)).finally(() => {
        setRouteHydrationAttempted(true);
      });
    } else if (visitorIdFromRoute) {
      setRouteHydrationAttempted(true);
    }
  }, [currentVisitor?.id, routerLocation.state, setCurrentVisitor]);

  // Live GPS tracking of the visitor's actual position. The marker on the map
  // follows the visitor in real time as they move. If the browser blocks or
  // can't acquire a fix, we surface a prompt so the visitor can enable
  // location services — navigation cannot start without a real origin.
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('unsupported');
      return undefined;
    }
    setLocationError(null);
    const wId = navigator.geolocation.watchPosition(
      (pos) => {
        setLivePosition([pos.coords.latitude, pos.coords.longitude]);
        setLocationError(null);
      },
      (err) => {
        if (err?.code === 1) setLocationError('denied');
        else if (err?.code === 2) setLocationError('unavailable');
        else if (err?.code === 3) setLocationError('timeout');
        else setLocationError('unavailable');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    watchIdRef.current = wId;
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [locationRetryToken]);

  // Approach leg, drawn IN-APP (no external Google jump). While the visitor is
  // still far from the gate, our node graph has no road geometry to get there,
  // so we ask a free routing service (public OSRM) for the real-road driving
  // route from the live GPS to the site entrance and render it on our own map.
  // Re-routes only when the origin drifts >50 m, so GPS ticks don't spam it.
  useEffect(() => {
    if (!currentVisitor?.id || !isValidLatLng(livePosition)) {
      setApproachRoute(null);
      setApproachInfo(null);
      lastRouteOriginRef.current = null;
      return undefined;
    }
    const mapObj = getLocationMap(state, currentVisitor.locationId);
    const entranceNode = getNode(mapObj, 'entrance');
    let entry = entranceNode ? getNodeLatLng(entranceNode) : null;
    if (!isValidLatLng(entry)) {
      const destNode = getNode(mapObj, currentVisitor.destinationNodeId);
      entry = destNode ? getNodeLatLng(destNode) : null;
    }
    if (!isValidLatLng(entry) || distanceMeters(livePosition, entry) <= 350) {
      setApproachRoute(null);
      setApproachInfo(null);
      lastRouteOriginRef.current = null;
      return undefined;
    }
    const last = lastRouteOriginRef.current;
    if (last && distanceMeters(last, livePosition) < 50 && approachRoute) {
      return undefined; // already routed from near here
    }
    lastRouteOriginRef.current = livePosition;
    const controller = new AbortController();
    const [oLat, oLng] = livePosition;
    const [dLat, dLng] = entry;
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson`,
      { signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        const route = data?.routes?.[0];
        const coords = (route?.geometry?.coordinates || [])
          .map(([lng, lat]) => [lat, lng])
          .filter(isValidLatLng);
        if (coords.length > 1) {
          setApproachRoute(coords);
          setApproachInfo({
            distanceM: route.distance,
            durationMin: Math.max(1, Math.round(route.duration / 60)),
          });
        }
      })
      .catch(() => { lastRouteOriginRef.current = null; }); // allow a retry next tick
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVisitor?.id, currentVisitor?.locationId, currentVisitor?.destinationNodeId, livePosition, state]);

  // Snap the live position to the next route node and advance the backend's
  // currentNodeId when within 8 m — that keeps the step list in sync as the
  // visitor physically walks the route.
  const SNAP_RADIUS_M = 8;
  useEffect(() => {
    if (!currentVisitor?.id) return;
    const probe = livePosition;
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
  }, [livePosition, currentVisitor?.id, currentVisitor?.currentNodeId, currentVisitor?.routeNodeIds, currentVisitor?.locationId, state, moveVisitor]);

  // Reset snap guard whenever the route changes (e.g. reroute / switch location).
  useEffect(() => {
    lastAdvancedNodeRef.current = null;
  }, [currentVisitor?.destinationNodeId, currentVisitor?.locationId]);

  // Geofenced auto-checkout: when the visitor's live GPS drifts beyond the
  // exit radius continuously for the debounce window, end their visit and
  // send them to the survey page. We measure distance to the *nearest* map
  // node (any office/corridor on the campus), not to the entrance — a big
  // campus like RP Tumba is 350 m across, so a visitor in a far corner could
  // legitimately be hundreds of metres from the gate while still inside.
  // Sustained-readings debounce stops a single noisy GPS fix from triggering.
  useEffect(() => {
    if (!currentVisitor?.id || currentVisitor.status !== 'active') return;
    if (!isValidLatLng(livePosition)) {
      outsideSinceRef.current = null;
      return;
    }
    const mapObj = getLocationMap(state, currentVisitor.locationId);
    const nodes = mapObj?.nodes || [];
    if (nodes.length === 0) return;

    let minDistM = Infinity;
    for (const node of nodes) {
      const pos = getNodeLatLng(node);
      if (!isValidLatLng(pos)) continue;
      const d = distanceMeters(livePosition, pos);
      if (d < minDistM) minDistM = d;
    }
    if (!Number.isFinite(minDistM)) return;

    if (minDistM <= CHECKOUT_RADIUS_M) {
      outsideSinceRef.current = null;
      return;
    }

    if (outsideSinceRef.current == null) {
      outsideSinceRef.current = Date.now();
      return;
    }
    if (Date.now() - outsideSinceRef.current < CHECKOUT_DEBOUNCE_MS) return;
    if (autoCheckoutInFlightRef.current) return;

    autoCheckoutInFlightRef.current = true;
    checkoutVisitor(currentVisitor.id, { keepActive: true })
      .then(() => navigate('/visit/checkout'))
      .catch(() => { autoCheckoutInFlightRef.current = false; outsideSinceRef.current = null; });
  }, [livePosition, currentVisitor?.id, currentVisitor?.status, currentVisitor?.locationId, state, checkoutVisitor, navigate]);

  // Arrival announcement: when the visitor reaches their destination, play a
  // spoken cue and a soft chime, and surface a toast banner. We only announce
  // once per (visitorId, destinationNodeId) so re-renders don't replay it.
  useEffect(() => {
    if (!currentVisitor?.id) return;
    const reached =
      currentVisitor.destinationNodeId &&
      currentVisitor.currentNodeId === currentVisitor.destinationNodeId;
    if (!reached) return;

    const key = `${currentVisitor.id}:${currentVisitor.destinationNodeId}`;
    if (arrivalAnnouncedRef.current === key) return;
    arrivalAnnouncedRef.current = key;

    const mapObj = getLocationMap(state, currentVisitor.locationId);
    const destNode = getNode(mapObj, currentVisitor.destinationNodeId);
    const destLabel = destNode?.label || t('visitor.nav.destination');

    setArrivalToast({
      title: t('visitor.nav.arrived.title'),
      message: t('visitor.nav.arrived.message', { destination: destLabel }),
    });

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const playTone = (frequency, startOffset, duration) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = frequency;
          gain.gain.setValueAtTime(0, ctx.currentTime + startOffset);
          gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + startOffset + 0.02);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startOffset + duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + startOffset);
          osc.stop(ctx.currentTime + startOffset + duration + 0.05);
        };
        playTone(880, 0, 0.18);
        playTone(1320, 0.2, 0.22);
        setTimeout(() => ctx.close().catch(() => {}), 1200);
      }
    } catch {
      // Audio not available — silently fall through to speech-only.
    }

    try {
      const synth = window.speechSynthesis;
      if (synth) {
        synth.cancel();
        const utter = new SpeechSynthesisUtterance(t('visitor.nav.arrived.spoken'));
        utter.lang = language === 'fr' ? 'fr-FR' : language === 'rw' ? 'rw-RW' : 'en-US';
        utter.rate = 1;
        utter.pitch = 1;
        synth.speak(utter);
      }
    } catch {
      // Speech synthesis not supported — toast still appears.
    }

    const dismissTimer = setTimeout(() => setArrivalToast(null), 6000);
    return () => clearTimeout(dismissTimer);
  }, [
    currentVisitor?.id,
    currentVisitor?.currentNodeId,
    currentVisitor?.destinationNodeId,
    currentVisitor?.locationId,
    state,
    t,
    language,
  ]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)] text-slate-500 dark:text-slate-400 text-sm">
        {t('visitor.nav.loading')}
      </div>
    );
  }

  if (!currentVisitor) {
    // If the route still carries a visitorId we haven't finished resolving
    // yet, hold on the loading screen instead of bouncing back to /visit —
    // otherwise CheckInPage remounts at step 0 right after the visitor
    // successfully checked in (a classic post-navigate state-propagation
    // race).
    const routeVisitorId = routerLocation.state?.visitorId;
    if (routeVisitorId && !routeHydrationAttempted) {
      return (
        <div className="flex items-center justify-center h-[calc(100vh-80px)] text-slate-500 dark:text-slate-400 text-sm">
          {t('visitor.nav.loading')}
        </div>
      );
    }
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

  // Origin is the visitor's live GPS — the map always centers on where the
  // visitor actually is. Building nodes are used only as fallback hints when
  // GPS has not produced a fix yet (in which case the GPS-required overlay is
  // shown over the map until a real position arrives).
  const defaultCenter = (() => {
    if (isValidLatLng(livePosition)) return livePosition;
    if (isValidLatLng(currentNodePos)) return currentNodePos;
    if (isValidLatLng(destinationNodePos)) return destinationNodePos;
    if (location?.address) {
      const parts = location.address.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts;
    }
    return [-1.99585, 30.04020];
  })();

  // The visitor marker tracks the live GPS in real time. We only fall back to
  // a static node/center when no GPS fix is available yet — and in that case
  // the GPS prompt is shown so the user can enable location services.
  const visitorPositionCandidate = livePosition || currentNodePos || defaultCenter;
  const visitorPosition = isValidLatLng(visitorPositionCandidate) ? visitorPositionCandidate : defaultCenter;

  // Build the remaining route polyline starting at the visitor's current node
  // (so completed segments fade out) and prepend the live GPS so the line
  // visually anchors to where the visitor stands right now.
  const upcomingRouteNodeIds = (() => {
    const ids = currentVisitor.routeNodeIds || [];
    if (!ids.length) return [];
    const idx = ids.indexOf(currentVisitor.currentNodeId);
    return idx >= 0 ? ids.slice(idx) : ids;
  })();
  const upcomingRoutePositions = buildRoutePositions(map, upcomingRouteNodeIds);
  const fullRoutePositions = buildRoutePositions(map, currentVisitor.routeNodeIds);
  const liveRoutePolyline = (() => {
    const segments = [...upcomingRoutePositions];
    if (isValidLatLng(livePosition)) {
      if (segments.length === 0 || distanceMeters(livePosition, segments[0]) > 1) {
        segments.unshift(livePosition);
      }
    }
    return segments;
  })();

  // Fit bounds covers the visitor's live position, the upcoming route, and
  // the destination — so as the visitor moves, the view tracks the remaining
  // journey rather than the static building footprint.
  const allPositions = [
    ...(isValidLatLng(livePosition) ? [livePosition] : []),
    // While far, approachRoute (the real-road line to the gate) is set; once
    // on-site it's cleared and we fit the internal route instead.
    ...(approachRoute && approachRoute.length > 1 ? approachRoute : liveRoutePolyline),
    ...(isValidLatLng(destinationNodePos) ? [destinationNodePos] : []),
  ].filter(isValidLatLng);

  // Building footprint: the bounding box of the location's mapped nodes, with
  // a small geographic padding. This is what gives the destination a visible
  // identity on the map — without it, the destination is just a pin floating
  // on generic OSM streets and the "site" is indistinguishable from the
  // surroundings. When a floorplan image is attached to the location, we also
  // overlay it inside the same bounds so the visitor sees the actual building.
  const buildingBounds = (() => {
    const nodePositions = (map?.nodes || [])
      .map(getNodeLatLng)
      .filter(isValidLatLng);
    if (nodePositions.length < 2) return null;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const [lat, lng] of nodePositions) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
    // ~5 m padding so the outline doesn't clip the edge nodes.
    const padLat = 0.00005;
    const padLng = 0.00005;
    return [
      [minLat - padLat, minLng - padLng],
      [maxLat + padLat, maxLng + padLng],
    ];
  })();

  // Approach vs. on-site. Our internal node graph only describes movement
  // *inside* the site; it has no road geometry for getting there. So while the
  // visitor is still far from the gate we hand the approach leg to Google Maps
  // (real roads + turn-by-turn), and only switch to the on-site guided route
  // once they're within FAR_FROM_SITE_M of the entrance.
  const FAR_FROM_SITE_M = 350;
  const siteEntryPos = (() => {
    const entranceNode = getNode(map, 'entrance');
    const fromEntrance = entranceNode ? getNodeLatLng(entranceNode) : null;
    if (isValidLatLng(fromEntrance)) return fromEntrance;
    if (isValidLatLng(destinationNodePos)) return destinationNodePos;
    if (buildingBounds) {
      return [
        (buildingBounds[0][0] + buildingBounds[1][0]) / 2,
        (buildingBounds[0][1] + buildingBounds[1][1]) / 2,
      ];
    }
    return null;
  })();
  const distanceToSiteM = isValidLatLng(livePosition) && isValidLatLng(siteEntryPos)
    ? distanceMeters(livePosition, siteEntryPos)
    : null;
  const isFarFromSite = distanceToSiteM != null && distanceToSiteM > FAR_FROM_SITE_M;
  const fmtMeters = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
  const farDistanceLabel = distanceToSiteM == null ? '' : fmtMeters(distanceToSiteM);
  // Prefer the actual road distance from the router; fall back to straight-line.
  const approachDistanceLabel = approachInfo?.distanceM != null
    ? fmtMeters(approachInfo.distanceM)
    : farDistanceLabel;
  // Deep link into Google Maps directions, starting turn-by-turn navigation
  // (dir_action=navigate). Destination is the gate so the on-site route can
  // take over on arrival. Origin is the live GPS when we have it; otherwise
  // Google falls back to the device's own location.
  const googleMapsNavUrl = isValidLatLng(siteEntryPos)
    ? `https://www.google.com/maps/dir/?api=1${
        isValidLatLng(livePosition) ? `&origin=${livePosition[0]},${livePosition[1]}` : ''
      }&destination=${siteEntryPos[0]},${siteEntryPos[1]}&travelmode=driving&dir_action=navigate`
    : null;

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

  const destinationLabel = destinationNode?.label || routeFallbackNode?.label || t('visitor.nav.destination');
  const currentNodeLabel = currentNode?.label || t('visitor.nav.youAreHere');
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
  const corridorHint = currentStep?.text || t('visitor.nav.followSignage');

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
    { key: 'map', icon: <MapLucide size={18} />, label: t('visitor.nav.recenter'), onClick: handleRecenterMap },
    { key: 'route', icon: <Route size={18} />, label: t('visitor.nav.focusRoute'), onClick: handleFocusRoute },
    { key: 'chat', icon: <MessageCircle size={18} />, label: t('visitor.nav.askAssistant'), onClick: handleOpenChat },
    { key: 'alerts', icon: <Bell size={18} />, label: t('visitor.nav.alerts'), onClick: handleOpenAlerts },
  ];

  return (
    <div className={`relative ${isFullscreen ? '' : 'flex gap-4 flex-1 min-h-0 h-full md:pl-20'}`}>

      {/* Left Icon Rail — fixed to viewport so it never scrolls with content */}
      {!isFullscreen && (
        <aside className="hidden md:flex flex-col items-center gap-2 w-16 py-4 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm fixed left-4 sm:left-6 top-20 bottom-20 z-[400] overflow-y-auto custom-scrollbar">
          <button
            type="button"
            onClick={handleScrollTop}
            title={t('visitor.nav.scrollTop')}
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

          {/* Floorplan image — overlaid inside the building's node bbox when
              the location has one. Sits above OSM tiles so the actual building
              layout is what the visitor sees, not just street features. */}
          {map?.floorplanImage && buildingBounds && (
            <ImageOverlay
              url={map.floorplanImage}
              bounds={buildingBounds}
              opacity={0.85}
              zIndex={400}
            />
          )}

          {/* Building footprint outline — gives the destination site a clear
              visual identity over the surrounding streets/buildings on OSM. */}
          {buildingBounds && (
            <Rectangle
              bounds={buildingBounds}
              pathOptions={{
                color: '#cd5c5c',
                weight: 2,
                opacity: 0.7,
                fillColor: '#cd5c5c',
                fillOpacity: map?.floorplanImage ? 0.05 : 0.12,
                dashArray: '4 4',
              }}
            />
          )}

          {/* Fit the map to show the visitor + remaining route + destination.
              Re-fits on route/destination change and once when GPS first arrives. */}
          <FitBounds
            positions={allPositions.length > 1 ? allPositions : [defaultCenter]}
            fitKey={`${(currentVisitor.routeNodeIds || []).join('|')}::${currentVisitor.destinationNodeId || ''}::${currentVisitor.currentNodeId || ''}::${livePosition ? 'gps' : 'nogps'}`}
          />

          {/* Completed segments — faded, so the visitor can see where they've been */}
          {/* Approach route to the gate (real roads, fetched from OSRM) —
              drawn on our own map so the visitor never leaves the app. */}
          {isFarFromSite && approachRoute && approachRoute.length > 1 && (
            <Polyline
              positions={approachRoute}
              pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
            />
          )}

          {!isFarFromSite && fullRoutePositions.length > 1 && (
            <Polyline
              positions={roundRouteCorners(fullRoutePositions)}
              pathOptions={{ color: '#cd5c5c', weight: 4, opacity: 0.25, lineCap: 'round', lineJoin: 'round', dashArray: '6 8' }}
            />
          )}

          {/* Live route — origin is the visitor's current GPS, ending at the destination */}
          {!isFarFromSite && liveRoutePolyline.length > 1 && (
            <Polyline
              positions={roundRouteCorners(liveRoutePolyline)}
              pathOptions={{ color: '#cd5c5c', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
            />
          )}

          {/* Route node markers (intermediate waypoints) — only on-site */}
          {!isFarFromSite && (currentVisitor.routeNodeIds || []).map((nodeId) => {
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
                <div className="text-center font-bold">{t('visitor.nav.youAreHere')}</div>
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

        {/* Far-from-site banner — the real-road approach route is drawn on the
            map above (in-app, no external jump). This shows the live status /
            ETA, with an optional Google Maps link as a fallback only. Once the
            visitor reaches the gate the on-site guided route takes over. */}
        {isFarFromSite && (
          <div className="absolute top-4 left-4 right-16 z-[670] flex justify-center">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-xl max-w-md w-full">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                {approachRoute ? <Navigation size={20} strokeWidth={2.2} /> : <Loader2 size={20} className="animate-spin" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {t('visitor.nav.farFromSite.title', { distance: approachDistanceLabel })}
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-snug">
                  {approachInfo
                    ? t('visitor.nav.farFromSite.eta', { minutes: approachInfo.durationMin })
                    : t('visitor.nav.farFromSite.subtitle')}
                </p>
              </div>
              {googleMapsNavUrl && (
                <a
                  href={googleMapsNavUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('visitor.nav.farFromSite.cta')}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
                >
                  {t('visitor.nav.farFromSite.cta')}
                </a>
              )}
            </div>
          </div>
        )}

        {/* GPS required overlay — blocks the map until the visitor's real
            position is available, since the origin must always be where they
            actually are. Different copy for denied / unavailable / unsupported. */}
        {!livePosition && locationError && (
          <div className="absolute inset-0 z-[680] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/15 text-[var(--color-brand-terracotta)] dark:text-red-400 flex items-center justify-center mb-3">
                <LocateFixed size={24} strokeWidth={2.2} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t('visitor.nav.locationRequired.title')}
              </h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {locationError === 'denied'
                  ? t('visitor.nav.locationRequired.denied')
                  : locationError === 'unsupported'
                  ? t('visitor.nav.locationRequired.unsupported')
                  : t('visitor.nav.locationRequired.unavailable')}
              </p>
              <button
                type="button"
                onClick={() => setLocationRetryToken((v) => v + 1)}
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold bg-[var(--color-brand-terracotta)] dark:bg-red-500 text-white px-4 py-2.5 rounded-xl shadow-sm hover:scale-105 transition-transform"
              >
                <LocateFixed size={14} /> {t('visitor.nav.locationRequired.enable')}
              </button>
            </div>
          </div>
        )}

        {/* Acquiring-fix indicator — non-blocking, while we wait for the first GPS sample */}
        {!livePosition && !locationError && (
          <div className="absolute top-4 left-4 z-[660] flex items-center gap-2 px-3 py-2 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-lg">
            <Loader2 size={14} className="text-[var(--color-brand-terracotta)] dark:text-red-400 animate-spin" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {t('visitor.nav.acquiringLocation')}
            </span>
          </div>
        )}

        {/* Floating location pill at bottom of map */}
        {!isFullscreen && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[650] flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-lg">
            <MapPin size={14} className="text-[var(--color-brand-terracotta)] dark:text-red-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{currentNodeLabel}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('visitor.nav.metersAway', { meters: Math.round(remainingDistance) })}</span>
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
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('visitor.nav.routeInstructions')}</h3>
              </div>
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
                            {t('visitor.nav.metersAway', { meters: step.distance })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 dark:text-slate-400 text-sm">{t('visitor.nav.noRoute')}</p>
              )}
            </div>
          </div>

          {/* Stats Stack */}
          <div className="flex flex-col gap-4 min-h-0">
            {/* Progress Card */}
            <div className="glass-card p-5 relative overflow-hidden">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('visitor.nav.progress')}</p>
              <div className="mt-1 flex items-baseline gap-1">
                <p className="text-4xl font-extrabold text-slate-900 dark:text-white leading-none">{progressPercent}</p>
                <span className="text-lg font-bold text-slate-500 dark:text-slate-400">%</span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                {t('visitor.nav.metersOf', { done: Math.round(completedDistance), total: Math.round(totalRouteDistance) })}
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('visitor.nav.eta')}</p>
              <div className="mt-1 flex items-baseline gap-1">
                <p className="text-4xl font-extrabold text-slate-900 dark:text-white leading-none">{etaMinutes}</p>
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('visitor.nav.min')}</span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">
                {corridorHint}
              </p>
            </div>

            {/* Destination Info Card */}
            <div className="glass-card p-5 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">{t('visitor.nav.destination')}</p>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-red-500/20">
                  <Target size={18} className="text-white" strokeWidth={2.4} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{destinationLabel}</p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    {t('visitor.nav.totalSteps', {
                      steps: totalSteps,
                      plural: totalSteps === 1 ? '' : 's',
                      meters: Math.round(totalRouteDistance),
                    })}
                  </p>
                </div>
              </div>
              <div className="mt-4 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('visitor.nav.visitor')}</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate mt-0.5">{currentVisitor.name}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Arrival Toast — fires once when the visitor reaches the destination */}
      <AnimatePresence>
        {arrivalToast && (
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            role="status"
            aria-live="polite"
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[800] flex items-start gap-3 px-5 py-4 max-w-sm w-[calc(100%-2rem)] rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-2xl border border-emerald-400/40"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
              <PartyPopper size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold tracking-tight">{arrivalToast.title}</p>
              <p className="text-xs font-medium text-white/90 mt-0.5">{arrivalToast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setArrivalToast(null)}
              aria-label="Close"
              className="text-white/80 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
                    <h3 className="font-bold text-lg leading-tight">{t('visitor.nav.alerts')}</h3>
                    <p className="text-xs text-slate-200/80 font-medium">{t('visitor.nav.alerts.your')}</p>
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
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('visitor.nav.visitor')}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-200 dark:to-slate-400 flex items-center justify-center text-white dark:text-slate-900">
                      <User size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{currentVisitor.name}</p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                        {location?.name || t('visitor.nav.alerts.onSite')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('visitor.nav.destination')}</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{destinationLabel}</p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    {t('visitor.nav.alerts.remaining', { meters: Math.round(remainingDistance), minutes: etaMinutes })}
                  </p>
                </div>

                <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-brand-terracotta)] dark:text-red-400">{t('visitor.nav.alerts.emergency')}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {t('visitor.nav.alerts.emergencyText')}
                  </p>
                  <a
                    href="tel:+250788000000"
                    className="mt-3 inline-flex items-center gap-2 text-xs font-bold bg-[var(--color-brand-terracotta)] dark:bg-red-500 text-white px-4 py-2 rounded-full shadow-sm hover:scale-105 transition-transform"
                  >
                    <Phone size={14} /> {t('visitor.nav.alerts.callReception')}
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
