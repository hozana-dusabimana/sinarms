import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, User, Hash, ArrowRight, Loader } from 'lucide-react';

export default function CheckInPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState('EN');
  const [formData, setFormData] = useState({ name: '', idOrPhone: '', destination: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Mock AI Intent processing delay
    setTimeout(() => {
      setIsProcessing(false);
      navigate('/visit/navigate');
    }, 2000);
  };

  const translations = {
    EN: { title: "Welcome to Ruliba", subtitle: "Please check in to start your visit.", dest: "Where are you going?", placeholder: "e.g. Finance Office, HR Manager" },
    FR: { title: "Bienvenue à Ruliba", subtitle: "Veuillez vous enregistrer pour commencer.", dest: "Où allez-vous?", placeholder: "ex: Bureau des finances, DRH" },
    RW: { title: "Ikaze muri Ruliba", subtitle: "Iyandikishe mbere yo kwinjira.", dest: "Ugiye he?", placeholder: "Urugero: Ibiro by'imari, HR" }
  };

  const t = translations[lang];

  return (
    <div className="flex flex-col items-center w-full min-h-[80vh] pt-4">
      {/* Language Toggle */}
      <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-full mb-10 backdrop-blur-md shadow-inner border border-white/40 dark:border-slate-700/50">
        {['EN', 'FR', 'RW'].map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
              lang === l ? 'bg-white dark:bg-slate-700 shadow-md text-[var(--color-brand-terracotta)] dark:text-red-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto glass-card p-6 sm:p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-500 rounded-2xl shadow-lg shadow-red-500/20 flex items-center justify-center mb-4 transform -rotate-3 hover:rotate-0 transition-transform">
            <MapPin size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">{t.title}</h2>
          <p className="text-sm tracking-wide text-slate-500 dark:text-slate-400 mt-2">{t.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Full Name</label>
            <div className="relative group">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-brand-terracotta)] transition-colors" />
              <input 
                type="text" 
                required
                className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] dark:focus:ring-red-500 focus:border-transparent transition-all"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">ID or Phone</label>
            <div className="relative group">
              <Hash size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-brand-terracotta)] transition-colors" />
              <input 
                type="text" 
                required
                className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] dark:focus:ring-red-500 focus:border-transparent transition-all"
                value={formData.idOrPhone}
                onChange={(e) => setFormData({...formData, idOrPhone: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1 pt-2">
            <label className="text-sm font-bold text-slate-800 dark:text-slate-200 pl-1">{t.dest}</label>
            <textarea 
              required
              rows={3}
              placeholder={t.placeholder}
              className="w-full bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl p-4 outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] dark:focus:ring-red-500 focus:border-transparent transition-all resize-none shadow-inner"
              value={formData.destination}
              onChange={(e) => setFormData({...formData, destination: e.target.value})}
            />
          </div>

          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center gap-3 border border-slate-200 dark:border-slate-700"
              >
                <Loader className="animate-spin text-[var(--color-brand-terracotta)] dark:text-red-400" size={24} />
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 tracking-wide">
                  Analyzing destination...
                </span>
              </motion.div>
            ) : (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full bg-gradient-to-r from-[var(--color-brand-terracotta)] to-red-600 hover:from-red-600 hover:to-[var(--color-brand-terracotta)] text-white font-bold py-4 rounded-xl shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 transition-all group"
              >
                Start Navigation
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </motion.button>
            )}
          </AnimatePresence>
        </form>
      </motion.div>
    </div>
  );
}
