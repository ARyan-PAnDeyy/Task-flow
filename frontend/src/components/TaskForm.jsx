import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errorMessage, fieldErrors } from '../api/client';
import { Modal, Spinner } from './ui';
import { PRIORITY_LABELS, STATUS_LABELS } from '../utils/format';

const empty = { title: '', description: '', status: 'TODO', priority: 'MEDIUM', dueDate: '', assigneeId: '', projectId: '' };

/**
 * Create / edit a task. Pass `projectId` to lock the project (e.g. from the
 * project page); otherwise the user picks from projects they manage.
 */
export default function TaskForm({ open, onClose, task, projectId, onSaved }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState([]);
  const [team, setTeam] = useState([]);
  const editing = Boolean(task);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      task
        ? {
            title: task.title,
            description: task.description || '',
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate || '',
            assigneeId: task.assigneeId || '',
            projectId: task.projectId,
          }
        : { ...empty, projectId: projectId || '' }
    );
    if (!task && !projectId) {
      api.get('/projects', { params: { limit: 100, sort: 'name:asc' } }).then((res) => setProjects(res.data.data));
    }
  }, [open, task, projectId]);

  // Load the assignable team whenever the selected project changes.
  useEffect(() => {
    if (!open || !form.projectId) {
      setTeam([]);
      return;
    }
    api.get(`/projects/${form.projectId}`).then((res) => {
      const p = res.data.data;
      const people = [...(p.manager ? [p.manager] : []), ...p.members.filter((m) => m.id !== p.managerId)];
      setTeam(people);
    });
  }, [open, form.projectId]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (form.title.trim().length < 2) local.title = 'Title must be at least 2 characters';
    if (!form.projectId) local.projectId = 'Select a project';
    if (Object.keys(local).length) return setErrors(local);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
    };
    if (!editing) payload.projectId = Number(form.projectId);

    setSaving(true);
    try {
      const res = editing ? await api.patch(`/tasks/${task.id}`, payload) : await api.post('/tasks', payload);
      toast.success(editing ? 'Task updated' : 'Task created');
      onSaved(res.data.data);
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit task' : 'New task'}
      size="max-w-2xl"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="task-form" className="btn-primary" disabled={saving}>
            {saving && <Spinner className="h-4 w-4 text-white" />}
            {editing ? 'Save changes' : 'Create task'}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {!editing && !projectId && (
          <div className="sm:col-span-2">
            <label className="label" htmlFor="t-project">Project *</label>
            <select id="t-project" className="input" value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value, assigneeId: '' }))}>
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {errors.projectId && <p className="field-error">{errors.projectId}</p>}
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="t-title">Title *</label>
          <input id="t-title" className="input" value={form.title} onChange={set('title')} maxLength={200} autoFocus />
          {errors.title && <p className="field-error">{errors.title}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="t-desc">Description</label>
          <textarea id="t-desc" className="input min-h-28" value={form.description} onChange={set('description')} />
        </div>
        <div>
          <label className="label" htmlFor="t-priority">Priority</label>
          <select id="t-priority" className="input" value={form.priority} onChange={set('priority')}>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="t-status">Status</label>
          <select id="t-status" className="input" value={form.status} onChange={set('status')}>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="t-assignee">Assignee</label>
          <select id="t-assignee" className="input" value={form.assigneeId} onChange={set('assigneeId')} disabled={!form.projectId}>
            <option value="">Unassigned</option>
            {team.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          {errors.assigneeId && <p className="field-error">{errors.assigneeId}</p>}
        </div>
        <div>
          <label className="label" htmlFor="t-due">Due date</label>
          <input id="t-due" type="date" className="input" value={form.dueDate} onChange={set('dueDate')} />
        </div>
      </form>
    </Modal>
  );
}
