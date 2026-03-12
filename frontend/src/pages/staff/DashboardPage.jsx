import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, AlertCircle, ShieldAlert, X, ChevronRight, Clock, Map as MapIcon, Users } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Leaflet default icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const mockVisitors = [
  { id: 1, name: 'Jean Bosco', dest: 'HR Dept', zone: 'Public Corridor', duration: 15, status: 'moving', node: '201' },
  { id: 2, name: 'Marie Claire', dest: 'Finance Office', zone: 'Waiting Area', duration: 5, status: 'idle', node: '102' },
  { id: 3, name: 'Guest 842', dest: 'Server Room', zone: 'Restricted Zone B', duration: 42, status: 'alert', node: '304' },
];

const mockAlerts = [
  { id: 1, visitor: 'Guest 842', type: 'RESTRICTED_ZONE', time: '2m ago', severity: 'high' },
  { id: 2, visitor: 'Marie Claire', type: 'IDLE_TIMEOUT', time: '15m ago', severity: 'medium' }
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('list');
  const [alerts, setAlerts] = useState(mockAlerts);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Live Operations</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Head Office - Kigali • Active Shift</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-slate-200/50 dark:bg-slate-800/50 px-4 py-2 rounded-full border border-slate-300/50 dark:border-slate-700">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Live Sync</span>
          </div>
          <button 
            onClick={() => setIsRegistrationModalOpen(true)}
            className="bg-[var(--color-brand-terracotta)] hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-400 text-white px-6 py-2 rounded-xl shadow-md shadow-red-500/30 transition-all font-bold tracking-wide flex items-center gap-2"
          >
            <Users size={18} />
            <span className="hidden sm:inline">Manual Registration</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Main Content Area (Map or List) */}
        <div className="lg:col-span-2 flex flex-col glass-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0b101e]/50 backdrop-blur-md z-10 sticky top-0">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('list')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'list' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'}`}
              >
                <Users size={16} /> Directory
              </button>
              <button 
                onClick={() => setActiveTab('map')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'map' ? 'bg-white dark:bg-slate-700 text-[var(--color-brand-terracotta)] dark:text-red-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'}`}
              >
                <MapIcon size={16} /> Live Map
              </button>
            </div>
            
            {activeTab === 'list' && (
              <div className="relative w-48 sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search visitors..." className="w-full bg-slate-100 dark:bg-slate-800/80 border-none rounded-full pl-9 pr-4 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] dark:text-slate-200" />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-transparent relative custom-scrollbar">
            {activeTab === 'map' ? (
              <div className="absolute inset-0 m-4 border-2 flex-none border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-200/50 dark:bg-black/20 overflow-hidden relative z-0 shadow-inner">
                <MapContainer 
                  center={[-1.9443, 30.0621]} 
                  zoom={18} 
                  scrollWheelZoom={true} 
                  className="w-full h-full z-0"
                  style={{ width: '100%', height: '100%', minHeight: '400px' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* Simulated live visitor nodes on the real map */}
                  <Marker position={[-1.9443, 30.0621]}>
                    <Popup>Jean Bosco</Popup>
                  </Marker>
                  <Marker position={[-1.9445, 30.0623]}>
                    <Popup>Marie Claire</Popup>
                  </Marker>
                </MapContainer>
              </div>
            ) : (
              <div className="w-full">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead className="bg-slate-100/80 dark:bg-[#0b101e]/80 backdrop-blur-md sticky top-0 z-10 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Visitor</th>
                      <th className="px-6 py-4">Destination</th>
                      <th className="px-6 py-4">Current Zone</th>
                      <th className="px-6 py-4">Duration</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {mockVisitors.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${v.status === 'alert' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                              {v.name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{v.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-400">{v.dest}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${v.status === 'alert' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400' : v.status === 'idle' ? 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-400' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300'}`}>
                            {v.status === 'alert' && <AlertCircle size={12} />}
                            {v.zone}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-slate-500 dark:text-slate-400">{v.duration} min</td>
                        <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="text-sm font-bold text-[var(--color-brand-terracotta)] dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-3 py-1 bg-red-50 dark:bg-red-500/10 rounded-md">
                            Check-Out
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Security Alerts Sidebar */}
        <div className="flex flex-col gap-6">
          <div className="glass-card flex-1 flex flex-col overflow-hidden relative border-t-4 border-t-red-500 dark:border-t-red-500">
            <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-red-500/10 to-transparent pointer-events-none" />
            
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 relative z-10">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert size={18} className="text-red-500" /> Security Alerts
              </h3>
              <span className="bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-xs font-black px-2 py-0.5 rounded-full">{alerts.length}</span>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-auto custom-scrollbar relative z-10">
              <AnimatePresence>
                {alerts.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-3 pb-8">
                    <ShieldAlert size={48} className="opacity-20" />
                    <p className="font-bold">No active alerts</p>
                  </motion.div>
                ) : (
                  alerts.map(alert => (
                    <motion.div 
                      key={alert.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`p-3 border rounded-xl relative overflow-hidden group ${alert.severity === 'high' ? 'bg-red-50/50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30' : 'bg-yellow-50/50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30'}`}
                    >
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${alert.severity === 'high' ? 'bg-red-500' : 'bg-yellow-400'}`} />
                      <div className="pl-2 pr-6">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{alert.visitor}</span>
                          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1"><Clock size={10} /> {alert.time}</span>
                        </div>
                        <p className={`text-xs font-semibold uppercase tracking-wider ${alert.severity === 'high' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-500'}`}>
                          {alert.type.replace('_', ' ')}
                        </p>
                      </div>
                      <button 
                        onClick={() => setAlerts(alerts.filter(a => a.id !== alert.id))}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${alert.severity === 'high' ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/30 dark:hover:bg-red-500/50 dark:text-red-300' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-500/30 dark:hover:bg-yellow-500/50 dark:text-yellow-300'}`}
                      >
                        <X size={14} strokeWidth={3} />
                      </button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="glass-card p-5 hidden xl:block">
            <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Quick Stats</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-2xl font-black text-slate-900 dark:text-white">142</p>
                <p className="text-xs font-bold text-slate-500">Total Today</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-2xl font-black text-slate-900 dark:text-white">38</p>
                <p className="text-xs font-bold text-slate-500">Avg Duration</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Manual Registration Modal */}
      <AnimatePresence>
        {isRegistrationModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2"><Users size={18}/> Register Visitor</h3>
                <button onClick={() => setIsRegistrationModalOpen(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Full Name</label>
                  <input type="text" placeholder="Visitor Name" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Destination</label>
                  <select className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]">
                    <option>HR Office (Node 201)</option>
                    <option>Finance (Node 102)</option>
                    <option>Server Room (Node 304)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Host Name (Optional)</label>
                  <input type="text" placeholder="Whom are they visiting?" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]" />
                </div>
                <div className="pt-4 flex gap-3">
                  <button onClick={() => setIsRegistrationModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                  <button onClick={() => setIsRegistrationModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-brand-terracotta)] text-white font-bold shadow-md hover:opacity-90 transition-opacity">Confirm Registration</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
