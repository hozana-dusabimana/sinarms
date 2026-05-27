import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  LogOut,
  Users,
  Activity,
  Menu,
  X,
  Users2,
  MessageSquare,
  TerminalSquare,
  User,
  ShieldCheck,
  History,
  Globe2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSinarms } from '../context/SinarmsContext';
import { useLanguage } from '../context/LanguageContext';
import NotificationsPanel from '../components/common/NotificationsPanel';

const READ_STORAGE_KEY = 'sinarms_staff_read_notifs';

function loadReadIds() {
  try {
    const raw = window.localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveReadIds(ids) {
  try {
    window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(new Set(ids)).slice(-200)));
  } catch {
    /* ignore */
  }
}

export default function StaffLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const navigate = useNavigate();
  const { currentUser, logout, activeAlerts = [], state, acknowledgeAlert } = useSinarms();
  const { t, label: languageLabel, cycleLanguage } = useLanguage();
  const [readIds, setReadIds] = useState(loadReadIds);

  const notificationItems = useMemo(() => {
    const alertItems = (activeAlerts || []).map((alert) => {
      const visitor = state.visitors?.find((v) => v.id === alert.visitorId);
      const visitorLabel = visitor?.name || alert.visitorId || 'Visitor';
      const typeLabel = (alert.type || 'alert').replace(/_/g, ' ');
      return {
        id: `alert:${alert.id}`,
        title: `${typeLabel} — ${visitorLabel}`,
        message: alert.message || 'Active alert requires attention.',
        severity: alert.severity === 'high' ? 'alert' : 'critical',
        timestamp: alert.triggeredAt,
        unread: !readIds.includes(`alert:${alert.id}`),
        onClick: async () => {
          try { await acknowledgeAlert(alert.id); } catch { /* ignore */ }
          navigate('/staff/dashboard');
        },
      };
    });

    const notifItems = (state.notifications || []).map((n) => ({
      id: `notif:${n.id}`,
      title: (n.type || 'Update').replace(/_/g, ' '),
      message: n.message,
      severity: n.type === 'ROUTE_SET' || n.type === 'HOST_NOTIFIED' ? 'route' : 'info',
      timestamp: n.createdAt,
      unread: !readIds.includes(`notif:${n.id}`),
      onClick: () => navigate('/staff/dashboard'),
    }));

    return [...alertItems, ...notifItems].sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    }).slice(0, 50);
  }, [activeAlerts, state.notifications, state.visitors, readIds, acknowledgeAlert, navigate]);

  const markAllRead = () => {
    const next = Array.from(new Set([...readIds, ...notificationItems.map((i) => i.id)]));
    setReadIds(next);
    saveReadIds(next);
  };

  const dismissOne = (id) => {
    const next = Array.from(new Set([...readIds, id]));
    setReadIds(next);
    saveReadIds(next);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      localStorage.removeItem('sinarms_role');
      navigate('/staff/login');
    }
  };

  const role = currentUser?.role || localStorage.getItem('sinarms_role') || 'admin';
  const roleLabel = role === 'admin' ? t('staff.layout.administrator') : t('staff.layout.receptionist');
  const displayName = currentUser?.name || currentUser?.email || roleLabel;

  const allNavItems = [
    { label: t('staff.nav.dashboard'), path: '/staff/dashboard', icon: <LayoutDashboard size={20} className="flex-shrink-0" />, roles: ['admin', 'receptionist'] },
    { label: t('staff.nav.history'), path: '/staff/history', icon: <History size={20} className="flex-shrink-0" />, roles: ['admin', 'receptionist'] },
    { label: t('staff.nav.organizations'), path: '/staff/organizations', icon: <Users size={20} className="flex-shrink-0" />, roles: ['admin'] },
    { label: t('staff.nav.analytics'), path: '/staff/analytics', icon: <Activity size={20} className="flex-shrink-0" />, roles: ['admin'] },
    { label: t('staff.nav.users'), path: '/staff/users', icon: <Users2 size={20} className="flex-shrink-0" />, roles: ['admin'] },
    { label: t('staff.nav.faq'), path: '/staff/faq', icon: <MessageSquare size={20} className="flex-shrink-0" />, roles: ['admin', 'receptionist'] },
    { label: t('staff.nav.audit'), path: '/staff/audit-log', icon: <TerminalSquare size={20} className="flex-shrink-0" />, roles: ['admin'] },
  ];

  const navItems = allNavItems.filter((item) => item.roles.includes(role));

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-hidden font-sans">
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-20 xl:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed xl:static top-0 left-0 z-30 h-full glass flex flex-col transform transition-all duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full xl:translate-x-0'}
          ${isSidebarOpen ? 'xl:w-72' : 'xl:w-20'}
          border-r border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/80 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.1)]`}
      >
        <div className="h-20 flex items-center justify-between px-5 border-b border-slate-200/70 dark:border-slate-800/70">
          <Link
            to="/staff/dashboard"
            className={`flex items-center gap-3 group ${!isSidebarOpen && 'xl:justify-center xl:w-full xl:px-0'}`}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 shadow-md shadow-red-500/20 flex items-center justify-center transition-transform group-hover:scale-110 flex-shrink-0">
              <ShieldCheck size={22} className="text-white" strokeWidth={2.4} />
            </div>
            <div className={`overflow-hidden transition-opacity duration-200 ${!isSidebarOpen && 'xl:hidden'}`}>
              <h1 className="text-xl font-bold tracking-tight leading-none text-slate-900 dark:text-white">SINARMS</h1>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-brand-terracotta)] dark:text-red-400">
                {roleLabel}
              </span>
            </div>
          </Link>
          <button
            className="xl:hidden p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            onClick={() => setIsMobileOpen(false)}
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-6 flex flex-col gap-1 custom-scrollbar">
          <p
            className={`px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ${
              !isSidebarOpen && 'xl:hidden'
            }`}
          >
            {t('staff.layout.management')}
          </p>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={!isSidebarOpen ? item.label : ''}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative
                ${!isSidebarOpen && 'xl:justify-center xl:px-0'}
                ${
                  isActive
                    ? 'bg-red-50 dark:bg-red-500/10 text-[var(--color-brand-terracotta)] dark:text-red-400 font-bold shadow-sm border border-red-100 dark:border-red-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 font-medium border border-transparent'
                }`
              }
            >
              {item.icon}
              <span
                className={`whitespace-nowrap transition-opacity duration-200 ${!isSidebarOpen && 'xl:hidden'}`}
              >
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200/70 dark:border-slate-800/70">
          <button
            onClick={handleLogout}
            title={!isSidebarOpen ? t('staff.layout.signOut') : ''}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 font-medium transition-colors ${
              !isSidebarOpen && 'xl:justify-center xl:px-0'
            }`}
          >
            <LogOut size={18} className="flex-shrink-0" />
            <span className={`whitespace-nowrap ${!isSidebarOpen && 'xl:hidden'}`}>{t('staff.layout.signOut')}</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-slate-50/50 dark:bg-[#0b101e]">
        <header className="h-20 flex items-center justify-between px-4 sm:px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800/70 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="xl:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <Menu size={22} />
            </button>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden xl:flex items-center justify-center p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              <Menu size={20} />
            </button>
            <div className="hidden sm:block pl-2">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {t('staff.layout.workspace')}
              </p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">
                {t('staff.layout.controlCenter')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={cycleLanguage}
              aria-label="Change language"
              className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Globe2 size={14} /> {languageLabel}
            </button>
            <NotificationsPanel
              items={notificationItems}
              onClearAll={markAllRead}
              onDismiss={dismissOne}
              label={t('staff.layout.notifications')}
            />

            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 p-1 pr-3 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none border border-slate-200/60 dark:border-slate-700/60"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 hidden sm:block">
                  {displayName}
                </span>
              </button>
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl ring-1 ring-black/5 z-[200] overflow-hidden">
                  <div className="py-2">
                    <div className="px-4 py-3 border-b border-slate-200/70 dark:border-slate-800/70">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{displayName}</p>
                      <p className="text-xs font-medium text-[var(--color-brand-terracotta)] dark:text-red-400 truncate capitalize">
                        {roleLabel}
                      </p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigate('/staff/profile');
                        }}
                        className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                      >
                        <User size={14} /> {t('staff.layout.profile')}
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 font-medium"
                      >
                        <LogOut size={14} /> {t('staff.layout.signOut')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto relative">
          <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-red-300/20 dark:bg-red-900/20 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-orange-200/30 dark:bg-orange-900/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative z-10 p-4 sm:p-6 lg:p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
