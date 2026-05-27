import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Plus, Route, Trash2, Save, Move, Crosshair, CheckCircle2, Loader2, Navigation, Circle, ArrowRight, X, CornerDownRight, QrCode } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMapEvents, ImageOverlay } from 'react-leaflet';
import L from 'leaflet';
import { useSinarms } from '../../context/SinarmsContext';
import { getLocationById, getLocationMap, getOrganizationById } from '../../lib/sinarmsEngine';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeDirection(fromLat, fromLng, toLat, toLng) {
  const dLng = toLng - fromLng;
  const dLat = toLat - fromLat;
  const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized < 30 || normalized >= 330) return 'straight';
  if (normalized >= 30 && normalized < 150) return 'right';
  if (normalized >= 210 && normalized < 330) return 'left';
  return 'straight';
}

function MapEvents({ activeTool, onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    }
  });
  return null;
}

export default function FacilityMapEditor() {
  const [searchParams] = useSearchParams();
  const locationId = searchParams.get('locationId');
  const { state, updateLocationMap, downloadLocationQr } = useSinarms();
  const [isDownloadingQr, setIsDownloadingQr] = useState(false);

  const location = locationId ? getLocationById(state, locationId) : null;
  const organization = location ? getOrganizationById(state, location.organizationId) : null;
  const locationMap = locationId ? getLocationMap(state, locationId) : { nodes: [], edges: [] };

  const defaultCenter = useMemo(() => {
    if (location?.address) {
      const parts = location.address.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts;
    }
    return [-1.9443, 30.0621];
  }, [location?.address]);

  // --- Nodes ---
  const [nodes, setNodes] = useState(() =>
    (locationMap.nodes || []).map(n => ({
      id: n.id,
      lat: n.lat != null ? n.lat : defaultCenter[0] + (n.y || 0) * 0.0001,
      lng: n.lng != null ? n.lng : defaultCenter[1] + (n.x || 0) * 0.0001,
      label: n.label || n.id,
      type: n.zone || n.type || 'public',
      aliases: n.aliases || [],
    }))
  );

  // --- Edges ---
  const [edges, setEdges] = useState(() =>
    (locationMap.edges || []).map(e => ({
      id: e.id || `${e.from}-${e.to}`,
      from: e.from,
      to: e.to,
      distanceM: e.distanceM || 0,
      direction: e.direction || 'straight',
      directionHint: e.directionHint || '',
      isAccessible: e.isAccessible !== false,
      gpsTrail: e.gpsTrail || [],
    }))
  );

  // --- Tools & UI state ---
  const [activeTool, setActiveTool] = useState('select');
  const [activeNodeId, setActiveNodeId] = useState(nodes[0]?.id || null);
  const [activeEdgeId, setActiveEdgeId] = useState(null);
  const [floorplanUrl, setFloorplanUrl] = useState(locationMap.floorplanImage || null);
  const [floorplanBounds, setFloorplanBounds] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [propertiesTab, setPropertiesTab] = useState('node');

  // --- Path Recording state ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordFromNodeId, setRecordFromNodeId] = useState(null);
  const [liveTrail, setLiveTrail] = useState([]);
  const [livePosition, setLivePosition] = useState(null);
  const [liveAccuracy, setLiveAccuracy] = useState(null);
  const watchIdRef = useRef(null);
  const pollIdRef = useRef(null);
  // Refs always hold the latest values — avoids stale closure in callbacks
  const liveTrailRef = useRef([]);
  const recordFromNodeIdRef = useRef(null);
  // Ref for the live Leaflet polyline — we update positions directly for smooth drawing
  const trailPolylineRef = useRef(null);

  const activeNode = nodes.find(n => n.id === activeNodeId) || null;
  const activeEdge = edges.find(e => e.id === activeEdgeId) || null;

  const mapCenter = useMemo(() => {
    if (nodes.length > 0 && nodes[0].lat != null) return [nodes[0].lat, nodes[0].lng];
    return defaultCenter;
  }, []);

  // Keep refs in sync
  useEffect(() => { liveTrailRef.current = liveTrail; }, [liveTrail]);
  useEffect(() => { recordFromNodeIdRef.current = recordFromNodeId; }, [recordFromNodeId]);

  // Directly adds a GPS point — updates position display immediately and appends to trail
  const addTrailPoint = useCallback((lat, lng, accuracy) => {
    // Always update the live position display immediately
    setLivePosition([lat, lng]);
    setLiveAccuracy(accuracy);

    setLiveTrail(prev => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        // Skip only exact duplicate coordinates — accept every real GPS change
        if (last[0] === lat && last[1] === lng) return prev;
      }
      const next = [...prev, [lat, lng]];
      liveTrailRef.current = next;
      // Update Leaflet polyline directly for instant visual feedback
      if (trailPolylineRef.current) {
        trailPolylineRef.current.setLatLngs(next);
      }
      return next;
    });
  }, []);

  // --- Path Recording ---
  const startRecording = useCallback((fromNodeId) => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }
    console.log(`[PathRecorder] START recording from node: "${fromNodeId}"`);
    setRecordFromNodeId(fromNodeId);
    recordFromNodeIdRef.current = fromNodeId;
    setLiveTrail([]);
    liveTrailRef.current = [];
    setIsRecording(true);

    // watchPosition is the real-time API — fires instantly when GPS hardware has a new fix
    const wId = navigator.geolocation.watchPosition(
      (pos) => addTrailPoint(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      (err) => console.error(`[PathRecorder] watch error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
    watchIdRef.current = wId;

    // Fallback poll every 100ms — catches cases where watchPosition is slow (some browsers/devices)
    const pId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => addTrailPoint(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 2000 }
      );
    }, 100);
    pollIdRef.current = pId;
  }, [addTrailPoint]);

  const stopRecording = useCallback((toNodeId) => {
    console.log(`[PathRecorder] STOP recording → destination node: "${toNodeId}"`);
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (pollIdRef.current != null) {
      clearInterval(pollIdRef.current);
      pollIdRef.current = null;
    }
    setIsRecording(false);
    setLiveAccuracy(null);

    // Read from refs to get the latest values (not stale closure)
    const fromId = recordFromNodeIdRef.current;
    const trail = [...liveTrailRef.current];

    if (!fromId || !toNodeId || fromId === toNodeId) {
      console.warn(`[PathRecorder] Aborted: from="${fromId}" to="${toNodeId}" (same or missing)`);
      setRecordFromNodeId(null);
      setLiveTrail([]);
      setLivePosition(null);
      return;
    }

    // Calculate total walked distance from GPS trail
    let totalDist = 0;
    for (let i = 1; i < trail.length; i++) {
      totalDist += haversineDistance(trail[i - 1][0], trail[i - 1][1], trail[i][0], trail[i][1]);
    }

    const fromNode = nodes.find(n => n.id === fromId);
    const toNode = nodes.find(n => n.id === toNodeId);

    // Fallback: straight-line distance if GPS trail too short
    if (totalDist < 1 && fromNode && toNode) {
      totalDist = haversineDistance(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);
      console.log(`[PathRecorder] GPS trail too short (${trail.length} points), using straight-line fallback: ${totalDist.toFixed(2)}m`);
    }

    const direction = fromNode && toNode ? computeDirection(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng) : 'straight';

    console.log(`[PathRecorder] Edge: "${fromId}" → "${toNodeId}" | distance: ${(Math.round(totalDist * 10) / 10)}m | direction: ${direction} | GPS points: ${trail.length}`);
    console.log(`[PathRecorder] GPS trail:`, trail.map((p, i) => `  #${i}: [${p[0].toFixed(16)}, ${p[1].toFixed(15)}]`).join('\n'));

    // Check if edge already exists
    setEdges(prev => {
      const existing = prev.find(e =>
        (e.from === fromId && e.to === toNodeId) ||
        (e.from === toNodeId && e.to === fromId)
      );

      if (existing) {
        console.log(`[PathRecorder] Updating existing edge: "${existing.id}"`);
        setActiveEdgeId(existing.id);
        return prev.map(e => e.id === existing.id ? {
          ...e,
          distanceM: Math.round(totalDist * 10) / 10,
          direction,
          directionHint: `Walk ${direction} to ${toNode?.label || toNodeId}.`,
          gpsTrail: trail,
        } : e);
      }

      const newEdge = {
        id: `${fromId}-${toNodeId}`,
        from: fromId,
        to: toNodeId,
        distanceM: Math.round(totalDist * 10) / 10,
        direction,
        directionHint: `Walk ${direction} to ${toNode?.label || toNodeId}.`,
        isAccessible: true,
        gpsTrail: trail,
      };
      console.log(`[PathRecorder] New edge: "${newEdge.id}" with ${trail.length} GPS trail points`);
      setActiveEdgeId(newEdge.id);
      return [...prev, newEdge];
    });

    setPropertiesTab('edge');
    setRecordFromNodeId(null);
    setLiveTrail([]);
    liveTrailRef.current = [];
    setLivePosition(null);
    setLiveAccuracy(null);
  }, [nodes]);

  const cancelRecording = useCallback(() => {
    console.log(`[PathRecorder] CANCELLED | ${liveTrailRef.current.length} GPS points discarded`);
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (pollIdRef.current != null) {
      clearInterval(pollIdRef.current);
      pollIdRef.current = null;
    }
    setIsRecording(false);
    setRecordFromNodeId(null);
    setLiveTrail([]);
    liveTrailRef.current = [];
    setLivePosition(null);
    setLiveAccuracy(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (pollIdRef.current != null) clearInterval(pollIdRef.current);
    };
  }, []);

  // --- Node click handler ---
  const handleNodeClick = (nodeId) => {
    if (activeTool === 'record') {
      if (isRecording) {
        // Arriving at destination node - finish recording
        stopRecording(nodeId);
        setActiveTool('select');
      } else {
        // Starting from this node
        startRecording(nodeId);
      }
      return;
    }

    if (activeTool === 'delete') {
      deleteNode(nodeId);
      return;
    }

    setActiveNodeId(nodeId);
    setActiveEdgeId(null);
    setPropertiesTab('node');
  };

  // --- Map click handler ---
  const handleMapClick = (latlng) => {
    if (isRecording) return;

    if (activeTool === 'node') {
      const newNode = {
        id: `node-${Date.now()}`,
        lat: latlng.lat,
        lng: latlng.lng,
        label: 'New Node',
        type: 'public',
        aliases: [],
      };
      setNodes(prev => [...prev, newNode]);
      setActiveNodeId(newNode.id);
      setPropertiesTab('node');
      setActiveTool('select');
      return;
    }
  };

  // --- Save ---
  const handleSaveLayout = async () => {
    if (!locationId) return;
    setIsSaving(true);
    try {
      const origNodes = locationMap.nodes || [];
      const mapData = {
        nodes: nodes.map(n => {
          const orig = origNodes.find(o => o.id === n.id);
          // Convert lat/lng back to x/y for DB storage (reverse of the load conversion)
          const x = orig?.x != null && orig?.lat == null ? orig.x : Math.round((n.lng - defaultCenter[1]) / 0.0001);
          const y = orig?.y != null && orig?.lat == null ? orig.y : Math.round((n.lat - defaultCenter[0]) / 0.0001);
          return { ...orig, id: n.id, lat: n.lat, lng: n.lng, x: isFinite(x) ? x : 0, y: isFinite(y) ? y : 0, label: n.label, zone: n.type, type: n.type, aliases: n.aliases, floor: orig?.floor || 1 };
        }),
        edges: edges.map(e => ({
          id: e.id,
          from: e.from,
          to: e.to,
          distanceM: e.distanceM,
          direction: e.direction,
          directionHint: e.directionHint,
          isAccessible: e.isAccessible,
          gpsTrail: e.gpsTrail,
        })),
        floorplanImage: floorplanUrl,
      };
      await updateLocationMap(locationId, mapData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      alert('Failed to save map layout.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateActiveNode = (updates) => {
    setNodes(prev => prev.map(n => n.id === activeNodeId ? { ...n, ...updates } : n));
  };

  const updateActiveEdge = (updates) => {
    setEdges(prev => prev.map(e => e.id === activeEdgeId ? { ...e, ...updates } : e));
  };

  const deleteNode = (nodeId) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.from !== nodeId && e.to !== nodeId));
    if (activeNodeId === nodeId) setActiveNodeId(null);
    setActiveTool('select');
  };

  const deleteEdge = (edgeId) => {
    setEdges(prev => prev.filter(e => e.id !== edgeId));
    if (activeEdgeId === edgeId) setActiveEdgeId(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setFloorplanUrl(url);
      setFloorplanBounds([
        [defaultCenter[0] - 0.0002, defaultCenter[1] - 0.0002],
        [defaultCenter[0] + 0.0002, defaultCenter[1] + 0.0002],
      ]);
    }
  };

  const getDeviceLocation = () => {
    setGpsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateActiveNode({ lat: position.coords.latitude, lng: position.coords.longitude });
          setGpsLoading(false);
        },
        () => { alert('Unable to retrieve location.'); setGpsLoading(false); },
      );
    } else {
      alert('Geolocation not supported.'); setGpsLoading(false);
    }
  };

  // --- Edge polylines for rendering ---
  const edgeLines = useMemo(() => {
    return edges.map(e => {
      const fromNode = nodes.find(n => n.id === e.from);
      const toNode = nodes.find(n => n.id === e.to);
      if (!fromNode || !toNode) return null;

      // Use GPS trail if available, otherwise straight line
      const positions = e.gpsTrail && e.gpsTrail.length > 1
        ? e.gpsTrail
        : [[fromNode.lat, fromNode.lng], [toNode.lat, toNode.lng]];

      return { ...e, positions };
    }).filter(Boolean);
  }, [edges, nodes]);

  const fromNodeForRecording = nodes.find(n => n.id === recordFromNodeId);

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            Facility Map Editor
            <span className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-red-200 dark:border-red-500/30">
              Admin Only
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {location ? location.name : 'No location selected'}
            {organization ? ` - ${organization.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input type="file" id="floorplan-upload" className="hidden" accept="image/*" onChange={handleFileUpload} />
          <label htmlFor="floorplan-upload" className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl transition-all font-bold flex items-center gap-2 border border-slate-300 dark:border-slate-600 shadow-sm cursor-pointer">
            <Upload size={18} />
            <span className="hidden sm:inline">Upload Floorplan</span>
          </label>
          <button
            type="button"
            onClick={async () => {
              if (!locationId || isDownloadingQr) return;
              setIsDownloadingQr(true);
              try {
                await downloadLocationQr(locationId);
              } catch (error) {
                window.alert(error?.response?.data?.message || error?.message || 'Unable to download QR code.');
              } finally {
                setIsDownloadingQr(false);
              }
            }}
            disabled={!locationId || isDownloadingQr}
            title="Download a printable QR code that auto-checks in visitors at this location"
            className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl transition-all font-bold flex items-center gap-2 border border-slate-300 dark:border-slate-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloadingQr ? <Loader2 size={18} className="animate-spin" /> : <QrCode size={18} />}
            <span className="hidden sm:inline">{isDownloadingQr ? 'Preparing…' : 'Download QR'}</span>
          </button>
          <button
            onClick={handleSaveLayout}
            disabled={isSaving}
            className={`bg-[var(--color-brand-terracotta)] hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-400 text-white px-6 py-2 rounded-xl shadow-md transition-all font-bold tracking-wide flex items-center gap-2 ${saveSuccess ? 'bg-green-600 hover:bg-green-600 dark:bg-green-600 shadow-green-500/30' : 'shadow-[var(--color-brand-terracotta)]/30 border-b-2 border-red-700 dark:border-red-700 active:border-b-0 active:translate-y-[2px]'} ${isSaving ? 'opacity-80 cursor-wait' : ''}`}
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : saveSuccess ? <CheckCircle2 size={18} /> : <Save size={18} />}
            <span className="hidden sm:inline">{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Layout'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        {/* Editor Workspace */}
        <div className="flex-1 glass-card overflow-hidden flex flex-col relative border-2 border-slate-200 dark:border-slate-800">

          {/* Toolbar */}
          <div className="h-14 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center p-2 gap-2 backdrop-blur-md absolute top-0 inset-x-0 z-20 shadow-sm">
            {[
              { id: 'select', icon: <Move size={18} />, label: 'Select' },
              { id: 'node', icon: <Plus size={18} />, label: 'Add Node' },
              { id: 'record', icon: <Navigation size={18} />, label: 'Walk & Record' },
              { id: 'delete', icon: <Trash2 size={18} />, label: 'Delete', color: 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20' },
            ].map(tool => (
              <button
                key={tool.id}
                onClick={() => {
                  if (isRecording && tool.id !== 'record') {
                    cancelRecording();
                  }
                  setActiveTool(tool.id);
                  setRecordFromNodeId(null);
                }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  activeTool === tool.id
                    ? tool.id === 'record' && isRecording
                      ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 shadow-inner ring-2 ring-green-400 animate-pulse'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-inner'
                    : tool.color || 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tool.icon} <span className="hidden md:inline">{tool.label}</span>
              </button>
            ))}
          </div>

          {/* Recording Banner */}
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="absolute top-14 inset-x-0 z-20 bg-green-50 dark:bg-green-900/30 border-b-2 border-green-400 dark:border-green-600 px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-600"></span>
                  </span>
                  <span className="text-sm font-bold text-green-800 dark:text-green-300">
                    Recording from <span className="underline">{fromNodeForRecording?.label || recordFromNodeId}</span>
                  </span>
                  <span className="text-xs text-green-600 dark:text-green-400">
                    ({liveTrail.length} pts, ~{Math.round(liveTrail.reduce((sum, p, i) => i > 0 ? sum + haversineDistance(liveTrail[i-1][0], liveTrail[i-1][1], p[0], p[1]) : sum, 0))}m)
                  </span>
                  {livePosition && (
                    <span className="text-xs font-mono text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-800/40 px-2 py-0.5 rounded">
                      {livePosition[0].toFixed(16)},{livePosition[1].toFixed(15)}
                      {liveAccuracy != null && <span className="ml-1 opacity-70">&plusmn;{liveAccuracy.toFixed(1)}m</span>}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-700 dark:text-green-400 font-medium">Walk to destination, then click destination node to finish</span>
                  <button onClick={cancelRecording} className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/20 px-3 py-1 rounded-lg hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors flex items-center gap-1">
                    <X size={12} /> Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Walk & Record: waiting for start node banner */}
          <AnimatePresence>
            {activeTool === 'record' && !isRecording && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="absolute top-14 inset-x-0 z-20 bg-amber-50 dark:bg-amber-900/30 border-b-2 border-amber-400 dark:border-amber-600 px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Navigation size={16} className="text-amber-600" />
                  <span className="text-sm font-bold text-amber-800 dark:text-amber-300">
                    Click a node to start walking from (your current location)
                  </span>
                </div>
                <button onClick={() => setActiveTool('select')} className="text-xs font-bold text-slate-600 bg-slate-200 dark:bg-slate-700 dark:text-slate-300 px-3 py-1 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                  Cancel
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Map Canvas */}
          <div className="flex-1 relative bg-slate-100/50 dark:bg-[#0b101e] mt-14 overflow-hidden z-0">
            <MapContainer
              center={mapCenter}
              zoom={19}
              scrollWheelZoom={true}
              className="w-full h-full z-0"
              style={{ width: '100%', height: '100%', minHeight: '400px' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={22}
                maxNativeZoom={19}
              />
              <MapEvents activeTool={activeTool} onMapClick={handleMapClick} />

              {floorplanUrl && floorplanBounds && (
                <ImageOverlay url={floorplanUrl} bounds={floorplanBounds} opacity={0.8} />
              )}

              {/* Saved edge lines */}
              {edgeLines.map(edge => (
                <Polyline
                  key={edge.id}
                  positions={edge.positions}
                  pathOptions={{
                    color: activeEdgeId === edge.id ? '#3b82f6' : edge.isAccessible ? '#cd5c5c' : '#94a3b8',
                    weight: activeEdgeId === edge.id ? 5 : 3,
                    dashArray: edge.isAccessible ? undefined : '8, 8',
                    opacity: activeEdgeId === edge.id ? 1 : 0.7,
                  }}
                  eventHandlers={{
                    click: () => {
                      if (activeTool === 'delete') {
                        deleteEdge(edge.id);
                      } else {
                        setActiveEdgeId(edge.id);
                        setPropertiesTab('edge');
                      }
                    }
                  }}
                />
              ))}

              {/* Live recording trail line — ref allows direct Leaflet updates for instant drawing */}
              {isRecording && (
                <Polyline
                  ref={trailPolylineRef}
                  positions={liveTrail}
                  pathOptions={{ color: '#22c55e', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
                />
              )}

              {/* Waypoint dots along the trail */}
              {isRecording && liveTrail.map((point, i) => (
                <CircleMarker
                  key={`wp-${i}`}
                  center={point}
                  radius={5}
                  pathOptions={{ color: '#16a34a', fillColor: '#ffffff', fillOpacity: 1, weight: 2 }}
                />
              ))}

              {/* Live current position dot */}
              {livePosition && isRecording && (
                <CircleMarker
                  center={livePosition}
                  radius={8}
                  pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1, weight: 3 }}
                />
              )}

              {/* Nodes */}
              {nodes.map(node => {
                const isFrom = recordFromNodeId === node.id;
                const isHighlightedForRecord = activeTool === 'record' && !isRecording && !recordFromNodeId;
                return (
                  <Marker
                    key={node.id}
                    position={[node.lat, node.lng]}
                    eventHandlers={{ click: () => handleNodeClick(node.id) }}
                    opacity={
                      isFrom ? 1 :
                      activeNodeId === node.id ? 1 :
                      isHighlightedForRecord ? 0.9 :
                      0.6
                    }
                  >
                    <Popup>
                      <div className="text-center">
                        <strong>{node.label}</strong>
                        <br />
                        <span className="text-xs text-gray-500">{node.type} | {node.id}</span>
                        {(activeTool === 'record' && !isRecording) && (
                          <div className="mt-1 text-xs font-bold text-green-600">Click to start recording path from here</div>
                        )}
                        {(isRecording && node.id !== recordFromNodeId) && (
                          <div className="mt-1 text-xs font-bold text-blue-600">Click to finish path here</div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>

        {/* Properties Panel */}
        <div className="w-full lg:w-80 glass-card flex flex-col overflow-hidden shadow-2xl shrink-0">
          {/* Tab Header */}
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0b101e]">
            <div className="flex">
              <button
                onClick={() => setPropertiesTab('node')}
                className={`flex-1 px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 ${
                  propertiesTab === 'node'
                    ? 'border-[var(--color-brand-terracotta)] text-[var(--color-brand-terracotta)] dark:text-red-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Circle size={14} /> Nodes
              </button>
              <button
                onClick={() => setPropertiesTab('edge')}
                className={`flex-1 px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 ${
                  propertiesTab === 'edge'
                    ? 'border-[var(--color-brand-terracotta)] text-[var(--color-brand-terracotta)] dark:text-red-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Route size={14} /> Paths ({edges.length})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-white/50 dark:bg-slate-900/50">
            {/* === NODE TAB === */}
            {propertiesTab === 'node' && (
              <div className="p-4 space-y-5">
                {activeNode ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">ID</label>
                      <input type="text" value={activeNode.id} disabled className="w-full bg-slate-100 dark:bg-slate-800 border-none text-slate-500 rounded-lg px-3 py-2 text-sm font-mono opacity-70" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Label</label>
                      <input type="text" value={activeNode.label} onChange={(e) => updateActiveNode({ label: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand-terracotta)] outline-none font-medium" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Node Type</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {['public', 'restricted', 'checkpoint', 'office', 'corridor', 'exit'].map(t => (
                          <button key={t} onClick={() => updateActiveNode({ type: t })} className={`${activeNode.type === t ? 'bg-[var(--color-brand-terracotta)] text-white shadow-md shadow-red-500/20 border-none' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'} py-2 rounded-lg text-xs font-bold transition-colors capitalize`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-4 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Coordinates</label>
                        <button onClick={getDeviceLocation} disabled={gpsLoading} className="text-xs font-bold text-[var(--color-brand-terracotta)] hover:bg-red-50 dark:hover:bg-red-500/20 px-2 py-1 rounded flex items-center gap-1 transition-colors disabled:opacity-50">
                          {gpsLoading ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />}
                          {gpsLoading ? 'Locating...' : 'Use GPS'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                          <span className="bg-slate-200 dark:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center border-r border-slate-300 dark:border-slate-600">Lat</span>
                          <input type="number" step="0.0000000000000001" value={activeNode.lat} onChange={(e) => updateActiveNode({ lat: parseFloat(e.target.value) || 0 })} className="w-full bg-transparent border-none text-slate-800 dark:text-slate-200 px-2 py-2 text-sm outline-none font-mono" />
                        </div>
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                          <span className="bg-slate-200 dark:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center border-r border-slate-300 dark:border-slate-600">Lng</span>
                          <input type="number" step="0.0000000000000001" value={activeNode.lng} onChange={(e) => updateActiveNode({ lng: parseFloat(e.target.value) || 0 })} className="w-full bg-transparent border-none text-slate-800 dark:text-slate-200 px-2 py-2 text-sm outline-none font-mono" />
                        </div>
                      </div>
                    </div>

                    {/* Connected edges summary */}
                    <div className="space-y-1.5 pt-4 border-t border-slate-200 dark:border-slate-800">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Connected Paths</label>
                      {edges.filter(e => e.from === activeNode.id || e.to === activeNode.id).length === 0 ? (
                        <p className="text-xs text-slate-400 pl-1">No paths connected. Use "Walk & Record" to physically walk between offices and create paths.</p>
                      ) : (
                        <div className="space-y-1">
                          {edges.filter(e => e.from === activeNode.id || e.to === activeNode.id).map(e => {
                            const otherId = e.from === activeNode.id ? e.to : e.from;
                            const other = nodes.find(n => n.id === otherId);
                            return (
                              <button
                                key={e.id}
                                onClick={() => { setActiveEdgeId(e.id); setPropertiesTab('edge'); }}
                                className="w-full text-left bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                              >
                                <CornerDownRight size={12} className="text-slate-400" />
                                <span className="font-medium text-slate-700 dark:text-slate-300">{other?.label || otherId}</span>
                                <span className="ml-auto text-slate-400">{e.distanceM}m</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {activeTool === 'delete' && (
                      <button onClick={() => deleteNode(activeNode.id)} className="w-full mt-4 bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                        <Trash2 size={16} /> Delete Node & Its Paths
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center text-slate-500 dark:text-slate-400 p-8 flex flex-col items-center gap-3">
                    <Move size={32} className="opacity-20" />
                    <p className="text-sm font-bold">Select a node to edit its properties.</p>
                    <p className="text-xs">Or use the toolbar to add nodes and record paths.</p>
                  </div>
                )}
              </div>
            )}

            {/* === EDGE/PATH TAB === */}
            {propertiesTab === 'edge' && (
              <div className="p-4 space-y-4">
                {/* Active edge details */}
                {activeEdge ? (
                  <>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                        <span>{nodes.find(n => n.id === activeEdge.from)?.label || activeEdge.from}</span>
                        <ArrowRight size={14} className="text-[var(--color-brand-terracotta)]" />
                        <span>{nodes.find(n => n.id === activeEdge.to)?.label || activeEdge.to}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Distance</label>
                          <div className="flex bg-white dark:bg-slate-900 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                            <input type="number" step="0.1" value={activeEdge.distanceM} onChange={(e) => updateActiveEdge({ distanceM: parseFloat(e.target.value) || 0 })} className="w-full bg-transparent border-none text-slate-800 dark:text-slate-200 px-2 py-2 text-sm outline-none font-mono" />
                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-2 text-xs font-bold text-slate-500 flex items-center">m</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Direction</label>
                          <select value={activeEdge.direction} onChange={(e) => updateActiveEdge({ direction: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2 py-2 text-sm outline-none font-medium">
                            <option value="straight">Straight</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Direction Hint</label>
                        <input type="text" value={activeEdge.directionHint} onChange={(e) => updateActiveEdge({ directionHint: e.target.value })} placeholder="e.g. Turn left at the water cooler" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand-terracotta)] outline-none font-medium" />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Accessible</label>
                        <button
                          onClick={() => updateActiveEdge({ isAccessible: !activeEdge.isAccessible })}
                          className={`relative w-11 h-6 rounded-full transition-colors ${activeEdge.isAccessible ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${activeEdge.isAccessible ? 'translate-x-5' : ''}`} />
                        </button>
                      </div>

                      {activeEdge.gpsTrail?.length > 0 && (
                        <p className="text-xs text-slate-400">{activeEdge.gpsTrail.length} GPS trail points recorded</p>
                      )}

                      <button onClick={() => deleteEdge(activeEdge.id)} className="w-full bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors text-xs">
                        <Trash2 size={14} /> Delete Path
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-slate-400 py-4">
                    <p className="text-xs font-medium">Select a path on the map or from the list below to edit.</p>
                  </div>
                )}

                {/* All edges list */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">All Paths ({edges.length})</label>
                  {edges.length === 0 ? (
                    <div className="text-center py-6 space-y-2">
                      <Route size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
                      <p className="text-xs text-slate-400">No paths yet. Use <strong>Walk & Record</strong> to physically walk between offices and record paths.</p>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-64 overflow-auto">
                      {edges.map(e => {
                        const fromLabel = nodes.find(n => n.id === e.from)?.label || e.from;
                        const toLabel = nodes.find(n => n.id === e.to)?.label || e.to;
                        return (
                          <button
                            key={e.id}
                            onClick={() => setActiveEdgeId(e.id)}
                            className={`w-full text-left rounded-lg px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                              activeEdgeId === e.id
                                ? 'bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-300 dark:ring-blue-500/30'
                                : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <Route size={12} className={`shrink-0 ${e.isAccessible ? 'text-[var(--color-brand-terracotta)]' : 'text-slate-400'}`} />
                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{fromLabel}</span>
                            <ArrowRight size={10} className="text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{toLabel}</span>
                            <span className="ml-auto text-slate-400 shrink-0">{e.distanceM}m</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Quick instructions */}
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">How to record paths:</p>
                  <ol className="text-xs text-amber-700 dark:text-amber-400/80 space-y-1 list-decimal list-inside">
                    <li>Select <strong>Walk & Record</strong> from toolbar</li>
                    <li>Click your <strong>starting node</strong> (current office)</li>
                    <li><strong>Walk physically</strong> — GPS tracks your movement in real-time</li>
                    <li>Path points and curve appear automatically as you move</li>
                    <li>Click the <strong>destination node</strong> to finish</li>
                    <li>Click <strong>Save Layout</strong> to persist</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
