import { Outlet } from 'react-router-dom';

export default function VisitorLayout() {
  return (
    <div className="flex flex-col min-h-[100dvh] w-full relative bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Decorative top blurred element */}
      <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-red-400/20 dark:bg-red-900/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-50px] right-[-50px] w-64 h-64 bg-purple-400/20 dark:bg-purple-900/40 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header logic will vary per page or exist uniformly */}
      <header className="px-6 pt-8 pb-4 relative z-10 flex items-center justify-between w-full max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-brand-terracotta)] to-red-600 dark:from-red-300 dark:to-orange-500">
          SINARMS
        </h1>
        <div className="h-8 shadow-sm px-3 rounded-full flex items-center justify-center text-xs font-medium bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          EN
        </div>
      </header>

      {/* Main Content Space */}
      <main className="flex-1 flex flex-col overflow-y-auto px-6 pb-20 relative z-10 custom-scrollbar w-full max-w-5xl mx-auto">
        <Outlet />
      </main>

      {/* Footer Branding */}
      <footer className="absolute bottom-0 left-0 right-0 p-4 text-center z-10 glass rounded-t-2xl shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Powered by Ruliba Clays Ltd
        </p>
      </footer>
    </div>
  );
}
