import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Edit2, Trash2, Shield, Search, X } from 'lucide-react';

const MOCK_USERS = [
  { id: 1, name: 'Alice Mutoni', email: 'alice@ruliba.rw', role: 'Admin', location: 'All Locations', status: 'Active' },
  { id: 2, name: 'Jean Paul', email: 'jean@ruliba.rw', role: 'Receptionist', location: 'Head Office', status: 'Active' },
  { id: 3, name: 'Claire UW', email: 'claire@ruliba.rw', role: 'Receptionist', location: 'Warehouse', status: 'Inactive' },
];

export default function UserManagement() {
  const [users, setUsers] = useState(MOCK_USERS);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            User Management
            <span className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-red-200 dark:border-red-500/30">
              Admin Only
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Manage Admin and Receptionist accounts</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[var(--color-brand-terracotta)] hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-400 text-white px-6 py-2.5 rounded-xl shadow-md shadow-red-500/30 transition-all font-bold tracking-wide flex items-center gap-2"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Add User</span>
        </button>
      </div>

      <div className="glass-card flex-1 flex flex-col overflow-hidden relative border-t-[6px] border-[var(--color-brand-terracotta)] dark:border-red-500">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md flex justify-between items-center z-10 sticky top-0">
          <div className="flex items-center gap-2">
            <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-widest uppercase">
              {users.length} Users
            </span>
          </div>
          <div className="relative w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search users..." className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-full pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)] dark:focus:ring-red-500 dark:text-slate-200 font-medium" />
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white/50 dark:bg-[#0b101e]/50 backdrop-blur-md">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-100/80 dark:bg-slate-900/80 sticky top-0 z-10 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-xs shadow-inner">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${u.role === 'Admin' ? 'border-[var(--color-brand-light-clay)] bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400' : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400'}`}>
                      {u.role === 'Admin' && <Shield size={12} />}
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-400">{u.location}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold uppercase ${u.status === 'Active' ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>{u.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-lg text-red-600 dark:text-red-400 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                <h3 className="font-bold text-lg dark:text-white">Add New User</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Full Name</label>
                  <input type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Email</label>
                  <input type="email" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Role</label>
                  <select className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]">
                    <option>Receptionist</option>
                    <option>Admin</option>
                  </select>
                </div>
                <div className="pt-4 flex gap-3">
                  <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                  <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-brand-terracotta)] text-white font-bold shadow-md hover:opacity-90 transition-opacity">Save User</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
