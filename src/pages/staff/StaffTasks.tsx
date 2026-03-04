import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../lib/logger';
import { getLocalDate } from '../../lib/date';
import confetti from 'canvas-confetti';
import type { Task } from '../../types/database';

interface TaskAssignment {
  id: string;
  task_id: string;
  assigned_to: string | null;
  status: string;
  due_date: string;
  task: { title: string; description: string | null; points: number; requires_photo: boolean } | null;
}

function fireConfetti(points: number) {
  // Scale the celebration based on points earned
  const intensity = Math.min(points / 100, 3); // 1x at 100pts, 3x at 300+

  confetti({
    particleCount: Math.floor(80 + intensity * 40),
    spread: 70 + intensity * 20,
    origin: { y: 0.7 },
    colors: ['#22D3EE', '#A78BFA', '#34D399', '#FBBF24', '#F472B6'],
  });

  // Big tasks get a second burst
  if (points >= 200) {
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#22D3EE', '#A78BFA', '#34D399'],
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#FBBF24', '#F472B6', '#22D3EE'],
      });
    }, 300);
  }
}

export default function StaffTasks() {
  const { profile, refreshProfile } = useAuth();
  const [myAssignments, setMyAssignments] = useState<TaskAssignment[]>([]);
  const [openAssignments, setOpenAssignments] = useState<TaskAssignment[]>([]);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [celebration, setCelebration] = useState<{ points: number; title: string } | null>(null);

  // Propose task form
  const [showPropose, setShowPropose] = useState(false);
  const [proposeTitle, setProposeTitle] = useState('');
  const [proposeDesc, setProposeDesc] = useState('');
  const [proposing, setProposing] = useState(false);

  const venueId = profile?.venue_id;
  const today = getLocalDate();

  // Auto-dismiss celebration
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(null), 4000);
    return () => clearTimeout(t);
  }, [celebration]);

  async function loadData() {
    if (!venueId || !profile) return;
    logger.api('StaffTasks: loading data');

    // Load today's assignments (mine + open)
    const { data: assignments, error: assignErr } = await supabase
      .from('task_assignments')
      .select('id, task_id, assigned_to, status, due_date, task:tasks(title, description, points, requires_photo)')
      .eq('venue_id', venueId)
      .eq('due_date', today)
      .in('status', ['pending', 'submitted']);

    if (assignErr) {
      logger.error('Failed to load assignments', assignErr.message);
    } else {
      const all = (assignments || []) as unknown as TaskAssignment[];
      setMyAssignments(all.filter(a => a.assigned_to === profile.id));
      setOpenAssignments(all.filter(a => a.assigned_to === null));
      logger.api(`Loaded ${all.length} assignments (${all.filter(a => a.assigned_to === profile.id).length} mine, ${all.filter(a => !a.assigned_to).length} open)`);
    }

    // Load all active tasks for "Available Tasks" section
    const { data: tasks, error: taskErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('points', { ascending: false });

    if (taskErr) {
      logger.error('Failed to load tasks', taskErr.message);
    } else {
      const myTaskIds = new Set((assignments || []).filter((a: { assigned_to: string | null }) => a.assigned_to === profile.id).map((a: { task_id: string }) => a.task_id));
      const available = (tasks || []).filter(t => !myTaskIds.has(t.id));
      setAvailableTasks(available as Task[]);
      logger.api(`${available.length} tasks available to take`);
    }

    setLoading(false);
  }

  useEffect(() => { loadData(); }, [venueId, profile]);

  async function claimOpen(assignment: TaskAssignment) {
    if (!profile) return;
    logger.api('Claiming open assignment', assignment.id);
    const { error } = await supabase.from('task_assignments').update({ assigned_to: profile.id }).eq('id', assignment.id);
    if (error) {
      logger.error('Claim failed', error.message);
      setMessage('Failed to claim task');
    } else {
      setMessage('Task claimed!');
    }
    loadData();
  }

  async function takeTask(task: Task) {
    if (!profile || !venueId) return;
    logger.api('Taking task (self-assign)', { taskId: task.id, title: task.title });
    const { error } = await supabase.from('task_assignments').insert({
      task_id: task.id,
      venue_id: venueId,
      assigned_to: profile.id,
      assigned_by: profile.id,
      due_date: today,
    });
    if (error) {
      logger.error('Take task failed', { message: error.message, code: error.code });
      setMessage(`Failed: ${error.message}`);
    } else {
      setMessage(`Picked up "${task.title}"!`);
    }
    loadData();
  }

  const showCelebration = useCallback((points: number, title: string) => {
    setCelebration({ points, title });
    fireConfetti(points);
  }, []);

  async function completeTask(assignment: TaskAssignment, photoFile?: File) {
    if (!profile || !venueId || !assignment.task) return;
    setUploading(assignment.id);
    logger.api('Completing task', { id: assignment.id, requiresPhoto: assignment.task.requires_photo });

    let photoUrl: string | null = null;
    if (photoFile) {
      const path = `${venueId}/${assignment.id}.${photoFile.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('task-photos').upload(path, photoFile, { upsert: true });
      if (!error) {
        photoUrl = path;
      } else {
        logger.error('Photo upload failed', error.message);
        setMessage('Photo upload failed — check permissions');
      }
    }

    if (assignment.task.requires_photo) {
      await supabase.from('task_assignments').update({
        status: 'submitted',
        completed_at: new Date().toISOString(),
        photo_url: photoUrl,
      }).eq('id', assignment.id);
      setMessage('Submitted for approval!');
    } else {
      // Auto-approve and award points immediately
      await supabase.from('task_assignments').update({
        status: 'approved',
        completed_at: new Date().toISOString(),
      }).eq('id', assignment.id);

      await supabase.from('points_ledger').insert({
        profile_id: profile.id,
        venue_id: venueId,
        delta: assignment.task.points,
        reason: `Task: ${assignment.task.title}`,
        assignment_id: assignment.id,
        created_by: profile.id,
      });

      // Refresh profile so points_total updates in the UI
      await refreshProfile();

      // Celebrate!
      showCelebration(assignment.task.points, assignment.task.title);
    }

    setUploading(null);
    loadData();
  }

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !venueId) return;
    setProposing(true);
    const { error } = await supabase.from('tasks').insert({
      venue_id: venueId,
      title: proposeTitle,
      description: proposeDesc || null,
      points: 0,
      requires_photo: false,
      is_recurring: false,
      is_active: false,
      created_by: profile.id,
      proposed_by: profile.id,
      approval_status: 'proposed',
    });
    if (error) {
      logger.error('Propose task failed', error.message);
      setMessage(`Failed to propose task: ${error.message}`);
    } else {
      setMessage('Task proposed! Admin will review and set points.');
      setProposeTitle('');
      setProposeDesc('');
      setShowPropose(false);
    }
    setProposing(false);
  }

  if (loading) return <div className="p-6 text-slate-400">Loading tasks...</div>;

  return (
    <div className="p-4 space-y-6">
      {/* Celebration overlay */}
      {celebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-slate-900/90 border-2 border-primary rounded-2xl px-8 py-6 text-center animate-bounce-in pointer-events-auto">
            <p className="text-4xl mb-2">🎉</p>
            <p className="text-2xl font-bold text-primary">+{celebration.points} pts!</p>
            <p className="text-sm text-slate-300 mt-1">"{celebration.title}" completed</p>
            <p className="text-xs text-slate-500 mt-2">Keep it up!</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Today's Tasks</h1>
        <button onClick={() => setShowPropose(!showPropose)}
          className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 min-h-[40px]">
          + Propose Task
        </button>
      </div>

      {message && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm flex justify-between">
          {message} <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      {/* Propose Task Form */}
      {showPropose && (
        <form onSubmit={handlePropose} className="bg-slate-800 border border-accent/30 rounded-xl p-5 space-y-3">
          <h2 className="text-lg font-semibold text-white">Propose a Task</h2>
          <p className="text-sm text-slate-400">Suggest a task — your admin will review and set the points.</p>
          <input
            value={proposeTitle}
            onChange={e => setProposeTitle(e.target.value)}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-accent"
            placeholder="Task title"
            required
          />
          <textarea
            value={proposeDesc}
            onChange={e => setProposeDesc(e.target.value)}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-accent resize-none"
            placeholder="Description (optional)"
            rows={2}
          />
          <div className="flex gap-3">
            <button type="submit" disabled={proposing}
              className="px-5 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 disabled:opacity-50 min-h-[44px]">
              {proposing ? 'Submitting...' : 'Submit Proposal'}
            </button>
            <button type="button" onClick={() => setShowPropose(false)}
              className="px-5 py-2.5 text-slate-300 border border-slate-600 rounded-lg min-h-[44px]">Cancel</button>
          </div>
        </form>
      )}

      {/* My Assigned Tasks */}
      {myAssignments.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">My Tasks</h2>
          <div className="space-y-3">
            {myAssignments.map(a => (
              <div key={a.id} className="bg-slate-800 border border-primary/30 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-white font-medium">{a.task?.title}</h3>
                    {a.task?.description && <p className="text-sm text-slate-400 mt-1">{a.task.description}</p>}
                  </div>
                  <span className="text-accent font-bold text-lg">+{a.task?.points}</span>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  {a.task?.requires_photo && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">Photo Required</span>
                  )}
                  {a.status === 'submitted' && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">Awaiting Approval</span>
                  )}
                </div>

                {a.status === 'pending' && (
                  <div className="mt-4">
                    {a.task?.requires_photo ? (
                      <label className="inline-flex items-center px-4 py-2.5 bg-primary text-slate-900 font-medium rounded-lg hover:bg-primary/90 cursor-pointer min-h-[48px]">
                        {uploading === a.id ? 'Uploading...' : 'Complete with Photo'}
                        <input type="file" accept="image/*" capture="environment" className="hidden"
                          onChange={e => { if (e.target.files?.[0]) completeTask(a, e.target.files[0]); }} />
                      </label>
                    ) : (
                      <button onClick={() => completeTask(a)} disabled={uploading === a.id}
                        className="px-4 py-2.5 bg-primary text-slate-900 font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 min-h-[48px]">
                        {uploading === a.id ? 'Completing...' : 'Complete Task'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Open tasks (assigned by admin, unclaimed) */}
      {openAssignments.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Open Tasks</h2>
          <p className="text-sm text-slate-400 mb-3">Assigned by your manager — claim one!</p>
          <div className="space-y-3">
            {openAssignments.map(a => (
              <div key={a.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-white font-medium">{a.task?.title}</h3>
                    {a.task?.description && <p className="text-sm text-slate-400 mt-1">{a.task.description}</p>}
                  </div>
                  <span className="text-accent font-bold text-lg">+{a.task?.points}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {a.task?.requires_photo && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">Photo Required</span>
                  )}
                  <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">Open</span>
                </div>
                <button onClick={() => claimOpen(a)}
                  className="mt-4 px-4 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 min-h-[48px]">
                  Claim Task
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Available Tasks (self-assign) */}
      {availableTasks.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Available Tasks</h2>
          <p className="text-sm text-slate-400 mb-3">Pick a task to work on today</p>
          <div className="space-y-3">
            {availableTasks.map(task => (
              <div key={task.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0 mr-4">
                  <h3 className="text-white font-medium">{task.title}</h3>
                  {task.description && <p className="text-sm text-slate-400 mt-1 truncate">{task.description}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-accent font-bold">+{task.points}</span>
                    {task.requires_photo && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">Photo</span>
                    )}
                    {task.is_recurring && (
                      <span className="text-xs bg-slate-600/50 text-slate-300 px-2 py-1 rounded-full">Daily</span>
                    )}
                  </div>
                </div>
                <button onClick={() => takeTask(task)}
                  className="px-4 py-2.5 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 border border-slate-600 min-h-[48px] whitespace-nowrap">
                  Take Task
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {myAssignments.length === 0 && openAssignments.length === 0 && availableTasks.length === 0 && (
        <p className="text-slate-500 text-center py-12">No tasks available today</p>
      )}
    </div>
  );
}
