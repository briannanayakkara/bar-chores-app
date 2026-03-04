import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { getLocalDate } from '../../lib/date';

interface ActivityItem {
  id: string;
  delta: number;
  reason: string | null;
  created_at: string;
  profile: { display_name: string | null; avatar_url: string | null } | null;
}

export default function StaffDashboard() {
  const { profile } = useAuth();
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.venue_id) {
      setLoading(false);
      return;
    }
    loadData();

    // Realtime subscription for activity feed
    const channel = supabase
      .channel('staff-dashboard-activity')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'points_ledger',
        filter: `venue_id=eq.${profile.venue_id}`,
      }, () => {
        loadActivity();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  async function loadData() {
    await Promise.all([loadTasks(), loadActivity()]);
    setLoading(false);
  }

  async function loadTasks() {
    if (!profile?.venue_id) return;
    const today = getLocalDate();
    const { data } = await supabase.from('task_assignments')
      .select('id, status, due_date, task:tasks(title, points)')
      .eq('venue_id', profile.venue_id)
      .or(`assigned_to.eq.${profile.id},assigned_to.is.null`)
      .eq('due_date', today)
      .in('status', ['pending', 'submitted']);
    if (data) setMyTasks(data);
  }

  async function loadActivity() {
    if (!profile?.venue_id) return;
    const { data } = await supabase.from('points_ledger')
      .select('id, delta, reason, created_at, profile:profiles!points_ledger_profile_id_fkey(display_name, avatar_url)')
      .eq('venue_id', profile.venue_id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setActivity(data as unknown as ActivityItem[]);
  }

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>;

  return (
    <div className="p-4 space-y-6">
      {/* Points Card */}
      <div className="bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 rounded-2xl p-6 text-center">
        <p className="text-sm text-slate-300">My Points</p>
        <p className="text-5xl font-bold text-primary mt-1">{profile?.points_total ?? 0}</p>
      </div>

      {/* Today's Tasks */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3">Today's Tasks</h2>
        {myTasks.length === 0 ? (
          <p className="text-slate-500 text-sm">No tasks for today</p>
        ) : (
          <div className="space-y-2">
            {myTasks.map((t: any) => (
              <div key={t.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{t.task?.title}</p>
                  <p className="text-sm text-accent">+{t.task?.points} pts</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  t.status === 'submitted' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-600/20 text-slate-400'
                }`}>{t.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Feed */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3">Recent Activity</h2>
        {activity.length === 0 ? (
          <p className="text-slate-500 text-sm">No activity yet</p>
        ) : (
          <div className="space-y-2">
            {activity.map(a => (
              <div key={a.id} className="bg-slate-800/50 rounded-lg px-4 py-3 flex items-center gap-3">
                {/* Avatar */}
                {a.profile?.avatar_url ? (
                  <img src={a.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                    {(a.profile?.display_name || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">
                    <span className="font-medium">{a.profile?.display_name}</span>{' '}
                    <span className="text-slate-400">{a.reason}</span>
                  </p>
                  <p className="text-xs text-slate-500">{new Date(a.created_at).toLocaleTimeString()}</p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${a.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {a.delta > 0 ? '+' : ''}{a.delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
