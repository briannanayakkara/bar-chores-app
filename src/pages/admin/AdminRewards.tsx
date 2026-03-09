import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import EmojiPicker from '../../components/shared/EmojiPicker';
import type { RewardTypeRow } from '../../types/database';

interface RewardRow {
  id: string;
  reward_type: string | null;
  reward_type_id: string | null;
  points_spent: number;
  points_reserved: number;
  quantity: number;
  status: string;
  redemption_code: string;
  used_at: string | null;
  created_at: string;
  redeemer: { display_name: string | null; username: string | null } | null;
  reward_type_info: { name: string; emoji: string } | null;
}

function generateCode(typeName: string) {
  const prefix = typeName.replace(/[^A-Z]/gi, '').slice(0, 3).toUpperCase() || 'RWD';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${code}`;
}

export default function AdminRewards() {
  const { profile } = useAuth();
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [message, setMessage] = useState('');
  const [rewardTypes, setRewardTypes] = useState<RewardTypeRow[]>([]);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editingType, setEditingType] = useState<RewardTypeRow | null>(null);
  const [typeName, setTypeName] = useState('');
  const [typeEmoji, setTypeEmoji] = useState('');
  const [typePoints, setTypePoints] = useState(0);

  const venueId = profile?.venue_id;

  async function loadRewardTypes() {
    if (!venueId) return;
    const { data } = await supabase
      .from('reward_types')
      .select('*')
      .eq('venue_id', venueId)
      .order('points_required');
    if (data) setRewardTypes(data as RewardTypeRow[]);
  }

  async function loadRewards() {
    if (!venueId) { setLoading(false); return; }
    const { data } = await supabase
      .from('reward_redemptions')
      .select('*, redeemer:profiles!reward_redemptions_profile_id_fkey(display_name, username), reward_type_info:reward_types(name, emoji)')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });
    if (data) setRewards(data as unknown as RewardRow[]);
    setLoading(false);
  }

  useEffect(() => { loadRewards(); loadRewardTypes(); }, [venueId]);

  async function handleSaveType(e: React.FormEvent) {
    e.preventDefault();
    if (!venueId) return;
    if (editingType) {
      const { error } = await supabase.from('reward_types').update({
        name: typeName, emoji: typeEmoji, points_required: typePoints,
      }).eq('id', editingType.id);
      if (error) { setMessage(`Error updating: ${error.message}`); return; }
      setMessage(`Updated "${typeName}"`);
    } else {
      const { error } = await supabase.from('reward_types').insert({
        venue_id: venueId, name: typeName, emoji: typeEmoji, points_required: typePoints,
      });
      if (error) { setMessage(`Error creating: ${error.message}`); return; }
      setMessage(`Created "${typeName}"`);
    }
    setShowTypeForm(false); setEditingType(null);
    setTypeName(''); setTypeEmoji(''); setTypePoints(0);
    loadRewardTypes();
  }

  async function toggleTypeActive(type: RewardTypeRow) {
    await supabase.from('reward_types').update({ is_active: !type.is_active }).eq('id', type.id);
    loadRewardTypes();
  }

  async function deleteType(type: RewardTypeRow) {
    if (!confirm(`Delete "${type.name}"?`)) return;
    const { error: err } = await supabase.from('reward_types').delete().eq('id', type.id);
    if (err) { setMessage(`Cannot delete: ${err.message}`); return; }
    setMessage(`Deleted "${type.name}"`); loadRewardTypes();
  }

  async function handleApprove(reward: RewardRow) {
    if (!profile || !venueId) return;
    const typeName = reward.reward_type_info?.name || reward.reward_type || 'Reward';
    const code = generateCode(typeName);
    await supabase.from('reward_redemptions').update({
      status: 'approved',
      redemption_code: code,
      approved_by: profile.id,
      resolved_at: new Date().toISOString(),
      resolved_by: profile.id,
    }).eq('id', reward.id);

    const { data: fullReward } = await supabase.from('reward_redemptions').select('profile_id, points_reserved').eq('id', reward.id).single();
    if (fullReward) {
      const pointsToDeduct = fullReward.points_reserved || reward.points_spent;
      await supabase.from('points_ledger').insert({
        profile_id: fullReward.profile_id,
        venue_id: venueId,
        delta: -pointsToDeduct,
        reason: `Redeemed: ${typeName} x${reward.quantity}`,
        created_by: profile.id,
      });
    }

    setMessage(`Approved! Code: ${code}`);
    loadRewards();
  }

  async function handleReject(reward: RewardRow) {
    if (!profile) return;
    await supabase.from('reward_redemptions').update({
      status: 'rejected',
      resolved_at: new Date().toISOString(),
      resolved_by: profile.id,
    }).eq('id', reward.id);
    setMessage('Rejected — points released.');
    loadRewards();
  }

  async function markUsed(reward: RewardRow) {
    await supabase.from('reward_redemptions').update({ used_at: new Date().toISOString() }).eq('id', reward.id);
    setMessage('Marked as used.');
    loadRewards();
  }

  const filtered = filter === 'all' ? rewards : rewards.filter(r => r.status === filter);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Rewards Management</h1>

      {message && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm mb-4 flex justify-between">
          {message} <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      {/* Reward Types Management */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Reward Types</h2>
          <button onClick={() => { setShowTypeForm(true); setEditingType(null); setTypeName(''); setTypeEmoji(''); setTypePoints(0); }}
            className="px-3 py-1.5 text-sm bg-primary text-slate-900 rounded-lg hover:bg-primary/90 min-h-[36px]">
            + Add Type
          </button>
        </div>

        {showTypeForm && (
          <form onSubmit={handleSaveType} className="bg-slate-700/50 rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Name *</label>
                <input value={typeName} onChange={e => setTypeName(e.target.value)} required
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary" placeholder="Hoodie" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Emoji</label>
                <EmojiPicker value={typeEmoji} onChange={setTypeEmoji} />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Points *</label>
                <input type="number" value={typePoints} onChange={e => setTypePoints(Number(e.target.value))} min={1} required
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-primary text-slate-900 text-sm rounded-lg min-h-[36px]">
                {editingType ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowTypeForm(false)} className="px-4 py-2 text-slate-300 border border-slate-600 text-sm rounded-lg min-h-[36px]">Cancel</button>
            </div>
          </form>
        )}

        {rewardTypes.length === 0 ? (
          <p className="text-slate-500 text-sm">No reward types configured.</p>
        ) : (
          <div className="space-y-2">
            {rewardTypes.map(type => (
              <div key={type.id} className={`flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0 ${!type.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{type.emoji}</span>
                  <div>
                    <p className="text-white text-sm font-medium">{type.name}</p>
                    <p className="text-xs text-accent">{type.points_required} pts</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingType(type); setTypeName(type.name); setTypeEmoji(type.emoji); setTypePoints(type.points_required); setShowTypeForm(true); }}
                    className="text-xs text-accent hover:text-primary">Edit</button>
                  <button onClick={() => toggleTypeActive(type)}
                    className="text-xs text-yellow-400 hover:text-yellow-300">{type.is_active ? 'Disable' : 'Enable'}</button>
                  <button onClick={() => deleteType(type)}
                    className="text-xs text-red-400 hover:text-red-300">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {['pending', 'approved', 'rejected', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${filter === f ? 'bg-primary text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-slate-400 text-center">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-slate-400 text-center">No rewards found.</div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {filtered.map(r => (
              <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{r.reward_type_info?.emoji || (r.reward_type === 'drink_ticket' ? '🍺' : '🍾')}</span>
                    <p className="text-white font-medium">
                      {r.reward_type_info?.name || (r.reward_type === 'drink_ticket' ? 'Drink' : 'Bottle')} Ticket x{r.quantity}
                    </p>
                  </div>
                  <p className="text-sm text-slate-400">
                    {r.redeemer?.display_name || r.redeemer?.username} · {r.points_spent} pts · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  {r.status === 'approved' && r.redemption_code && (
                    <p className="text-sm font-mono text-accent mt-1">Code: {r.redemption_code} {r.used_at ? '(USED)' : ''}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    r.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    r.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>{r.status}</span>
                  {r.status === 'pending' && (
                    <>
                      <button onClick={() => handleApprove(r)} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg min-h-[36px]">Approve</button>
                      <button onClick={() => handleReject(r)} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg min-h-[36px]">Reject</button>
                    </>
                  )}
                  {r.status === 'approved' && !r.used_at && (
                    <button onClick={() => markUsed(r)} className="px-3 py-1.5 bg-slate-600 text-white text-sm rounded-lg min-h-[36px]">Mark Used</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
