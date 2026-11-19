import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import api from '../api/client';
import { Avatar, RoleBadge, Spinner } from './ui';

/** Searchable multi-select list of active users. */
export default function UserPicker({ selected, onChange, exclude = [] }) {
  const [users, setUsers] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get('/users', { params: { limit: 100, isActive: true } }).then((res) => setUsers(res.data.data));
  }, []);

  const visible = useMemo(() => {
    if (!users) return [];
    const q = query.toLowerCase();
    return users.filter((u) => !exclude.includes(u.id) && (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
  }, [users, query, exclude]);

  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  if (!users) return <Spinner />;
  return (
    <div className="rounded-lg border border-slate-300">
      <div className="relative border-b border-slate-200">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          className="w-full rounded-t-lg py-2 pl-9 pr-3 text-sm focus:outline-none"
          placeholder="Search people…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul className="max-h-52 divide-y divide-slate-100 overflow-y-auto">
        {visible.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-500">No users found</li>}
        {visible.map((u) => (
          <li key={u.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
              <input type="checkbox" className="h-4 w-4 rounded accent-indigo-600" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
              <Avatar user={u} size="h-7 w-7 text-[10px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{u.name}</span>
                <span className="block truncate text-xs text-slate-500">{u.email}</span>
              </span>
              <RoleBadge role={u.role} />
            </label>
          </li>
        ))}
      </ul>
      {selected.length > 0 && <p className="border-t border-slate-200 px-3 py-1.5 text-xs text-slate-500">{selected.length} selected</p>}
    </div>
  );
}
