import { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MapPin, Users, Shield, ArrowRight, Activity, Globe2, Building2, Cpu, Network, Lock, Zap, Bot, Database, CheckCircle2, Twitter, Linkedin, Github, Mail, Phone } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useLanguage } from '../context/LanguageContext';

const activePersonIcon = L.divIcon({
  className: 'bg-transparent',
  html: `<div class="relative flex items-center justify-center w-6 h-6">
           <div class="absolute w-full h-full bg-green-500 rounded-full animate-ping opacity-75"></div>
           <div class="relative w-4 h-4 bg-green-500 border-2 border-white rounded-full shadow-lg"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const destIcon = L.divIcon({
  className: 'bg-transparent',
  html: `<div class="relative flex items-center justify-center w-6 h-6">
           <div class="relative w-4 h-4 bg-[var(--color-brand-terracotta)] border-2 border-white rounded-full shadow-lg z-10"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const originIcon = L.divIcon({
  className: 'bg-transparent',
  html: `<div class="relative flex items-center justify-center w-6 h-6">
           <div class="relative w-4 h-4 bg-slate-800 dark:bg-slate-300 border-2 border-white rounded-full shadow-lg z-10"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const createLabelIcon = (text) => L.divIcon({
  className: 'bg-transparent',
  html: `<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-xl border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider whitespace-nowrap z-20" style="transform: translate(-50%, -150%); width: max-content;">${text}</div>`,
  iconAnchor: [0, 0] // Centered perfectly via CSS transform
});

const KIGALI_ROUTE = [
  [-1.9441, 30.0619],
  [-1.9442, 30.0620],
  [-1.9443, 30.0620],
  [-1.9444, 30.0621],
  [-1.9445, 30.0623]
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { t, label: languageLabel, cycleLanguage } = useLanguage();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } }
  };

  const { scrollYProgress } = useScroll();
  const yBg = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

  const [mockPosition, setMockPosition] = useState(KIGALI_ROUTE[0]);

  useEffect(() => {
    let animationFrameId;
    let startTime;
    const DURATION = 10000; // 10 seconds for a full sweep

    const animate = (time) => {
      if (!startTime) startTime = time;
      const elapsed = (time - startTime) % DURATION;
      
      // Calculate progress between 0 and 1
      const progress = elapsed / DURATION;
      
      const totalSegments = KIGALI_ROUTE.length - 1;
      const exactIndex = progress * totalSegments;
      const currentIndex = Math.floor(exactIndex);
      const nextIndex = Math.min(currentIndex + 1, totalSegments);
      const segmentProgress = exactIndex - currentIndex;
      
      // Linearly interpolate between the two coordinates
      const currentPoint = KIGALI_ROUTE[currentIndex];
      const nextPoint = KIGALI_ROUTE[nextIndex];
      const lat = currentPoint[0] + (nextPoint[0] - currentPoint[0]) * segmentProgress;
      const lng = currentPoint[1] + (nextPoint[1] - currentPoint[1]) * segmentProgress;
      
      // Push the precise fractional coordinate to state for 60fps rendering
      setMockPosition([lat, lng]);
      
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className="relative min-h-[100dvh] bg-slate-50 dark:bg-[#060b14] font-sans selection:bg-[var(--color-brand-terracotta)]/30 overflow-x-hidden">
      
      {/* Background Ambience & Cinematic Hero Video */}
      <div className="absolute top-0 left-0 w-full h-[120vh] overflow-hidden pointer-events-none z-0 bg-[#060b14]">
        <motion.div style={{ y: yBg }} className="absolute inset-0">
          <video 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover opacity-80 dark:opacity-60 scale-105"
            poster="/images/hero_background.png"
          >
            <source src="https://assets.mixkit.co/videos/preview/mixkit-business-people-walking-in-a-modern-office-building-4241-large.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-50/50 to-slate-50 dark:via-[#060b14]/70 dark:to-[#060b14] z-10"></div>
        </motion.div>
      </div>

      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--color-brand-terracotta)]/10 dark:bg-red-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute top-[30%] left-[60%] w-[30%] h-[30%] bg-purple-500/10 dark:bg-purple-600/10 rounded-full blur-[90px] pointer-events-none z-0" />
      
      {/* Dotted Grid Overlay */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjAwLCAyMDAsIDIwMCwgMC4yKSIvPjwvc3ZnPg==')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNykiLz48L3N2Zz4=')] opacity-50 z-0 pointer-events-none"></div>

      {/* --- TOP NAVBAR --- */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-[#060b14]/70 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#hero" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 shadow-md shadow-red-500/20 flex items-center justify-center transition-transform group-hover:scale-110">
              <Shield size={20} className="text-white" strokeWidth={2.4} />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white">SINARMS</h1>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-brand-terracotta)] dark:text-red-400">
                {t('landing.brand.tagline')}
              </p>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-1">
            <a href="#showcase" className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              {t('landing.nav.showcase')}
            </a>
            <a href="#features" className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              {t('landing.nav.features')}
            </a>
            <a href="#cta" className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              {t('landing.nav.getStarted')}
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cycleLanguage}
              aria-label="Change language"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Globe2 size={14} /> {languageLabel}
            </button>
            <button
              type="button"
              onClick={() => navigate('/staff/login')}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Shield size={14} /> {t('landing.nav.staffLogin')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/visit')}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-gradient-to-r from-[var(--color-brand-terracotta)] to-red-600 text-xs font-bold text-white hover:brightness-110 transition-all shadow-md shadow-red-500/30"
            >
              <Globe2 size={14} /> {t('landing.nav.visitorPortal')}
            </button>
          </div>
        </div>
      </header>

      {/* --- HERO SECTION --- */}
      <div id="hero" className="relative z-10 container mx-auto px-6 pt-24 pb-20 lg:pt-32 flex flex-col lg:flex-row items-center justify-between min-h-[100dvh] gap-16">
        
        {/* Left Content Area */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex-1 max-w-2xl"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 backdrop-blur-md mb-8 shadow-sm">
            <span className="relative flex h-2.5 w-2.5 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tracking-widest uppercase">{t('landing.hero.statusOnline')}</span>
          </motion.div>

          <motion.h1 variants={itemVariants} className="text-5xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] mb-6 drop-shadow-sm">
            {t('landing.hero.titleA')} <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-brand-terracotta)] via-red-500 to-orange-500">
              {t('landing.hero.titleB')}
            </span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-lg text-slate-600 dark:text-slate-400 mb-10 leading-relaxed max-w-xl">
            {t('landing.hero.description')}
          </motion.p>

          <motion.div variants={containerVariants} className="grid sm:grid-cols-2 gap-6 w-full max-w-xl">
            
            {/* Action Card: Visitor */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/visit')}
              className="group cursor-pointer p-6 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:shadow-[var(--color-brand-terracotta)]/10 dark:hover:shadow-red-500/10 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-[var(--color-brand-terracotta)] dark:text-red-400 group-hover:bg-[var(--color-brand-terracotta)] group-hover:text-white dark:group-hover:bg-red-500 transition-colors">
                  <Globe2 size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('landing.hero.visitorCardTitle')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('landing.hero.visitorCardDesc')}</p>
              </div>
              <div className="mt-6 flex items-center text-sm font-bold text-[var(--color-brand-terracotta)] dark:text-red-400 group-hover:translate-x-2 transition-transform">
                {t('landing.hero.visitorCardCta')} <ArrowRight size={16} className="ml-2" />
              </div>
            </motion.div>

            {/* Action Card: Staff */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/staff/login')}
              className="group cursor-pointer p-6 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:shadow-[var(--color-brand-terracotta)]/10 dark:hover:shadow-red-500/10 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-[var(--color-brand-terracotta)] dark:text-red-400 group-hover:bg-[var(--color-brand-terracotta)] group-hover:text-white dark:group-hover:bg-red-500 transition-colors">
                  <Shield size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('landing.hero.staffCardTitle')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('landing.hero.staffCardDesc')}</p>
              </div>
              <div className="mt-6 flex items-center text-sm font-bold text-[var(--color-brand-terracotta)] dark:text-red-400 group-hover:translate-x-2 transition-transform">
                {t('landing.hero.staffCardCta')} <ArrowRight size={16} className="ml-2" />
              </div>
            </motion.div>

          </motion.div>
        </motion.div>

        {/* Right Hero Graphic */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 1, type: "spring" }}
          className="flex-1 w-full max-w-lg hidden lg:block relative"
        >
          {/* Abstract Floating UI Elements */}
          <div className="relative w-full aspect-square bg-gradient-to-tr from-slate-200 to-white dark:from-slate-800 dark:to-slate-900 rounded-[3rem] shadow-2xl border border-white/50 dark:border-slate-800/50 flex flex-col p-8 overflow-hidden">
            
            {/* Live React-Leaflet Map Background */}
            <div className="absolute inset-0 z-0 overflow-hidden landing-map">
              <style>{`
                .landing-map .leaflet-container {
                  background: transparent !important;
                }
                .landing-map .leaflet-tile-pane {
                  filter: grayscale(1) opacity(0.5);
                }
                .dark .landing-map .leaflet-tile-pane {
                  filter: grayscale(1) opacity(0.25) invert(1) hue-rotate(180deg);
                }
                /* Hide attribution cleanly for landing visual */
                .landing-map .leaflet-control-container {
                  display: none !important;
                }
              `}</style>
              <MapContainer 
                center={[-1.9443, 30.0621]} 
                zoom={19.5} 
                zoomSnap={0.5}
                zoomControl={false}
                attributionControl={false}
                scrollWheelZoom={false}
                dragging={false}
                doubleClickZoom={false}
                className="w-full h-full"
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png" />
                
                {/* Base Nodes */}
                <Marker position={KIGALI_ROUTE[0]} icon={originIcon} />
                <Marker position={KIGALI_ROUTE[KIGALI_ROUTE.length - 1]} icon={destIcon} />

                {/* Floating Labels perfectly centered vertically above the nodes */}
                <Marker position={KIGALI_ROUTE[0]} icon={createLabelIcon("Reception")} />
                <Marker position={KIGALI_ROUTE[KIGALI_ROUTE.length - 1]} icon={createLabelIcon("HR")} />

                {/* Routing tracking */}
                <Polyline positions={KIGALI_ROUTE} pathOptions={{ color: '#cd5c5c', weight: 4, dashArray: '8, 8' }} />
                <Marker position={mockPosition} icon={activePersonIcon} />
              </MapContainer>
            </div>
            
            {/* Interior shadow for blending */}
            <div className="absolute inset-0 z-10 pointer-events-none shadow-[inset_0_0_80px_rgba(255,255,255,0.8)] dark:shadow-[inset_0_0_100px_rgba(15,23,42,1)] rounded-[3rem]"></div>

            {/* Floating Glass Panels */}
            <motion.div 
              animate={{ y: [-10, 10, -10] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-10 right-[-20px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-white dark:border-slate-700 w-48 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
                <Activity size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('landing.hero.liveTraffic')}</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{t('landing.hero.active')}</p>
              </div>
            </motion.div>

            <motion.div 
              animate={{ y: [10, -10, 10] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute bottom-20 left-[-40px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-white dark:border-slate-700 w-56 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Users size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('landing.hero.currentVisitors')}</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{t('landing.hero.checkedIn')}</p>
              </div>
            </motion.div>
            
            <div className="mt-auto relative z-10 w-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-white/50 dark:border-slate-700/50 flex align-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="text-[var(--color-brand-terracotta)] dark:text-red-500" />
                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">Ruliba HQ • Kigali</span>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse my-auto"></div>
            </div>

          </div>
        </motion.div>
      </div>
      
      {/* Brand logo at bottom corner of hero */}
      <div className="absolute top-[calc(100vh-80px)] right-8 hidden flex-col lg:flex items-end gap-1 opacity-50 z-10 hover:opacity-100 transition-opacity cursor-default">
        <div className="flex items-center gap-3">
          <Building2 size={24} className="text-slate-900 dark:text-white" />
          <span className="font-bold text-slate-900 dark:text-white uppercase tracking-widest text-sm">{t('landing.hero.poweredBy')}</span>
        </div>
      </div>
      
      {/* --- VISUAL SHOWCASE SECTION --- */}
      <div id="showcase" className="scroll-mt-20" />
      <div className="relative z-10 w-full bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-24 sm:py-32 overflow-hidden">
        <div className="container mx-auto px-6">
          
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24 md:mb-40">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }} className="order-2 lg:order-1 relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200/50 dark:border-slate-700/50 group aspect-[4/3]">
              <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-brand-terracotta)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10"></div>
              <img src="/images/office_interior.png" alt="Luxurious Office Lobby" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" />
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }} className="order-1 lg:order-2">
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 leading-[1.15] tracking-tight">{t('landing.showcase1.titleA')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-brand-terracotta)] to-red-500">{t('landing.showcase1.titleB')}</span></h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">{t('landing.showcase1.description')}</p>
              <ul className="space-y-4 text-slate-700 dark:text-slate-300 font-bold">
                <li className="flex items-center gap-3"><CheckCircle2 className="text-[var(--color-brand-terracotta)]" size={20}/> {t('landing.showcase1.bullet1')}</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="text-[var(--color-brand-terracotta)]" size={20}/> {t('landing.showcase1.bullet2')}</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="text-[var(--color-brand-terracotta)]" size={20}/> {t('landing.showcase1.bullet3')}</li>
              </ul>
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }}>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 leading-[1.15] tracking-tight">{t('landing.showcase2.titleA')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500">{t('landing.showcase2.titleB')}</span></h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">{t('landing.showcase2.description')}</p>
              <ul className="space-y-4 text-slate-700 dark:text-slate-300 font-bold">
                <li className="flex items-center gap-3"><CheckCircle2 className="text-blue-500" size={20}/> {t('landing.showcase2.bullet1')}</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="text-blue-500" size={20}/> {t('landing.showcase2.bullet2')}</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="text-blue-500" size={20}/> {t('landing.showcase2.bullet3')}</li>
              </ul>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }} className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200/50 dark:border-slate-700/50 group aspect-[4/3]">
              <div className="absolute inset-0 bg-gradient-to-bl from-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10"></div>
              <img src="/images/feature_dashboard.png" alt="Advanced Command Center" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" />
            </motion.div>
          </div>

        </div>
      </div>
      
      {/* --- PREMIUM FEATURES SECTION --- */}
      <div id="features" className="scroll-mt-20" />
      <div className="relative z-10 w-full bg-slate-100 dark:bg-[#060b14] border-t border-slate-200 dark:border-slate-800 py-32">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-6">{t('landing.features.title')}</h2>
            <p className="text-lg text-slate-500 dark:text-slate-400">{t('landing.features.description')}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { i: <Network size={32}/>, t: t('landing.features.f1.title'), d: t('landing.features.f1.desc') },
              { i: <Bot size={32}/>, t: t('landing.features.f2.title'), d: t('landing.features.f2.desc') },
              { i: <Shield size={32}/>, t: t('landing.features.f3.title'), d: t('landing.features.f3.desc') },
              { i: <Database size={32}/>, t: t('landing.features.f4.title'), d: t('landing.features.f4.desc') },
              { i: <Cpu size={32}/>, t: t('landing.features.f5.title'), d: t('landing.features.f5.desc') },
              { i: <Zap size={32}/>, t: t('landing.features.f6.title'), d: t('landing.features.f6.desc') },
            ].map((feat, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: idx * 0.1 }}
                className="p-8 rounded-3xl bg-slate-50 border border-slate-200 hover:border-[var(--color-brand-terracotta)] dark:bg-[#111726] dark:border-slate-800 dark:hover:border-red-500 transition-colors group"
              >
                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#060b14] shadow-sm flex items-center justify-center text-[var(--color-brand-terracotta)] dark:text-red-500 mb-6 group-hover:scale-110 transition-transform">
                  {feat.i}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{feat.t}</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{feat.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* --- FOOTER CTA --- */}
      <div id="cta" className="scroll-mt-20" />
      <div className="relative z-10 w-full overflow-hidden bg-slate-950 border-t border-slate-900 border-b-8 border-b-[var(--color-brand-terracotta)]">
        
        {/* Parallax Server Background */}
        <div className="absolute inset-0 opacity-30 mix-blend-screen scale-105 grayscale pointer-events-none">
          <img src="/images/tech_server.png" alt="Server Infrastructure" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950"></div>
        </div>

        <div className="relative container mx-auto px-6 py-40 text-center z-10 flex flex-col items-center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tight drop-shadow-2xl">{t('landing.cta.titleA')} <span className="text-[var(--color-brand-terracotta)]">{t('landing.cta.titleB')}</span></h2>
            <p className="text-xl text-slate-300 font-medium mb-12 max-w-2xl mx-auto drop-shadow-md">{t('landing.cta.description')}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/staff/login')}
                className="px-8 py-4 rounded-xl bg-[var(--color-brand-terracotta)] text-white font-bold shadow-lg shadow-red-500/30 hover:shadow-red-500/50 hover:bg-red-600 hover:scale-105 transition-all w-full sm:w-auto flex items-center justify-center gap-2 group"
              >
                {t('landing.cta.staffBtn')} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => navigate('/visit')}
                className="px-8 py-4 rounded-xl bg-white/10 backdrop-blur-md text-white border border-white/20 font-bold hover:bg-white/20 hover:scale-105 transition-all w-full sm:w-auto"
              >
                {t('landing.cta.demoBtn')}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
      {/* --- STANDARD FOOTER --- */}
      <footer className="relative z-10 w-full bg-[#03060a] border-t border-slate-900 pt-20 pb-10 px-6">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-16">
            <div className="lg:col-span-2 pr-0 lg:pr-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[var(--color-brand-terracotta)] rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-500/20">
                  <span className="font-black tracking-widest text-lg">RC</span>
                </div>
                <span className="text-xl font-bold tracking-widest text-white">SINARMS</span>
              </div>
              <p className="text-slate-400/80 mb-8 leading-relaxed max-w-sm">
                {t('landing.footer.tagline')}
              </p>
              <div className="flex items-center gap-5 text-slate-500">
                <a href="#" className="p-2 bg-slate-900 rounded-full hover:bg-[var(--color-brand-terracotta)] hover:text-white transition-colors"><Twitter size={18}/></a>
                <a href="#" className="p-2 bg-slate-900 rounded-full hover:bg-[var(--color-brand-terracotta)] hover:text-white transition-colors"><Linkedin size={18}/></a>
                <a href="#" className="p-2 bg-slate-900 rounded-full hover:bg-[var(--color-brand-terracotta)] hover:text-white transition-colors"><Github size={18}/></a>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-bold tracking-widest uppercase text-sm mb-6 pl-1 border-l-2 border-[var(--color-brand-terracotta)]">{t('landing.footer.platform')}</h4>
              <ul className="space-y-4 text-slate-400">
                <li><a href="#" className="hover:text-[var(--color-brand-terracotta)] transition-colors">{t('landing.footer.platform1')}</a></li>
                <li><a href="#" className="hover:text-[var(--color-brand-terracotta)] transition-colors">{t('landing.footer.platform2')}</a></li>
                <li><a href="#" className="hover:text-[var(--color-brand-terracotta)] transition-colors">{t('landing.footer.platform3')}</a></li>
                <li><a href="#" className="hover:text-[var(--color-brand-terracotta)] transition-colors">{t('landing.footer.platform4')}</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold tracking-widest uppercase text-sm mb-6 pl-1 border-l-2 border-[var(--color-brand-terracotta)]">{t('landing.footer.company')}</h4>
              <ul className="space-y-4 text-slate-400">
                <li><a href="#" className="hover:text-[var(--color-brand-terracotta)] transition-colors">{t('landing.footer.company1')}</a></li>
                <li><a href="#" className="hover:text-[var(--color-brand-terracotta)] transition-colors">{t('landing.footer.company2')}</a></li>
                <li><a href="#" className="hover:text-[var(--color-brand-terracotta)] transition-colors">{t('landing.footer.company3')}</a></li>
                <li><a href="#" className="hover:text-[var(--color-brand-terracotta)] transition-colors">{t('landing.footer.company4')}</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold tracking-widest uppercase text-sm mb-6 pl-1 border-l-2 border-[var(--color-brand-terracotta)]">{t('landing.footer.contact')}</h4>
              <ul className="space-y-4 text-slate-400">
                <li className="flex items-center gap-3"><Mail size={16} className="text-[var(--color-brand-terracotta)]"/> hello@sinarms.com</li>
                <li className="flex items-center gap-3"><Phone size={16} className="text-[var(--color-brand-terracotta)]"/> +250 788 000 000</li>
                <li className="flex items-center gap-3"><MapPin size={16} className="text-[var(--color-brand-terracotta)]"/> Kigali, Rwanda</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-900 pt-8 flex flex-col md:flex-row items-center justify-between text-sm text-slate-500">
            <p className="font-medium">{t('landing.footer.copyright', { year: new Date().getFullYear() })}</p>
            <div className="flex items-center gap-8 mt-4 md:mt-0 font-medium">
              <a href="#" className="hover:text-white transition-colors">{t('landing.footer.privacy')}</a>
              <a href="#" className="hover:text-white transition-colors">{t('landing.footer.terms')}</a>
              <a href="#" className="hover:text-white transition-colors">{t('landing.footer.cookies')}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
