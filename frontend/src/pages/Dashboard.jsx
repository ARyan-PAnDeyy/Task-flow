import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, ListChecks, CheckCircle2, AlertTriangle, Clock, CalendarClock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatCard, PageHeader, PageLoader, ProgressBar, PriorityBadge, Avatar, EmptyState, ProjectStatusBadge } from '../components/ui';
import { STATUS_LABELS, PRIORITY_LABELS, formatDate, daysUntil } from '../utils/format';

// Colorblind-safe chart colors, assigned in a fixed order.
const SERIES = { blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a' };
const STATUS_COLORS = { TODO: SERIES.orange, IN_PROGRESS: SERIES.blue, COMPLETED: SERIES.aqua };
// Priority is ordinal -> one hue, light to dark.
const PRIORITY_COLORS = { LOW: '#9ec5f4', MEDIUM: '#5a9ae6', HIGH: '#1d5aa8' };
const AXIS = { fontSize: 12, fill: '#64748b' };

function ChartTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-slate-700">{labelFormatter ? labelFormatter(label) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload.fill }} />
          {p.name}: <span className="font-semibold text-slate-900">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function StatusBreakdown({ data, total }) {
  if (!total) return <EmptyState title="No tasks yet" />;
  return (
    <div>
      <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded">
        {Object.entries(data).map(([status, n]) =>
          n ? (
            <div
              key={status}
              title={`${STATUS_LABELS[status]}: ${n}`}
              className="h-full first:rounded-l last:rounded-r"
              style={{ width: `${(n / total) * 100}%`, background: STATUS_COLORS[status] }}
            />
          ) : null
        )}
      </div>
      <ul className="mt-4 space-y-2">
        {Object.entries(data).map(([status, n]) => (
          <li key={status} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLORS[status] }} />
              {STATUS_LABELS[status]}
            </span>
            <span className="font-medium text-slate-900">
              {n} <span className="font-normal text-slate-400">({Math.round((n / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/dashboard')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <EmptyState icon={AlertTriangle} title="Could not load dashboard" description={error} />;
  if (!data) return <PageLoader />;

  const { summary, tasksByStatus, tasksByPriority, projectProgress, upcomingDeadlines, completionTrend, teamPerformance } = data;
  const priorityData = Object.entries(tasksByPriority).map(([k, v]) => ({ key: k, name: PRIORITY_LABELS[k], value: v }));
  const shortDate = (d) => formatDate(d, { day: 'numeric', month: 'short' });

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome back, ${user.name.split(' ')[0]}`} subtitle="Here's what's happening across your projects." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FolderKanban} label="Projects" value={summary.totalProjects} hint={`${summary.activeProjects} active`} />
        <StatCard icon={ListChecks} label="Total tasks" value={summary.totalTasks} hint={`${summary.myOpenTasks} open and assigned to you`} color="blue" />
        <StatCard icon={CheckCircle2} label="Completed" value={summary.completedTasks} hint={`${summary.completionRate}% completion rate`} color="green" />
        <StatCard icon={AlertTriangle} label="Overdue" value={summary.overdueTasks} hint={`${summary.pendingTasks} pending in total`} color={summary.overdueTasks ? 'red' : 'amber'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Completed vs created</h2>
          <p className="mb-4 text-sm text-slate-500">Tasks per day, last 14 days</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={completionTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip labelFormatter={shortDate} />} cursor={{ stroke: '#94a3b8', strokeWidth: 1 }} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="completed" name="Completed" stroke={SERIES.blue} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                <Line type="monotone" dataKey="created" name="Created" stroke={SERIES.orange} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold text-slate-900">Task status</h2>
          <p className="mb-4 text-sm text-slate-500">{summary.totalTasks} tasks</p>
          <StatusBreakdown data={tasksByStatus} total={summary.totalTasks} />
          <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-900">By priority</h3>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }} barCategoryGap={6}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="value" name="Tasks" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 12, fill: '#334155' }}>
                  {priorityData.map((d) => (
                    <Cell key={d.key} fill={PRIORITY_COLORS[d.key]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Project progress</h2>
            <Link to="/projects" className="text-sm font-medium text-indigo-600 hover:underline">View all</Link>
          </div>
          {projectProgress.length === 0 ? (
            <EmptyState icon={FolderKanban} title="No open projects" />
          ) : (
            <ul className="space-y-4">
              {projectProgress.map((p) => (
                <li key={p.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <Link to={`/projects/${p.id}`} className="truncate font-medium text-slate-800 hover:text-indigo-600">{p.name}</Link>
                    <span className="shrink-0 text-slate-500">
                      {p.completed}/{p.total} · <span className="font-semibold text-slate-900">{p.progress}%</span>
                    </span>
                  </div>
                  <ProgressBar value={p.progress} />
                  <p className="mt-1 text-xs text-slate-400">Deadline {formatDate(p.deadline)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Upcoming deadlines</h2>
          {upcomingDeadlines.tasks.length === 0 && upcomingDeadlines.projects.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nothing due in the next two weeks" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcomingDeadlines.projects.map((p) => (
                <li key={`p${p.id}`} className="flex items-center gap-3 py-2.5">
                  <FolderKanban className="h-4 w-4 shrink-0 text-indigo-500" />
                  <Link to={`/projects/${p.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-indigo-600">{p.name}</Link>
                  <ProjectStatusBadge status={p.status} />
                  <DueIn date={p.deadline} />
                </li>
              ))}
              {upcomingDeadlines.tasks.map((t) => (
                <li key={`t${t.id}`} className="flex items-center gap-3 py-2.5">
                  <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/tasks/${t.id}`} className="block truncate text-sm font-medium hover:text-indigo-600">{t.title}</Link>
                    <p className="truncate text-xs text-slate-500">{t.project?.name} · {t.assignee?.name || 'Unassigned'}</p>
                  </div>
                  <PriorityBadge priority={t.priority} />
                  <DueIn date={t.dueDate} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="p-5 pb-3">
          <h2 className="font-semibold text-slate-900">Team performance</h2>
          <p className="text-sm text-slate-500">Assigned tasks per person across your projects</p>
        </div>
        {teamPerformance.length === 0 ? (
          <EmptyState title="No assigned tasks yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Member</th>
                  <th className="px-3 py-2.5 text-right font-medium">Assigned</th>
                  <th className="px-3 py-2.5 text-right font-medium">In progress</th>
                  <th className="px-3 py-2.5 text-right font-medium">Completed</th>
                  <th className="px-3 py-2.5 text-right font-medium">Overdue</th>
                  <th className="w-48 px-5 py-2.5 font-medium">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teamPerformance.map((m) => (
                  <tr key={m.user.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <Avatar user={m.user} size="h-7 w-7 text-[10px]" />
                        <span className="font-medium text-slate-800">{m.user.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{m.assigned}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{m.inProgress}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{m.completed}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${m.overdue ? 'font-semibold text-red-600' : ''}`}>{m.overdue}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={m.completionRate} />
                        <span className="w-10 text-right text-xs tabular-nums text-slate-600">{m.completionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function DueIn({ date }) {
  const d = daysUntil(date);
  const text = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d}d`;
  return <span className={`w-16 shrink-0 text-right text-xs font-medium ${d <= 2 ? 'text-red-600' : 'text-slate-500'}`}>{text}</span>;
}
