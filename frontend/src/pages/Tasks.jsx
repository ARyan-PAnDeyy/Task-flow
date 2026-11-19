import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, ListChecks, ArrowUpDown, X } from 'lucide-react';
import api, { cleanParams, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import useDebounce from '../hooks/useDebounce';
import TaskForm from '../components/TaskForm';
import { PageHeader, PageLoader, EmptyState, Pagination, StatusBadge, PriorityBadge, Avatar } from '../components/ui';
import { STATUS_LABELS, PRIORITY_LABELS, formatDate, isOverdue } from '../utils/format';

const DEFAULTS = { search: '', status: '', priority: '', projectId: '', assigneeId: '', overdue: '', sort: 'dueDate:asc', page: '1' };

export default function Tasks() {
  const { canCreateProjects } = useAuth();
  // Filters live in the URL so views are shareable and survive refresh.
  const [params, setParams] = useSearchParams();
  const filters = { ...DEFAULTS, ...Object.fromEntries(params) };
  const [searchText, setSearchText] = useState(filters.search);
  const search = useDebounce(searchText);
  const [projects, setProjects] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const setFilter = useCallback(
    (patch) => {
      const next = { ...Object.fromEntries(params), page: '1', ...patch };
      setParams(cleanParams(Object.fromEntries(Object.entries(next).filter(([k, v]) => DEFAULTS[k] !== v))));
    },
    [params, setParams]
  );

  useEffect(() => {
    if (search !== filters.search) setFilter({ search });
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get('/projects', { params: { limit: 100, sort: 'name:asc' } }).then((res) => setProjects(res.data.data));
  }, []);

  const queryKey = params.toString();
  const load = useCallback(() => {
    setResult(null);
    api
      .get('/tasks', { params: cleanParams({ ...filters, limit: 15 }) })
      .then((res) => setResult(res.data))
      .catch((err) => setError(errorMessage(err)));
  }, [queryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  const activeFilters = ['status', 'priority', 'projectId', 'assigneeId', 'overdue', 'search'].filter((k) => filters[k]);
  const [sortField, sortDir] = filters.sort.split(':');
  const sortBy = (field) => setFilter({ sort: `${field}:${sortField === field && sortDir === 'asc' ? 'desc' : 'asc'}` });
  const SortHeader = ({ field, children, className = '' }) => (
    <th className={`px-3 py-2.5 font-medium ${className}`}>
      <button className="inline-flex items-center gap-1 uppercase hover:text-slate-800" onClick={() => sortBy(field)}>
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-indigo-600' : 'text-slate-300'}`} />
      </button>
    </th>
  );

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Search and filter tasks across all your projects"
        actions={
          canCreateProjects && (
            <button className="btn-primary" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> New task
            </button>
          )
        }
      />

      <div className="card mb-4 space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input className="input pl-9" placeholder="Search title or description…" value={searchText} onChange={(e) => setSearchText(e.target.value)} aria-label="Search tasks" />
          </div>
          <select className="input" value={filters.projectId} onChange={(e) => setFilter({ projectId: e.target.value })} aria-label="Project">
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input" value={filters.status} onChange={(e) => setFilter({ status: e.target.value })} aria-label="Status">
            <option value="">Any status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="input" value={filters.priority} onChange={(e) => setFilter({ priority: e.target.value })} aria-label="Priority">
            <option value="">Any priority</option>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="input" value={filters.assigneeId} onChange={(e) => setFilter({ assigneeId: e.target.value })} aria-label="Assignee">
            <option value="">Anyone</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={filters.overdue === 'true'} onChange={(e) => setFilter({ overdue: e.target.checked ? 'true' : '' })} />
            Overdue only
          </label>
          {activeFilters.length > 0 && (
            <button className="btn-ghost text-sm" onClick={() => { setSearchText(''); setParams({}); }}>
              <X className="h-4 w-4" /> Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        {error && <EmptyState title="Could not load tasks" description={error} />}
        {!result && !error && <PageLoader />}
        {result && result.data.length === 0 && <EmptyState icon={ListChecks} title="No tasks match" description="Try adjusting your filters." />}
        {result && result.data.length > 0 && (
          <>
            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {result.data.map((t) => (
                <li key={t.id} className="p-4">
                  <Link to={`/tasks/${t.id}`} className="font-medium text-slate-800">{t.title}</Link>
                  <p className="mb-2 text-xs text-slate-500">{t.project?.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <StatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                    <span className={isOverdue(t) ? 'font-medium text-red-600' : 'text-slate-500'}>Due {formatDate(t.dueDate)}</span>
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500">
                  <tr>
                    <SortHeader field="title" className="pl-5">Task</SortHeader>
                    <th className="px-3 py-2.5 font-medium uppercase">Project</th>
                    <SortHeader field="status">Status</SortHeader>
                    <SortHeader field="priority">Priority</SortHeader>
                    <th className="px-3 py-2.5 font-medium uppercase">Assignee</th>
                    <SortHeader field="dueDate">Due</SortHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="max-w-xs px-5 py-3">
                        <Link to={`/tasks/${t.id}`} className="block truncate font-medium text-slate-800 hover:text-indigo-600">{t.title}</Link>
                      </td>
                      <td className="max-w-[12rem] truncate px-3 py-3 text-slate-600">
                        <Link to={`/projects/${t.project?.id}`} className="hover:underline">{t.project?.name}</Link>
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-3 py-3"><PriorityBadge priority={t.priority} /></td>
                      <td className="px-3 py-3">
                        {t.assignee ? (
                          <span className="flex items-center gap-2"><Avatar user={t.assignee} size="h-6 w-6 text-[10px]" /><span className="truncate">{t.assignee.name}</span></span>
                        ) : (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-3 ${isOverdue(t) ? 'font-medium text-red-600' : 'text-slate-600'}`}>{formatDate(t.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={result.pagination} onChange={(page) => setFilter({ page: String(page) })} />
          </>
        )}
      </div>

      <TaskForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
    </div>
  );
}
