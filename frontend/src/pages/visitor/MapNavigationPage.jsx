import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Navigation2, CheckCircle2, ChevronRight, CornerUpLeft, CornerUpRight, Maximize, Minimize } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AIChatbot from '../../components/visitor/AIChatbot';

const MOCK_STEPS = [
  { id: 1, text: 'Walk straight past the reception desk.', icon: <ChevronRight className="rotate-[-90deg]" size={24} />, distance: 15, done: true },
  { id: 2, text: 'Turn left at the main corridor.', icon: <CornerUpLeft size={24} />, distance: 20, done: false, current: true },
  { id: 3, text: 'Take the first right. You will see HR Office 104.', icon: <CornerUpRight size={24} />, distance: 5, done: false },
  { id: 4, text: 'Arrive at destination.', icon: <CheckCircle2 size={24} />, distance: 0, done: false }
];

import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

// Leaflet default icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const KIGALI_ROUTE = [
  [-1.9441, 30.0619],
  [-1.9442, 30.0620],
  [-1.9443, 30.0620],
  [-1.9445, 30.0623]
];

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

export default function MapNavigationPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(KIGALI_ROUTE[0]);

  // Real-time GPS Tracking
  useEffect(() => {
    let watchId;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentPosition([latitude, longitude]);
        },
        (error) => {
          console.warn("GPS tracking error:", error);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

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
          
          <Polyline positions={KIGALI_ROUTE} pathOptions={{ color: '#cd5c5c', weight: 4, dashArray: '10, 10' }} />
          
          {/* Live Visitor Position */}
          <Marker position={currentPosition} icon={activePersonIcon}>
            <Popup>
              <div className="text-center font-bold">You are here</div>
            </Popup>
          </Marker>

          <Marker position={KIGALI_ROUTE[KIGALI_ROUTE.length - 1]} icon={customPinIcon}>
            <Popup>
              <div className="text-center font-bold text-red-600">HR Office 104</div>
            </Popup>
          </Marker>
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
        
        <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-6 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800 -ml-2 pl-2">
          {MOCK_STEPS.map((step, idx) => (
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
      </div>

      {/* Slide-Up Chat Component */}
      <AIChatbot />
    </div>
  );
}
