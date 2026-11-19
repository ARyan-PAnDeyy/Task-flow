import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Pencil, Trash2, Paperclip, Upload, Download, Send, FileText, MessageSquare } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import TaskForm from '../components/TaskForm';
import { PageLoader, EmptyState, StatusBadge, PriorityBadge, Avatar, ConfirmDialog, Spinner } from '../components/ui';
import { STATUS_LABELS, formatDate, formatDateTime, formatBytes, timeAgo, isOverdue } from '../utils/format';

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, canManage } = useAuth();
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // { type, item }
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    try {
      const [t, c, a] = await Promise.all([
        api.get(`/tasks/${id}`),
        api.get(`/tasks/${id}/comments`),
        api.get(`/tasks/${id}/attachments`),
      ]);
      setTask(t.data.data);
      setComments(c.data.data);
      setAttachments(a.data.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState title="Task unavailable" description={error} action={<Link className="btn-secondary" to="/tasks">Back to tasks</Link>} />;
  if (!task) return <PageLoader />;

  const manage = canManage(task.project);
  const canChangeStatus = manage || task.assigneeId === user.id;

  const changeStatus = async (status) => {
    try {
      const res = await api.patch(`/tasks/${task.id}`, { status });
      setTask(res.data.data);
      toast.success(`Moved to ${STATUS_LABELS[status]}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const postComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const res = await api.post(`/tasks/${task.id}/comments`, { content: comment.trim() });
      setComments((c) => [...c, res.data.data]);
      setComment('');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be 10MB or smaller');
      return;
    }
    const body = new FormData();
    body.append('file', file);
    setUploading(true);
    try {
      const res = await api.post(`/tasks/${task.id}/attachments`, body);
      setAttachments((a) => [{ ...res.data.data, uploadedBy: user }, ...a]);
      toast.success('File uploaded');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const download = async (a) => {
    try {
      const res = await api.get(`/attachments/${a.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = Object.assign(document.createElement('a'), { href: url, download: a.originalName });
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err, 'Download failed'));
    }
  };

  const doDelete = async () => {
    const { type, item } = confirm;
    try {
      if (type === 'task') {
        await api.delete(`/tasks/${task.id}`);
        toast.success('Task deleted');
        navigate(`/projects/${task.projectId}`);
        return;
      }
      if (type === 'comment') {
        await api.delete(`/comments/${item.id}`);
        setComments((c) => c.filter((x) => x.id !== item.id));
      }
      if (type === 'attachment') {
        await api.delete(`/attachments/${item.id}`);
        setAttachments((a) => a.filter((x) => x.id !== item.id));
      }
      toast.success('Deleted');
      setConfirm(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <Link to={`/projects/${task.projectId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {task.project.name}
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <h1 className="text-xl font-semibold text-slate-900">{task.title}</h1>
              {manage && (
                <div className="flex shrink-0 gap-2">
                  <button className="btn-secondary" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</button>
                  <button className="btn-secondary text-red-600 hover:bg-red-50" onClick={() => setConfirm({ type: 'task' })} aria-label="Delete task"><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </div>
            <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{task.description || 'No description provided.'}</p>
          </div>

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
              <MessageSquare className="h-4 w-4" /> Comments ({comments.length})
            </h2>
            <ul className="space-y-4">
              {comments.map((c) => (
                <li key={c.id} className="group flex gap-3">
                  <Avatar user={c.author || { id: 0, name: 'Deleted user' }} />
                  <div className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm">
                        <span className="font-medium text-slate-900">{c.author?.name || 'Deleted user'}</span>{' '}
                        <span className="text-xs text-slate-400" title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</span>
                      </p>
                      {(c.userId === user.id || manage) && (
                        <button className="text-slate-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100 focus:opacity-100" onClick={() => setConfirm({ type: 'comment', item: c })} aria-label="Delete comment">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-700">{c.content}</p>
                  </div>
                </li>
              ))}
              {comments.length === 0 && <p className="text-sm text-slate-500">No comments yet. Start the conversation.</p>}
            </ul>
            <form onSubmit={postComment} className="mt-5 flex gap-3">
              <Avatar user={user} />
              <div className="flex-1">
                <textarea
                  className="input min-h-20"
                  placeholder="Write a comment…"
                  value={comment}
                  maxLength={5000}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) postComment(e); }}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Ctrl + Enter to send</span>
                  <button className="btn-primary" disabled={posting || !comment.trim()}>
                    {posting ? <Spinner className="h-4 w-4 text-white" /> : <Send className="h-4 w-4" />} Comment
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>

        <aside className="space-y-6">
          <div className="card space-y-4 p-5 text-sm">
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">Status</p>
              {canChangeStatus ? (
                <select className="input" value={task.status} onChange={(e) => changeStatus(e.target.value)} aria-label="Status">
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : (
                <StatusBadge status={task.status} />
              )}
            </div>
            <Detail label="Priority"><PriorityBadge priority={task.priority} /></Detail>
            <Detail label="Assignee">
              {task.assignee ? <span className="flex items-center gap-2"><Avatar user={task.assignee} size="h-6 w-6 text-[10px]" />{task.assignee.name}</span> : 'Unassigned'}
            </Detail>
            <Detail label="Due date">
              <span className={isOverdue(task) ? 'font-medium text-red-600' : ''}>{formatDate(task.dueDate)}{isOverdue(task) && ' (overdue)'}</span>
            </Detail>
            {task.completedAt && <Detail label="Completed">{formatDateTime(task.completedAt)}</Detail>}
            <Detail label="Created by">{task.createdBy?.name || '—'}</Detail>
            <Detail label="Created">{formatDateTime(task.createdAt)}</Detail>
          </div>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Paperclip className="h-4 w-4" /> Files ({attachments.length})</h2>
              <button className="btn-ghost text-sm text-indigo-600" onClick={() => fileInput.current.click()} disabled={uploading}>
                {uploading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />} Upload
              </button>
              <input ref={fileInput} type="file" className="hidden" onChange={upload} />
            </div>
            {attachments.length === 0 ? (
              <p className="text-sm text-slate-500">No files attached.</p>
            ) : (
              <ul className="space-y-2">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                    <FileText className="h-5 w-5 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={a.originalName}>{a.originalName}</p>
                      <p className="truncate text-xs text-slate-400">{formatBytes(a.size)} · {a.uploadedBy?.name}</p>
                    </div>
                    <button className="btn-ghost p-1" onClick={() => download(a)} aria-label={`Download ${a.originalName}`}><Download className="h-4 w-4" /></button>
                    {(a.uploadedById === user.id || manage) && (
                      <button className="btn-ghost p-1 hover:text-red-600" onClick={() => setConfirm({ type: 'attachment', item: a })} aria-label={`Delete ${a.originalName}`}><Trash2 className="h-4 w-4" /></button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-400">Max 10MB · images, PDF, Office docs, txt, csv, zip</p>
          </section>
        </aside>
      </div>

      <TaskForm open={editOpen} onClose={() => setEditOpen(false)} task={task} onSaved={setTask} />
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={doDelete}
        title={`Delete ${confirm?.type}?`}
        message={confirm?.type === 'task' ? 'This task, its comments and its files will be permanently deleted.' : 'This cannot be undone.'}
      />
    </div>
  );
}

function Detail({ label, children }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase text-slate-500">{label}</p>
      <div className="text-slate-800">{children}</div>
    </div>
  );
}
