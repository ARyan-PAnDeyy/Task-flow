import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ScrollText } from 'lucide-react';
import api, { cleanParams, errorMessage } from '../api/client';
import { PageHeader, PageLoader, EmptyState, Pagination, Badge, Avatar } from '../components/ui';
import { formatDateTime } from '../utils/format';

const ACTION_COLORS = { CREATE: 'green', DELETE: 'red', UPDATE: 'blue', STATUS_CHANGE: 'blue', LOGIN: 'slate', REGISTER: 'violet' };
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'LOGIN', 'REGISTER', 'ADD_MEMBERS', 'REMOVE_MEMBER', 'COMMENT', 'UPLOAD'];

function summarize(details) {
  if (!details) return '';
  return Object.entries(details)
    .map(([k, v]) => {
      if (v && typeof v === 'object' && 'from' in v) return `${k}: ${v.from ?? '∅'} → ${v.to ?? '∅'}`;
      return `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`;
    })
    .join(' · ');
}

export default function AuditLogs() {
  const [filters, setFilters] = useState({ action: '', entityType: '', page: 1 });
  const [result, setResult] = useState(null);

  useEffect(() => {
    api
      .get('/audit-logs', { params: cleanParams({ ...filters, limit: 20 }) })
      .then((res) => setResult(res.data))
      .catch((err) => toast.error(errorMessage(err)));
  }, [filters]);

  return (
    <div>
      <PageHeader title="Audit logs" subtitle="Every significant change in the system, newest first" />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:w-1/2">
        <select className="input" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })} aria-label="Action">
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
        </select>
        <select className="input" value={filters.entityType} onChange={(e) => setFilters({ ...filters, entityType: e.target.value, page: 1 })} aria-label="Entity">
          <option value="">All entities</option>
          {['User', 'Project', 'Task', 'System'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="card overflow-hidden">
        {!result && <PageLoader />}
        {result && result.data.length === 0 && <EmptyState icon={ScrollText} title="No log entries" />}
        {result && result.data.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">When</th>
                    <th className="px-3 py-2.5 font-medium">User</th>
                    <th className="px-3 py-2.5 font-medium">Action</th>
                    <th className="px-3 py-2.5 font-medium">Entity</th>
                    <th className="px-3 py-2.5 font-medium">Details</th>
                    <th className="px-5 py-2.5 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((l) => (
                    <tr key={l.id} className="align-top">
                      <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDateTime(l.createdAt)}</td>
                      <td className="px-3 py-3">
                        {l.user ? <span className="flex items-center gap-2"><Avatar user={l.user} size="h-6 w-6 text-[10px]" />{l.user.name}</span> : <span className="text-slate-400">System</span>}
                      </td>
                      <td className="px-3 py-3"><Badge color={ACTION_COLORS[l.action] || 'indigo'}>{l.action}</Badge></td>
                      <td className="whitespace-nowrap px-3 py-3">{l.entityType}{l.entityId ? ` #${l.entityId}` : ''}</td>
                      <td className="max-w-md px-3 py-3 text-xs text-slate-500"><span className="line-clamp-2 break-all" title={summarize(l.details)}>{summarize(l.details)}</span></td>
                      <td className="px-5 py-3 text-xs text-slate-400">{l.ipAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={result.pagination} onChange={(page) => setFilters({ ...filters, page })} />
          </>
        )}
      </div>
    </div>
  );
}
