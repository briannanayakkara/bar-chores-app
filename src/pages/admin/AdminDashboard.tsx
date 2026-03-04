import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { getLocalDate } from '../../lib/date';

interface AssignmentEntry {
  id: string;
  status: string;
  due_date: string;
  completed_at: string | null;
  photo_url: string | null;
  task: { title: string; points: number } | null;
  assignee: { display_name: string | null; username: string | null } | null;
}

interface PerformerStats {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  tasks_completed: number;
  points_earned: number;
  points_total: number;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ staff: 0, pendingApprovals: 0, tasksToday: 0, pointsToday: 0 });
  const [loading, setLoading] = useState(true);

  // Calendar state
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [calendarData, setCalendarData] = useState<Record<string, AssignmentEntry[]>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Performance rankings
  const [performers, setPerformers] = useState<PerformerStats[]>([]);
  const [perfRange, setPerfRange] = useState<'today' | 'week' | 'month' | 'all'>('week');

  // Recent completions
  const [recentCompletions, setRecentCompletions] = useState<AssignmentEntry[]>([]);

  useEffect(() => {
    if (!profile?.venue_id) {
      setLoading(false);
      return;
    }
    loadStats();
    loadCalendar();
    loadRecentCompletions();
  }, [profile]);

  useEffect(() => {
    if (!profile?.venue_id) return;
    loadCalendar();
  }, [weekStart]);

  useEffect(() => {
    if (!profile?.venue_id) return;
    loadPerformers();
  }, [profile, perfRange]);

  async function loadStats() {
    const venueId = profile!.venue_id!;
    const today = getLocalDate();

    const [staffRes, pendingRes, todayTasksRes, pointsRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).eq('role', 'staff'),
      supabase.from('task_assignments').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).eq('status', 'submitted'),
      supabase.from('task_assignments').select('id', { count: 'exact', head: true }).eq('venue_id', venueId).eq('due_date', today),
      supabase.from('points_ledger').select('delta').eq('venue_id', venueId).gte('created_at', today + 'T00:00:00'),
    ]);

    const pointsToday = (pointsRes.data || []).reduce((sum, r) => sum + (r.delta > 0 ? r.delta : 0), 0);

    setStats({
      staff: staffRes.count || 0,
      pendingApprovals: pendingRes.count || 0,
      tasksToday: todayTasksRes.count || 0,
      pointsToday,
    });
    setLoading(false);
  }

  async function loadCalendar() {
    const venueId = profile!.venue_id!;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const startStr = getLocalDate(weekStart);
    const endStr = getLocalDate(weekEnd);

    const { data } = await supabase
      .from('task_assignments')
      .select('id, status, due_date, completed_at, photo_url, task:tasks(title, points), assignee:profiles!task_assignments_assigned_to_fkey(display_name, username)')
      .eq('venue_id', venueId)
      .gte('due_date', startStr)
      .lte('due_date', endStr)
      .order('due_date', { ascending: true });

    const grouped: Record<string, AssignmentEntry[]> = {};
    for (const entry of (data || []) as unknown as AssignmentEntry[]) {
      const date = entry.due_date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(entry);
    }
    setCalendarData(grouped);
  }

  async function loadPerformers() {
    const venueId = profile!.venue_id!;

    // Get staff profiles with total points
    const { data: staffProfiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, points_total')
      .eq('venue_id', venueId)
      .eq('role', 'staff');

    const statsMap: Record<string, PerformerStats> = {};
    for (const p of staffProfiles || []) {
      statsMap[p.id] = { id: p.id, display_name: p.display_name, avatar_url: p.avatar_url, tasks_completed: 0, points_earned: 0, points_total: p.points_total || 0 };
    }

    if (perfRange === 'all') {
      // For "all time", use the stored points_total
      for (const id in statsMap) {
        statsMap[id].points_earned = statsMap[id].points_total;
      }
      // Count all approved tasks
      const { data: completions } = await supabase
        .from('task_assignments')
        .select('assigned_to')
        .eq('venue_id', venueId)
        .eq('status', 'approved');
      for (const c of completions || []) {
        if (c.assigned_to && statsMap[c.assigned_to]) {
          statsMap[c.assigned_to].tasks_completed += 1;
        }
      }
    } else {
      const now = new Date();
      let startDate: string;

      if (perfRange === 'today') {
        startDate = getLocalDate(now) + 'T00:00:00';
      } else if (perfRange === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - d.getDay() + 1);
        startDate = getLocalDate(d) + 'T00:00:00';
      } else {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate = getLocalDate(d) + 'T00:00:00';
      }

      const { data: points } = await supabase
        .from('points_ledger')
        .select('profile_id, delta')
        .eq('venue_id', venueId)
        .gte('created_at', startDate)
        .gt('delta', 0);

      const { data: completions } = await supabase
        .from('task_assignments')
        .select('assigned_to')
        .eq('venue_id', venueId)
        .eq('status', 'approved')
        .gte('completed_at', startDate);

      for (const pt of points || []) {
        if (statsMap[pt.profile_id]) {
          statsMap[pt.profile_id].points_earned += pt.delta;
        }
      }
      for (const c of completions || []) {
        if (c.assigned_to && statsMap[c.assigned_to]) {
          statsMap[c.assigned_to].tasks_completed += 1;
        }
      }
    }

    const sorted = Object.values(statsMap).sort((a, b) => b.points_earned - a.points_earned);
    setPerformers(sorted);
  }

  async function loadRecentCompletions() {
    const venueId = profile!.venue_id!;
    const { data } = await supabase
      .from('task_assignments')
      .select('id, status, due_date, completed_at, photo_url, task:tasks(title, points), assignee:profiles!task_assignments_assigned_to_fkey(display_name, username)')
      .eq('venue_id', venueId)
      .eq('status', 'submitted')
      .order('completed_at', { ascending: false })
      .limit(5);
    if (data) setRecentCompletions(data as unknown as AssignmentEntry[]);
  }

  function getWeekDays() {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }

  function prevWeek() { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); setSelectedDay(null); }
  function nextWeek() { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); setSelectedDay(null); }
  function goToday() {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0, 0, 0, 0);
    setWeekStart(d); setSelectedDay(null);
  }

  function getWeekLabel() {
    const start = weekStart;
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en', opts)} — ${end.toLocaleDateString('en', { ...opts, year: 'numeric' })}`;
  }

  // Week summary stats
  function getWeekSummary() {
    let totalTasks = 0, completedTasks = 0, totalPts = 0;
    for (const entries of Object.values(calendarData)) {
      totalTasks += entries.length;
      for (const e of entries) {
        if (e.status === 'approved') { completedTasks++; totalPts += e.task?.points || 0; }
        if (e.status === 'submitted') { completedTasks++; }
      }
    }
    return { totalTasks, completedTasks, totalPts };
  }

  function statusColor(status: string) {
    switch (status) {
      case 'approved': return 'text-green-400 bg-green-500/20';
      case 'submitted': return 'text-yellow-400 bg-yellow-500/20';
      case 'rejected': return 'text-red-400 bg-red-500/20';
      default: return 'text-slate-400 bg-slate-600/20';
    }
  }

  function statusDot(status: string) {
    switch (status) {
      case 'approved': return 'bg-green-400';
      case 'submitted': return 'bg-yellow-400';
      case 'rejected': return 'bg-red-400';
      default: return 'bg-slate-500';
    }
  }

  const today = getLocalDate();
  const weekSummary = getWeekSummary();

  const cards = [
    { label: 'Active Staff', value: stats.staff, color: 'text-primary', link: '/admin/users' },
    { label: 'Pending Approvals', value: stats.pendingApprovals, color: 'text-yellow-400', link: '/admin/assignments' },
    { label: 'Tasks Today', value: stats.tasksToday, color: 'text-green-400', link: '/admin/tasks' },
    { label: 'Points Awarded Today', value: stats.pointsToday, color: 'text-accent', link: '/admin/assignments' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {loading ? (
        <div className="text-slate-400">Loading stats...</div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map(card => (
              <Link key={card.label} to={card.link}
                className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-colors">
                <p className="text-sm text-slate-400 mb-1">{card.label}</p>
                <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
              </Link>
            ))}
          </div>

          {/* Pending Photo Reviews */}
          {recentCompletions.length > 0 && (
            <div className="bg-slate-800 border border-yellow-500/30 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-yellow-400 mb-3">Pending Reviews</h2>
              <div className="space-y-2">
                {recentCompletions.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-4 py-3">
                    <div>
                      <p className="text-white text-sm font-medium">{c.task?.title}</p>
                      <p className="text-xs text-slate-400">{c.assignee?.display_name || c.assignee?.username} · {c.due_date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.photo_url && <span className="text-xs text-accent">Has photo</span>}
                      <Link to="/admin/assignments" className="text-xs text-primary hover:underline">Review</Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Rankings */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold text-white">Top Performers</h2>
              <div className="flex gap-1 flex-wrap">
                {(['today', 'week', 'month', 'all'] as const).map(r => (
                  <button key={r} onClick={() => setPerfRange(r)}
                    className={`px-3 py-1 rounded-lg text-xs capitalize ${perfRange === r ? 'bg-primary text-slate-900' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
                    {r === 'today' ? 'Today' : r === 'week' ? 'This Week' : r === 'month' ? 'This Month' : 'All Time'}
                  </button>
                ))}
              </div>
            </div>
            {performers.length === 0 ? (
              <p className="text-slate-500 text-sm">No staff members yet</p>
            ) : performers.every(p => p.points_earned === 0 && p.tasks_completed === 0) ? (
              <p className="text-slate-500 text-sm">No activity {perfRange === 'today' ? 'today' : perfRange === 'week' ? 'this week' : perfRange === 'month' ? 'this month' : ''} yet</p>
            ) : (
              <div className="space-y-2">
                {performers.map((p, i) => (
                  <div key={p.id} className={`flex items-center gap-3 rounded-lg px-4 py-3 ${p.points_earned > 0 || p.tasks_completed > 0 ? 'bg-slate-700/30' : 'bg-slate-700/10 opacity-50'}`}>
                    <span className={`text-lg font-bold w-6 ${i === 0 && p.points_earned > 0 ? 'text-yellow-400' : i === 1 && p.points_earned > 0 ? 'text-slate-300' : i === 2 && p.points_earned > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                      {i + 1}
                    </span>
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">
                        {(p.display_name || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{p.display_name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400">{p.tasks_completed} task{p.tasks_completed !== 1 ? 's' : ''} completed</p>
                    </div>
                    <span className="text-accent font-bold">{p.points_earned} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weekly Calendar */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <h2 className="text-lg font-semibold text-white">Weekly Calendar</h2>
              <div className="flex items-center gap-2">
                <button onClick={prevWeek} className="px-2 py-1 text-slate-400 hover:text-white bg-slate-700 rounded min-h-[32px]">←</button>
                <button onClick={goToday} className="px-3 py-1 text-xs text-slate-300 hover:text-white bg-slate-700 rounded min-h-[32px]">Today</button>
                <button onClick={nextWeek} className="px-2 py-1 text-slate-400 hover:text-white bg-slate-700 rounded min-h-[32px]">→</button>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-1">{getWeekLabel()}</p>
            <div className="flex gap-4 text-xs text-slate-500 mb-4">
              <span>{weekSummary.totalTasks} assigned</span>
              <span>{weekSummary.completedTasks} done</span>
              <span>{weekSummary.totalPts} pts earned</span>
            </div>

            {/* Legend */}
            <div className="flex gap-3 mb-3 text-xs flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500"></span> Pending</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> Submitted</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span> Approved</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span> Rejected</span>
            </div>

            <div className="overflow-x-auto -mx-5 px-5 pb-2 scrollbar-thin">
            <div className="grid grid-cols-7 gap-2" style={{ minWidth: '540px' }}>
              {getWeekDays().map(day => {
                const dateStr = getLocalDate(day);
                const dayEntries = calendarData[dateStr] || [];
                const isToday = dateStr === today;
                const isSelected = selectedDay === dateStr;
                const approved = dayEntries.filter(e => e.status === 'approved').length;
                const submitted = dayEntries.filter(e => e.status === 'submitted').length;
                const pending = dayEntries.filter(e => e.status === 'pending').length;
                const rejected = dayEntries.filter(e => e.status === 'rejected').length;
                const totalPts = dayEntries.filter(e => e.status === 'approved').reduce((s, e) => s + (e.task?.points || 0), 0);

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                    className={`rounded-lg p-3 min-h-[100px] text-left transition-colors ${
                      isSelected ? 'bg-primary/20 border-2 border-primary' :
                      isToday ? 'bg-primary/10 border border-primary/30' :
                      'bg-slate-700/30 border border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-slate-400'}`}>
                        {day.toLocaleDateString('en', { weekday: 'short' })}
                      </span>
                      <span className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-slate-300'}`}>
                        {day.getDate()}
                      </span>
                    </div>
                    {dayEntries.length > 0 ? (
                      <>
                        <div className="flex gap-1 flex-wrap mb-1">
                          {approved > 0 && <span className="text-[10px] text-green-400">{approved} done</span>}
                          {submitted > 0 && <span className="text-[10px] text-yellow-400">{submitted} review</span>}
                          {pending > 0 && <span className="text-[10px] text-slate-400">{pending} todo</span>}
                          {rejected > 0 && <span className="text-[10px] text-red-400">{rejected} rej</span>}
                        </div>
                        {totalPts > 0 && <p className="text-xs text-accent">{totalPts} pts</p>}
                        {/* Status dots */}
                        <div className="flex gap-0.5 mt-1 flex-wrap">
                          {dayEntries.slice(0, 8).map(e => (
                            <span key={e.id} className={`w-2 h-2 rounded-full ${statusDot(e.status)}`}></span>
                          ))}
                          {dayEntries.length > 8 && <span className="text-[9px] text-slate-500">+{dayEntries.length - 8}</span>}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-600 mt-2">No tasks</p>
                    )}
                  </button>
                );
              })}
            </div>
            </div>

            {/* Selected Day Detail */}
            {selectedDay && calendarData[selectedDay] && calendarData[selectedDay].length > 0 && (
              <div className="mt-4 bg-slate-700/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">
                    {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h3>
                  <button onClick={() => setSelectedDay(null)} className="text-xs text-slate-400 hover:text-white">Close</button>
                </div>
                <div className="space-y-2">
                  {calendarData[selectedDay].map(e => (
                    <div key={e.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{e.task?.title}</p>
                        <p className="text-xs text-slate-400">{e.assignee?.display_name || e.assignee?.username || 'Unassigned'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-accent">{e.task?.points} pts</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(e.status)}`}>{e.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
