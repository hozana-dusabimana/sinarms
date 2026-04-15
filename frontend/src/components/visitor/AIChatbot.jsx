import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Bot, Mic, MicOff, Navigation2 } from 'lucide-react';
import { useSinarms } from '../../context/SinarmsContext';

export default function AIChatbot({ organizationId, locationId, open, onOpenChange, hideLauncher = false } = {}) {
  const { sendChatbotQuery, rerouteVisitor, currentVisitor } = useSinarms();
  const isControlled = typeof open === 'boolean' && typeof onOpenChange === 'function';
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = (next) => {
    if (isControlled) onOpenChange(typeof next === 'function' ? next(isOpen) : next);
    else setInternalOpen(next);
  };
  const [messages, setMessages] = useState([
    { id: 1, sender: 'bot', text: 'Hello! I am your AI assistant. Ask me questions like "Where is the toilet?" or "How do I get to the HR office?"' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const panelRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutsideClick(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const text = input.trim();
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text }]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await sendChatbotQuery({ organizationId, locationId, query: text });
      const reply =
        response?.answer ||
        response?.fallback ||
        'I am not sure about that. Please ask at the Reception desk.';

      const confidence = Number(response?.confidence || 0);
      const isConfidentSameLocation = Boolean(
        response?.destinationNodeId
        && currentVisitor?.id
        && response.status === 'resolved'
        && !response.crossLocation
        && confidence >= 0.7,
      );
      const needsConfirmation = Boolean(
        response?.destinationNodeId
        && currentVisitor?.id
        && (response.crossLocation || response.status === 'confirm'),
      );

      const action = needsConfirmation
        ? {
            kind: response.crossLocation ? 'switch-location' : 'set-destination',
            destinationNodeId: response.destinationNodeId,
            destinationLabel: response.destinationLabel,
            locationId: response.locationId || locationId,
            locationName: response.locationName,
          }
        : null;

      const botMessageId = Date.now() + 1;
      setMessages(prev => [...prev, { id: botMessageId, sender: 'bot', text: reply, action }]);

      // Auto-navigate on a confident, same-location hit — no extra click needed.
      if (isConfidentSameLocation) {
        try {
          await rerouteVisitor(currentVisitor.id, {
            destinationNodeId: response.destinationNodeId,
            locationId: response.locationId || locationId,
          });
          setMessages(prev => [
            ...prev,
            {
              id: Date.now() + 2,
              sender: 'bot',
              text: `Route set to ${response.destinationLabel || 'your destination'} — follow the highlighted path on the map.`,
            },
          ]);
        } catch (_error) {
          setMessages(prev => [
            ...prev,
            {
              id: Date.now() + 2,
              sender: 'bot',
              text: 'I found the place but could not update your route automatically. Please ask at Reception.',
            },
          ]);
        }
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { id: Date.now() + 1, sender: 'bot', text: 'The assistant is unavailable right now. Please ask at the Reception desk.' },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAction = async (messageId, action) => {
    if (!action || !currentVisitor?.id) return;
    setMessages(prev => prev.map((msg) => (msg.id === messageId ? { ...msg, actionPending: true } : msg)));
    try {
      await rerouteVisitor(currentVisitor.id, {
        destinationNodeId: action.destinationNodeId,
        locationId: action.locationId,
      });
      const confirmation = action.kind === 'switch-location'
        ? `Switched to ${action.locationName || 'the new location'}. Follow the highlighted route to ${action.destinationLabel || 'your destination'}.`
        : `Route updated. Follow the highlighted path to ${action.destinationLabel || 'your destination'}.`;
      setMessages(prev => [
        ...prev.map((msg) => (msg.id === messageId ? { ...msg, action: null, actionPending: false, actionDone: true } : msg)),
        { id: Date.now(), sender: 'bot', text: confirmation },
      ]);
    } catch (error) {
      setMessages(prev => prev.map((msg) => (
        msg.id === messageId
          ? { ...msg, actionPending: false, actionError: 'Could not update your route. Please ask at Reception.' }
          : msg
      )));
    }
  };

  const toggleListen = () => {
    if (isListening) {
      setIsListening(false);
    } else {
      setIsListening(true);
      // Simulate speech to text picking up something after a brief delay
      setTimeout(() => {
        setInput("Where is the reception desk?");
        setIsListening(false);
      }, 3000);
    }
  };

  return (
    <>
      {!hideLauncher && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          aria-label="Open AI assistant"
          className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 text-white rounded-full shadow-2xl shadow-red-500/40 flex items-center justify-center z-[600] border border-white/20"
        >
          <Bot size={24} strokeWidth={2.2} />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-md">
            <Sparkles size={10} className="text-[var(--color-brand-terracotta)]" strokeWidth={3} />
          </span>
        </motion.button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 bottom-24 top-24 md:top-auto md:w-96 md:h-[min(500px,calc(100dvh-160px))] md:left-auto md:right-6 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl z-[600] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
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
                aria-label="Close assistant"
                className="w-10 h-10 flex items-center justify-center bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-md transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-[#0b101e] custom-scrollbar">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                      msg.sender === 'user'
                        ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 rounded-br-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-sm'
                    }`}
                  >
                    <div>{msg.text}</div>
                    {msg.action && (
                      <button
                        onClick={() => handleAction(msg.id, msg.action)}
                        disabled={msg.actionPending}
                        className="mt-3 inline-flex items-center gap-2 text-xs font-semibold bg-[var(--color-brand-terracotta)] dark:bg-red-500 text-white px-3 py-2 rounded-full shadow-sm hover:scale-105 transition-transform disabled:opacity-60 disabled:cursor-progress"
                      >
                        <Navigation2 size={14} />
                        {msg.actionPending
                          ? 'Updating route...'
                          : msg.action.kind === 'switch-location'
                            ? `Switch to ${msg.action.locationName || 'that location'} and go`
                            : `Go to ${msg.action.destinationLabel || 'this place'}`}
                      </button>
                    )}
                    {msg.actionDone && (
                      <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Route updated.</p>
                    )}
                    {msg.actionError && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-semibold">{msg.actionError}</p>
                    )}
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

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={isListening ? "Listening..." : "Ask a question..."}
                    className="w-full bg-slate-100 dark:bg-[#0b101e] border-none text-slate-800 dark:text-slate-200 rounded-full pl-5 pr-12 py-3.5 outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] dark:focus:ring-red-500 shadow-inner"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  />
                  <button 
                    onClick={toggleListen}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${isListening ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 animate-pulse' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    {isListening ? <Mic size={18} /> : <MicOff size={18} />}
                  </button>
                </div>
                <button 
                  onClick={handleSend}
                  className="w-12 h-12 shrink-0 bg-[var(--color-brand-terracotta)] hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-400 text-white rounded-full flex items-center justify-center transition-colors shadow-md shadow-red-500/30"
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
