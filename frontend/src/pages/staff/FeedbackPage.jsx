import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquareHeart, Star, Search, Building2, MapPin, User } from 'lucide-react';
import { useSinarms } from '../../context/SinarmsContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatDateTime, getLocationById, getOrganizationById } from '../../lib/sinarmsEngine';

function Stars({ rating }) {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={15}
          strokeWidth={1.5}
          className={star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300 dark:text-slate-600'}
        />
      ))}
      <span className="ml-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">{rating}/5</span>
    </div>
  );
}

export default function FeedbackPage() {
  const { state, currentUser } = useSinarms();
  const { t } = useLanguage();
  const [search, setSearch] = useState('');

  const roleLabel = currentUser?.role === 'admin' ? t('staff.layout.administrator') : t('staff.layout.receptionist');

  const enriched = useMemo(() => {
    return (state.feedback || [])
      .map((entry) => ({
        ...entry,
        _locationName: getLocationById(state, entry.locationId)?.name || '—',
        _orgName: getOrganizationById(state, entry.organizationId)?.name || '—',
      }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [state]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return enriched;
    return enriched.filter((entry) =>
      [entry.name, entry.comment, entry._locationName, entry._orgName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [enriched, search]);

  const avgRating = useMemo(() => {
    const rated = enriched.filter((entry) => Number(entry.rating) > 0);
    if (!rated.length) return null;
    return (rated.reduce((sum, entry) => sum + Number(entry.rating), 0) / rated.length).toFixed(1);
  }, [enriched]);

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 shadow-md shadow-red-500/30 flex items-center justify-center text-white">
            <MessageSquareHeart size={24} strokeWidth={2.2} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              {t('staff.feedback.title')}
              <span className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-red-200 dark:border-red-500/30">
                {roleLabel}
              </span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">{t('staff.feedback.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {t('staff.feedback.total')}
            </p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">{enriched.length}</p>
          </div>
          {avgRating && (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {t('staff.feedback.avgRating')}
              </p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums flex items-center gap-1 justify-end">
                {avgRating} <Star size={18} className="text-yellow-400 fill-yellow-400" />
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('staff.feedback.searchPlaceholder')}
          className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 focus:border-red-300 dark:focus:border-red-500/50 outline-none text-sm font-medium placeholder:text-slate-400 text-slate-800 dark:text-slate-100 shadow-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 py-16">
          <MessageSquareHeart size={32} className="opacity-40" />
          <p className="font-bold text-slate-700 dark:text-slate-200">{t('staff.feedback.empty.title')}</p>
          <p className="text-xs">{t('staff.feedback.empty.subtitle')}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.02, 0.3) }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4 shadow-sm flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 text-white font-bold flex items-center justify-center text-sm shadow-sm flex-shrink-0">
                    {(entry.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                      {entry.name || (
                        <span className="inline-flex items-center gap-1 text-slate-400 font-semibold italic">
                          <User size={13} /> {t('staff.feedback.anonymous')}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {entry.createdAt ? formatDateTime(entry.createdAt) : '—'}
                    </p>
                  </div>
                </div>
                <Stars rating={Number(entry.rating)} />
              </div>

              {entry.comment ? (
                <p className="text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                  “{entry.comment}”
                </p>
              ) : (
                <p className="text-xs italic text-slate-400 dark:text-slate-500">{t('staff.feedback.noComment')}</p>
              )}

              <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-auto pt-1">
                <span className="inline-flex items-center gap-1 min-w-0">
                  <MapPin size={12} className="flex-shrink-0" />
                  <span className="truncate">{entry._locationName}</span>
                </span>
                {currentUser?.role === 'admin' && (
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <Building2 size={12} className="flex-shrink-0" />
                    <span className="truncate">{entry._orgName}</span>
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
