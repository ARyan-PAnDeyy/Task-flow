import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Search, Users as UsersIcon } from 'lucide-react';
import api, { cleanParams, errorMessage, fieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import useDebounce from '../hooks/useDebounce';
import { PageHeader, PageLoader, EmptyState, Pagination, Avatar, Badge, Modal, Spinner } from '../components/ui';
import { ROLE_LABELS, formatDate, timeAgo } from '../utils/format';

export default function Users() {
  const { user: me } = useAuth();
  const [filters, setFilters] = useState({ search: '', role: '', page: 1 });
  const [result, setResult] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const search = useDebounce(filters.search);

  const load = useCallback(() => {
    api
      .get('/users', { params: cleanParams({ ...filters, search, limit: 15, sort: 'name:asc' }) })
      .then((res) => setResult(res.data))
      .catch((err) => toast.error(errorMessage(err)));
  }, [filters.role, filters.page, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  const update = async (u, patch) => {
    try {
      const res = await api.patch(`/users/${u.id}`, patch);
      setResult((r) => ({ ...r, data: r.data.map((x) => (x.id === u.id ? res.data.data : x)) }));
      toast.success(`${u.name} updated`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage accounts and roles"
        actions={<button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add user</button>}
      />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_200px]">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search name or email…" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })} aria-label="Search users" />
        </div>
        <select className="input" value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value, page: 1 })} aria-label="Role">
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {!result && <PageLoader />}
        {result && result.data.length === 0 && <EmptyState icon={UsersIcon} title="No users found" />}
        {result && result.data.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">User</th>
                    <th className="px-3 py-2.5 font-medium">Role</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Last login</th>
                    <th className="px-3 py-2.5 font-medium">Joined</th>
                    <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((u) => (
                    <tr key={u.id} className={u.isActive ? '' : 'bg-slate-50/60 text-slate-400'}>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-3">
                          <Avatar user={u} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-800">{u.name}{u.id === me.id && ' (you)'}</span>
                            <span className="block truncate text-xs text-slate-500">{u.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className="input w-44 py-1.5"
                          value={u.role}
                          disabled={u.id === me.id}
                          onChange={(e) => update(u, { role: e.target.value })}
                          aria-label={`Role for ${u.name}`}
                        >
                          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">{u.isActive ? <Badge color="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                      <td className="px-3 py-3">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</td>
                      <td className="px-3 py-3">{formatDate(u.createdAt)}</td>
                      <td className="px-5 py-3 text-right">
                        {u.id !== me.id && (
                          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => update(u, { isActive: !u.isActive })}>
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={result.pagination} onChange={(page) => setFilters({ ...filters, page })} />
          </>
        )}
      </div>
      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}

function CreateUserModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'TEAM_MEMBER' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users', form);
      toast.success('User created');
      setForm({ name: '', email: '', password: '', role: 'TEAM_MEMBER' });
      setErrors({});
      onCreated();
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add user"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" form="user-form" disabled={saving}>{saving && <Spinner className="h-4 w-4 text-white" />} Create</button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4" noValidate>
        {[
          ['name', 'Full name', 'text'],
          ['email', 'Email', 'email'],
          ['password', 'Temporary password', 'password'],
        ].map(([k, label, type]) => (
          <div key={k}>
            <label className="label" htmlFor={`u-${k}`}>{label}</label>
            <input id={`u-${k}`} type={type} className="input" value={form[k]} onChange={set(k)} />
            {errors[k] && <p className="field-error">{errors[k]}</p>}
          </div>
        ))}
        <div>
          <label className="label" htmlFor="u-role">Role</label>
          <select id="u-role" className="input" value={form.role} onChange={set('role')}>
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </form>
    </Modal>
  );
}
