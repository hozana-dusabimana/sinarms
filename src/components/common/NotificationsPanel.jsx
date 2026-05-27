import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCircle2, AlertTriangle, Info, MessageSquare, X, BellRing } from 'lucide-react';

function iconFor(severity) {
  if (severity === 'critical' || severity === 'alert') return <AlertTriangle size={16} className="text-red-500" />;
  if (severity === 'success') return <CheckCircle2 size={16} className="text-emerald-500" />;
  if (severity === 'route' || severity === 'info') return <Info size={16} className="text-blue-500" />;
  return <MessageSquare size={16} className="text-slate-500" />;
}

function timeAgo(value) {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return '';
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

/**
 * items: Array<{ id, title, message, severity, timestamp, unread, onClick? }>
 * align: 'left' | 'right' (where the panel opens relative to the trigger)
 * dotColor: Tailwind ring/bg variant applied to unread indicator
 */
export default function NotificationsPanel({
  items = [],
  onClearAll,
  onDismiss,
  align = 'right',
  label = 'Notifications',
  triggerClassName = 'relative p-2.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const unreadCount = items.filter((i) => i.unread).length;

  useEffect(() => {
    if (!open) return;
    const handler = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
      >
        {unreadCount > 0 ? <BellRing size={20} /> : <Bell size={20} />}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-brand-terracotta)] text-white text-[10px] font-black ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-80 sm:w-96 max-h-[70vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl ring-1 ring-black/5 z-[1100] overflow-hidden flex flex-col`}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">{label}</p>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </p>
              </div>
              {onClearAll && items.length > 0 && (
                <button
                  type="button"
                  onClick={() => { onClearAll(); }}
                  className="text-[11px] font-bold text-[var(--color-brand-terracotta)] dark:text-red-400 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1">
              {items.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                    <Bell size={20} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No notifications yet</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">New alerts and updates will appear here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className={`group relative flex gap-3 px-4 py-3 transition-colors ${
                        item.unread ? 'bg-red-50/50 dark:bg-red-500/5' : ''
                      } hover:bg-slate-50 dark:hover:bg-slate-800/50`}
                    >
                      <div className="flex-shrink-0 mt-0.5">{iconFor(item.severity)}</div>
                      <button
                        type="button"
                        onClick={() => {
                          if (item.onClick) item.onClick();
                          setOpen(false);
                        }}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{item.title}</p>
                        {item.message && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug mt-0.5 line-clamp-2">{item.message}</p>
                        )}
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">
                          {timeAgo(item.timestamp)}
                        </p>
                      </button>
                      {onDismiss && (
                        <button
                          type="button"
                          onClick={() => onDismiss(item.id)}
                          className="flex-shrink-0 self-start p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Dismiss"
                        >
                          <X size={14} />
                        </button>
                      )}
                      {item.unread && (
                        <span className="absolute right-3 top-3 w-2 h-2 rounded-full bg-[var(--color-brand-terracotta)]" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
