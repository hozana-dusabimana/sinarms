import { Fragment, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, AlertCircle, ShieldAlert, X, Clock, Map as MapIcon, Users, Activity, UserCheck, TrendingUp } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useSinarms } from '../../context/SinarmsContext';
import { useLanguage } from '../../context/LanguageContext';
import { getLocationMap, getNode, minutesBetween } from '../../lib/sinarmsEngine';

// Leaflet default icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Inline SVG destination pin — no network dependency (same as visitor map).
const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44"><path d="M16 2C8 2 2 8 2 16c0 10 14 26 14 26s14-16 14-26C30 8 24 2 16 2z" fill="#cd5c5c" stroke="#ffffff" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#ffffff"/></svg>`;
const destinationPinIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(pinSvg)}`,
  iconSize: [28, 38],
  iconAnchor: [14, 36],
  popupAnchor: [0, -32],
});

// Pulsing dot for active visitors (same pattern as MapNavigationPage).
const visitorDotIcon = L.divIcon({
  className: 'bg-transparent',
  html: `<div class="relative flex items-center justify-center w-6 h-6">
           <div class="absolute w-full h-full bg-blue-500 rounded-full animate-ping opacity-75"></div>
           <div class="relative w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-lg"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const alertDotIcon = L.divIcon({
  className: 'bg-transparent',
  html: `<div class="relative flex items-center justify-center w-6 h-6">
           <div class="absolute w-full h-full bg-red-500 rounded-full animate-ping opacity-75"></div>
           <div class="relative w-4 h-4 bg-red-600 border-2 border-white rounded-full shadow-lg"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function isValidLatLng(pos) {
  return Array.isArray(pos)
    && pos.length === 2
    && typeof pos[0] === 'number' && !Number.isNaN(pos[0])
    && typeof pos[1] === 'number' && !Number.isNaN(pos[1]);
}

function getNodeLatLng(node) {
  if (node && node.lat != null && node.lng != null) {
    const pos = [Number(node.lat), Number(node.lng)];
    return isValidLatLng(pos) ? pos : null;
  }
  return null;
}

function buildRoutePositions(map, routeNodeIds) {
  if (!map || !routeNodeIds || routeNodeIds.length < 2) return [];
  const positions = [];
  for (let i = 0; i < routeNodeIds.length - 1; i++) {
    const fromId = routeNodeIds[i];
    const toId = routeNodeIds[i + 1];
    const edge = (map.edges || []).find((e) =>
      (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)
    );
    if (edge?.gpsTrail?.length > 1) {
      const trail = (edge.from === fromId ? edge.gpsTrail : [...edge.gpsTrail].reverse())
        .filter(isValidLatLng);
      const toAppend = positions.length > 0 ? trail.slice(1) : trail;
      toAppend.forEach((p) => positions.push(p));
    } else {
      const fromPos = getNodeLatLng(getNode(map, fromId));
      const toPos = getNodeLatLng(getNode(map, toId));
      if (positions.length === 0 && isValidLatLng(fromPos)) positions.push(fromPos);
      if (isValidLatLng(toPos)) positions.push(toPos);
    }
  }
  return positions;
}

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    const valid = (positions || []).filter(isValidLatLng);
    if (valid.length >= 2) {
      map.fitBounds(L.latLngBounds(valid), { padding: [40, 40], maxZoom: 19 });
    } else if (valid.length === 1) {
      map.setView(valid[0], 19);
    }
  }, [map, positions]);
  return null;
}

export default function DashboardPage() {
  const { state, analytics, currentUser, activeAlerts, acknowledgeAlert, checkoutVisitor, registerVisitor } = useSinarms();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState('list');
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualIdOrPhone, setManualIdOrPhone] = useState('');
  const [manualDestinationNodeId, setManualDestinationNodeId] = useState('');
  const [manualHostName, setManualHostName] = useState('');

  const scopedVisitors = state.visitors || [];
  const activeVisitors = scopedVisitors.filter((visitor) => visitor.status === 'active');
  const location = currentUser?.locationId
    ? state.locations.find((entry) => entry.id === currentUser.locationId) || null
    : null;
  const locationMap = location ? getLocationMap(state, location.id) : null;
  const destinationOptions = (locationMap?.nodes || [])
    .filter((node) => node.type !== 'exit' && node.type !== 'checkpoint')
    .filter((node) => node.type === 'office')
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label));

  // Real lat/lng from the seeded map graph (each node carries lat/lng set by
  // attachGeo). This plots visitors at their actual building coordinates
  // instead of the old fake offset grid.
  function visitorCurrentPosition(visitor) {
    const map = getLocationMap(state, visitor.locationId);
    const node = getNode(map, visitor.currentNodeId);
    return getNodeLatLng(node);
  }

  // Collect all relevant positions for the current shift — used to centre/fit
  // the map so it opens on the actual location and routes, not on a default.
  const mapFitPositions = (() => {
    if (!locationMap) return [];
    const positions = [];
    (locationMap.nodes || []).forEach((node) => {
      const pos = getNodeLatLng(node);
      if (isValidLatLng(pos)) positions.push(pos);
    });
    return positions;
  })();

  const mapCenter = mapFitPositions[0] || [-1.99585, 30.04020];

  function visitorStatus(visitor) {
    if (activeAlerts.some((alert) => alert.visitorId === visitor.id)) {
      return 'alert';
    }

    const idleMinutes = visitor.lastPositionUpdateAt ? minutesBetween(visitor.lastPositionUpdateAt) : 0;
    if (idleMinutes >= 25) {
      return 'idle';
    }

    return 'moving';
  }

  function alertAge(alert) {
    const minutes = minutesBetween(alert.triggeredAt);
    if (minutes < 60) return t('staff.dashboard.minutesAgo', { n: minutes });
    const hours = Math.round(minutes / 60);
    return t('staff.dashboard.hoursAgo', { n: hours });
  }

  const stats = [
    {
      label: t('staff.dashboard.stat.activeVisitors'),
      value: activeVisitors.length.toString(),
      icon: <UserCheck className="w-6 h-6" />,
      color: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    },
    {
      label: t('staff.dashboard.stat.totalToday'),
      value: (analytics?.totalVisitors ?? 0).toString(),
      icon: <Users className="w-6 h-6" />,
      color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    },
    {
      label: t('staff.dashboard.stat.activeAlerts'),
      value: activeAlerts.length.toString(),
      icon: <ShieldAlert className="w-6 h-6" />,
      color: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
      alert: activeAlerts.length > 0,
    },
    {
      label: t('staff.dashboard.stat.avgDuration'),
      value: `${analytics?.averageDuration ?? 0}m`,
      icon: <Activity className="w-6 h-6" />,
      color: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    },
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-end justify-between mb-1 flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{t('staff.dashboard.title')}</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            {t('staff.dashboard.subtitle', { location: location?.name || t('staff.dashboard.fallbackLocation') })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-white dark:bg-slate-800/60 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{t('staff.dashboard.liveSync')}</span>
          </div>
          <button
            onClick={() => setIsRegistrationModalOpen(true)}
            className="bg-gradient-to-r from-[var(--color-brand-terracotta)] to-red-600 hover:opacity-95 text-white px-5 py-2.5 rounded-xl shadow-md shadow-red-500/20 transition-all font-bold flex items-center gap-2"
          >
            <Users size={18} />
            <span className="hidden sm:inline">{t('staff.dashboard.manualRegister')}</span>
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="glass-card p-5 relative overflow-hidden group hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  {stat.label}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{stat.value}</p>
                  {stat.alert && (
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                  )}
                </div>
              </div>
              <div className={`p-2.5 rounded-xl ${stat.color} transition-transform group-hover:scale-110`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
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
                <Users size={16} /> {t('staff.dashboard.tab.directory')}
              </button>
              <button
                onClick={() => setActiveTab('map')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'map' ? 'bg-white dark:bg-slate-700 text-[var(--color-brand-terracotta)] dark:text-red-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'}`}
              >
                <MapIcon size={16} /> {t('staff.dashboard.tab.liveMap')}
              </button>
            </div>

            {activeTab === 'list' && (
              <div className="relative w-48 sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder={t('staff.dashboard.searchPlaceholder')} className="w-full bg-slate-100 dark:bg-slate-800/80 border-none rounded-full pl-9 pr-4 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] dark:text-slate-200" />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-transparent relative custom-scrollbar">
            {activeTab === 'map' ? (
              <div className="absolute inset-0 m-4 rounded-2xl overflow-hidden relative z-0 shadow-xl border-4 border-slate-50 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900">
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
                  />

                  <FitBounds positions={mapFitPositions.length ? mapFitPositions : [mapCenter]} />

                  {/* Destination pins for every seeded office/room so receptionists
                      can see the full facility layout, not only visitor dots. */}
                  {(locationMap?.nodes || [])
                    .filter((node) => node && !['exit', 'checkpoint'].includes(node.type))
                    .map((node) => {
                      const pos = getNodeLatLng(node);
                      if (!isValidLatLng(pos)) return null;
                      return (
                        <CircleMarker
                          key={`node-${node.id}`}
                          center={pos}
                          radius={4}
                          pathOptions={{ color: '#cd5c5c', fillColor: '#ffffff', fillOpacity: 1, weight: 2 }}
                        >
                          <Popup>
                            <div className="text-center text-xs font-semibold">{node.label}</div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}

                  {/* Active visitor routes + their live dots + destination pins. */}
                  {activeVisitors.map((visitor) => {
                    const vmap = getLocationMap(state, visitor.locationId);
                    const routePositions = buildRoutePositions(vmap, visitor.routeNodeIds);
                    const currentPos = visitorCurrentPosition(visitor);
                    const destNode = getNode(vmap, visitor.destinationNodeId);
                    const destPos = getNodeLatLng(destNode);
                    const isAlerting = activeAlerts.some((a) => a.visitorId === visitor.id);
                    const icon = isAlerting ? alertDotIcon : visitorDotIcon;

                    return (
                      <Fragment key={`viz-${visitor.id}`}>
                        {routePositions.length > 1 && (
                          <Polyline
                            positions={routePositions}
                            pathOptions={{
                              color: isAlerting ? '#ef4444' : '#cd5c5c',
                              weight: 4,
                              opacity: 0.8,
                              lineCap: 'round',
                              lineJoin: 'round',
                            }}
                          />
                        )}
                        {isValidLatLng(destPos) && (
                          <Marker position={destPos} icon={destinationPinIcon}>
                            <Popup>
                              <div className="text-center text-xs font-bold text-red-600">
                                {destNode?.label || t('staff.dashboard.popup.destination')}
                              </div>
                            </Popup>
                          </Marker>
                        )}
                        {isValidLatLng(currentPos) && (
                          <Marker position={currentPos} icon={icon}>
                            <Popup>
                              <div className="text-center font-bold">{visitor.name}</div>
                              <div className="text-center text-xs text-slate-500">
                                {getNode(vmap, visitor.currentNodeId)?.label || visitor.currentNodeId}
                              </div>
                            </Popup>
                          </Marker>
                        )}
                      </Fragment>
                    );
                  })}
                </MapContainer>
              </div>
            ) : (
              <div className="w-full">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead className="bg-slate-100/80 dark:bg-[#0b101e]/80 backdrop-blur-md sticky top-0 z-10 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4">{t('staff.dashboard.col.visitor')}</th>
                      <th className="px-6 py-4">{t('staff.dashboard.col.destination')}</th>
                      <th className="px-6 py-4">{t('staff.dashboard.col.currentZone')}</th>
                      <th className="px-6 py-4">{t('staff.dashboard.col.duration')}</th>
                      <th className="px-6 py-4 text-right">{t('staff.dashboard.col.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {activeVisitors.map((visitor) => {
                      const map = getLocationMap(state, visitor.locationId);
                      const destinationNode = getNode(map, visitor.destinationNodeId);
                      const currentNode = getNode(map, visitor.currentNodeId);
                      const status = visitorStatus(visitor);
                      const duration = visitor.durationMin || minutesBetween(visitor.checkinTime);
                      const zoneLabel = currentNode ? currentNode.label : visitor.currentNodeId;

                      return (
                      <tr key={visitor.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${status === 'alert' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                              {visitor.name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{visitor.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-400">{destinationNode?.label || visitor.destinationText}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${status === 'alert' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400' : status === 'idle' ? 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-400' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300'}`}>
                            {status === 'alert' && <AlertCircle size={12} />}
                            {zoneLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-slate-500 dark:text-slate-400">{t('staff.dashboard.minutesShort', { n: duration })}</td>
                        <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await checkoutVisitor(visitor.id, { manual: true });
                              } catch (error) {
                                window.alert(error?.message || t('staff.dashboard.errors.checkout'));
                              }
                            }}
                            className="text-sm font-bold text-[var(--color-brand-terracotta)] dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-3 py-1 bg-red-50 dark:bg-red-500/10 rounded-md"
                          >
                            {t('staff.dashboard.checkout')}
                          </button>
                        </td>
                      </tr>
                      );
                    })}
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
                <ShieldAlert size={18} className="text-red-500" /> {t('staff.dashboard.alerts.title')}
              </h3>
              <span className="bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-xs font-black px-2 py-0.5 rounded-full">{activeAlerts.length}</span>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-auto custom-scrollbar relative z-10">
              <AnimatePresence>
                {activeAlerts.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-3 pb-8">
                    <ShieldAlert size={48} className="opacity-20" />
                    <p className="font-bold">{t('staff.dashboard.alerts.empty')}</p>
                  </motion.div>
                ) : (
                  activeAlerts.map((alert) => {
                    const alertVisitor = state.visitors.find((visitor) => visitor.id === alert.visitorId);
                    const visitorLabel = alertVisitor?.name || alert.visitorId;

                    return (
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
                          <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{visitorLabel}</span>
                          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1"><Clock size={10} /> {alertAge(alert)}</span>
                        </div>
                        <p className={`text-xs font-semibold uppercase tracking-wider ${alert.severity === 'high' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-500'}`}>
                          {alert.type.replace('_', ' ')}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await acknowledgeAlert(alert.id);
                          } catch (error) {
                            window.alert(error?.message || t('staff.dashboard.errors.acknowledge'));
                          }
                        }}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${alert.severity === 'high' ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/30 dark:hover:bg-red-500/50 dark:text-red-300' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-500/30 dark:hover:bg-yellow-500/50 dark:text-yellow-300'}`}
                      >
                        <X size={14} strokeWidth={3} />
                      </button>
                    </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="glass-card p-5 hidden xl:block">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <TrendingUp size={16} className="text-[var(--color-brand-terracotta)] dark:text-red-400" />
                {t('staff.dashboard.overview.title')}
              </h4>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('staff.dashboard.overview.totalVisitors')}</span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">{analytics.totalVisitors}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('staff.dashboard.overview.avgDuration')}</span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">{analytics.averageDuration}m</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('staff.dashboard.overview.onSite')}</span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">{activeVisitors.length}</span>
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
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2"><Users size={18}/> {t('staff.dashboard.modal.title')}</h3>
                <button onClick={() => setIsRegistrationModalOpen(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">{t('staff.dashboard.modal.name')}</label>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder={t('staff.dashboard.modal.namePlaceholder')}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">{t('staff.dashboard.modal.idOrPhone')}</label>
                  <input
                    type="text"
                    value={manualIdOrPhone}
                    onChange={(e) => setManualIdOrPhone(e.target.value)}
                    placeholder={t('staff.dashboard.modal.idOrPhonePlaceholder')}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">{t('staff.dashboard.modal.destination')}</label>
                  <select
                    value={manualDestinationNodeId}
                    onChange={(e) => setManualDestinationNodeId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]"
                  >
                    <option value="" disabled>
                      {t('staff.dashboard.modal.destinationPlaceholder')}
                    </option>
                    {destinationOptions.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">{t('staff.dashboard.modal.host')}</label>
                  <input
                    type="text"
                    value={manualHostName}
                    onChange={(e) => setManualHostName(e.target.value)}
                    placeholder={t('staff.dashboard.modal.hostPlaceholder')}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button onClick={() => setIsRegistrationModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{t('staff.dashboard.modal.cancel')}</button>
                  <button
                    onClick={async () => {
                      if (!currentUser?.organizationId || !currentUser?.locationId) {
                        window.alert(t('staff.dashboard.errors.noLocation'));
                        return;
                      }

                      if (!manualName.trim() || !manualDestinationNodeId) {
                        window.alert(t('staff.dashboard.errors.required'));
                        return;
                      }

                      try {
                        const map = getLocationMap(state, currentUser.locationId);
                        const node = getNode(map, manualDestinationNodeId);
                        const destinationText = node?.label || t('staff.dashboard.popup.destination');

                        await registerVisitor({
                          name: manualName,
                          idOrPhone: manualIdOrPhone,
                          destinationText,
                          language,
                          organizationId: currentUser.organizationId,
                          locationId: currentUser.locationId,
                          source: 'manual',
                          hostName: manualHostName,
                          destinationNodeId: manualDestinationNodeId,
                        });

                        setIsRegistrationModalOpen(false);
                        setManualName('');
                        setManualIdOrPhone('');
                        setManualDestinationNodeId('');
                        setManualHostName('');
                      } catch (error) {
                        window.alert(error?.message || t('staff.dashboard.errors.register'));
                      }
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-brand-terracotta)] text-white font-bold shadow-md hover:opacity-90 transition-opacity"
                  >
                    {t('staff.dashboard.modal.confirm')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
