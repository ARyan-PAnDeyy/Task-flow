import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CircleCheckBig, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { errorMessage, fieldErrors } from '../api/client';
import { Spinner } from '../components/ui';

const DEMO = [
  { label: 'Admin', email: 'admin@taskflow.com', password: 'Admin@123' },
  { label: 'Manager', email: 'priya.pm@taskflow.com', password: 'Password@123' },
  { label: 'Member', email: 'ananya@taskflow.com', password: 'Password@123' },
];

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <CircleCheckBig className="h-8 w-8 text-indigo-400" /> TaskFlow
        </div>
        <div>
          <h2 className="text-4xl font-semibold leading-tight">Plan projects.<br />Ship tasks.<br />Keep everyone aligned.</h2>
          <p className="mt-4 max-w-md text-slate-400">
            Role-based project and task management for teams: track progress, deadlines and performance in one place.
          </p>
        </div>
        <p className="text-sm text-slate-500">© {new Date().getFullYear()} TaskFlow</p>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 text-xl font-semibold lg:hidden">
            <CircleCheckBig className="h-7 w-7 text-indigo-600" /> TaskFlow
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>
          {children}
          <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} className="input pr-10" value={value} onChange={onChange} autoComplete={autoComplete} />
      <button type="button" className="absolute right-2 top-2 text-slate-400 hover:text-slate-600" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return setError('Email and password are required');
    setLoading(true);
    setError('');
    try {
      await login(form.email, form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
    return undefined;
  };

  return (
    <AuthShell title="Sign in" subtitle="Welcome back! Enter your details." footer={<>No account? <Link className="font-medium text-indigo-600 hover:underline" to="/register">Create one</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput id="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" />
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading && <Spinner className="h-4 w-4 text-white" />} Sign in
        </button>
      </form>
      <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-3">
        <p className="mb-2 text-xs font-medium text-slate-500">Demo accounts (after running the seed)</p>
        <div className="flex gap-2">
          {DEMO.map((d) => (
            <button key={d.label} type="button" className="btn-secondary flex-1 px-2 py-1.5 text-xs" onClick={() => setForm({ email: d.email, password: d.password })}>
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email';
    if (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) {
      e.password = 'At least 8 characters with upper & lower case letters and a number';
    }
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match';
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;
    setLoading(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      toast.success('Account created');
      navigate('/', { replace: true });
    } catch (err) {
      setErrors({ ...fieldErrors(err), form: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <AuthShell title="Create an account" subtitle="New accounts join as Team Members. An admin can change your role." footer={<>Already registered? <Link className="font-medium text-indigo-600 hover:underline" to="/login">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {errors.form && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{errors.form}</div>}
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className="input" value={form.name} onChange={set('name')} autoComplete="name" autoFocus />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={form.email} onChange={set('email')} autoComplete="email" />
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput id="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
          {errors.password && <p className="field-error">{errors.password}</p>}
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <PasswordInput id="confirm" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
          {errors.confirm && <p className="field-error">{errors.confirm}</p>}
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading && <Spinner className="h-4 w-4 text-white" />} Create account
        </button>
      </form>
    </AuthShell>
  );
}
