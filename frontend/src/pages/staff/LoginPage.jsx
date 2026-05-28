import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  Globe2,
  Shield,
  Eye,
  EyeOff,
  MapPinned,
  ScrollText,
  Radar,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSinarms } from '../../context/SinarmsContext';
import { useLanguage } from '../../context/LanguageContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useSinarms();
  const { t, label: languageLabel, cycleLanguage } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const emailRef = useRef(null);
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleKeyEvent = (e) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLock(e.getModifierState('CapsLock'));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg('');
    setSubmitting(true);
    try {
      const result = await login({ email, password });
      if (!result.ok) {
        setErrorMsg(result.message || t('staff.login.failure'));
        setSubmitting(false);
        return;
      }
      localStorage.setItem('sinarms_role', result.user?.role || 'admin');
      navigate('/staff/dashboard');
    } catch (err) {
      setErrorMsg(err?.message || t('staff.login.failure'));
      setSubmitting(false);
    }
  };

  const features = [
    { Icon: MapPinned, label: t('staff.login.feature.mapping') },
    { Icon: ScrollText, label: t('staff.login.feature.audit') },
    { Icon: Radar, label: t('staff.login.feature.geofence') },
  ];

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 sm:p-8">
      {/* Ambient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-[#0a0f1c] dark:to-slate-900 pointer-events-none" />
      <div className="absolute top-0 -left-32 w-[28rem] h-[28rem] bg-[var(--color-brand-terracotta)]/20 dark:bg-[var(--color-brand-terracotta)]/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 -right-32 w-[28rem] h-[28rem] bg-indigo-400/15 dark:bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Top chrome */}
      <Link
        to="/"
        className="absolute top-5 left-5 z-30 inline-flex items-center gap-2 h-9 px-3 rounded-full bg-white/80 dark:bg-slate-900/70 backdrop-blur border border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors shadow-sm"
      >
        <ArrowLeft size={13} />
        {t('staff.login.backToSite')}
      </Link>

      <button
        type="button"
        onClick={cycleLanguage}
        aria-label="Change language"
        className="absolute top-5 right-5 z-30 inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white/80 dark:bg-slate-900/70 backdrop-blur border border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors shadow-sm"
      >
        <Globe2 size={13} /> {languageLabel}
      </button>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[1080px] grid grid-cols-1 lg:grid-cols-2 rounded-3xl overflow-hidden shadow-2xl shadow-slate-900/10 dark:shadow-black/40 ring-1 ring-slate-200/70 dark:ring-slate-800/70 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl"
      >
        {/* ============== LEFT PANEL ============== */}
        <div className="relative hidden lg:flex flex-col justify-between p-10 xl:p-12 text-white bg-gradient-to-br from-[#160b0b] via-[#1d0f10] to-[#2b1414] overflow-hidden min-h-[640px]">
          {/* Dotted grid */}
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><circle cx='1' cy='1' r='1' fill='rgba(255,255,255,0.18)'/></svg>\")",
            }}
          />
          {/* Radial glow */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[var(--color-brand-terracotta)]/40 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-32 -right-16 w-96 h-96 bg-red-700/30 rounded-full blur-[120px] pointer-events-none" />

          {/* Brand */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 shadow-lg shadow-red-900/40 flex items-center justify-center">
              <Shield size={20} className="text-white" strokeWidth={2.4} />
            </div>
            <div className="leading-tight">
              <p className="text-base font-black tracking-tight">SINARMS</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-brand-light-clay)]">
                {t('landing.brand.tagline')}
              </p>
            </div>
          </div>

          {/* Headline block */}
          <div className="relative z-10 space-y-7">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-terracotta)] animate-pulse" />
              {t('staff.login.welcome.eyebrow')}
            </span>
            <div>
              <h1 className="text-4xl xl:text-[2.65rem] font-black leading-[1.05] tracking-tight">
                {t('staff.login.welcome.headline')}
              </h1>
              <p className="mt-4 text-sm xl:text-[15px] text-white/65 leading-relaxed max-w-md">
                {t('staff.login.welcome.subhead')}
              </p>
            </div>

            <ul className="space-y-3 pt-2">
              {features.map((feat, i) => (
                <motion.li
                  key={feat.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.08, duration: 0.4 }}
                  className="flex items-center gap-3 text-sm text-white/85"
                >
                  <span className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-[var(--color-brand-light-clay)]">
                    <feat.Icon size={15} strokeWidth={2.2} />
                  </span>
                  <span className="font-medium">{feat.label}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Status / footer */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/70">
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                <span className="relative w-2 h-2 rounded-full bg-emerald-400" />
              </span>
              {t('staff.login.systemStatus')}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
              v1.0 · RW
            </div>
          </div>
        </div>

        {/* ============== RIGHT PANEL ============== */}
        <div className="relative p-7 sm:p-10 xl:p-12 flex flex-col justify-center min-h-[560px]">
          {/* Mobile brand (shown when left panel is hidden) */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 shadow-md shadow-red-500/30 flex items-center justify-center">
              <Shield size={18} className="text-white" strokeWidth={2.4} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-black tracking-tight text-slate-900 dark:text-white">SINARMS</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-terracotta)]">
                {t('landing.brand.tagline')}
              </p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-brand-terracotta)]/10 dark:bg-[var(--color-brand-terracotta)]/15 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-clay)] dark:text-[var(--color-brand-light-clay)]">
              <Lock size={11} strokeWidth={2.6} />
              {t('staff.login.secureBadge')}
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {t('staff.login.title')}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {t('staff.login.subtitle')}
            </p>
          </div>

          {/* Error */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-4"
              >
                <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span className="font-medium">{errorMsg}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleLogin} className="space-y-5" noValidate>
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.14em] mb-1.5"
              >
                {t('staff.login.email')}
              </label>
              <div className="relative group">
                <Mail
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-brand-terracotta)] transition-colors"
                />
                <input
                  id="login-email"
                  ref={emailRef}
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={t('staff.login.emailPlaceholder')}
                  className="w-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-11 pr-4 h-12 outline-none focus:border-[var(--color-brand-terracotta)] focus:ring-4 focus:ring-[var(--color-brand-terracotta)]/15 transition-all font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.14em]"
                >
                  {t('staff.login.password')}
                </label>
                <a
                  href="#"
                  className="text-[11px] font-bold text-[var(--color-brand-terracotta)] hover:text-[var(--color-brand-clay)] dark:text-red-400 dark:hover:text-red-300 transition-colors"
                >
                  {t('staff.login.forgot')}
                </a>
              </div>
              <div className="relative group">
                <Lock
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-brand-terracotta)] transition-colors"
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder={t('staff.login.passwordPlaceholder')}
                  className="w-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-11 pr-12 h-12 outline-none focus:border-[var(--color-brand-terracotta)] focus:ring-4 focus:ring-[var(--color-brand-terracotta)]/15 transition-all font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={handleKeyEvent}
                  onKeyDown={handleKeyEvent}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={
                    showPassword ? t('staff.login.hidePassword') : t('staff.login.showPassword')
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <AnimatePresence>
                {capsLock && (
                  <motion.p
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    className="mt-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1"
                  >
                    <AlertCircle size={12} /> {t('staff.login.capsLockOn')}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Remember */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <span
                className={`relative w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center transition-colors ${
                  remember
                    ? 'bg-[var(--color-brand-terracotta)] border-[var(--color-brand-terracotta)]'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 group-hover:border-slate-400'
                }`}
                style={{ width: 18, height: 18 }}
              >
                <input
                  type="checkbox"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                {remember && (
                  <svg
                    className="w-3 h-3 text-white"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="2,6.5 5,9 10,3.5" />
                  </svg>
                )}
              </span>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                {t('staff.login.remember')}
              </span>
            </label>

            {/* Submit */}
            <motion.button
              whileTap={{ scale: 0.985 }}
              type="submit"
              disabled={submitting}
              className="relative w-full h-12 rounded-xl bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 text-white font-bold shadow-lg shadow-red-500/25 hover:shadow-red-500/40 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group overflow-hidden transition-shadow"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>{t('staff.login.signingIn')}</span>
                </>
              ) : (
                <>
                  <span>{t('staff.login.submit')}</span>
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-0.5 transition-transform"
                  />
                </>
              )}
            </motion.button>
          </form>

          {/* Visitor CTA */}
          <div className="mt-7 pt-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              {t('staff.login.visitorCta')}
            </span>
            <Link
              to="/visit"
              className="font-bold text-[var(--color-brand-terracotta)] hover:text-[var(--color-brand-clay)] dark:text-red-400 dark:hover:text-red-300 inline-flex items-center gap-1 transition-colors"
            >
              {t('staff.login.visitorLink')}
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
