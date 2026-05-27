import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  Search,
  Download,
  RefreshCcw,
  Users,
  UserCheck,
  LogOut as LogOutIcon,
  Clock,
  Calendar,
  X,
  MapPin,
  Phone,
  Mail,
  Building2,
} from 'lucide-react';
import { useSinarms } from '../../context/SinarmsContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  formatDateTime,
  getLocationById,
  getLocationMap,
  getNode,
  getOrganizationById,
} from '../../lib/sinarmsEngine';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n) {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - n);
  return d;
}

function downloadCsv(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    if (value == null) return '';
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => escape(row[key])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function StatCard({ icon, label, value, tint = 'red' }) {
  const tints = {
    red: 'from-red-500 to-orange-500 text-red-100',
    green: 'from-emerald-500 to-teal-500 text-emerald-100',
    blue: 'from-blue-500 to-indigo-500 text-blue-100',
    amber: 'from-amber-500 to-yellow-500 text-amber-100',
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 backdrop-blur-sm p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {value}
          </p>
        </div>
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${tints[tint]} shadow-sm`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status, t }) {
  const isActive = status === 'active';
  const label =
    status === 'active'
      ? t('staff.history.status.active')
      : status === 'exited'
        ? t('staff.history.status.exited')
        : t('staff.history.status.unknown');
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
        isActive
          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
        }`}
      />
      {label}
    </span>
  );
}

export default function VisitorHistoryPage() {
  const { state, fetchVisitorHistory, currentUser } = useSinarms();
  const { t } = useLanguage();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState('30d');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const RANGE_OPTIONS = [
    { value: 'today', label: t('staff.history.range.today') },
    { value: '7d', label: t('staff.history.range.7d') },
    { value: '30d', label: t('staff.history.range.30d') },
    { value: 'all', label: t('staff.history.range.all') },
  ];

  const STATUS_OPTIONS = [
    { value: 'all', label: t('staff.history.status.all') },
    { value: 'active', label: t('staff.history.status.active') },
    { value: 'exited', label: t('staff.history.status.exited') },
  ];

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVisitorHistory();
      setHistory(data);
    } catch (err) {
      setError(err?.message || t('staff.history.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enriched = useMemo(() => {
    return history.map((visitor) => {
      const location = getLocationById(state, visitor.locationId);
      const organization = getOrganizationById(state, visitor.organizationId);
      const map = getLocationMap(state, visitor.locationId);
      const node = getNode(map, visitor.destinationNodeId);
      return {
        ...visitor,
        _locationName: location?.name || visitor.locationId || '—',
        _orgName: organization?.name || visitor.organizationId || '—',
        _destinationLabel: node?.label || visitor.destinationText || '—',
      };
    });
  }, [history, state]);

  const filtered = useMemo(() => {
    const now = new Date();
    let cutoff = null;
    if (range === 'today') cutoff = startOfDay(now);
    else if (range === '7d') cutoff = daysAgo(7);
    else if (range === '30d') cutoff = daysAgo(30);

    const term = search.trim().toLowerCase();

    return enriched
      .filter((visitor) => {
        if (cutoff && visitor.checkinTime) {
          if (new Date(visitor.checkinTime) < cutoff) return false;
        }
        if (statusFilter !== 'all' && visitor.status !== statusFilter) return false;
        if (!term) return true;
        const hay = [
          visitor.name,
          visitor.email,
          visitor.phone,
          visitor._destinationLabel,
          visitor._locationName,
          visitor._orgName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(term);
      })
      .sort((a, b) => {
        const ta = a.checkinTime ? new Date(a.checkinTime).getTime() : 0;
        const tb = b.checkinTime ? new Date(b.checkinTime).getTime() : 0;
        return tb - ta;
      });
  }, [enriched, range, statusFilter, search]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((v) => v.status === 'active').length;
    const exited = filtered.filter((v) => v.status === 'exited').length;
    const durations = filtered
      .filter((v) => v.status === 'exited' && v.durationMin)
      .map((v) => Number(v.durationMin));
    const avg = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    return { total, active, exited, avg };
  }, [filtered]);

  const handleExport = () => {
    const rows = filtered.map((visitor) => ({
      Name: visitor.name || '',
      Email: visitor.email || '',
      Phone: visitor.phone || '',
      Organization: visitor._orgName,
      Location: visitor._locationName,
      Destination: visitor._destinationLabel,
      CheckIn: visitor.checkinTime ? formatDateTime(visitor.checkinTime) : '',
      CheckOut: visitor.checkoutTime ? formatDateTime(visitor.checkoutTime) : '',
      DurationMin: visitor.durationMin || '',
      Status: visitor.status || '',
    }));
    if (rows.length === 0) return;
    downloadCsv(`visitor-history-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const roleLabel = currentUser?.role === 'admin' ? t('staff.layout.administrator') : t('staff.layout.receptionist');

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 shadow-md shadow-red-500/30 flex items-center justify-center text-white">
            <History size={24} strokeWidth={2.4} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              {t('staff.history.title')}
              <span className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-red-200 dark:border-red-500/30">
                {roleLabel}
              </span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
              {t('staff.history.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadHistory}
            disabled={loading}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl transition-all font-bold flex items-center gap-2 shadow-sm disabled:opacity-60"
          >
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{t('staff.history.refresh')}</span>
          </button>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 hover:opacity-90 text-white px-4 sm:px-6 py-2 rounded-xl shadow-md shadow-red-500/20 transition-all font-bold tracking-wide flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={18} />
            <span className="hidden sm:inline">{t('staff.history.export')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users size={20} />} label={t('staff.history.totalVisits')} value={stats.total} tint="red" />
        <StatCard icon={<UserCheck size={20} />} label={t('staff.history.active')} value={stats.active} tint="green" />
        <StatCard icon={<LogOutIcon size={20} />} label={t('staff.history.exited')} value={stats.exited} tint="blue" />
        <StatCard icon={<Clock size={20} />} label={t('staff.history.avgDuration')} value={`${stats.avg}m`} tint="amber" />
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
        <div className="relative flex-1 min-w-0">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('staff.history.searchPlaceholder')}
            className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-red-300 dark:focus:border-red-500/50 focus:bg-white dark:focus:bg-slate-900 outline-none text-sm font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-red-300 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-red-300 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-500/10 border-b border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-sm font-semibold">
            {error}
          </div>
        )}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 uppercase tracking-widest text-[11px] text-slate-500 dark:text-slate-400 font-black border-b-2 border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">{t('staff.history.col.visitor')}</th>
                <th className="px-5 py-3.5">{t('staff.history.col.destination')}</th>
                <th className="px-5 py-3.5 hidden md:table-cell">{t('staff.history.col.location')}</th>
                <th className="px-5 py-3.5">{t('staff.history.col.checkin')}</th>
                <th className="px-5 py-3.5 hidden lg:table-cell">{t('staff.history.col.checkout')}</th>
                <th className="px-5 py-3.5 text-right">{t('staff.history.col.duration')}</th>
                <th className="px-5 py-3.5 text-right">{t('staff.history.col.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500 dark:text-slate-400 font-medium">
                    {t('staff.history.loading')}
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
                      <History size={32} className="opacity-40" />
                      <p className="font-bold text-slate-700 dark:text-slate-200">{t('staff.history.empty.title')}</p>
                      <p className="text-xs">{t('staff.history.empty.subtitle')}</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((visitor, index) => (
                  <motion.tr
                    key={visitor.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.015, 0.3) }}
                    onClick={() => setSelected(visitor)}
                    className="hover:bg-red-50/40 dark:hover:bg-red-500/5 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 text-white font-bold flex items-center justify-center text-sm shadow-sm flex-shrink-0">
                          {(visitor.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">
                            {visitor.name || t('staff.history.unknownVisitor')}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {visitor.phone || visitor.email || visitor.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                      {visitor._destinationLabel}
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell text-slate-600 dark:text-slate-400">
                      {visitor._locationName}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                      {visitor.checkinTime ? formatDateTime(visitor.checkinTime) : '—'}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                      {visitor.checkoutTime ? formatDateTime(visitor.checkoutTime) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                      {visitor.durationMin ? `${visitor.durationMin}m` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <StatusPill status={visitor.status} t={t} />
                    </td>
                  </motion.tr>
                ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t('staff.history.showingCount', { filtered: filtered.length, total: enriched.length })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-500/10 dark:to-orange-500/5 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 text-white font-bold flex items-center justify-center text-lg shadow-md flex-shrink-0">
                    {(selected.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-extrabold text-slate-900 dark:text-white truncate">
                      {selected.name || t('staff.history.detail.unknownTitle')}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusPill status={selected.status} t={t} />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/70 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <DetailRow icon={<Phone size={15} />} label={t('staff.history.detail.phone')} value={selected.phone} />
                <DetailRow icon={<Mail size={15} />} label={t('staff.history.detail.email')} value={selected.email} />
                <DetailRow icon={<Building2 size={15} />} label={t('staff.history.detail.organization')} value={selected._orgName} />
                <DetailRow icon={<MapPin size={15} />} label={t('staff.history.detail.location')} value={selected._locationName} />
                <DetailRow icon={<MapPin size={15} />} label={t('staff.history.detail.destination')} value={selected._destinationLabel} />
                <DetailRow
                  icon={<Clock size={15} />}
                  label={t('staff.history.detail.checkedIn')}
                  value={selected.checkinTime ? formatDateTime(selected.checkinTime) : '—'}
                />
                <DetailRow
                  icon={<LogOutIcon size={15} />}
                  label={t('staff.history.detail.checkedOut')}
                  value={selected.checkoutTime ? formatDateTime(selected.checkoutTime) : t('staff.history.detail.stillOnSite')}
                />
                <DetailRow
                  icon={<Clock size={15} />}
                  label={t('staff.history.detail.duration')}
                  value={selected.durationMin ? t('staff.history.detail.minutes', { n: selected.durationMin }) : '—'}
                />
                {selected.purpose && (
                  <div className="pt-2">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
                      {t('staff.history.detail.purpose')}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                      {selected.purpose}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">
          {value || '—'}
        </p>
      </div>
    </div>
  );
}
