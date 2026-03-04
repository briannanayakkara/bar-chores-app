import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Profile } from '../../types/database';

export default function StaffLeaderboard() {
  const { profile } = useAuth();
  const [leaders, setLeaders] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadLeaderboard() {
    if (!profile?.venue_id) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('venue_id', profile.venue_id)
      .eq('role', 'staff')
      .order('points_total', { ascending: false });
    if (data) setLeaders(data as Profile[]);
    setLoading(false);
  }

  useEffect(() => { loadLeaderboard(); }, [profile]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (!profile?.venue_id) return;
    const channel = supabase
      .channel('leaderboard-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'points_ledger',
        filter: `venue_id=eq.${profile.venue_id}`,
      }, () => {
        loadLeaderboard();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  function getInitials(name: string | null) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function getMedal(rank: number) {
    if (rank === 0) return '🥇';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    return `#${rank + 1}`;
  }

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-white mb-4">Leaderboard</h1>

      {leaders.length === 0 ? (
        <p className="text-slate-500 text-center py-12">No staff members yet</p>
      ) : (
        <div className="space-y-2">
          {leaders.map((leader, idx) => {
            const isMe = leader.id === profile?.id;
            return (
              <div key={leader.id}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                  isMe
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-slate-800 border-slate-700'
                }`}>
                {/* Rank */}
                <div className="w-10 text-center text-lg font-bold">
                  {typeof getMedal(idx) === 'string' && getMedal(idx).startsWith('#')
                    ? <span className="text-slate-400 text-sm">{getMedal(idx)}</span>
                    : <span>{getMedal(idx)}</span>
                  }
                </div>

                {/* Avatar */}
                {leader.avatar_url ? (
                  <img src={leader.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${
                    isMe ? 'bg-primary/30 text-primary' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {getInitials(leader.display_name)}
                  </div>
                )}

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isMe ? 'text-primary' : 'text-white'}`}>
                    {leader.display_name || leader.username}
                    {isMe && <span className="text-xs ml-2 opacity-70">(You)</span>}
                  </p>
                </div>

                {/* Points */}
                <div className="text-right">
                  <p className={`text-xl font-bold ${isMe ? 'text-primary' : 'text-accent'}`}>
                    {leader.points_total}
                  </p>
                  <p className="text-xs text-slate-400">pts</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
