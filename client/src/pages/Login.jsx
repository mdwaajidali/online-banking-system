import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { Alert, Button, Field, PasswordInput } from '../components/ui.jsx';
import { Logo } from '../components/Layout.jsx';

const DEMO = [
  ['Customer', 'aarav@demo.bank', 'Aarav@12345'],
  ['Customer', 'diya@demo.bank', 'Diya@12345'],
  ['Bank staff', 'admin@demo.bank', 'Admin@12345'],
];

export default function Login() {
  const { login, notice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo />
        <h1>Sign in</h1>
        <p className="muted">Check your balance and send money safely.</p>

        <Alert kind="info">{notice}</Alert>
        <Alert>{error}</Alert>

        <form onSubmit={submit} noValidate>
          <Field label="Email address">
            {(id) => (
              <input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            )}
          </Field>
          <Field label="Password">
            {(id) => (
              <PasswordInput id={id} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            )}
          </Field>
          <Button type="submit" loading={busy} className="btn-block">
            Sign in
          </Button>
        </form>

        <p className="auth-switch">
          New to Kosh Bank? <Link to="/register">Open an account</Link>
        </p>

        {import.meta.env.DEV ? (
          <details className="demo-box">
            <summary>Demo logins (development only)</summary>
            <ul>
              {DEMO.map(([role, e, p]) => (
                <li key={e}>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setEmail(e);
                      setPassword(p);
                    }}
                  >
                    {role}: {e}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}
