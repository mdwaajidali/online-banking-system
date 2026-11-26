import { NavLink, Outlet } from 'react-router-dom';
import { FileText, Home, Landmark, LogOut, ScrollText, Send, User, Users } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { IdleTimeout } from './IdleTimeout.jsx';

const ICON = { size: 18, strokeWidth: 1.75, 'aria-hidden': true };

export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark">
        <Landmark size={18} strokeWidth={2} aria-hidden="true" />
      </span>
      Kosh Bank
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const links =
    user.role === 'admin'
      ? [
          ['/admin', 'Customers', Users],
          ['/admin/activity', 'Activity log', ScrollText],
          ['/profile', 'Profile', User],
        ]
      : [
          ['/', 'Home', Home],
          ['/send', 'Send money', Send],
          ['/statement', 'Statement', FileText],
          ['/profile', 'Profile', User],
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
            {links.map(([to, label, Icon]) => (
              <NavLink key={to} to={to} end>
                <Icon {...ICON} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-user">
            <span className="who">{user.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => logout('You have signed out safely.')}>
              <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
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
