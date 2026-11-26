import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { IdleTimeout } from './IdleTimeout.jsx';

export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path d="M8 13h16L16 7zM9 14h3v8H9zm5.5 0h3v8h-3zM20 14h3v8h-3zM8 23h16v2H8z" fill="var(--bg)" />
      </svg>
      Kosh Bank
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const links =
    user.role === 'admin'
      ? [
          ['/admin', 'Customers'],
          ['/admin/activity', 'Activity log'],
          ['/profile', 'Profile'],
        ]
      : [
          ['/', 'Home'],
          ['/send', 'Send money'],
          ['/statement', 'Statement'],
          ['/profile', 'Profile'],
        ];

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <nav aria-label="Main">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-user">
            <span className="who">{user.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => logout('You have signed out safely.')}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="container">
        <Outlet />
      </main>
      <footer className="footer container">
        Kosh Bank never asks for your password or OTP by phone, SMS or email.
      </footer>
      <IdleTimeout />
    </div>
  );
}
