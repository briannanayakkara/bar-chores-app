import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { adminAction } from '../../lib/admin-api';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../lib/logger';
import type { Profile } from '../../types/database';

export default function AdminUsers() {
  const { profile: adminProfile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);

  // Form state
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const venueId = adminProfile?.venue_id;

  async function loadUsers() {
    if (!venueId) { setLoading(false); return; }
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .eq('venue_id', venueId)
      .eq('role', 'staff')
      .order('display_name');
    if (err) logger.error('Failed to load staff', err.message);
    if (data) setUsers(data as Profile[]);
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, [venueId]);

  function openCreate() {
    setEditingUser(null);
    setUsername(''); setDisplayName(''); setPin('');
    setShowForm(true); setError('');
  }

  function openEdit(user: Profile) {
    setEditingUser(user);
    setUsername(user.username || '');
    setDisplayName(user.display_name || '');
    setPin('');
    setShowForm(true); setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!venueId) return;
    setSaving(true); setError('');

    if (editingUser) {
      // Update via Edge Function
      const { error: err } = await adminAction('update-staff', {
        staff_id: editingUser.id,
        username,
        display_name: displayName,
        pin: pin || undefined,
      });
      if (err) { setError(err); setSaving(false); return; }
      setMessage(`Updated "${displayName}"`);
    } else {
      // Create via Edge Function — no fake auth users, no bcrypt on client
      if (!pin) { setError('PIN is required for new staff'); setSaving(false); return; }
      if (pin.length < 4) { setError('PIN must be at least 4 digits'); setSaving(false); return; }

      logger.api('Creating staff via Edge Function', { username, venueId });
      const { error: err } = await adminAction('create-staff', {
        username,
        display_name: displayName,
        pin,
        venue_id: venueId,
      });
      if (err) { setError(err); setSaving(false); return; }
      setMessage(`Created "${displayName}" — PIN login ready`);
    }

    setSaving(false);
    setShowForm(false);
    loadUsers();
  }

  async function handleDelete(user: Profile) {
    if (!confirm(`Delete ${user.display_name || user.username}? This cannot be undone.`)) return;

    logger.api('Deleting staff via Edge Function', { id: user.id });
    const { error: err } = await adminAction('delete-staff', { staff_id: user.id });
    if (err) {
      setError(`Delete failed: ${err}`);
    } else {
      setMessage(`Deleted "${user.display_name || user.username}"`);
    }
    loadUsers();
  }

  async function handleResetPin(user: Profile) {
    const newPin = prompt(`Enter new PIN for ${user.display_name || user.username}:`);
    if (!newPin) return;
    if (newPin.length < 4) { setError('PIN must be at least 4 digits'); return; }

    const { error: err } = await adminAction('reset-pin', {
      staff_id: user.id,
      new_pin: newPin,
    });
    if (err) {
      setError(`PIN reset failed: ${err}`);
    } else {
      setMessage(`PIN reset for "${user.display_name || user.username}"`);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Staff Management</h1>
        <button onClick={openCreate} className="px-4 py-2.5 bg-primary text-slate-900 font-medium rounded-lg hover:bg-primary/90 min-h-[48px]">
          + Add Staff
        </button>
      </div>

      {message && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm mb-4 flex justify-between">
          {message} <button onClick={() => setMessage('')}>×</button>
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-4 flex justify-between">
          {error} <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">{editingUser ? 'Edit Staff' : 'New Staff Member'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Username *</label>
              <input value={username} onChange={e => setUsername(e.target.value)} required
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" placeholder="jake_b" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Display Name *</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} required
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" placeholder="Jake B" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">{editingUser ? 'New PIN (leave blank to keep current)' : 'PIN * (min 4 digits)'}</label>
            <input type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)}
              minLength={editingUser ? 0 : 4}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" placeholder="1234" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="px-6 py-2.5 bg-primary text-slate-900 font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 min-h-[48px]">
              {saving ? 'Saving...' : editingUser ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 text-slate-300 border border-slate-600 rounded-lg min-h-[48px]">Cancel</button>
          </div>
        </form>
      )}

      {/* Users Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-slate-400 text-center">Loading...</div>
        ) : users.length === 0 ? (
          <div className="p-6 text-slate-400 text-center">No staff members yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-slate-400 border-b border-slate-700">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Username</th>
                <th className="px-6 py-3">Points</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-slate-700/50 hover:bg-slate-750/50">
                  <td className="px-6 py-4 text-white font-medium">{user.display_name || '—'}</td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-sm">{user.username}</td>
                  <td className="px-6 py-4 text-accent font-medium">{user.points_total}</td>
                  <td className="px-6 py-4 flex gap-3">
                    <button onClick={() => openEdit(user)} className="text-sm text-accent hover:text-primary">Edit</button>
                    <button onClick={() => handleResetPin(user)} className="text-sm text-yellow-400 hover:text-yellow-300">Reset PIN</button>
                    <button onClick={() => handleDelete(user)} className="text-sm text-red-400 hover:text-red-300">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
