import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errorMessage, fieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Modal, Spinner } from './ui';
import UserPicker from './UserPicker';
import { PROJECT_STATUS_LABELS } from '../utils/format';

const empty = { name: '', description: '', status: 'ACTIVE', startDate: '', deadline: '', managerId: '', memberIds: [] };

export default function ProjectForm({ open, onClose, project, onSaved }) {
  const { isAdmin } = useAuth();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [managers, setManagers] = useState([]);
  const editing = Boolean(project);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      project
        ? {
            name: project.name,
            description: project.description || '',
            status: project.status,
            startDate: project.startDate || '',
            deadline: project.deadline || '',
            managerId: project.managerId || '',
            memberIds: [],
          }
        : empty
    );
    if (isAdmin) {
      Promise.all([
        api.get('/users', { params: { role: 'PROJECT_MANAGER', limit: 100, isActive: true } }),
        api.get('/users', { params: { role: 'ADMIN', limit: 100, isActive: true } }),
      ]).then(([pms, admins]) => setManagers([...pms.data.data, ...admins.data.data]));
    }
  }, [open, project, isAdmin]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (form.name.trim().length < 2) local.name = 'Name must be at least 2 characters';
    if (form.startDate && form.deadline && form.deadline < form.startDate) local.deadline = 'Deadline must be after the start date';
    if (Object.keys(local).length) return setErrors(local);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: form.status,
      startDate: form.startDate || null,
      deadline: form.deadline || null,
    };
    if (isAdmin && form.managerId) payload.managerId = Number(form.managerId);
    if (!editing) payload.memberIds = form.memberIds;

    setSaving(true);
    try {
      const res = editing ? await api.patch(`/projects/${project.id}`, payload) : await api.post('/projects', payload);
      toast.success(editing ? 'Project updated' : 'Project created');
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
      title={editing ? 'Edit project' : 'New project'}
      size="max-w-2xl"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="project-form" className="btn-primary" disabled={saving}>
            {saving && <Spinner className="h-4 w-4 text-white" />}
            {editing ? 'Save changes' : 'Create project'}
          </button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="p-name">Name *</label>
          <input id="p-name" className="input" value={form.name} onChange={set('name')} maxLength={150} autoFocus />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="p-desc">Description</label>
          <textarea id="p-desc" className="input min-h-24" value={form.description} onChange={set('description')} />
        </div>
        <div>
          <label className="label" htmlFor="p-status">Status</label>
          <select id="p-status" className="input" value={form.status} onChange={set('status')}>
            {Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        {isAdmin ? (
          <div>
            <label className="label" htmlFor="p-manager">Project manager</label>
            <select id="p-manager" className="input" value={form.managerId} onChange={set('managerId')}>
              <option value="">{editing ? 'Unassigned' : 'Me'}</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.role === 'ADMIN' ? 'Admin' : 'PM'})</option>
              ))}
            </select>
            {errors.managerId && <p className="field-error">{errors.managerId}</p>}
          </div>
        ) : (
          <div />
        )}
        <div>
          <label className="label" htmlFor="p-start">Start date</label>
          <input id="p-start" type="date" className="input" value={form.startDate} onChange={set('startDate')} />
        </div>
        <div>
          <label className="label" htmlFor="p-deadline">Deadline</label>
          <input id="p-deadline" type="date" className="input" value={form.deadline} onChange={set('deadline')} />
          {errors.deadline && <p className="field-error">{errors.deadline}</p>}
        </div>
        {!editing && (
          <div className="sm:col-span-2">
            <label className="label">Team members</label>
            <UserPicker selected={form.memberIds} onChange={(ids) => setForm((f) => ({ ...f, memberIds: ids }))} />
          </div>
        )}
      </form>
    </Modal>
  );
}
