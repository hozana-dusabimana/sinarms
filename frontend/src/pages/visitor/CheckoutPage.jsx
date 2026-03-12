import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Star } from 'lucide-react';

export default function CheckoutPage() {
  const navigate = useNavigate();

  const handleCheckout = () => {
    // Process Check-Out API here
    setTimeout(() => {
      navigate('/');
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center w-full min-h-[80vh] justify-center pt-4 pb-20">
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="w-full max-w-md mx-auto glass-card p-8 sm:p-10 text-center relative overflow-hidden"
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-green-400/20 dark:bg-green-600/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center shadow-[0_10px_30px_-10px_rgba(34,197,94,0.6)] mb-6 text-white transform hover:scale-105 transition-transform">
          <LogOut size={36} className="translate-x-[-2px]" />
        </div>
        
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 mb-2">Check-Out</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">Thank you for visiting Ruliba Clays Ltd. Your session lasted <span className="text-slate-800 dark:text-slate-200 font-bold">42 minutes</span>.</p>

        <hr className="border-slate-200 dark:border-slate-700/50 mb-8" />

        <div className="mb-10">
          <h4 className="font-bold text-sm text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-4">Rate your visit</h4>
          <div className="flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <motion.button 
                key={star}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                className="text-slate-300 dark:text-slate-600 hover:text-yellow-400 focus:text-yellow-400 transition-colors"
              >
                <Star size={32} fill="currentColor" strokeWidth={1} />
              </motion.button>
            ))}
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCheckout}
          className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold py-4 rounded-xl shadow-lg transition-all"
        >
          Confirm Check-Out
        </motion.button>
      </motion.div>
    </div>
  );
}
