import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Pencil, Trash2, Plus, UserPlus, X, CalendarDays, LayoutGrid, List as ListIcon, MessageSquare } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ProjectForm from '../components/ProjectForm';
import TaskForm from '../components/TaskForm';
import UserPicker from '../components/UserPicker';
import {
  PageLoader, EmptyState, ProgressBar, ProjectStatusBadge, PriorityBadge, StatusBadge, Avatar, RoleBadge,
  ConfirmDialog, Modal,
} from '../components/ui';
import { STATUS_LABELS, formatDate, isOverdue } from '../utils/format';

const COLUMNS = ['TODO', 'IN_PROGRESS', 'COMPLETED'];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, canManage } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [view, setView] = useState('board');
  const [editOpen, setEditOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [newMembers, setNewMembers] = useState([]);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get('/tasks', { params: { projectId: id, limit: 100, sort: 'dueDate:asc' } }),
      ]);
      setProject(p.data.data);
      setTasks(t.data.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState title="Project unavailable" description={error} action={<Link className="btn-secondary" to="/projects">Back to projects</Link>} />;
  if (!project) return <PageLoader />;

  const manage = canManage(project);

  const changeStatus = async (task, status) => {
    try {
      await api.patch(`/tasks/${task.id}`, { status });
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status } : t)));
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const deleteProject = async () => {
    setDeleting(true);
    try {
      await api.delete(`/projects/${project.id}`);
      toast.success('Project deleted');
      navigate('/projects');
    } catch (err) {
      toast.error(errorMessage(err));
      setDeleting(false);
    }
  };

  const addMembers = async () => {
    try {
      const res = await api.post(`/projects/${project.id}/members`, { userIds: newMembers });
      setProject(res.data.data);
      setMembersOpen(false);
      setNewMembers([]);
      toast.success('Members added');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const removeMember = async () => {
    try {
      const res = await api.delete(`/projects/${project.id}/members/${removing.id}`);
      setProject(res.data.data);
      toast.success(`${removing.name} removed`);
      setRemoving(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const canChangeStatus = (t) => manage || t.assigneeId === user.id;

  const TaskCard = ({ t }) => (
    <div className="card p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link to={`/tasks/${t.id}`} className="text-sm font-medium text-slate-800 hover:text-indigo-600">{t.title}</Link>
        <PriorityBadge priority={t.priority} />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className={`flex items-center gap-1 ${isOverdue(t) ? 'font-medium text-red-600' : ''}`}>
          <CalendarDays className="h-3.5 w-3.5" />
          {t.dueDate ? formatDate(t.dueDate, { day: 'numeric', month: 'short' }) : 'No due date'}
        </span>
        {t.assignee ? <Avatar user={t.assignee} size="h-6 w-6 text-[10px]" /> : <span>Unassigned</span>}
      </div>
      {canChangeStatus(t) && (
        <select
          className="input mt-2 py-1 text-xs"
          value={t.status}
          onChange={(e) => changeStatus(t, e.target.value)}
          aria-label={`Change status of ${t.title}`}
        >
          {COLUMNS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>

      <div className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            <p className="mt-2 max-w-3xl whitespace-pre-line text-sm text-slate-600">{project.description || 'No description'}</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
              <span>Manager: <span className="font-medium text-slate-700">{project.manager?.name || 'Unassigned'}</span></span>
              <span>Start: <span className="font-medium text-slate-700">{formatDate(project.startDate)}</span></span>
              <span>Deadline: <span className="font-medium text-slate-700">{formatDate(project.deadline)}</span></span>
            </div>
          </div>
          {manage && (
            <div className="flex shrink-0 gap-2">
              <button className="btn-secondary" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</button>
              <button className="btn-secondary text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /> Delete</button>
            </div>
          )}
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-slate-500">{project.stats.completed} of {project.stats.total} tasks completed</span>
            <span className="font-semibold text-slate-900">{project.stats.progress}%</span>
          </div>
          <ProgressBar value={project.stats.progress} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
            <div className="flex gap-2">
              <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
                <button className={`rounded-md p-1.5 ${view === 'board' ? 'bg-slate-100' : ''}`} onClick={() => setView('board')} aria-label="Board view"><LayoutGrid className="h-4 w-4" /></button>
                <button className={`rounded-md p-1.5 ${view === 'list' ? 'bg-slate-100' : ''}`} onClick={() => setView('list')} aria-label="List view"><ListIcon className="h-4 w-4" /></button>
              </div>
              {manage && (
                <button className="btn-primary" onClick={() => setTaskFormOpen(true)}><Plus className="h-4 w-4" /> Add task</button>
              )}
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className="card"><EmptyState title="No tasks yet" description={manage ? 'Create the first task for this project.' : undefined} /></div>
          ) : view === 'board' ? (
            <div className="grid gap-4 md:grid-cols-3">
              {COLUMNS.map((col) => {
                const items = tasks.filter((t) => t.status === col);
                return (
                  <div key={col} className="rounded-xl bg-slate-100/70 p-3">
                    <div className="mb-3 flex items-center justify-between px-1">
                      <StatusBadge status={col} />
                      <span className="text-xs font-medium text-slate-500">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((t) => <TaskCard key={t.id} t={t} />)}
                      {items.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No tasks</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Task</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Priority</th>
                    <th className="px-3 py-2.5 font-medium">Assignee</th>
                    <th className="px-3 py-2.5 font-medium">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5"><Link to={`/tasks/${t.id}`} className="font-medium hover:text-indigo-600">{t.title}</Link></td>
                      <td className="px-3 py-2.5"><StatusBadge status={t.status} /></td>
                      <td className="px-3 py-2.5"><PriorityBadge priority={t.priority} /></td>
                      <td className="px-3 py-2.5">{t.assignee?.name || <span className="text-slate-400">—</span>}</td>
                      <td className={`px-3 py-2.5 ${isOverdue(t) ? 'font-medium text-red-600' : ''}`}>{formatDate(t.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="card h-fit p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Team ({project.members.length})</h2>
            {manage && (
              <button className="btn-ghost text-sm text-indigo-600" onClick={() => setMembersOpen(true)}><UserPlus className="h-4 w-4" /> Add</button>
            )}
          </div>
          {project.members.length === 0 ? (
            <p className="text-sm text-slate-500">No team members yet.</p>
          ) : (
            <ul className="space-y-3">
              {project.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <Avatar user={m} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <RoleBadge role={m.role} />
                  </div>
                  {manage && (
                    <button className="btn-ghost p-1 text-slate-400 hover:text-red-600" onClick={() => setRemoving(m)} aria-label={`Remove ${m.name}`}>
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-400">
            <MessageSquare className="h-3.5 w-3.5" /> Members can comment and attach files on tasks.
          </p>
        </aside>
      </div>

      <ProjectForm open={editOpen} onClose={() => setEditOpen(false)} project={project} onSaved={(p) => setProject(p)} />
      <TaskForm open={taskFormOpen} onClose={() => setTaskFormOpen(false)} projectId={project.id} onSaved={load} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteProject}
        loading={deleting}
        title="Delete project?"
        message={`"${project.name}" and all of its ${project.stats.total} tasks, comments and attachments will be permanently deleted.`}
      />
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={removeMember}
        confirmLabel="Remove"
        title="Remove member?"
        message={`${removing?.name} will lose access to this project and their tasks here will become unassigned.`}
      />
      <Modal
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        title="Add team members"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setMembersOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={!newMembers.length} onClick={addMembers}>
              Add {newMembers.length || ''}
            </button>
          </>
        }
      >
        {membersOpen && (
          <UserPicker selected={newMembers} onChange={setNewMembers} exclude={project.members.map((m) => m.id)} />
        )}
      </Modal>
    </div>
  );
}
