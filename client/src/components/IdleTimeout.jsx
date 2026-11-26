import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { Button, Modal } from './ui.jsx';

const IDLE_MS = 5 * 60 * 1000; // warn after 5 minutes without activity
const WARNING_SECONDS = 60;

/** Signs the user out automatically if they walk away from the screen (e.g. on a shared computer). */
export function IdleTimeout() {
  const { logout } = useAuth();
  const [warning, setWarning] = useState(false);
  const [left, setLeft] = useState(WARNING_SECONDS);
  const timer = useRef();

  useEffect(() => {
    if (warning) return;
    const reset = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setLeft(WARNING_SECONDS);
        setWarning(true);
      }, IDLE_MS);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [warning]);

  useEffect(() => {
    if (!warning) return;
    if (left <= 0) {
      logout('You were signed out because you were inactive. This keeps your money safe.');
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [warning, left, logout]);

  if (!warning) return null;
  return (
    <Modal title="Are you still there?">
      <p>
        For your safety, you will be signed out in <strong>{left} seconds</strong>.
      </p>
      <div className="row-actions">
        <Button
          onClick={async () => {
            await api('/auth/me').catch(() => {}); // refreshes the session on the server
            setWarning(false);
          }}
        >
          Stay signed in
        </Button>
        <Button variant="ghost" onClick={() => logout('You have signed out safely.')}>
          Sign out now
        </Button>
      </div>
    </Modal>
  );
}
