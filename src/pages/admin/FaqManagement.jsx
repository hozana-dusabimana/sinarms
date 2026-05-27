import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Plus, Edit2, Trash2, Search, X, Languages } from 'lucide-react';
import { useSinarms } from '../../context/SinarmsContext';
import { useLanguage } from '../../context/LanguageContext';

export default function FaqManagement() {
  const { state, createFaq, updateFaq, deleteFaq } = useSinarms();
  const { t } = useLanguage();
  const faqs = state.faq || [];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-500 rounded-xl shadow-lg shadow-red-500/20 flex items-center justify-center text-white">
            <MessageSquare size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              {t('staff.faq.title')}
              <span className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-red-200 dark:border-red-500/30">
                {t('staff.adminOnly')}
              </span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium overflow-hidden whitespace-nowrap overflow-ellipsis max-w-[200px] sm:max-w-none">{t('staff.faq.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => { setEditingFaq(null); setIsModalOpen(true); }}
          className="bg-[var(--color-brand-terracotta)] hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-400 text-white px-6 py-2.5 rounded-xl shadow-md shadow-red-500/30 transition-all font-bold tracking-wide flex items-center gap-2"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">{t('staff.faq.add')}</span>
        </button>
      </div>

      <div className="glass-card flex-1 flex flex-col overflow-hidden relative border-t-[6px] border-[var(--color-brand-terracotta)] dark:border-red-500">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md flex justify-between items-center z-10 sticky top-0">
          <div className="flex items-center gap-2">
            <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-widest uppercase">
              {t('staff.faq.entries', { n: faqs.length })}
            </span>
          </div>
          <div className="relative w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder={t('staff.faq.searchPlaceholder')} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-full pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] dark:focus:ring-red-500 dark:text-slate-200 font-medium" />
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-[#0b101e]">
          <div className="p-4 space-y-4 max-w-5xl mx-auto custom-scrollbar">
            {faqs.map((faq) => (
              <motion.div 
                key={faq.id}
                layout
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-[var(--color-brand-terracotta)]/50 dark:hover:border-red-500/50 transition-colors cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Languages size={12}/> {(faq.language || 'en').toUpperCase()}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">{faq.question}</h3>
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-2 pl-1 leading-relaxed border-l-2 border-slate-200 dark:border-slate-800">
                    {faq.answer}
                  </p>
                </div>
                
                <div className="flex items-center gap-6 self-start sm:self-center">
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-700 dark:text-slate-200">{faq.hitCount}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('staff.faq.matches')}</p>
                  </div>
                  <div className="flex items-center gap-2 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => { setEditingFaq(faq); setIsModalOpen(true); }}
                      className="p-2 text-slate-400 hover:text-[var(--color-brand-terracotta)] dark:hover:text-red-400 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await deleteFaq(faq.id);
                        } catch (error) {
                          window.alert(error?.message || t('staff.faq.deleteFailed'));
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2"><MessageSquare size={18}/> {editingFaq ? t('staff.faq.modal.editTitle') : t('staff.faq.modal.newTitle')}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">{t('staff.faq.modal.language')}</label>
                  <select id="faq-lang" defaultValue={editingFaq ? (editingFaq.language || 'en').toUpperCase() : 'EN'} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] font-bold">
                    <option value="EN">{t('staff.faq.modal.langEn')}</option>
                    <option value="FR">{t('staff.faq.modal.langFr')}</option>
                    <option value="RW">{t('staff.faq.modal.langRw')}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">{t('staff.faq.modal.question')}</label>
                  <input id="faq-q" type="text" defaultValue={editingFaq ? editingFaq.question : ''} placeholder={t('staff.faq.modal.questionPlaceholder')} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">{t('staff.faq.modal.answer')}</label>
                  <textarea id="faq-a" defaultValue={editingFaq ? editingFaq.answer : ''} rows={4} placeholder={t('staff.faq.modal.answerPlaceholder')} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] resize-none" />
                </div>

                <div className="pt-2 flex gap-3">
                  <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{t('staff.faq.modal.cancel')}</button>
                  <button onClick={async () => {
                    try {
                      const languageRaw = document.getElementById('faq-lang').value;
                      const language = languageRaw === 'FR' ? 'fr' : languageRaw === 'RW' ? 'rw' : 'en';
                      const question = document.getElementById('faq-q').value;
                      const answer = document.getElementById('faq-a').value;

                      if (!question.trim() || !answer.trim()) {
                        window.alert(t('staff.faq.modal.required'));
                        return;
                      }

                      if (editingFaq) {
                        await updateFaq(editingFaq.id, { language, question, answer });
                      } else {
                        await createFaq({ language, question, answer });
                      }

                      setIsModalOpen(false);
                    } catch (error) {
                      window.alert(error?.message || t('staff.faq.modal.saveFailed'));
                    }
                  }} className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-brand-terracotta)] text-white font-bold shadow-md hover:opacity-90 transition-opacity">
                    {editingFaq ? t('staff.faq.modal.update') : t('staff.faq.modal.save')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
