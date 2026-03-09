import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { RewardTypeRow } from '../../types/database';

interface MyReward {
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
  reward_type_info: { name: string; emoji: string } | null;
}

export default function StaffRewards() {
  const { profile, refreshProfile } = useAuth();
  const [rewardTypes, setRewardTypes] = useState<RewardTypeRow[]>([]);
  const [rewards, setRewards] = useState<MyReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const pointsTotal = profile?.points_total ?? 0;
  const pendingReserved = rewards
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + (r.points_reserved || r.points_spent), 0);
  const availablePoints = pointsTotal - pendingReserved;

  async function loadRewardTypes() {
    if (!profile?.venue_id) return;
    const { data } = await supabase
      .from('reward_types')
      .select('*')
      .eq('venue_id', profile.venue_id)
      .eq('is_active', true)
      .order('points_required');
    if (data) setRewardTypes(data as RewardTypeRow[]);
  }

  async function loadRewards() {
    if (!profile) return;
    const { data } = await supabase
      .from('reward_redemptions')
      .select('*, reward_type_info:reward_types(name, emoji)')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false });
    if (data) setRewards(data as unknown as MyReward[]);
    setLoading(false);
  }

  useEffect(() => {
    loadRewardTypes();
    loadRewards();
  }, [profile]);

  // Realtime subscription for reward status changes and points updates
  useEffect(() => {
    if (!profile) return;
    const channel = supabase.channel('staff-rewards')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reward_redemptions',
        filter: `profile_id=eq.${profile.id}`,
      }, () => {
        loadRewards();
        refreshProfile();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'points_ledger',
        filter: `profile_id=eq.${profile.id}`,
      }, () => {
        refreshProfile();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  async function requestReward(type: RewardTypeRow) {
    if (!profile?.venue_id) return;
    if (availablePoints < type.points_required) { setError('Not enough points!'); return; }

    setRequesting(true); setError('');
    const tempCode = `PENDING-${Date.now()}`;
    const { error: err } = await supabase.from('reward_redemptions').insert({
      profile_id: profile.id,
      venue_id: profile.venue_id,
      reward_type_id: type.id,
      points_spent: type.points_required,
      points_reserved: type.points_required,
      quantity: 1,
      redemption_code: tempCode,
    });
    setRequesting(false);
    if (err) { setError(err.message); return; }
    setMessage(`${type.name} requested! Waiting for admin approval.`);
    loadRewards();
  }

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>;

  return (
    <div className="p-4 space-y-6">
      {/* Points Balance */}
      <div className="bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 rounded-2xl p-5 text-center">
        <p className="text-sm text-slate-300">Available Points</p>
        <p className="text-4xl font-bold text-primary">{availablePoints}</p>
        {pendingReserved > 0 && (
          <p className="text-xs text-yellow-400 mt-1">{pendingReserved} pts reserved (pending approval)</p>
        )}
      </div>

      {message && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm flex justify-between">
          {message} <button onClick={() => setMessage('')}>×</button>
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm flex justify-between">
          {error} <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Redeem Options — dynamic from reward_types */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3">Redeem Points</h2>
        {rewardTypes.length === 0 ? (
          <p className="text-slate-500 text-sm">No rewards available yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {rewardTypes.map(type => (
              <button
                key={type.id}
                onClick={() => requestReward(type)}
                disabled={requesting || availablePoints < type.points_required}
                className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-left hover:border-primary/50 transition-colors disabled:opacity-40"
              >
                <span className="text-2xl">{type.emoji}</span>
                <p className="text-white font-medium mt-2 text-sm">{type.name}</p>
                <p className="text-xs text-accent">{type.points_required.toLocaleString()} pts</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3">My Rewards</h2>
        {rewards.length === 0 ? (
          <p className="text-slate-500 text-sm">No rewards yet</p>
        ) : (
          <div className="space-y-2">
            {rewards.map(r => (
              <div key={r.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span>{r.reward_type_info?.emoji || '🎁'}</span>
                    <p className="text-white font-medium">
                      {r.reward_type_info?.name || r.reward_type || 'Reward'} x{r.quantity}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                  {r.status === 'approved' && r.redemption_code && !r.redemption_code.startsWith('PENDING') && (
                    <p className="text-sm font-mono text-accent mt-1">{r.redemption_code}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  r.status === 'approved' ? (r.used_at ? 'bg-slate-600/20 text-slate-400' : 'bg-green-500/20 text-green-400') :
                  r.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {r.used_at ? 'Used' : r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
