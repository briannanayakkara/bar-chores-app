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

  // Staff form state
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Admin invite state
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [inviting, setInviting] = useState(false);

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

  async function loadAdmins() {
    if (!venueId) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('venue_id', venueId)
      .eq('role', 'venue_admin')
      .order('display_name');
    if (data) setAdmins(data as Profile[]);
  }

  useEffect(() => { loadUsers(); loadAdmins(); }, [venueId]);

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

  async function handleInviteAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!venueId) return;
    setInviting(true); setError('');

    const { error: err } = await adminAction('invite-admin', {
      email: inviteEmail,
      display_name: inviteDisplayName,
      venue_id: venueId,
    });

    if (err) { setError(err); }
    else {
      setMessage(`Invite sent to ${inviteEmail}`);
      setInviteEmail(''); setInviteDisplayName('');
      setShowInviteForm(false);
      loadAdmins();
    }
    setInviting(false);
  }

  async function handleResendAdminInvite(admin: Profile) {
    setError(''); setMessage('');
    const { error: err } = await adminAction('resend-invite', { user_id: admin.id });
    if (err) { setError(err); } else { setMessage(`Invite resent to ${admin.email}`); }
  }

  async function handleCancelAdminInvite(admin: Profile) {
    if (!confirm(`Cancel invite for "${admin.display_name || admin.email}"?`)) return;
    setError(''); setMessage('');
    const { error: err } = await adminAction('cancel-invite', { user_id: admin.id });
    if (err) { setError(err); } else { setMessage('Invite cancelled'); loadAdmins(); }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
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

      {/* Venue Admins Section */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Venue Admins</h2>
          <button
            onClick={() => { setShowInviteForm(!showInviteForm); setError(''); }}
            className="px-3 py-1.5 text-sm text-green-400 hover:text-green-300 border border-green-400/30 rounded-lg transition-colors"
          >
            Invite Admin
          </button>
        </div>

        {showInviteForm && (
          <form onSubmit={handleInviteAdmin} className="bg-slate-700/50 rounded-lg p-4 mb-4 space-y-3">
            <p className="text-sm text-slate-400">An email invitation will be sent. The admin sets their own password.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Email *</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" placeholder="admin@venue.com" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Display Name *</label>
                <input value={inviteDisplayName} onChange={e => setInviteDisplayName(e.target.value)} required
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" placeholder="Jane Smith" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={inviting} className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-500 disabled:opacity-50 min-h-[48px]">
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
              <button type="button" onClick={() => setShowInviteForm(false)} className="px-4 py-2 text-slate-300 border border-slate-600 rounded-lg min-h-[48px]">Cancel</button>
            </div>
          </form>
        )}

        {admins.length === 0 ? (
          <p className="text-slate-500 text-sm">No other admins for this venue.</p>
        ) : (
          <div className="space-y-2">
            {admins.map(admin => (
              <div key={admin.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold">
                    {(admin.display_name || admin.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-white text-sm font-medium">{admin.display_name || 'Unnamed'}</span>
                    <span className="text-slate-400 text-sm ml-2">{admin.email}</span>
                    {admin.status === 'pending' && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">Pending</span>
                    )}
                  </div>
                </div>
                {admin.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleResendAdminInvite(admin)} className="text-xs text-accent hover:text-primary">Resend</button>
                    <button onClick={() => handleCancelAdminInvite(admin)} className="text-xs text-red-400 hover:text-red-300">Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Staff Table */}
      <h2 className="text-lg font-semibold text-white mb-4">Staff Members</h2>
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
