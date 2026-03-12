import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Plus, Route, Trash2, Settings2, Save, Move, Crosshair, CheckCircle2, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, ImageOverlay } from 'react-leaflet';
import L from 'leaflet';

// Leaflet default icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapEvents({ activeTool, onAddNode, onDrawPath }) {
  useMapEvents({
    click(e) {
      if (activeTool === 'node') {
        onAddNode(e.latlng);
      } else if (activeTool === 'edge') {
        onDrawPath(e.latlng);
      }
    }
  });
  return null;
}

export default function FacilityMapEditor() {
  const [activeTool, setActiveTool] = useState('select'); // select, node, edge
  const [nodes, setNodes] = useState([
    { id: '1', lat: -1.9442, lng: 30.0620, label: 'Reception', type: 'public' },
    { id: '2', lat: -1.9443, lng: 30.0621, label: 'Corridor A', type: 'public' },
    { id: '3', lat: -1.9444, lng: 30.0621, label: 'HR Office', type: 'restricted' },
    { id: '4', lat: -1.9444, lng: 30.0622, label: 'Exit', type: 'public' }
  ]);
  const [activeNodeId, setActiveNodeId] = useState('2');
  const [floorplanUrl, setFloorplanUrl] = useState(null);
  const [floorplanBounds, setFloorplanBounds] = useState(null);
  const [pathPoints, setPathPoints] = useState([
    [-1.9442, 30.0620], [-1.9443, 30.0621], [-1.9444, 30.0621]
  ]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [isTrackingPath, setIsTrackingPath] = useState(false);

  const activeNode = nodes.find(n => n.id === activeNodeId) || nodes[0];

  const handleSaveLayout = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 800);
  };

  const handleAddNode = (latlng) => {
    const newNode = {
      id: Date.now().toString(),
      lat: latlng.lat,
      lng: latlng.lng,
      label: `New Node`,
      type: 'public'
    };
    setNodes([...nodes, newNode]);
    setActiveNodeId(newNode.id);
    setActiveTool('select');
  };

  const handleDrawPath = (latlng) => {
    setPathPoints([...pathPoints, [latlng.lat, latlng.lng]]);
  };

  const updateActiveNode = (updates) => {
    setNodes(nodes.map(n => n.id === activeNodeId ? { ...n, ...updates } : n));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setFloorplanUrl(url);
      setFloorplanBounds([[-1.9441, 30.0619], [-1.9445, 30.0623]]);
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
        () => {
          alert("Unable to retrieve location. Please allow location permissions.");
          setGpsLoading(false);
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
      setGpsLoading(false);
    }
  };

  const togglePathTracking = () => {
    if (!isTrackingPath) {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by this browser.");
        return;
      }
      setIsTrackingPath(true);
      
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setPathPoints(prev => [...prev, [position.coords.latitude, position.coords.longitude]]);
        },
        () => alert("Location tracking lost."),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      
      // Store watch ID in window to clear it later
      window.mapTrackingId = watchId;
    } else {
      setIsTrackingPath(false);
      if (window.mapTrackingId) {
        navigator.geolocation.clearWatch(window.mapTrackingId);
      }
    }
  };
  
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            Facility Map Editor
            <span className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-red-200 dark:border-red-500/30">
              Admin Only
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Head Office - Kigali</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="file" id="floorplan-upload" className="hidden" accept="image/*" onChange={handleFileUpload} />
          <label htmlFor="floorplan-upload" className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl transition-all font-bold flex items-center gap-2 border border-slate-300 dark:border-slate-600 shadow-sm cursor-pointer">
            <Upload size={18} />
            <span className="hidden sm:inline">Upload Floorplan</span>
          </label>
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
          
          <div className="h-14 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center p-2 gap-2 backdrop-blur-md absolute top-0 inset-x-0 z-20 shadow-sm">
            {[
              { id: 'select', icon: <Move size={18} />, label: 'Move/Select' },
              { id: 'node', icon: <Plus size={18} />, label: 'Add Node' },
              { id: 'edge', icon: <Route size={18} />, label: 'Draw Path' },
              { id: 'delete', icon: <Trash2 size={18} />, label: 'Delete', color: 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20' }
            ].map(tool => (
              <button 
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  activeTool === tool.id 
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-inner' 
                    : tool.color || 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tool.icon} <span className="hidden md:inline">{tool.label}</span>
              </button>
            ))}
          </div>

          {/* Canvas Area */}
          <div className="flex-1 relative bg-slate-100/50 dark:bg-[#0b101e] mt-14 overflow-hidden z-0">
            <MapContainer 
              center={[-1.9443, 30.0621]} 
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
              <MapEvents activeTool={activeTool} onAddNode={handleAddNode} onDrawPath={handleDrawPath} />
              
              {floorplanUrl && floorplanBounds && (
                <ImageOverlay url={floorplanUrl} bounds={floorplanBounds} opacity={0.8} />
              )}
              
              <Polyline positions={pathPoints} pathOptions={{ color: '#cd5c5c', weight: 4, dashArray: '8, 8' }} />
              
              {/* Nodes */}
              {nodes.map(node => (
                <Marker 
                  key={node.id} 
                  position={[node.lat, node.lng]}
                  eventHandlers={{ click: () => setActiveNodeId(node.id) }}
                  opacity={activeNodeId === node.id ? 1 : 0.6}
                >
                  <Popup>{node.label} - {node.type}</Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

        </div>

        {/* Properties Panel */}
        <div className="w-full lg:w-80 glass-card flex flex-col overflow-hidden shadow-2xl shrink-0">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0b101e]">
            <h3 className="font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Settings2 size={18} className="text-[var(--color-brand-terracotta)] dark:text-red-500" />
              Node Properties
            </h3>
          </div>
          
          <div className="p-4 space-y-5 flex-1 overflow-auto bg-white/50 dark:bg-slate-900/50">
            {activeNode ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">ID</label>
                  <input type="text" value={`NODE_${activeNode.id}`} disabled className="w-full bg-slate-100 dark:bg-slate-800 border-none text-slate-500 rounded-lg px-3 py-2 text-sm font-mono opacity-70" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Label (English)</label>
                  <input type="text" value={activeNode.label} onChange={(e) => updateActiveNode({ label: e.target.value })} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand-terracotta)] outline-none font-medium" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Zone Type</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button onClick={() => updateActiveNode({ type: 'public' })} className={`${activeNode.type === 'public' ? 'bg-[var(--color-brand-terracotta)] text-white shadow-md shadow-red-500/20 border-none' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'} py-2 rounded-lg text-sm font-bold transition-colors`}>Public</button>
                    <button onClick={() => updateActiveNode({ type: 'restricted' })} className={`${activeNode.type === 'restricted' ? 'bg-[var(--color-brand-terracotta)] text-white shadow-md shadow-red-500/20 border-none' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'} py-2 rounded-lg text-sm font-bold transition-colors`}>Restricted</button>
                    <button onClick={() => updateActiveNode({ type: 'exit' })} className={`${activeNode.type === 'exit' ? 'bg-[var(--color-brand-terracotta)] text-white shadow-md shadow-red-500/20 border-none' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'} py-2 rounded-lg text-sm font-bold transition-colors col-span-2`}>Emergency Exit</button>
                  </div>
                </div>

                <div className="space-y-1.5 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Coordinates</label>
                    <button 
                      onClick={getDeviceLocation} 
                      disabled={gpsLoading}
                      className="text-xs font-bold text-[var(--color-brand-terracotta)] hover:bg-red-50 dark:hover:bg-red-500/20 px-2 py-1 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      {gpsLoading ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />} 
                      {gpsLoading ? 'Locating...' : 'Use Device GPS'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                      <span className="bg-slate-200 dark:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center border-r border-slate-300 dark:border-slate-600">Lat</span>
                      <input type="number" step="0.000001" value={activeNode.lat} onChange={(e) => updateActiveNode({ lat: parseFloat(e.target.value) || 0 })} className="w-full bg-transparent border-none text-slate-800 dark:text-slate-200 px-2 py-2 text-sm outline-none font-mono" />
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                      <span className="bg-slate-200 dark:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center border-r border-slate-300 dark:border-slate-600">Lng</span>
                      <input type="number" step="0.000001" value={activeNode.lng} onChange={(e) => updateActiveNode({ lng: parseFloat(e.target.value) || 0 })} className="w-full bg-transparent border-none text-slate-800 dark:text-slate-200 px-2 py-2 text-sm outline-none font-mono" />
                    </div>
                  </div>
                </div>
                
                {activeTool === 'delete' && (
                  <button onClick={() => { setNodes(nodes.filter(n => n.id !== activeNode.id)); setActiveNodeId(null); setActiveTool('select'); }} className="w-full mt-4 bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                    <Trash2 size={16} /> Delete Node
                  </button>
                )}
              </>
            ) : (
              <div className="text-center text-slate-500 dark:text-slate-400 p-8 flex flex-col items-center gap-3">
                {activeTool === 'edge' ? (
                  <>
                    <Route size={32} className={`opacity-20 text-[var(--color-brand-terracotta)] ${isTrackingPath ? 'animate-pulse' : ''}`} />
                    <p className="text-sm font-bold text-[var(--color-brand-terracotta)] dark:text-red-400">Path Drawing Mode</p>
                    <p className="text-xs">Click map to plot, or use auto-tracking.</p>
                    
                    <button 
                      onClick={togglePathTracking}
                      className={`mt-4 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-2 ${isTrackingPath ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-200 dark:border-red-500/30' : 'bg-[var(--color-brand-terracotta)] text-white shadow-red-500/30'}`}
                    >
                      <Crosshair size={14} className={isTrackingPath ? 'animate-spin' : ''} /> 
                      {isTrackingPath ? 'Stop Tracking' : 'Start Auto-Tracking'}
                    </button>

                    <button 
                      onClick={() => setPathPoints([])}
                      className="mt-3 text-xs font-bold text-slate-500 border border-slate-300 dark:border-slate-700 w-full py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Clear Path
                    </button>
                  </>
                ) : (
                  <>
                    <Move size={32} className="opacity-20" />
                    <p className="text-sm font-bold">Select a node to edit its properties.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
