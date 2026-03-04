import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface RewardRow {
  id: string;
  reward_type: string;
  points_spent: number;
  quantity: number;
  status: string;
  redemption_code: string;
  used_at: string | null;
  created_at: string;
  redeemer: { display_name: string | null; username: string | null } | null;
}

function generateCode(type: string) {
  const prefix = type === 'drink_ticket' ? 'DRK' : 'BTL';
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

  const venueId = profile?.venue_id;

  async function loadRewards() {
    if (!venueId) { setLoading(false); return; }
    const { data } = await supabase
      .from('reward_redemptions')
      .select('*, redeemer:profiles!reward_redemptions_profile_id_fkey(display_name, username)')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });
    if (data) setRewards(data as unknown as RewardRow[]);
    setLoading(false);
  }

  useEffect(() => { loadRewards(); }, [venueId]);

  async function handleApprove(reward: RewardRow) {
    if (!profile || !venueId) return;
    const code = generateCode(reward.reward_type);
    await supabase.from('reward_redemptions').update({
      status: 'approved',
      redemption_code: code,
      approved_by: profile.id,
    }).eq('id', reward.id);

    // Deduct points
    const { data: fullReward } = await supabase.from('reward_redemptions').select('profile_id').eq('id', reward.id).single();
    if (fullReward) {
      await supabase.from('points_ledger').insert({
        profile_id: fullReward.profile_id,
        venue_id: venueId,
        delta: -reward.points_spent,
        reason: `Redeemed: ${reward.reward_type === 'drink_ticket' ? 'Drink' : 'Bottle'} Ticket x${reward.quantity}`,
        created_by: profile.id,
      });
    }

    setMessage(`Approved! Code: ${code}`);
    loadRewards();
  }

  async function handleReject(reward: RewardRow) {
    await supabase.from('reward_redemptions').update({ status: 'rejected' }).eq('id', reward.id);
    setMessage('Rejected.');
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
                    <span className="text-lg">{r.reward_type === 'drink_ticket' ? '🍺' : '🍾'}</span>
                    <p className="text-white font-medium">
                      {r.reward_type === 'drink_ticket' ? 'Drink' : 'Bottle'} Ticket x{r.quantity}
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
