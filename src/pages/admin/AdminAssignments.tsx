import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { getLocalDate } from '../../lib/date';

interface AssignmentRow {
  id: string;
  due_date: string;
  status: string;
  photo_url: string | null;
  completed_at: string | null;
  task: { title: string; points: number; requires_photo: boolean } | null;
  assignee: { display_name: string | null; username: string | null } | null;
}

export default function AdminAssignments() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [message, setMessage] = useState('');

  // Assign form
  const [showAssign, setShowAssign] = useState(false);
  const [tasks, setTasks] = useState<{ id: string; title: string }[]>([]);
  const [staff, setStaff] = useState<{ id: string; display_name: string | null }[]>([]);
  const [selectedTask, setSelectedTask] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Photo review
  const [reviewPhoto, setReviewPhoto] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);

  const venueId = profile?.venue_id;

  async function loadAssignments() {
    if (!venueId) { setLoading(false); return; }
    const { data } = await supabase
      .from('task_assignments')
      .select('id, due_date, status, photo_url, completed_at, task:tasks(title, points, requires_photo), assignee:profiles!task_assignments_assigned_to_fkey(display_name, username)')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setAssignments(data as unknown as AssignmentRow[]);
    setLoading(false);
  }

  async function loadFormData() {
    if (!venueId) return;
    const [tasksRes, staffRes] = await Promise.all([
      supabase.from('tasks').select('id, title').eq('venue_id', venueId).eq('is_active', true).order('title'),
      supabase.from('profiles').select('id, display_name').eq('venue_id', venueId).eq('role', 'staff').order('display_name'),
    ]);
    if (tasksRes.data) setTasks(tasksRes.data);
    if (staffRes.data) setStaff(staffRes.data);
  }

  useEffect(() => { loadAssignments(); loadFormData(); }, [venueId]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!venueId || !profile) return;
    setAssigning(true);
    const today = getLocalDate();
    await supabase.from('task_assignments').insert({
      task_id: selectedTask,
      venue_id: venueId,
      assigned_to: selectedStaff || null,
      assigned_by: profile.id,
      due_date: today,
    });
    setAssigning(false); setShowAssign(false);
    setSelectedTask(''); setSelectedStaff('');
    setMessage('Task assigned!');
    loadAssignments();
  }

  async function handleApprove(assignment: AssignmentRow) {
    if (!venueId || !profile || !assignment.task) return;
    // Update status
    await supabase.from('task_assignments').update({ status: 'approved' }).eq('id', assignment.id);
    // Award points — get assignee ID from the assignment
    const { data: fullAssignment } = await supabase.from('task_assignments').select('assigned_to').eq('id', assignment.id).single();
    if (fullAssignment?.assigned_to) {
      await supabase.from('points_ledger').insert({
        profile_id: fullAssignment.assigned_to,
        venue_id: venueId,
        delta: assignment.task.points,
        reason: `Task: ${assignment.task.title}`,
        assignment_id: assignment.id,
        created_by: profile.id,
      });
    }
    setMessage('Approved and points awarded!');
    loadAssignments();
  }

  async function handleReject(assignment: AssignmentRow) {
    await supabase.from('task_assignments').update({ status: 'rejected' }).eq('id', assignment.id);
    setMessage('Assignment rejected.');
    loadAssignments();
  }

  async function viewPhoto(storagePath: string) {
    setLoadingPhoto(true);
    // photo_url stores the storage path — generate a 1-hour signed URL
    const { data, error } = await supabase.storage.from('task-photos').createSignedUrl(storagePath, 3600);
    if (data?.signedUrl) {
      setReviewPhoto(data.signedUrl);
    } else {
      // Fallback: might be a full URL from before the fix
      setReviewPhoto(storagePath.startsWith('http') ? storagePath : '');
      if (error) setMessage(`Photo load failed: ${error.message}`);
    }
    setLoadingPhoto(false);
  }

  const filtered = filter === 'all' ? assignments : assignments.filter(a => a.status === filter);

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-white">Assignments</h1>
        <button onClick={() => setShowAssign(!showAssign)} className="px-3 md:px-4 py-2.5 bg-primary text-slate-900 font-medium rounded-lg hover:bg-primary/90 min-h-[48px] text-sm md:text-base whitespace-nowrap">
          + Assign
        </button>
      </div>

      {message && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm mb-4 flex justify-between">
          {message} <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      {showAssign && (
        <form onSubmit={handleAssign} className="bg-slate-800 border border-slate-700 rounded-xl p-4 md:p-6 mb-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Assign Task</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Task *</label>
              <select value={selectedTask} onChange={e => setSelectedTask(e.target.value)} required
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary">
                <option value="">Select task...</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Assign To (empty = open)</label>
              <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary">
                <option value="">Open (anyone can claim)</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={assigning} className="px-6 py-2.5 bg-primary text-slate-900 font-medium rounded-lg disabled:opacity-50 min-h-[48px]">
              {assigning ? 'Assigning...' : 'Assign'}
            </button>
            <button type="button" onClick={() => setShowAssign(false)} className="px-6 py-2.5 text-slate-300 border border-slate-600 rounded-lg min-h-[48px]">Cancel</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {['all', 'pending', 'submitted', 'approved', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize whitespace-nowrap ${filter === f ? 'bg-primary text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Photo modal */}
      {reviewPhoto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setReviewPhoto(null)}>
          <img src={reviewPhoto} alt="Task photo" className="max-w-full max-h-[80vh] rounded-xl" />
        </div>
      )}

      {/* Assignments — Card layout on mobile, row layout on desktop */}
      <div className="space-y-3 md:space-y-0 md:bg-slate-800 md:border md:border-slate-700 md:rounded-xl md:overflow-hidden md:divide-y md:divide-slate-700/50">
        {loading ? (
          <div className="p-6 text-slate-400 text-center">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-slate-400 text-center">No assignments found.</div>
        ) : (
          filtered.map(a => (
            <div key={a.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 md:border-0 md:rounded-none">
              {/* Top row: task name + status badge */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium">{a.task?.title || 'Unknown task'}</p>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {a.assignee?.display_name || a.assignee?.username || 'Unassigned'} · {a.due_date}
                    {a.task?.points ? ` · ${a.task.points} pts` : ''}
                  </p>
                  {a.completed_at && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Completed: {new Date(a.completed_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                  a.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                  a.status === 'submitted' ? 'bg-yellow-500/20 text-yellow-400' :
                  a.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-600/20 text-slate-400'
                }`}>
                  {a.status}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {a.photo_url && (
                  <button onClick={() => viewPhoto(a.photo_url!)} disabled={loadingPhoto}
                    className="text-sm text-accent hover:text-primary px-3 py-1.5 border border-slate-600 rounded-lg min-h-[36px]">
                    {loadingPhoto ? '...' : 'View Photo'}
                  </button>
                )}
                {a.status === 'submitted' && (
                  <>
                    <button onClick={() => handleApprove(a)} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-500 min-h-[36px]">Approve</button>
                    <button onClick={() => handleReject(a)} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-500 min-h-[36px]">Reject</button>
                  </>
                )}
                {a.status === 'rejected' && (
                  <button onClick={() => handleApprove(a)} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-500 min-h-[36px]">Re-approve</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
