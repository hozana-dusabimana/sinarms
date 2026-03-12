import { useState } from 'react';
import { motion } from 'framer-motion';
import { TerminalSquare, Filter, Download, ArrowRight } from 'lucide-react';

const MOCK_AUDIT = [
  { id: 101, time: '14:32:01', admin: 'Alice Mutoni', action: 'CREATE_USER', details: 'Added new Receptionist (Jean Paul)', ip: '192.168.1.5' },
  { id: 102, time: '14:15:22', admin: 'System', action: 'CRON_ALERT', details: 'Generated HIGH alert for Guest 842', ip: 'localhost' },
  { id: 103, time: '13:50:11', admin: 'Jean Paul', action: 'MANUAL_CHECKOUT', details: 'Force ended session for Visitor 901', ip: '192.168.1.12' },
  { id: 104, time: '11:20:05', admin: 'Alice Mutoni', action: 'UPDATE_MAP', location: 'Head Office', details: 'Added 2 restricted nodes', ip: '10.0.0.45' },
  { id: 105, time: '09:00:10', admin: 'Alice Mutoni', action: 'LOGIN', details: 'Successful desktop login', ip: '10.0.0.45' },
];

export default function AuditLog() {
  const [logs] = useState(MOCK_AUDIT);

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 border border-slate-700 rounded-xl shadow-lg flex items-center justify-center text-green-400">
            <TerminalSquare size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              System Audit Log
              <span className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-slate-300 dark:border-slate-700">
                Read Only
              </span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium font-mono text-sm max-w-[200px] truncate sm:max-w-none">
              Immutable record of system operations
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl transition-all font-bold flex items-center gap-2 shadow-sm">
            <Filter size={18} />
            <span className="hidden sm:inline">Filter</span>
          </button>
          <button className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 px-4 sm:px-6 py-2 rounded-xl shadow-md transition-all font-bold tracking-wide flex items-center gap-2">
            <Download size={18} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      <div className="glass-card flex-1 flex flex-col overflow-hidden relative shadow-2xl border-2 border-slate-200 dark:border-slate-800">
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-[#0b101e] font-mono text-xs sm:text-sm custom-scrollbar">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-200/50 dark:bg-slate-900/80 sticky top-0 z-10 uppercase tracking-widest text-slate-500 dark:text-slate-400 font-black border-b-2 border-slate-300 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 w-24">Time (UTC)</th>
                <th className="px-6 py-4 w-40">User/Source</th>
                <th className="px-6 py-4 w-48">Action Type</th>
                <th className="px-6 py-4">Details</th>
                <th className="px-6 py-4 text-right w-32">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
              {logs.map((log, i) => (
                <motion.tr 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={log.id} 
                  className="hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors group"
                >
                  <td className="px-6 py-4 text-slate-500 font-bold">{log.time}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] tracking-widest ${log.admin === 'System' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                      {log.admin}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                       {log.action}
                       {log.location && <span className="text-[10px] text-slate-400 font-normal">@{log.location}</span>}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400 truncate max-w-sm whitespace-pre-wrap">{log.details}</td>
                  <td className="px-6 py-4 text-right text-slate-400">{log.ip}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
