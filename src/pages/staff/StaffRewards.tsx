import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface MyReward {
  id: string;
  reward_type: string;
  points_spent: number;
  quantity: number;
  status: string;
  redemption_code: string;
  used_at: string | null;
  created_at: string;
}

export default function StaffRewards() {
  const { profile } = useAuth();
  const [rewards, setRewards] = useState<MyReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const points = profile?.points_total ?? 0;
  const hasPendingReward = rewards.some(r => r.status === 'pending');

  async function loadRewards() {
    if (!profile) return;
    const { data } = await supabase
      .from('reward_redemptions')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false });
    if (data) setRewards(data as MyReward[]);
    setLoading(false);
  }

  useEffect(() => { loadRewards(); }, [profile]);

  async function requestReward(type: 'drink_ticket' | 'bottle_ticket', qty: number) {
    if (!profile?.venue_id) return;
    const cost = type === 'drink_ticket' ? 100 * qty : 1000 * qty;
    if (points < cost) { setError('Not enough points!'); return; }

    setRequesting(true); setError('');
    const tempCode = `PENDING-${Date.now()}`;
    const { error: err } = await supabase.from('reward_redemptions').insert({
      profile_id: profile.id,
      venue_id: profile.venue_id,
      reward_type: type,
      points_spent: cost,
      quantity: qty,
      redemption_code: tempCode,
    });
    setRequesting(false);
    if (err) { setError(err.message); return; }
    setMessage('Reward requested! Waiting for admin approval.');
    loadRewards();
  }

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>;

  return (
    <div className="p-4 space-y-6">
      {/* Points Balance */}
      <div className="bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 rounded-2xl p-5 text-center">
        <p className="text-sm text-slate-300">Available Points</p>
        <p className="text-4xl font-bold text-primary">{points}</p>
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

      {/* Redeem Options */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3">Redeem Points</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => requestReward('drink_ticket', 1)}
            disabled={requesting || points < 100 || hasPendingReward}
            className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-left hover:border-primary/50 transition-colors disabled:opacity-40"
          >
            <span className="text-3xl">🍺</span>
            <p className="text-white font-medium mt-2">Drink Ticket</p>
            <p className="text-sm text-accent">100 points</p>
            {hasPendingReward && <p className="text-xs text-yellow-400 mt-1">Pending request...</p>}
          </button>
          <button
            onClick={() => requestReward('bottle_ticket', 1)}
            disabled={requesting || points < 1000 || hasPendingReward}
            className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-left hover:border-primary/50 transition-colors disabled:opacity-40"
          >
            <span className="text-3xl">🍾</span>
            <p className="text-white font-medium mt-2">Bottle Ticket</p>
            <p className="text-sm text-accent">1,000 points</p>
            {hasPendingReward && <p className="text-xs text-yellow-400 mt-1">Pending request...</p>}
          </button>
        </div>
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
                    <span>{r.reward_type === 'drink_ticket' ? '🍺' : '🍾'}</span>
                    <p className="text-white font-medium">
                      {r.reward_type === 'drink_ticket' ? 'Drink' : 'Bottle'} x{r.quantity}
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
