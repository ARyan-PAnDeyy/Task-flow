import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, FolderKanban, Users, CalendarDays } from 'lucide-react';
import api, { cleanParams, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import useDebounce from '../hooks/useDebounce';
import ProjectForm from '../components/ProjectForm';
import { PageHeader, PageLoader, EmptyState, Pagination, ProgressBar, ProjectStatusBadge, Avatar } from '../components/ui';
import { PROJECT_STATUS_LABELS, formatDate, daysUntil } from '../utils/format';

export default function Projects() {
  const { canCreateProjects } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ search: '', status: '', sort: 'createdAt:desc', page: 1 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const search = useDebounce(filters.search);

  const load = useCallback(() => {
    api
      .get('/projects', { params: cleanParams({ ...filters, search, limit: 9 }) })
      .then((res) => setResult(res.data))
      .catch((err) => setError(errorMessage(err)));
  }, [filters.status, filters.sort, filters.page, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  const update = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value, page: 1 }));

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="All projects you manage or belong to"
        actions={
          canCreateProjects && (
            <button className="btn-primary" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> New project
            </button>
          )
        }
      />

      <div className="card mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search projects…" value={filters.search} onChange={update('search')} aria-label="Search projects" />
        </div>
        <select className="input" value={filters.status} onChange={update('status')} aria-label="Filter by status">
          <option value="">All statuses</option>
          {Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className="input" value={filters.sort} onChange={update('sort')} aria-label="Sort">
          <option value="createdAt:desc">Newest first</option>
          <option value="createdAt:asc">Oldest first</option>
          <option value="deadline:asc">Deadline (soonest)</option>
          <option value="name:asc">Name (A–Z)</option>
        </select>
      </div>

      {error && <EmptyState title="Could not load projects" description={error} />}
      {!result && !error && <PageLoader />}
      {result && result.data.length === 0 && (
        <div className="card">
          <EmptyState
            icon={FolderKanban}
            title="No projects found"
            description={filters.search || filters.status ? 'Try different filters.' : 'Projects you are added to will appear here.'}
          />
        </div>
      )}
      {result && result.data.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.data.map((p) => {
              const d = daysUntil(p.deadline);
              const late = d !== null && d < 0 && p.status !== 'COMPLETED';
              return (
                <Link key={p.id} to={`/projects/${p.id}`} className="card flex flex-col p-5 transition hover:border-indigo-300 hover:shadow-md">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 font-semibold text-slate-900">{p.name}</h3>
                    <ProjectStatusBadge status={p.status} />
                  </div>
                  <p className="mb-4 line-clamp-2 min-h-10 text-sm text-slate-500">{p.description || 'No description'}</p>
                  <div className="mt-auto">
                    <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                      <span>{p.stats.completed}/{p.stats.total} tasks</span>
                      <span className="font-semibold text-slate-700">{p.stats.progress}%</span>
                    </div>
                    <ProgressBar value={p.stats.progress} />
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        {p.manager ? <Avatar user={p.manager} size="h-6 w-6 text-[10px]" /> : null}
                        {p.manager?.name || 'No manager'}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{p.memberCount}</span>
                        <span className={`flex items-center gap-1 ${late ? 'font-medium text-red-600' : ''}`}>
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(p.deadline, { day: 'numeric', month: 'short' })}
                        </span>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="card mt-4">
            <Pagination pagination={result.pagination} onChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </div>
        </>
      )}

      <ProjectForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={(p) => navigate(`/projects/${p.id}`)} />
    </div>
  );
}
