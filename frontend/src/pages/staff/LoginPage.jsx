import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, ArrowRight, Globe2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSinarms } from '../../context/SinarmsContext';
import { useLanguage } from '../../context/LanguageContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useSinarms();
  const { t, label: languageLabel, cycleLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const result = await login({ email, password });
      if (!result.ok) {
        window.alert(result.message || t('staff.login.failure'));
        return;
      }

      localStorage.setItem('sinarms_role', result.user?.role || 'admin');
      navigate('/staff/dashboard');
    } catch (err) {
      window.alert(err?.message || t('staff.login.failure'));
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 relative overflow-hidden">
      
      {/* Decorative Blur Orbs */}
      <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-[var(--color-brand-terracotta)]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <button
        type="button"
        onClick={cycleLanguage}
        aria-label="Change language"
        className="absolute top-6 right-6 z-20 inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
      >
        <Globe2 size={14} /> {languageLabel}
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md glass-card p-8 sm:p-12 relative z-10"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-500 rounded-2xl shadow-lg shadow-red-500/20 flex items-center justify-center mb-6">
            <span className="text-white font-bold tracking-widest text-xl">RC</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t('staff.login.title')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t('staff.login.subtitle')}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">{t('staff.login.email')}</label>
            <div className="relative group">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-brand-terracotta)] transition-colors" />
              <input 
                type="email" 
                required
                className="w-full bg-slate-100/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] dark:focus:ring-red-500 transition-all font-medium"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">{t('staff.login.password')}</label>
            <div className="relative group">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-brand-terracotta)] transition-colors" />
              <input 
                type="password" 
                required
                className="w-full bg-slate-100/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] dark:focus:ring-red-500 transition-all font-medium"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pb-2 mt-4">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[var(--color-brand-terracotta)] focus:ring-[var(--color-brand-terracotta)]" />
              <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">{t('staff.login.remember')}</span>
            </label>
            <a href="#" className="text-sm text-[var(--color-brand-terracotta)] hover:text-red-600 dark:text-red-400 font-semibold cursor-pointer">{t('staff.login.forgot')}</a>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            className="w-full bg-[var(--color-slate-900)] dark:bg-slate-100 text-white dark:text-slate-900 font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform group mt-6"
          >
            <LogIn size={20} className="group-hover:-translate-x-1 transition-transform" />
            {t('staff.login.submit')}
            <ArrowRight size={20} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </motion.button>
        </form>

      </motion.div>
    </div>
  );
}
