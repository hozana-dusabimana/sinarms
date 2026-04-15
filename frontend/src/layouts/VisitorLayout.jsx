import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Globe2, LogOut } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { useSinarms } from '../context/SinarmsContext';
import NotificationsPanel from '../components/common/NotificationsPanel';
import { getLocationMap, getLocationById, getNode } from '../lib/sinarmsEngine';

const VISITOR_READ_KEY = 'sinarms_visitor_read_notifs';

function loadVisitorRead() {
  try {
    const raw = window.localStorage.getItem(VISITOR_READ_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function VisitorLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isNavigating = location.pathname.includes('/navigate');
  const { currentVisitor, state } = useSinarms();
  const [readIds, setReadIds] = useState(loadVisitorRead);

  useEffect(() => {
    try { window.localStorage.setItem(VISITOR_READ_KEY, JSON.stringify(readIds.slice(-100))); } catch { /* ignore */ }
  }, [readIds]);

  const notificationItems = useMemo(() => {
    if (!currentVisitor) return [];
    const items = [];
    const visitorId = currentVisitor.id;
    const map = getLocationMap(state, currentVisitor.locationId);
    const loc = getLocationById(state, currentVisitor.locationId);
    const destNode = getNode(map, currentVisitor.destinationNodeId);
    const currentNode = getNode(map, currentVisitor.currentNodeId);
    const createdAt = currentVisitor.checkedInAt || currentVisitor.createdAt || new Date().toISOString();

    items.push({
      id: `v:${visitorId}:checkin`,
      title: 'Check-in confirmed',
      message: `Welcome to ${loc?.name || 'the facility'}.`,
      severity: 'success',
      timestamp: createdAt,
    });

    if (currentVisitor.routeNodeIds?.length) {
      items.push({
        id: `v:${visitorId}:route`,
        title: 'Route set',
        message: destNode ? `Follow the path to ${destNode.label}.` : 'Your route is ready.',
        severity: 'route',
        timestamp: currentVisitor.routeAssignedAt || createdAt,
        onClick: () => navigate('/visit/navigate'),
      });
    }

    if (currentVisitor.hostNotifiedAt) {
      items.push({
        id: `v:${visitorId}:host`,
        title: 'Host notified',
        message: 'The department knows you are on the way.',
        severity: 'info',
        timestamp: currentVisitor.hostNotifiedAt,
      });
    }

    if (
      currentVisitor.destinationNodeId &&
      currentVisitor.currentNodeId === currentVisitor.destinationNodeId
    ) {
      items.push({
        id: `v:${visitorId}:arrived`,
        title: 'You have arrived',
        message: currentNode ? `You are at ${currentNode.label}.` : 'You reached your destination.',
        severity: 'success',
        timestamp: currentVisitor.arrivedAt || new Date().toISOString(),
      });
    }

    (state.notifications || [])
      .filter((n) => n.visitorId === visitorId)
      .forEach((n) => {
        items.push({
          id: `vn:${n.id}`,
          title: (n.type || 'Update').replace(/_/g, ' '),
          message: n.message,
          severity: 'info',
          timestamp: n.createdAt,
        });
      });

    return items
      .map((it) => ({ ...it, unread: !readIds.includes(it.id) }))
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  }, [currentVisitor, state, readIds, navigate]);

  const markAllRead = () => setReadIds((prev) => Array.from(new Set([...prev, ...notificationItems.map((i) => i.id)])));
  const dismissOne = (id) => setReadIds((prev) => Array.from(new Set([...prev, id])));

  return (
    <div className={`flex flex-col w-full relative bg-slate-50 dark:bg-[#0b101e] overflow-hidden font-sans ${isNavigating ? 'h-[100dvh]' : 'min-h-[100dvh]'}`}>
      {/* Decorative blurred gradient blobs (matches main app aesthetic) */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[40%] bg-red-300/25 dark:bg-red-900/30 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[40%] bg-orange-300/25 dark:bg-purple-900/30 rounded-full blur-[110px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-[1000] w-full border-b border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md flex-shrink-0">
        <div className={`${isNavigating ? 'w-full px-4 sm:px-6' : 'max-w-5xl mx-auto px-5 sm:px-8'} h-16 flex items-center justify-between`}>
          <Link to="/visit" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 shadow-md shadow-red-500/20 flex items-center justify-center transition-transform group-hover:scale-110">
              <ShieldCheck size={22} className="text-white" strokeWidth={2.4} />
            </div>
            <div className="leading-tight">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">SINARMS</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-brand-terracotta)] dark:text-red-400">
                Visitor Portal
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {isNavigating ? 'Navigating' : 'Online'}
              </span>
            </div>
            {currentVisitor && (
              <NotificationsPanel
                items={notificationItems}
                onClearAll={markAllRead}
                onDismiss={dismissOne}
                label="Updates"
                triggerClassName="relative p-2 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors"
              />
            )}
            {isNavigating && (
              <button
                type="button"
                onClick={() => navigate('/visit/checkout')}
                className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-gradient-to-r from-[var(--color-brand-terracotta)] to-red-600 border border-red-500/40 text-xs font-bold text-white hover:brightness-110 transition-all shadow-md shadow-red-500/30"
              >
                <LogOut size={14} /> End Visit
              </button>
            )}
            <button
              type="button"
              className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Globe2 size={14} /> EN
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Space */}
      <main className="flex-1 relative z-10 w-full overflow-hidden custom-scrollbar flex flex-col">
        <div className={`flex-1 flex flex-col min-h-0 ${isNavigating ? 'w-full px-4 sm:px-6 py-4' : 'max-w-5xl mx-auto w-full px-5 sm:px-8 py-6 sm:py-10 pb-24 overflow-y-auto'}`}>
          <Outlet />
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="relative z-10 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md flex-shrink-0">
        <div className={`${isNavigating ? 'w-full px-4 sm:px-6' : 'max-w-5xl mx-auto px-5 sm:px-8'} py-3 flex items-center justify-between`}>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Powered by <span className="font-bold text-slate-700 dark:text-slate-200">Ruliba Clays Ltd</span>
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Secure Visitor Management
          </p>
        </div>
      </footer>
    </div>
  );
}
