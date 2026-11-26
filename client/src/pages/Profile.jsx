import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { dateTime, groupDigits } from '../lib/format.js';
import { Alert, Button, Field, PasswordInput } from '../components/ui.jsx';
import { PasswordChecklist, passwordChecks } from './Register.jsx';

function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setMsg({});
    const errs = {};
    if (!form.currentPassword) errs.currentPassword = 'Enter your current password';
    if (!passwordChecks(form.newPassword).every(([, ok]) => ok)) errs.newPassword = 'Password does not meet the rules below';
    if (form.newPassword !== form.confirm) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setMsg({ ok: 'Password changed. You have been signed out on all other devices.' });
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      else setMsg({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Change password</h2>
      <Alert kind="success">{msg.ok}</Alert>
      <Alert>{msg.error}</Alert>
      <Field label="Current password" error={errors.currentPassword}>
        {(id) => <PasswordInput id={id} autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} />}
      </Field>
      <Field label="New password" error={errors.newPassword}>
        {(id) => <PasswordInput id={id} autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} />}
      </Field>
      <PasswordChecklist value={form.newPassword} />
      <Field label="Type the new password again" error={errors.confirm}>
        {(id) => <PasswordInput id={id} autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />}
      </Field>
      <Button type="submit" loading={busy}>
        Change password
      </Button>
    </form>
  );
}

function OpenAccount() {
  const { data, reload } = useApi('/accounts');
  const [type, setType] = useState('savings');
  const [nickname, setNickname] = useState('');
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.location.hash === '#open-account') document.getElementById('open-account')?.scrollIntoView();
  }, []);

  if (!data) return null;
  const full = data.accounts.length >= 3;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg({});
    try {
      const r = await api('/accounts', { method: 'POST', body: { type, nickname: nickname.trim() || undefined } });
      setMsg({ ok: `Your new account ${groupDigits(r.account.accountNumber)} is ready.` });
      setNickname('');
      reload();
    } catch (err) {
      setMsg({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" id="open-account" onSubmit={submit}>
      <h2>Open another account</h2>
      <p className="muted">You have {data.accounts.length} of 3 accounts.</p>
      <Alert kind="success">{msg.ok}</Alert>
      <Alert>{msg.error}</Alert>
      {full ? (
        <p>You already have the maximum number of accounts.</p>
      ) : (
        <>
          <Field label="Account type">
            {(id) => (
              <select id={id} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="savings">Savings</option>
                <option value="current">Current</option>
              </select>
            )}
          </Field>
          <Field label="Nickname (optional)" hint="For example: Rent, Emergency fund">
            {(id) => <input id={id} maxLength={40} value={nickname} onChange={(e) => setNickname(e.target.value)} />}
          </Field>
          <Button type="submit" loading={busy}>
            Open account
          </Button>
        </>
      )}
    </form>
  );
}

export default function Profile() {
  const { user } = useAuth();
  return (
    <div className="narrow stack">
      <h1>Profile</h1>
      <div className="card">
        <dl className="details">
          <div>
            <dt>Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          {user.phone ? (
            <div>
              <dt>Mobile</dt>
              <dd>{user.phone}</dd>
            </div>
          ) : null}
          {user.lastLoginAt ? (
            <div>
              <dt>Last sign-in</dt>
              <dd>{dateTime(user.lastLoginAt)}</dd>
            </div>
          ) : null}
        </dl>
        <p className="small muted">If you don't recognise the last sign-in time, change your password right away.</p>
      </div>
      {user.role === 'customer' ? <OpenAccount /> : null}
      <ChangePassword />
    </div>
  );
}
