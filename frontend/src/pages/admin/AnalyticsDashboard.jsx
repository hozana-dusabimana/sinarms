import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Users, Clock, ShieldAlert, ArrowUpRight, ArrowDownRight, Calendar, MapPin } from 'lucide-react';
import { useSinarms } from '../../context/SinarmsContext';
import api from '../../lib/api';

function weekOfYear(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d - firstThursday) / (7 * 24 * 60 * 60 * 1000));
}

export default function AnalyticsDashboard() {
  const { analytics: bootstrapAnalytics, exportAnalytics } = useSinarms();
  const [analytics, setAnalytics] = useState(bootstrapAnalytics);
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [granularity, setGranularity] = useState('D');
  const arrivalsByDay = analytics.arrivalsByDay || [];

  const aggregateByGranularity = (days, granularityKey) => {
    if (!days.length) return [];
    if (granularityKey === 'D') {
      return days.slice(-14).map((entry) => ({
        key: entry.date,
        label: entry.date
          ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(`${entry.date}T00:00:00Z`))
          : '',
        total: entry.totalVisitors || 0,
      }));
    }
    if (granularityKey === 'W') {
      const buckets = new Map();
      days.forEach((entry) => {
        if (!entry.date) return;
        const d = new Date(`${entry.date}T00:00:00Z`);
        const day = d.getUTCDay();
        const diff = (day + 6) % 7; // week starts Monday
        const monday = new Date(d);
        monday.setUTCDate(d.getUTCDate() - diff);
        const key = monday.toISOString().slice(0, 10);
        const prev = buckets.get(key) || { key, start: monday, total: 0 };
        prev.total += entry.totalVisitors || 0;
        buckets.set(key, prev);
      });
      return Array.from(buckets.values())
        .sort((a, b) => a.start - b.start)
        .slice(-8)
        .map((bucket) => ({
          key: bucket.key,
          label: `W${String(weekOfYear(bucket.start)).padStart(2, '0')}`,
          total: bucket.total,
        }));
    }
    // 'M' — group by year+month
    const buckets = new Map();
    days.forEach((entry) => {
      if (!entry.date) return;
      const d = new Date(`${entry.date}T00:00:00Z`);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const prev = buckets.get(key) || { key, date: d, total: 0 };
      prev.total += entry.totalVisitors || 0;
      buckets.set(key, prev);
    });
    return Array.from(buckets.values())
      .sort((a, b) => a.date - b.date)
      .slice(-6)
      .map((bucket) => ({
        key: bucket.key,
        label: new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' }).format(bucket.date),
        total: bucket.total,
      }));
  };

  const trendSeries = aggregateByGranularity(arrivalsByDay, granularity);
  const trendMax = Math.max(1, ...trendSeries.map((entry) => entry.total || 0));

  const trendBars = trendSeries.map((entry) => ({
    dateLabel: entry.label,
    height: Math.round((entry.total / trendMax) * 100),
    total: entry.total,
  }));

  useEffect(() => {
    setAnalytics(bootstrapAnalytics);
  }, [bootstrapAnalytics]);

  useEffect(() => {
    const rangeToDays = {
      'Last 7 Days': 7,
      'Last 30 Days': 30,
      'Last 90 Days': 90,
    };

    const days = rangeToDays[dateRange] || 30;
    let cancelled = false;

    async function load() {
      try {
        const response = await api.get('/api/analytics/summary', { params: { days } });
        if (!cancelled) {
          setAnalytics(response.data);
        }
      } catch (_error) {
        // Stay on bootstrap analytics if the request is unauthorized/unavailable.
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [dateRange]);

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            Analytics Overview
            <span className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-red-200 dark:border-red-500/30">
              Admin Only
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Head Office - Kigali</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const ranges = ['Last 7 Days', 'Last 30 Days', 'Last 90 Days'];
              const next = ranges[(ranges.indexOf(dateRange) + 1) % ranges.length] || ranges[0];
              setDateRange(next);
            }}
            className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl transition-all font-bold flex items-center gap-2 border border-slate-300 dark:border-slate-600 shadow-sm"
          >
            <Calendar size={18} />
            <span className="hidden sm:inline">{dateRange}</span>
          </button>
          <button onClick={() => exportAnalytics()} className="bg-[var(--color-brand-terracotta)] hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-400 text-white px-6 py-2 rounded-xl shadow-md shadow-red-500/30 transition-all font-bold tracking-wide flex items-center gap-2">
            <ArrowUpRight size={18} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { title: "Total Visitors", val: String(analytics.totalVisitors), change: "", up: true, icon: <Users /> },
          { title: "Avg Duration", val: `${analytics.averageDuration} min`, change: "", up: true, icon: <Clock /> },
          { title: "Active Now", val: String(analytics.activeVisitors), change: "", up: true, icon: <TrendingUp /> },
          { title: "Total Alerts", val: String(analytics.alertsToday), change: "", up: false, icon: <ShieldAlert /> },
        ].map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i} 
            className="glass-card p-5 border-l-4 border-l-[var(--color-brand-terracotta)] dark:border-l-red-500 rounded-2xl relative overflow-hidden"
          >
            <div className="absolute right-[-20px] top-[-20px] opacity-10 text-[var(--color-brand-terracotta)] dark:text-red-500">
              {stat.icon}
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{stat.title}</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{stat.val}</h3>
            {stat.change ? (
              <div className={`flex items-center gap-1 text-xs font-bold ${stat.up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {stat.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <span>{stat.change} vs last month</span>
              </div>
            ) : null}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[400px]">
        
        {/* Main Chart */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-8 z-10 relative">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 size={20} className="text-[var(--color-brand-terracotta)] dark:text-red-500" />
              Visitor Volume Trend
            </h3>
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              {['D', 'W', 'M'].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setGranularity(p)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    p === granularity
                      ? 'bg-white text-slate-900 dark:bg-slate-700 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 relative w-full h-full min-h-[250px] z-10 flex items-end gap-2 sm:gap-4 px-2">
            {/* CSS Bar Chart Simulation */}
            {trendBars.map((bar, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end items-center group/bar h-full">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${bar.height}%` }}
                  transition={{ duration: 1, type: "spring" }}
                  className="w-full max-w-[40px] bg-[var(--color-brand-terracotta)]/80 dark:bg-red-500/80 rounded-t-sm group-hover/bar:bg-red-600 dark:group-hover/bar:bg-red-400 transition-colors relative"
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                    {bar.total}
                  </div>
                </motion.div>
                <span className="text-[10px] font-mono text-slate-400 mt-2 block w-full text-center truncate">{bar.dateLabel}</span>
              </div>
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-12 h-[1px] bg-slate-200 dark:bg-slate-800 z-0"></div>
          <div className="absolute inset-x-0 bottom-[40%] h-[1px] bg-slate-200 dark:bg-slate-800 border-dashed border-b z-0 opacity-50"></div>
          <div className="absolute inset-x-0 top-16 h-[1px] bg-slate-200 dark:bg-slate-800 border-dashed border-b z-0 opacity-50"></div>
        </div>

        {/* Heatmap/Top Destinations */}
        <div className="glass-card flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0b101e]/80">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin size={18} className="text-[var(--color-brand-terracotta)] dark:text-red-500" />
              Most Visited Departments
            </h3>
          </div>
          
          <div className="p-5 space-y-4 flex-1 bg-white/50 dark:bg-slate-900/50">
            {(analytics.topDestinations || []).map((dept, i) => {
              const percent = analytics.totalVisitors ? Math.round((dept.total / analytics.totalVisitors) * 100) : 0;
              return (
              <div key={i} className="space-y-2 group cursor-pointer">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{dept.label}</span>
                  <span className="text-xs font-mono font-bold text-slate-500">{percent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 1, delay: i * 0.2 }}
                    className="h-full bg-gradient-to-r from-[var(--color-brand-terracotta)] to-red-500 rounded-full group-hover:opacity-80 transition-opacity"
                  />
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
