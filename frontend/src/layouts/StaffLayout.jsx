import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Map, Settings, Users, Activity, Menu, X, Users2, MessageSquare, TerminalSquare } from 'lucide-react';
import { useState } from 'react';
import { useSinarms } from '../context/SinarmsContext';

export default function StaffLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { currentUser, logout } = useSinarms();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      localStorage.removeItem('sinarms_role');
      navigate('/staff/login');
    }
  };

  const role = currentUser?.role || localStorage.getItem('sinarms_role') || 'admin';

  const allNavItems = [
    { label: 'Live Dashboard', path: '/staff/dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'receptionist'] },
    { label: 'Map Editor', path: '/staff/map-editor', icon: <Map size={20} />, roles: ['admin'] },
    { label: 'Organizations', path: '/staff/organizations', icon: <Users size={20} />, roles: ['admin'] },
    { label: 'Analytics', path: '/staff/analytics', icon: <Activity size={20} />, roles: ['admin'] },
    { label: 'Users & Roles', path: '/staff/users', icon: <Users2 size={20} />, roles: ['admin'] },
    { label: 'FAQ Database', path: '/staff/faq', icon: <MessageSquare size={20} />, roles: ['admin', 'receptionist'] },
    { label: 'Audit Log', path: '/staff/audit-log', icon: <TerminalSquare size={20} />, roles: ['admin'] },
  ];

  const navItems = allNavItems.filter(item => item.roles.includes(role));

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-hidden font-sans">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-20 xl:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed xl:static top-0 left-0 z-30 h-full w-72 glass flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'} border-r border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.1)]`}
      >
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-500 shadow-md flex items-center justify-center">
              <span className="text-white font-bold tracking-widest text-sm">RC</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tighter hidden sm:block leading-[1.1]">SINARMS</h1>
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-brand-terracotta)] dark:text-red-500 hidden sm:block">{role === 'admin' ? 'Administrator' : 'Receptionist'}</span>
            </div>
          </div>
          <button className="xl:hidden p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" onClick={() => setIsSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-8 space-y-2">
          <p className="px-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
            Management
          </p>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                  isActive 
                    ? 'bg-red-50 dark:bg-slate-800/80 text-[var(--color-brand-terracotta)] dark:text-red-400 font-medium shadow-sm border border-red-100 dark:border-slate-700/50' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 hover:dark:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-brand-terracotta)] dark:bg-red-500 shadow-[0_0_8px_var(--color-brand-terracotta)]" />}
                  {item.icon}
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-400 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 font-medium"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Space */}
      <main className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-[#0b101e] relative">
        <header className="h-20 xl:hidden flex items-center px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600 dark:text-slate-300">
            <Menu size={24} />
          </button>
          <div className="ml-4 font-bold tracking-tighter text-lg">SINARMS ADMIN</div>
        </header>
        
        <div className="flex-1 overflow-auto p-4 sm:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
