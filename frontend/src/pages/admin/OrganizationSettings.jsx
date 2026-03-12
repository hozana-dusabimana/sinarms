import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Edit2, Trash2, MapPin, Search, CheckCircle2, ChevronDown, X, LocateFixed } from 'lucide-react';

const MOCK_ORGS = [
  { id: 1, name: 'Ruliba Clays Ltd', email: 'admin@ruliba.rw', locations: 3, status: 'active', expanded: true },
  { id: 2, name: 'Kigali Industries', email: 'contact@kigaliind.com', locations: 1, status: 'active', expanded: false },
  { id: 3, name: 'Rwandex Coffee', email: 'hello@rwandex.rw', locations: 0, status: 'inactive', expanded: false },
];

export default function OrganizationSettings() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState(MOCK_ORGS);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  
  const [gpsValue, setGpsValue] = useState('');
  const [isGettingGps, setIsGettingGps] = useState(false);

  const handleGetDeviceGPS = () => {
    setIsGettingGps(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsValue(`${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
          setIsGettingGps(false);
        },
        (error) => {
          console.error("GPS Error", error);
          alert("Error fetching location. Ensure permissions are granted.");
          setIsGettingGps(false);
        }
      );
    } else {
      alert("GPS not supported by this browser.");
      setIsGettingGps(false);
    }
  };

  const toggleExpand = (id) => {
    setOrgs(orgs.map(org => org.id === id ? { ...org, expanded: !org.expanded } : org));
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-500 rounded-xl shadow-lg shadow-red-500/20 flex flex-col items-center justify-center text-white">
            <Building2 size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              Organization Manager
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Multi-tenant facility configuration</p>
          </div>
        </div>
        <button 
          onClick={() => { setEditingOrg(null); setIsOrgModalOpen(true); }}
          className="bg-[var(--color-brand-terracotta)] hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-400 text-white px-6 py-2.5 rounded-xl shadow-md shadow-red-500/30 transition-all font-bold tracking-wide flex items-center gap-2"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Register Organization</span>
        </button>
      </div>

      <div className="glass-card flex-1 flex flex-col overflow-hidden relative border-t-[6px] border-[var(--color-brand-terracotta)] dark:border-red-500">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md flex justify-between items-center z-10 sticky top-0">
          <div className="flex items-center gap-2">
            <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-widest uppercase">
              {orgs.length} Total
            </span>
          </div>
          
          <div className="relative w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search organizations..." className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-full pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] dark:focus:ring-red-500 dark:text-slate-200 font-medium" />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-[#0b101e]">
          <div className="p-4 space-y-4 max-w-5xl mx-auto custom-scrollbar">
            {orgs.map((org) => (
              <motion.div 
                key={org.id}
                layout
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
              >
                {/* Org Header */}
                <div 
                  className={`p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${org.expanded ? 'bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800' : ''}`}
                  onClick={() => toggleExpand(org.id)}
                >
                  <div className="flex items-center gap-4">
                    <button className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${org.expanded ? 'bg-[var(--color-brand-terracotta)] text-white dark:bg-red-500' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      <ChevronDown size={18} className={`transform transition-transform ${org.expanded ? 'rotate-180' : ''}`} />
                    </button>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{org.name}</h3>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        {org.email} <span className="opacity-50">•</span> {org.locations} Locations
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 border ${org.status === 'active' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                      {org.status === 'active' && <CheckCircle2 size={12} />}
                      {org.status}
                    </span>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => { setEditingOrg(org); setIsOrgModalOpen(true); }}
                        className="p-2 text-slate-400 hover:text-[var(--color-brand-terracotta)] dark:hover:text-red-400 transition-colors bg-white dark:bg-slate-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => setOrgs(orgs.filter(o => o.id !== org.id))}
                        className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors bg-white dark:bg-slate-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Locations View */}
                <AnimatePresence>
                  {org.expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="bg-slate-50 dark:bg-[#0b101e]/80"
                    >
                      <div className="p-5 pl-17">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Configured Locations</h4>
                          <button 
                            onClick={() => setIsLocationModalOpen(true)}
                            className="text-xs font-bold text-[var(--color-brand-terracotta)] flex items-center gap-1 hover:underline dark:text-red-400"
                          >
                            <Plus size={14} /> Add Location
                          </button>
                        </div>

                        {org.locations > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3].slice(0, org.locations).map((loc) => (
                              <div key={loc} onClick={() => navigate('/staff/map-editor')} className="p-4 bg-white dark:bg-slate-800 border-l-4 border-l-[var(--color-brand-terracotta)] dark:border-l-red-500 rounded-xl rounded-l-md shadow-sm border border-slate-200 dark:border-slate-700 relative group cursor-pointer hover:border-[var(--color-brand-terracotta)] dark:hover:border-red-500 transition-colors">
                                <MapPin size={24} className="text-slate-300 dark:text-slate-600 mb-2" />
                                <h5 className="font-bold text-slate-900 dark:text-white">Head Office / Location {loc}</h5>
                                <p className="text-xs text-slate-500 mt-1 mb-3">125 Map Nodes • 4 Active Visitors</p>
                                <button className="text-xs font-bold text-slate-600 dark:text-slate-300 w-full bg-slate-100 dark:bg-slate-700 hover:bg-[var(--color-brand-terracotta)] hover:text-white dark:hover:bg-red-500 dark:hover:text-white py-1.5 rounded-lg transition-colors">Manage Map</button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                            <MapPin size={32} className="mb-2 opacity-50" />
                            <p className="font-semibold text-sm">No locations configured yet.</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Organization Modal */}
      <AnimatePresence>
        {isOrgModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2"><Building2 size={18}/> {editingOrg ? 'Edit Organization' : 'Register Organization'}</h3>
                <button onClick={() => setIsOrgModalOpen(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Organization Name</label>
                  <input type="text" defaultValue={editingOrg ? editingOrg.name : ''} placeholder="e.g. Acme Corp" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Admin Email</label>
                  <input type="email" defaultValue={editingOrg ? editingOrg.email : ''} placeholder="admin@acme.com" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Primary Domain (Optional)</label>
                  <input type="text" placeholder="acme.com" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]" />
                </div>
                <div className="pt-4 flex gap-3">
                  <button onClick={() => setIsOrgModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                  <button onClick={() => {
                    if (editingOrg) {
                      setOrgs(orgs.map(o => o.id === editingOrg.id ? { ...o, name: document.querySelector('input[type="text"]').value, email: document.querySelector('input[type="email"]').value } : o));
                    }
                    setIsOrgModalOpen(false);
                  }} className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-brand-terracotta)] text-white font-bold shadow-md hover:opacity-90 transition-opacity">{editingOrg ? 'Save Changes' : 'Create Org'}</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Location Modal */}
      <AnimatePresence>
        {isLocationModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2"><MapPin size={18}/> Add New Location</h3>
                <button onClick={() => setIsLocationModalOpen(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Location Name</label>
                  <input type="text" placeholder="e.g. Warehouse A" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Address / GPS coordinates</label>
                    <button 
                      onClick={handleGetDeviceGPS}
                      disabled={isGettingGps}
                      className="text-xs font-bold text-[var(--color-brand-terracotta)] hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1 transition-colors"
                    >
                      <LocateFixed size={14} className={isGettingGps ? 'animate-spin' : ''} /> 
                      {isGettingGps ? 'Locating...' : 'Use Device GPS'}
                    </button>
                  </div>
                  <input 
                    type="text" 
                    value={gpsValue}
                    onChange={(e) => setGpsValue(e.target.value)}
                    placeholder="e.g. -1.9443, 30.0621" 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Default Floorplan Upload</label>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                    <MapPin size={24} className="mb-2 opacity-50 text-[var(--color-brand-terracotta)]" />
                    <span className="text-sm font-bold">Click to upload SVG or PNG map</span>
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button onClick={() => setIsLocationModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                  <button onClick={() => setIsLocationModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-brand-terracotta)] text-white font-bold shadow-md hover:opacity-90 transition-opacity">Create Location</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
