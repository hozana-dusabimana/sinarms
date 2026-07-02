import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FileBarChart2, Calendar, CalendarDays, MapPin, Users, ArrowUpRight, Building2 } from 'lucide-react';
import { useSinarms } from '../../context/SinarmsContext';
import { downloadCsv, formatDurationMinutes } from '../../lib/sinarmsEngine';
import api from '../../lib/api';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default function ReportsPage() {
  const { state } = useSinarms();
  const [organizationId, setOrganizationId] = useState('');
  const [mode, setMode] = useState('date'); // 'date' | 'weekday'
  const [date, setDate] = useState(todayKey);
  const [weekday, setWeekday] = useState('1'); // default Monday
  const [days, setDays] = useState('30');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const organizationOptions = (state?.organizations || [])
    .slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const orgNameById = useMemo(() => {
    const map = {};
    (state?.organizations || []).forEach((org) => {
      map[org.id] = org.name;
    });
    return map;
  }, [state?.organizations]);

  const locationNameById = useMemo(() => {
    const map = {};
    (state?.locations || []).forEach((loc) => {
      map[loc.id] = loc.name;
    });
    return map;
  }, [state?.locations]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const params = { organizationId: organizationId || undefined };
        if (mode === 'date') {
          params.date = date;
        } else {
          params.weekday = weekday;
          params.days = days;
        }
        const response = await api.get('/api/analytics/report', { params });
        if (!cancelled) {
          setReport(response.data);
        }
      } catch {
        if (!cancelled) {
          setReport(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [organizationId, mode, date, weekday, days]);

  const rows = report?.visitors || [];
  const weekdayEntry = report?.byWeekday?.[Number(weekday)];

  const scopeLabel =
    mode === 'date'
      ? `on ${formatDateTime(`${date}T00:00:00Z`).replace(/, .*$/, '')}`
      : `on every ${WEEKDAY_NAMES[Number(weekday)]} (last ${days} days)`;

  const handleExport = () => {
    const csvRows = rows.map((row) => ({
      Name: row.name,
      Status: row.status,
      Institution: orgNameById[row.organizationId] || row.organizationId,
      Location: locationNameById[row.locationId] || row.locationId,
      Destination: row.destination || '—',
      CheckIn: row.checkinTime ? formatDateTime(row.checkinTime) : '',
      CheckOut: row.checkoutTime ? formatDateTime(row.checkoutTime) : '',
      DurationMin: row.durationMin ?? '',
    }));
    const suffix = mode === 'date' ? date : `${WEEKDAY_NAMES[Number(weekday)]}-${days}d`;
    downloadCsv(`visitor-report-${suffix}.csv`, csvRows);
  };

  const controlClass =
    'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl transition-all font-bold border border-slate-300 dark:border-slate-600 shadow-sm outline-none';

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            Visitor Reports
            <span className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-red-200 dark:border-red-500/30">
              Admin Only
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Drill into who visited {scopeLabel}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={!rows.length}
          className="bg-[var(--color-brand-terracotta)] hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl shadow-md shadow-red-500/30 transition-all font-bold tracking-wide flex items-center gap-2"
        >
          <ArrowUpRight size={18} />
          <span className="hidden sm:inline">Export CSV</span>
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-5 flex flex-wrap items-center gap-3">
        {organizationOptions.length > 0 && (
          <label className="flex items-center gap-2">
            <Building2 size={16} className="text-slate-400" />
            <select
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              title="Institution"
              className={`${controlClass} max-w-[12rem]`}
            >
              <option value="">All institutions</option>
              {organizationOptions.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {[
            { key: 'date', label: 'Specific day', icon: <Calendar size={14} /> },
            { key: 'weekday', label: 'Every weekday', icon: <CalendarDays size={14} /> },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key)}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                opt.key === mode
                  ? 'bg-white text-slate-900 dark:bg-slate-700 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>

        {mode === 'date' ? (
          <input
            type="date"
            value={date}
            max={todayKey()}
            onChange={(e) => setDate(e.target.value)}
            className={controlClass}
          />
        ) : (
          <>
            <select value={weekday} onChange={(e) => setWeekday(e.target.value)} className={controlClass}>
              {WEEKDAY_NAMES.map((name, idx) => (
                <option key={name} value={String(idx)}>
                  {name}s
                </option>
              ))}
            </select>
            <select value={days} onChange={(e) => setDays(e.target.value)} className={controlClass}>
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </>
        )}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {[
          { title: 'Visitors', val: String(report?.totalVisitors ?? 0), icon: <Users /> },
          {
            title: mode === 'weekday' ? 'Avg per occurrence' : 'Avg duration',
            val:
              mode === 'weekday'
                ? String(weekdayEntry?.average ?? 0)
                : formatDurationMinutes(report?.averageDuration ?? 0),
            icon: <CalendarDays />,
          },
          {
            title: mode === 'weekday' ? `${WEEKDAY_NAMES[Number(weekday)]}s counted` : 'Active now',
            val: mode === 'weekday' ? String(weekdayEntry?.activeDays ?? 0) : String(report?.activeVisitors ?? 0),
            icon: <Calendar />,
          },
        ].map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            key={stat.title}
            className="glass-card p-5 border-l-4 border-l-[var(--color-brand-terracotta)] dark:border-l-red-500 rounded-2xl relative overflow-hidden"
          >
            <div className="absolute right-[-20px] top-[-20px] opacity-10 text-[var(--color-brand-terracotta)] dark:text-red-500">
              {stat.icon}
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
              {stat.title}
            </p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">{stat.val}</h3>
          </motion.div>
        ))}
      </div>

      {/* Top offices for this scope */}
      {(report?.topDestinations || []).length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
            <MapPin size={18} className="text-[var(--color-brand-terracotta)] dark:text-red-500" />
            Most visited offices {scopeLabel}
          </h3>
          <div className="space-y-3">
            {(report.topDestinations || []).map((dept, i) => {
              const percent = report.totalVisitors
                ? Math.round((dept.total / report.totalVisitors) * 100)
                : 0;
              return (
                <div key={dept.label} className="space-y-1">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{dept.label}</span>
                    <span className="text-xs font-mono font-bold text-slate-500">
                      {dept.total} · {percent}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      className="h-full bg-gradient-to-r from-[var(--color-brand-terracotta)] to-red-500 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visitor table */}
      <div className="glass-card flex flex-col overflow-hidden flex-1 min-h-[300px]">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0b101e]/80 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileBarChart2 size={18} className="text-[var(--color-brand-terracotta)] dark:text-red-500" />
            Visitors ({rows.length})
          </h3>
          {loading && <span className="text-xs font-semibold text-slate-400">Loading…</span>}
        </div>
        <div className="overflow-auto custom-scrollbar">
          {rows.length === 0 ? (
            <div className="p-10 text-center text-slate-400 dark:text-slate-500 font-medium">
              No visitors {scopeLabel}.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/90 backdrop-blur">
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Destination</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Check-in</th>
                  <th className="px-5 py-3 text-right">Duration</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 dark:border-slate-800/70 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-100">{row.name}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          row.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{row.destination || '—'}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {locationNameById[row.locationId] || row.locationId}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(row.checkinTime)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                      {row.durationMin != null ? formatDurationMinutes(row.durationMin) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
