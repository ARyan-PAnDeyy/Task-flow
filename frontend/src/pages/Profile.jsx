import { useState } from 'react';
import toast from 'react-hot-toast';
import api, { errorMessage, fieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Avatar, RoleBadge, Spinner } from '../components/ui';
import { formatDate } from '../utils/format';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    setSavingName(true);
    try {
      const res = await api.patch('/auth/me', { name: name.trim() });
      setUser(res.data.data);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return setPwErrors({ confirm: 'Passwords do not match' });
    setSavingPw(true);
    setPwErrors({});
    try {
      await api.post('/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      toast.success('Password changed');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setSavingPw(false);
    }
    return undefined;
  };

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Profile" />
      <div className="card flex items-center gap-4 p-5">
        <Avatar user={user} size="h-14 w-14 text-lg" />
        <div>
          <p className="text-lg font-semibold">{user.name}</p>
          <p className="text-sm text-slate-500">{user.email}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <RoleBadge role={user.role} /> Member since {formatDate(user.createdAt)}
          </div>
        </div>
      </div>

      <form onSubmit={saveName} className="card space-y-4 p-5">
        <h2 className="font-semibold">Personal details</h2>
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={100} />
        </div>
        <button className="btn-primary" disabled={savingName || name.trim().length < 2 || name === user.name}>
          {savingName && <Spinner className="h-4 w-4 text-white" />} Save
        </button>
      </form>

      <form onSubmit={savePassword} className="card space-y-4 p-5" noValidate>
        <h2 className="font-semibold">Change password</h2>
        {[
          ['currentPassword', 'Current password', 'current-password'],
          ['newPassword', 'New password', 'new-password'],
          ['confirm', 'Confirm new password', 'new-password'],
        ].map(([k, label, ac]) => (
          <div key={k}>
            <label className="label" htmlFor={k}>{label}</label>
            <input id={k} type="password" className="input" value={pw[k]} autoComplete={ac} onChange={(e) => setPw({ ...pw, [k]: e.target.value })} />
            {pwErrors[k] && <p className="field-error">{pwErrors[k]}</p>}
          </div>
        ))}
        <button className="btn-primary" disabled={savingPw || !pw.currentPassword || !pw.newPassword}>
          {savingPw && <Spinner className="h-4 w-4 text-white" />} Update password
        </button>
      </form>
    </div>
  );
}
