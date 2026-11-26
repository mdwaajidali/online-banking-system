import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { Alert, Button, Field, PasswordInput } from '../components/ui.jsx';
import { Logo } from '../components/Layout.jsx';

export function passwordChecks(pw) {
  return [
    ['At least 8 characters', pw.length >= 8],
    ['Contains a letter', /[A-Za-z]/.test(pw)],
    ['Contains a number', /\d/.test(pw)],
  ];
}

export function PasswordChecklist({ value }) {
  return (
    <ul className="checklist" aria-label="Password rules">
      {passwordChecks(value).map(([label, ok]) => (
        <li key={label} className={ok ? 'ok' : ''}>
          <span aria-hidden="true">{ok ? '✓' : '○'}</span> {label}
        </li>
      ))}
    </ul>
  );
}

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '', accountType: 'savings' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Please enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Please enter a valid email';
    if (form.phone && !/^[6-9]\d{9}$/.test(form.phone)) errs.phone = 'Enter a 10-digit mobile number';
    if (!passwordChecks(form.password).every(([, ok]) => ok)) errs.password = 'Password does not meet the rules below';
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const { confirm: _c, ...body } = form;
      await register(body);
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      else setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo />
        <h1>Open an account</h1>
        <p className="muted">It takes about a minute. Your account number is ready immediately.</p>
        <Alert>{error}</Alert>

        <form onSubmit={submit} noValidate>
          <Field label="Full name" error={errors.name}>
            {(id) => <input id={id} autoComplete="name" value={form.name} onChange={set('name')} autoFocus />}
          </Field>
          <Field label="Email address" error={errors.email}>
            {(id) => <input id={id} type="email" autoComplete="email" value={form.email} onChange={set('email')} />}
          </Field>
          <Field label="Mobile number (optional)" error={errors.phone}>
            {(id) => <input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={form.phone} onChange={set('phone')} />}
          </Field>

          <fieldset className="choice-group">
            <legend>Account type</legend>
            {[
              ['savings', 'Savings', 'For personal money and everyday spending'],
              ['current', 'Current', 'For business or frequent transactions'],
            ].map(([value, title, desc]) => (
              <label key={value} className={`choice ${form.accountType === value ? 'selected' : ''}`}>
                <input type="radio" name="accountType" value={value} checked={form.accountType === value} onChange={set('accountType')} />
                <span>
                  <strong>{title}</strong>
                  <small>{desc}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <Field label="Create a password" error={errors.password}>
            {(id) => <PasswordInput id={id} autoComplete="new-password" value={form.password} onChange={set('password')} />}
          </Field>
          <PasswordChecklist value={form.password} />
          <Field label="Type the password again" error={errors.confirm}>
            {(id) => <PasswordInput id={id} autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />}
          </Field>

          <Button type="submit" loading={busy} className="btn-block">
            Open my account
          </Button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
