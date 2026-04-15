import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Edit2, Trash2, Shield, Search, X } from 'lucide-react';
import { useSinarms } from '../../context/SinarmsContext';

export default function UserManagement() {
  const { state, createUser, updateUser, deactivateUser } = useSinarms();
  const users = state.users || [];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('receptionist');
  const [userLocationId, setUserLocationId] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const isEditing = Boolean(editingUserId);

  const openEditModal = (user) => {
    setEditingUserId(user.id);
    setUserName(user.name || '');
    setUserEmail(user.email || '');
    setUserRole(user.role || 'receptionist');
    setUserLocationId(user.locationId || '');
    setUserPassword('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
  };

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
          onClick={() => {
            setEditingUserId(null);
            setUserName('');
            setUserEmail('');
            setUserRole('receptionist');
            setUserLocationId('');
            setUserPassword('');
            setIsModalOpen(true);
          }}
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
              {users.map((u) => {
                const roleLabel = u.role === 'admin' ? 'Admin' : 'Receptionist';
                const locationLabel =
                  u.role === 'admin'
                    ? 'All Locations'
                    : state.locations.find((location) => location.id === u.locationId)?.name || 'Unassigned';
                const statusLabel = u.status === 'active' ? 'Active' : 'Inactive';

                return (
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
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${roleLabel === 'Admin' ? 'border-[var(--color-brand-light-clay)] bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400' : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400'}`}>
                      {roleLabel === 'Admin' && <Shield size={12} />}
                      {roleLabel}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-400">{locationLabel}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold uppercase ${statusLabel === 'Active' ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>{statusLabel}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(u)}
                        title="Edit user"
                        className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await deactivateUser(u.id);
                          } catch (error) {
                            window.alert(error?.message || 'Unable to update user status.');
                          }
                        }}
                        className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-lg text-red-600 dark:text-red-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
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
                <h3 className="font-bold text-lg dark:text-white">{isEditing ? 'Edit User' : 'Add New User'}</h3>
                <button onClick={closeModal} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Full Name</label>
                  <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Email</label>
                  <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Role</label>
                  <select value={userRole} onChange={(e) => setUserRole(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]">
                    <option value="receptionist">Receptionist</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {userRole === 'receptionist' ? (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Assigned Location</label>
                    <select value={userLocationId} onChange={(e) => setUserLocationId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]">
                      <option value="" disabled>Select a location...</option>
                      {state.locations.map((location) => (
                        <option key={location.id} value={location.id}>{location.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">
                    {isEditing ? 'New Password (optional)' : 'Password'}
                  </label>
                  <input
                    type="password"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder={isEditing ? 'Leave blank to keep current' : 'Default: Reception123!'}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-brand-terracotta)]"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button onClick={closeModal} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                  <button onClick={async () => {
                    if (!userName.trim() || !userEmail.trim()) {
                      window.alert('Name and email are required.');
                      return;
                    }

                    if (userRole === 'receptionist' && !userLocationId) {
                      window.alert('Select a location for the receptionist.');
                      return;
                    }

                    const payload = {
                      name: userName.trim(),
                      email: userEmail.trim(),
                      role: userRole,
                      locationId: userRole === 'receptionist' ? userLocationId : null,
                    };
                    if (userPassword) payload.password = userPassword;

                    try {
                      if (isEditing) {
                        await updateUser(editingUserId, payload);
                      } else {
                        await createUser(payload);
                      }
                      closeModal();
                    } catch (error) {
                      window.alert(error?.message || (isEditing ? 'Unable to update user.' : 'Unable to create user.'));
                    }
                  }} className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-brand-terracotta)] text-white font-bold shadow-md hover:opacity-90 transition-opacity">{isEditing ? 'Save Changes' : 'Save User'}</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
