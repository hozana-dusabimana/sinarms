import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Bot } from 'lucide-react';

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, sender: 'bot', text: 'Hello! I am your AI assistant. Ask me questions like "Where is the toilet?" or "What time does HR open?"' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: input }]);
    setInput('');
    setIsTyping(true);

    // Mock AI Response (MiniLM FAQ simulation)
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: 'I am a simulated chatbot designed entirely for the SINARMS frontend mockup. (FAQ system would handle this response in production).' }]);
    }, 1500);
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full shadow-2xl flex items-center justify-center z-40 border border-slate-700 dark:border-slate-300"
      >
        <MessageSquare size={24} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 bottom-24 top-24 md:top-auto md:w-96 md:h-[500px] md:left-auto md:right-6 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
          >
            <div className="bg-gradient-to-r from-[var(--color-brand-terracotta)] to-slate-900 p-4 flex items-center justify-between text-white drop-shadow-md z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Virtual Assistant</h3>
                  <p className="text-xs text-slate-200/80 font-medium">MiniLM AI Powered</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-black/20 hover:bg-black/30 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-[#0b101e] pb-10 custom-scrollbar">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                      msg.sender === 'user' 
                        ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 rounded-br-sm' 
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-bl-sm p-4 flex gap-1 shadow-sm">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute bottom-0 w-full z-10">
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Ask a question..."
                  className="w-full bg-slate-100 dark:bg-[#0b101e] border-none text-slate-800 dark:text-slate-200 rounded-full pl-5 pr-12 py-3.5 outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] dark:focus:ring-red-500 shadow-inner"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button 
                  onClick={handleSend}
                  className="absolute right-2 w-10 h-10 bg-[var(--color-brand-terracotta)] hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-400 text-white rounded-full flex items-center justify-center transition-colors shadow-md shadow-red-500/30"
                >
                  <Send size={18} className="translate-x-[1px]" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
