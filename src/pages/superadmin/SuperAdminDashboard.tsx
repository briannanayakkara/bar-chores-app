import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { adminAction } from '../../lib/admin-api';
import { logger } from '../../lib/logger';
import type { Venue, Profile } from '../../types/database';

interface VenueWithAdmins extends Venue {
  admins: Profile[];
}

export default function SuperAdminDashboard() {
  const { logout } = useAuth();
  const [venues, setVenues] = useState<VenueWithAdmins[]>([]);
  const [loading, setLoading] = useState(true);

  // Create venue form
  const [showCreate, setShowCreate] = useState(false);
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueSlug, setVenueSlug] = useState('');
  const [creating, setCreating] = useState(false);

  // Assign admin form
  const [assignVenueId, setAssignVenueId] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadVenues() {
    logger.api('Loading venues...');

    const { data: venueData, error: err } = await supabase.from('venues').select('*').order('created_at', { ascending: false });
    if (err) {
      logger.error('loadVenues failed', { message: err.message, code: err.code });
    }
    if (!venueData) { setLoading(false); return; }

    // Load admins for each venue
    const { data: admins } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'venue_admin');

    const venuesWithAdmins: VenueWithAdmins[] = venueData.map(v => ({
      ...v as Venue,
      admins: (admins || []).filter(a => a.venue_id === v.id) as Profile[],
    }));

    setVenues(venuesWithAdmins);
    setLoading(false);
  }

  useEffect(() => { loadVenues(); }, []);

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function handleCreateVenue(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    const slug = venueSlug || autoSlug(venueName);

    logger.api('INSERT venues', { name: venueName, slug, address: venueAddress || null });
    const { error: err } = await supabase.from('venues').insert({ name: venueName, address: venueAddress || null, slug });

    if (err) {
      logger.error('Venue insert failed', { message: err.message, code: err.code });
      setError(`${err.message} (code: ${err.code})`);
    } else {
      setMessage(`Venue "${venueName}" created!`);
      setVenueName(''); setVenueAddress(''); setVenueSlug('');
      setShowCreate(false);
      loadVenues();
    }
    setCreating(false);
  }

  async function handleDeleteVenue(venue: VenueWithAdmins) {
    if (!confirm(`Delete "${venue.name}" and ALL its data (staff, tasks, assignments, points)? This cannot be undone.`)) return;
    setError('');
    logger.api('Deleting venue', { id: venue.id, name: venue.name });

    // Delete in FK order
    for (const table of ['reward_redemptions', 'points_ledger', 'task_assignments', 'tasks']) {
      const { error: err } = await supabase.from(table).delete().eq('venue_id', venue.id);
      if (err) logger.error(`Failed to delete ${table}`, err.message);
    }

    // Delete profiles (staff + admins) in this venue
    const { data: venueProfiles } = await supabase.from('profiles').select('id').eq('venue_id', venue.id);
    if (venueProfiles) {
      for (const p of venueProfiles) {
        await supabase.from('profiles').delete().eq('id', p.id);
      }
    }

    await supabase.from('venue_settings').delete().eq('venue_id', venue.id);

    const { error: venueErr } = await supabase.from('venues').delete().eq('id', venue.id);
    if (venueErr) {
      logger.error('Venue delete failed', venueErr.message);
      setError(`Delete failed: ${venueErr.message}`);
    } else {
      setMessage(`Deleted "${venue.name}"`);
    }
    loadVenues();
  }

  async function handleDeleteAdmin(admin: Profile) {
    if (!confirm(`Remove admin "${admin.display_name || admin.email}"?`)) return;
    setError('');

    const { error: err } = await supabase.from('profiles').delete().eq('id', admin.id);
    if (err) {
      setError(`Delete failed: ${err.message}`);
    } else {
      setMessage(`Removed admin "${admin.display_name || admin.email}"`);
    }
    loadVenues();
  }

  async function handleAssignAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!assignVenueId || !adminPassword) return;
    setAssigning(true);
    setError('');
    setMessage('');

    logger.api('Creating admin via Edge Function', { email: adminEmail, venueId: assignVenueId });

    const { error: err } = await adminAction('create-admin', {
      email: adminEmail,
      password: adminPassword,
      display_name: adminDisplayName,
      venue_id: assignVenueId,
    });

    if (err) {
      logger.error('Admin creation failed', err);
      setError(err);
    } else {
      logger.api('Admin created OK');
      setMessage(`Admin "${adminEmail}" created. They can login at /login`);
      setAdminEmail(''); setAdminDisplayName(''); setAdminPassword('');
      setAssignVenueId(null);
      loadVenues();
    }
    setAssigning(false);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-700">
        <div>
          <h1 className="text-xl font-bold text-primary">Super Admin</h1>
          <p className="text-xs text-slate-400">Venue management</p>
        </div>
        <button onClick={logout} className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
          Sign Out
        </button>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Messages */}
        {message && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm flex justify-between items-center">
            {message}
            <button onClick={() => setMessage('')} className="text-green-400 hover:text-green-300 ml-4">×</button>
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm flex justify-between items-center">
            {error}
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 ml-4">×</button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => { setShowCreate(!showCreate); setAssignVenueId(null); }}
            className="px-4 py-2.5 bg-primary text-slate-900 font-medium rounded-lg hover:bg-primary/90 transition-colors min-h-[48px]"
          >
            + New Venue
          </button>
        </div>

        {/* Create Venue Form */}
        {showCreate && (
          <form onSubmit={handleCreateVenue} className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Create New Venue</h2>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Venue Name *</label>
              <input
                value={venueName}
                onChange={e => { setVenueName(e.target.value); if (!venueSlug) setVenueSlug(''); }}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary"
                placeholder="The Anchor Bar"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Address</label>
              <input
                value={venueAddress}
                onChange={e => setVenueAddress(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary"
                placeholder="123 Main St"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Slug (auto-generated if empty)</label>
              <input
                value={venueSlug || autoSlug(venueName)}
                onChange={e => setVenueSlug(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary"
                placeholder="the-anchor-bar"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={creating} className="px-6 py-2.5 bg-primary text-slate-900 font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 min-h-[48px]">
                {creating ? 'Creating...' : 'Create Venue'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-2.5 text-slate-300 hover:text-white border border-slate-600 rounded-lg min-h-[48px]">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Assign Admin Form */}
        {assignVenueId && (
          <form onSubmit={handleAssignAdmin} className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">
              Add Admin to {venues.find(v => v.id === assignVenueId)?.name}
            </h2>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Admin Email *</label>
              <input
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary"
                placeholder="admin@venue.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Display Name *</label>
              <input
                value={adminDisplayName}
                onChange={e => setAdminDisplayName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary"
                placeholder="Jane Smith"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Password *</label>
              <input
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary"
                placeholder="Min 6 characters"
                minLength={6}
                required
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={assigning} className="px-6 py-2.5 bg-primary text-slate-900 font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 min-h-[48px]">
                {assigning ? 'Creating...' : 'Create Admin'}
              </button>
              <button type="button" onClick={() => setAssignVenueId(null)} className="px-6 py-2.5 text-slate-300 hover:text-white border border-slate-600 rounded-lg min-h-[48px]">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Venues List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">All Venues</h2>
          {loading ? (
            <div className="p-6 text-slate-400 text-center">Loading...</div>
          ) : venues.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-slate-400 text-center">
              No venues yet. Create your first venue above.
            </div>
          ) : (
            venues.map(venue => (
              <div key={venue.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                {/* Venue header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
                  <div>
                    <h3 className="text-white font-semibold text-lg">{venue.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                      <span className="font-mono">{venue.slug}</span>
                      {venue.address && <span>{venue.address}</span>}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setAssignVenueId(venue.id); setShowCreate(false); }}
                      className="px-3 py-1.5 text-sm text-accent hover:text-primary border border-accent/30 rounded-lg transition-colors"
                    >
                      + Add Admin
                    </button>
                    <button
                      onClick={() => handleDeleteVenue(venue)}
                      className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 border border-red-400/30 rounded-lg transition-colors"
                    >
                      Delete Venue
                    </button>
                  </div>
                </div>

                {/* Admins list */}
                <div className="px-6 py-3">
                  {venue.admins.length === 0 ? (
                    <p className="text-slate-500 text-sm py-2">No admins assigned yet</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Admins</p>
                      {venue.admins.map(admin => (
                        <div key={admin.id} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold">
                              {(admin.display_name || admin.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="text-white text-sm font-medium">{admin.display_name || 'Unnamed'}</span>
                              <span className="text-slate-400 text-sm ml-2">{admin.email}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteAdmin(admin)}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
