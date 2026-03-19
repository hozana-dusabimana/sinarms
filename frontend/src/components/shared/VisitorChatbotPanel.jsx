import { useState } from 'react';
import { useSinarms } from '../../context/SinarmsContext';

export default function VisitorChatbotPanel({ organizationId, locationId }) {
  const { sendChatbotQuery } = useSinarms();
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Ask about parking, bathrooms, office hours, or how to reach a destination.',
    },
  ]);
  const [query, setQuery] = useState('');

  async function submitQuery() {
    if (!query.trim()) {
      return;
    }

    const text = query.trim();
    setMessages((current) => [...current, { id: Date.now(), sender: 'user', text }]);
    const response = await sendChatbotQuery({ organizationId, locationId, query: text });
    setMessages((current) => [...current, { id: Date.now() + 1, sender: 'bot', text: response.answer }]);
    setQuery('');
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold">Visitor Assistant</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Hardcoded AI endpoint responses</p>
        </div>
      </div>
      <div className="max-h-72 space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
        {messages.map((message) => (
          <div key={message.id} className={message.sender === 'user' ? 'text-right' : ''}>
            <div
              className={`inline-block max-w-full rounded-2xl px-4 py-3 text-sm ${
                message.sender === 'user'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-white text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              submitQuery();
            }
          }}
          placeholder="Ask a question..."
          className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[var(--color-brand-terracotta)] dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="button"
          onClick={submitQuery}
          className="rounded-2xl bg-[var(--color-brand-terracotta)] px-4 py-3 text-sm font-bold text-white"
        >
          Send
        </button>
      </div>
    </div>
  );
}
