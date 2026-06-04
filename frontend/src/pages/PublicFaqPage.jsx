import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Globe2, Search, ChevronDown, Building2, MessageSquare, ArrowLeft, HelpCircle } from 'lucide-react';
import api from '../lib/api';
import { useSinarms } from '../context/SinarmsContext';
import { useLanguage } from '../context/LanguageContext';

export default function PublicFaqPage() {
  const { state } = useSinarms();
  const { t, language, label: languageLabel, cycleLanguage } = useLanguage();
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [institutionFilter, setInstitutionFilter] = useState('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);

  // Pull the whole public feed once, then slice it client-side — the list is
  // small and this keeps the institution/search filters instant without a round
  // trip per keystroke.
  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/faq/public')
      .then((res) => {
        if (!cancelled) setFaqs(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const organizations = useMemo(
    () => (state.organizations || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [state.organizations],
  );
  const organizationName = (organizationId) =>
    organizations.find((org) => org.id === organizationId)?.name || t('publicFaq.general');

  const visibleFaqs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    // A chosen institution gets its own entries plus the global (null) ones that
    // apply everywhere — same contract the backend uses.
    const byInstitution = faqs.filter(
      (faq) => !institutionFilter || !faq.organizationId || faq.organizationId === institutionFilter,
    );
    const bySearch = needle
      ? byInstitution.filter(
          (faq) =>
            (faq.question || '').toLowerCase().includes(needle) ||
            (faq.answer || '').toLowerCase().includes(needle),
        )
      : byInstitution;
    // Prefer entries in the visitor's chosen language, but never strand them on an
    // empty page when an institution only has answers in another language.
    const byLanguage = bySearch.filter((faq) => (faq.language || 'en') === language);
    return byLanguage.length ? byLanguage : bySearch;
  }, [faqs, institutionFilter, query, language]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50 dark:bg-[#0b101e] font-sans relative overflow-hidden">
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[40%] bg-red-300/25 dark:bg-red-900/30 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[40%] bg-orange-300/25 dark:bg-purple-900/30 rounded-full blur-[110px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full border-b border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md flex-shrink-0">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 shadow-md shadow-red-500/20 flex items-center justify-center transition-transform group-hover:scale-110">
              <ShieldCheck size={22} className="text-white" strokeWidth={2.4} />
            </div>
            <div className="leading-tight">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">SINARMS</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-brand-terracotta)] dark:text-red-400">
                {t('publicFaq.title')}
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={cycleLanguage}
            aria-label="Change language"
            className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <Globe2 size={14} /> {languageLabel}
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="relative z-10 flex-1 w-full overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto w-full px-5 sm:px-8 py-8 sm:py-12">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-[var(--color-brand-terracotta)] dark:hover:text-red-400 transition-colors mb-6"
          >
            <ArrowLeft size={16} /> {t('publicFaq.backHome')}
          </Link>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-500 rounded-xl shadow-lg shadow-red-500/20 flex items-center justify-center text-white flex-shrink-0">
              <MessageSquare size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{t('publicFaq.title')}</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">{t('publicFaq.subtitle')}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('publicFaq.searchPlaceholder')}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] dark:focus:ring-red-500 dark:text-slate-200 font-medium shadow-sm"
              />
            </div>
            {organizations.length > 0 && (
              <select
                value={institutionFilter}
                onChange={(e) => setInstitutionFilter(e.target.value)}
                aria-label={t('publicFaq.institution')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] dark:focus:ring-red-500 dark:text-slate-200 shadow-sm sm:max-w-[16rem]"
              >
                <option value="">{t('staff.filter.allInstitutions')}</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* List */}
          {loading ? (
            <div className="py-20 text-center text-slate-400 dark:text-slate-500 font-semibold">{t('publicFaq.loading')}</div>
          ) : error ? (
            <div className="py-20 text-center text-slate-400 dark:text-slate-500 font-semibold">{t('publicFaq.loadFailed')}</div>
          ) : visibleFaqs.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center gap-3 text-slate-400 dark:text-slate-600">
              <HelpCircle size={48} className="opacity-30" />
              <p className="font-bold text-slate-500 dark:text-slate-400">{t('publicFaq.empty')}</p>
              <p className="text-sm">{t('publicFaq.emptyHint')}</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                {t('publicFaq.count', { n: visibleFaqs.length })}
              </p>
              <div className="space-y-3">
                {visibleFaqs.map((faq) => {
                  const isOpen = openId === faq.id;
                  return (
                    <div
                      key={faq.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : faq.id)}
                        className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mb-2">
                            <Building2 size={11} /> {faq.organizationId ? organizationName(faq.organizationId) : t('publicFaq.general')}
                          </span>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">{faq.question}</h3>
                        </div>
                        <ChevronDown
                          size={20}
                          className={`flex-shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <p className="px-5 pb-5 text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line border-l-2 border-[var(--color-brand-terracotta)]/40 dark:border-red-500/40 ml-5">
                              <span className="block pl-4">{faq.answer}</span>
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md flex-shrink-0">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Powered by <span className="font-bold text-slate-700 dark:text-slate-200">SINARMS</span>
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Secure Visitor Management
          </p>
        </div>
      </footer>
    </div>
  );
}
