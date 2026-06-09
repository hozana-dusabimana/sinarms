import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquareHeart, Star, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useSinarms } from '../../context/SinarmsContext';
import { useLanguage } from '../../context/LanguageContext';

export default function FeedbackPage() {
  const navigate = useNavigate();
  const { state, currentVisitor, submitFeedback } = useSinarms();
  const { t } = useLanguage();

  const activeLocations = useMemo(
    () => (state.locations || []).filter((location) => location.status !== 'inactive'),
    [state.locations],
  );
  const orgName = (organizationId) =>
    (state.organizations || []).find((org) => org.id === organizationId)?.name || '';

  const [locationId, setLocationId] = useState(
    currentVisitor?.locationId || activeLocations[0]?.id || '',
  );
  const [name, setName] = useState(currentVisitor?.name || '');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const canSubmit = (rating > 0 || comment.trim().length > 0) && !isSubmitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await submitFeedback({
        name: name.trim() || null,
        rating: rating > 0 ? rating : null,
        comment: comment.trim() || null,
        locationId: locationId || null,
        visitorId: currentVisitor?.id || null,
      });
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || t('visitor.feedback.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center w-full min-h-[70vh] justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="w-full max-w-md mx-auto glass-card p-8 sm:p-10 text-center relative overflow-hidden"
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-green-400/20 dark:bg-green-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center shadow-[0_10px_30px_-10px_rgba(34,197,94,0.6)] mb-6 text-white">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 mb-2">
            {t('visitor.feedback.thanksTitle')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
            {t('visitor.feedback.thanksBody')}
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold py-3.5 rounded-xl shadow-lg transition-all"
          >
            {t('visitor.feedback.backHome')}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto glass-card p-7 sm:p-9 relative overflow-hidden"
      >
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-red-400/20 dark:bg-red-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 rounded-2xl flex items-center justify-center shadow-md shadow-red-500/30 mb-5 text-white">
          <MessageSquareHeart size={30} />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 mb-1">
          {t('visitor.feedback.title')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium mb-7 text-sm">
          {t('visitor.feedback.subtitle')}
        </p>

        {activeLocations.length > 1 && (
          <label className="block mb-5">
            <span className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
              {t('visitor.feedback.location')}
            </span>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-red-300 dark:focus:border-red-500/50 outline-none p-3 text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              {activeLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                  {orgName(location.organizationId) ? ` — ${orgName(location.organizationId)}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block mb-5">
          <span className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
            {t('visitor.feedback.name')} <span className="font-medium normal-case tracking-normal text-slate-400">({t('visitor.feedback.optional')})</span>
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
            placeholder={t('visitor.feedback.namePlaceholder')}
            className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-red-300 dark:focus:border-red-500/50 focus:bg-white dark:focus:bg-slate-900 outline-none p-3 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </label>

        <div className="mb-5">
          <span className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
            {t('visitor.feedback.rating')}
          </span>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <motion.button
                key={star}
                type="button"
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setRating(star === rating ? 0 : star)}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
                className={`transition-colors ${
                  star <= rating
                    ? 'text-yellow-400'
                    : 'text-slate-300 dark:text-slate-600 hover:text-yellow-300'
                }`}
              >
                <Star size={30} fill="currentColor" strokeWidth={1} />
              </motion.button>
            ))}
          </div>
        </div>

        <label className="block mb-6">
          <span className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
            {t('visitor.feedback.comment')}
          </span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder={t('visitor.feedback.commentPlaceholder')}
            className="w-full resize-none rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-red-300 dark:focus:border-red-500/50 focus:bg-white dark:focus:bg-slate-900 outline-none p-3 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </label>

        {error && (
          <p className="mb-4 text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft size={16} /> {t('visitor.feedback.back')}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-50"
          >
            {isSubmitting ? t('visitor.feedback.sending') : t('visitor.feedback.send')}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
