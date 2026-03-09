import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Task, TaskFrequency } from '../../types/database';

export default function AdminTasks() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(0);
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [frequency, setFrequency] = useState<TaskFrequency>('once');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [proposedTasks, setProposedTasks] = useState<(Task & { proposer?: { display_name: string | null } })[]>([]);
  const [approvePoints, setApprovePoints] = useState<Record<string, number>>({});

  const venueId = profile?.venue_id;

  async function loadTasks() {
    if (!venueId) { setLoading(false); return; }
    const { data } = await supabase.from('tasks').select('*').eq('venue_id', venueId).in('approval_status', ['active']).order('created_at', { ascending: false });
    if (data) setTasks(data as Task[]);

    // Load proposed + rejected tasks (so admin can re-approve rejected ones)
    const { data: proposed } = await supabase
      .from('tasks')
      .select('*, proposer:profiles!tasks_proposed_by_fkey(display_name)')
      .eq('venue_id', venueId)
      .in('approval_status', ['proposed', 'rejected'])
      .order('created_at', { ascending: false });
    if (proposed) setProposedTasks(proposed as any);

    setLoading(false);
  }

  useEffect(() => { loadTasks(); }, [venueId]);

  function openCreate() {
    setEditingTask(null);
    setTitle(''); setDescription(''); setPoints(0); setRequiresPhoto(false); setFrequency('once');
    setShowForm(true); setError('');
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setTitle(task.title); setDescription(task.description || ''); setPoints(task.points);
    setRequiresPhoto(task.requires_photo); setFrequency(task.frequency);
    setShowForm(true); setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!venueId || !profile) return;
    setSaving(true); setError('');

    const autoPhoto = points >= 500 ? true : requiresPhoto;

    if (editingTask) {
      const { error: err } = await supabase.from('tasks').update({
        title, description: description || null, points, requires_photo: autoPhoto, frequency,
      }).eq('id', editingTask.id);
      if (err) { setError(err.message); setSaving(false); return; }
      setMessage(`Updated "${title}"`);
    } else {
      const { error: err } = await supabase.from('tasks').insert({
        venue_id: venueId, title, description: description || null, points,
        requires_photo: autoPhoto, frequency, created_by: profile.id,
      });
      if (err) { setError(err.message); setSaving(false); return; }
      setMessage(`Created "${title}"`);
    }

    setSaving(false); setShowForm(false); loadTasks();
  }

  async function toggleActive(task: Task) {
    await supabase.from('tasks').update({ is_active: !task.is_active }).eq('id', task.id);
    loadTasks();
  }

  async function handleDelete(task: Task) {
    if (!confirm(`Delete "${task.title}"?`)) return;
    await supabase.from('tasks').delete().eq('id', task.id);
    setMessage(`Deleted "${task.title}"`); loadTasks();
  }

  async function approveProposal(task: Task) {
    const pts = approvePoints[task.id] ?? 0;
    if (pts <= 0) { setError('Set points before approving'); return; }
    await supabase.from('tasks').update({
      points: pts,
      is_active: true,
      approval_status: 'active',
      requires_photo: pts >= 500,
    }).eq('id', task.id);
    setMessage(`Approved "${task.title}" for ${pts} pts`);
    loadTasks();
  }

  async function rejectProposal(task: Task) {
    await supabase.from('tasks').update({ approval_status: 'rejected' }).eq('id', task.id);
    setMessage(`Rejected "${task.title}"`);
    loadTasks();
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Task Management</h1>
        <button onClick={openCreate} className="px-4 py-2.5 bg-primary text-slate-900 font-medium rounded-lg hover:bg-primary/90 min-h-[48px]">
          + New Task
        </button>
      </div>

      {message && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm mb-4 flex justify-between">
          {message} <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">{editingTask ? 'Edit Task' : 'New Task'}</h2>
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm text-slate-300 mb-1">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" placeholder="Deep Clean Fridges" />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary resize-none" placeholder="Instructions for this task..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Points *</label>
              <input type="number" value={points} onChange={e => { setPoints(Number(e.target.value)); if (Number(e.target.value) >= 500) setRequiresPhoto(true); }} min={0}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
            <label className="flex items-center gap-3 text-slate-300 cursor-pointer min-h-[48px]">
              <input type="checkbox" checked={requiresPhoto || points >= 500} onChange={e => setRequiresPhoto(e.target.checked)} disabled={points >= 500}
                className="w-5 h-5 rounded bg-slate-700 border-slate-600" />
              Requires Photo {points >= 500 && <span className="text-xs text-yellow-400">(auto: 500+ pts)</span>}
            </label>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Frequency</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value as TaskFrequency)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary">
                <option value="once">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="px-6 py-2.5 bg-primary text-slate-900 font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 min-h-[48px]">
              {saving ? 'Saving...' : editingTask ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 text-slate-300 border border-slate-600 rounded-lg min-h-[48px]">Cancel</button>
          </div>
        </form>
      )}

      {/* Proposed & Rejected Tasks Section */}
      {proposedTasks.length > 0 && (
        <div className="bg-slate-800 border border-yellow-500/30 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold text-yellow-400 mb-3">Staff Proposals ({proposedTasks.length})</h2>
          <div className="space-y-3">
            {proposedTasks.map(task => {
              const isRejected = task.approval_status === 'rejected';
              return (
                <div key={task.id} className={`rounded-lg p-4 ${isRejected ? 'bg-red-500/10 border border-red-500/20' : 'bg-slate-700/50'}`}>
                  <div className="flex-1 min-w-0 mb-3">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{task.title}</p>
                      {isRejected && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Rejected</span>}
                    </div>
                    {task.description && <p className="text-sm text-slate-400 mt-1">{task.description}</p>}
                    <p className="text-xs text-slate-500 mt-1">
                      Proposed by {(task as any).proposer?.display_name || 'Unknown'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number" min={1}
                      value={approvePoints[task.id] ?? ''}
                      onChange={e => setApprovePoints(prev => ({ ...prev, [task.id]: Number(e.target.value) }))}
                      className="w-20 px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white text-sm focus:outline-none focus:border-primary"
                      placeholder="Pts"
                    />
                    <button onClick={() => approveProposal(task)}
                      className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-500 min-h-[36px]">{isRejected ? 'Re-approve' : 'Approve'}</button>
                    {!isRejected && (
                      <button onClick={() => rejectProposal(task)}
                        className="px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-500 min-h-[36px]">Reject</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="p-6 text-slate-400 text-center">Loading...</div>
        ) : tasks.length === 0 ? (
          <div className="p-6 text-slate-400 text-center">No tasks yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-slate-400 border-b border-slate-700">
                <th className="px-3 md:px-6 py-3">Task</th>
                <th className="px-3 md:px-6 py-3">Points</th>
                <th className="px-3 md:px-6 py-3 hidden sm:table-cell">Photo</th>
                <th className="px-3 md:px-6 py-3 hidden sm:table-cell">Frequency</th>
                <th className="px-3 md:px-6 py-3">Status</th>
                <th className="px-3 md:px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id} className={`border-b border-slate-700/50 hover:bg-slate-750/50 ${!task.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-3 md:px-6 py-4">
                    <p className="text-white font-medium">{task.title}</p>
                    {task.description && <p className="text-xs text-slate-400 mt-1 max-w-[200px] truncate">{task.description}</p>}
                  </td>
                  <td className="px-3 md:px-6 py-4 text-accent font-medium">{task.points}</td>
                  <td className="px-3 md:px-6 py-4 text-slate-400 hidden sm:table-cell">{task.requires_photo ? 'Yes' : 'No'}</td>
                  <td className="px-3 md:px-6 py-4 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      task.frequency === 'once' ? 'bg-slate-600/20 text-slate-400' :
                      task.frequency === 'daily' ? 'bg-blue-500/20 text-blue-400' :
                      task.frequency === 'weekly' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-orange-500/20 text-orange-400'
                    }`}>
                      {task.frequency === 'once' ? 'One-time' : task.frequency.charAt(0).toUpperCase() + task.frequency.slice(1)}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${task.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/20 text-slate-400'}`}>
                      {task.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-4">
                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-3">
                      <button onClick={() => openEdit(task)} className="text-sm text-accent hover:text-primary">Edit</button>
                      <button onClick={() => toggleActive(task)} className="text-sm text-yellow-400 hover:text-yellow-300">{task.is_active ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => handleDelete(task)} className="text-sm text-red-400 hover:text-red-300">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
