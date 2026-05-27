import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Building2, MapPin, Clock, CheckCircle2, KeyRound, Pencil, Save, X, Eye, EyeOff } from 'lucide-react';
import { useSinarms } from '../../context/SinarmsContext';

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

export default function ProfilePage() {
  const { currentUser, state, updateOwnProfile } = useSinarms();

  const organization = useMemo(
    () => (state?.organizations || []).find((o) => o.id === currentUser?.organizationId),
    [state?.organizations, currentUser?.organizationId]
  );
  const location = useMemo(
    () => (state?.locations || []).find((l) => l.id === currentUser?.locationId),
    [state?.locations, currentUser?.locationId]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    setName(currentUser.name || '');
    setEmail(currentUser.email || '');
    setCurrentPassword('');
    setNewPassword('');
    setError(null);
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="p-8 text-sm text-slate-500 dark:text-slate-400">
        You are not signed in.
      </div>
    );
  }

  const role = currentUser.role || 'staff';
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const initial = (currentUser.name || currentUser.email || 'U').charAt(0).toUpperCase();
  const permissions = currentUser.permissions || {};
  const grantedPermissions = Object.entries(permissions).filter(([, v]) => v === true);

  const cancelEdit = () => {
    setIsEditing(false);
    setName(currentUser.name || '');
    setEmail(currentUser.email || '');
    setCurrentPassword('');
    setNewPassword('');
    setError(null);
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const payload = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (trimmedName && trimmedName !== currentUser.name) payload.name = trimmedName;
    if (trimmedEmail && trimmedEmail !== currentUser.email) payload.email = trimmedEmail;
    if (newPassword) {
      if (!currentPassword) {
        setError('Enter your current password to change it.');
        return;
      }
      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }
      payload.currentPassword = currentPassword;
      payload.password = newPassword;
    }
    if (Object.keys(payload).length === 0) {
      setError('Nothing to update.');
      return;
    }

    try {
      setSaving(true);
      await updateOwnProfile(payload);
      setSuccessMsg('Profile updated.');
      setIsEditing(false);
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Could not update profile.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm"
      >
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-[var(--color-brand-terracotta)] via-red-500 to-orange-500" />
        <div className="relative px-6 sm:px-8 pt-16 pb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex items-end gap-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 text-white dark:text-slate-900 flex items-center justify-center text-3xl font-black shadow-xl ring-4 ring-white dark:ring-slate-900">
              {initial}
            </div>
            <div className="pb-1">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {currentUser.name || currentUser.email}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-500/15 text-[var(--color-brand-terracotta)] dark:text-red-400 text-[11px] font-bold uppercase tracking-wider">
                  <Shield size={12} /> {roleLabel}
                </span>
                {currentUser.status && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
                    <CheckCircle2 size={12} /> {currentUser.status}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div>
            {!isEditing ? (
              <button
                type="button"
                onClick={() => { setIsEditing(true); setSuccessMsg(null); }}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:brightness-110 transition-all shadow-md"
              >
                <Pencil size={14} /> Edit Profile
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  type="submit"
                  form="profile-edit-form"
                  disabled={saving}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-gradient-to-r from-[var(--color-brand-terracotta)] to-red-600 text-white text-xs font-bold hover:brightness-110 transition-all shadow-md shadow-red-500/30 disabled:opacity-60"
                >
                  <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-sm font-semibold px-4 py-3">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-sm font-semibold px-4 py-3">
          {error}
        </div>
      )}

      {isEditing ? (
        <form id="profile-edit-form" onSubmit={saveEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Contact</p>
            <Field icon={<User size={14} />} label="Name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent outline-none text-sm font-semibold text-slate-900 dark:text-slate-100"
                autoComplete="name"
              />
            </Field>
            <Field icon={<Mail size={14} />} label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent outline-none text-sm font-semibold text-slate-900 dark:text-slate-100"
                autoComplete="email"
              />
            </Field>
          </div>

          <div className="glass-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Change Password</p>
            <Field icon={<KeyRound size={14} />} label="Current password">
              <input
                type={showPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-transparent outline-none text-sm font-semibold text-slate-900 dark:text-slate-100"
                placeholder="Required to change password"
                autoComplete="current-password"
              />
            </Field>
            <Field
              icon={<KeyRound size={14} />}
              label="New password"
              trailing={
                <button type="button" onClick={() => setShowPw((v) => !v)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            >
              <input
                type={showPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-transparent outline-none text-sm font-semibold text-slate-900 dark:text-slate-100"
                placeholder="Leave blank to keep current"
                autoComplete="new-password"
              />
            </Field>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Contact</p>
            <Row icon={<User size={14} />} label="Name" value={currentUser.name || '—'} />
            <Row icon={<Mail size={14} />} label="Email" value={currentUser.email || '—'} />
          </div>

          <div className="glass-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Workspace</p>
            <Row icon={<Building2 size={14} />} label="Organization" value={organization?.name || '—'} />
            <Row icon={<MapPin size={14} />} label="Location" value={location?.name || (role === 'admin' ? 'All locations' : '—')} />
          </div>

          <div className="glass-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Activity</p>
            <Row icon={<Clock size={14} />} label="Last login" value={formatDateTime(currentUser.lastLogin)} />
            <Row icon={<Clock size={14} />} label="Created" value={formatDateTime(currentUser.createdAt)} />
          </div>

          <div className="glass-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Security</p>
            <Row icon={<KeyRound size={14} />} label="User ID" value={currentUser.id} />
          </div>
        </div>
      )}

      {grantedPermissions.length > 0 && (
        <div className="glass-card p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Permissions</p>
          <div className="flex flex-wrap gap-2">
            {grantedPermissions.map(([key]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold"
              >
                <CheckCircle2 size={12} className="text-emerald-500" /> {key}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{value}</p>
      </div>
    </div>
  );
}

function Field({ icon, label, children, trailing }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</p>
        <div className="mt-1 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 focus-within:border-[var(--color-brand-terracotta)] dark:focus-within:border-red-400 transition-colors">
          {children}
          {trailing}
        </div>
      </div>
    </div>
  );
}
