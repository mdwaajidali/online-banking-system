import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/useApi.js';
import { groupDigits, money } from '../lib/format.js';
import { Alert, CopyButton, EmptyState, Loading } from '../components/ui.jsx';
import { TxList } from '../components/TxList.jsx';

function readHidden() {
  try {
    return localStorage.getItem('hideBalances') === '1';
  } catch {
    return false;
  }
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const accounts = useApi('/accounts');
  const recent = useApi('/transactions/recent');
  const [hidden, setHidden] = useState(readHidden);

  const toggleHidden = () => {
    setHidden((h) => {
      try {
        localStorage.setItem('hideBalances', h ? '0' : '1');
      } catch {
        /* storage blocked */
      }
      return !h;
    });
  };

  if (accounts.loading && !accounts.data) return <Loading />;
  if (accounts.error) return <Alert>{accounts.error.message}</Alert>;

  const list = accounts.data.accounts;
  const total = list.reduce((s, a) => s + a.balance, 0);
  const { daily, usedToday } = accounts.data.limits;
  const show = (v) => (hidden ? '₹ ••••••' : money(v));

  return (
    <>
      <section className="hero">
        <div>
          <p className="muted">
            {greeting()}, {user.name.split(' ')[0]}
          </p>
          <p className="hero-label">Total balance</p>
          <p className="hero-amount">{show(total)}</p>
          <button className="link-btn" onClick={toggleHidden} aria-pressed={hidden}>
            {hidden ? 'Show balances' : 'Hide balances'}
          </button>
        </div>
        <div className="hero-actions">
          <Link to="/send" className="btn btn-primary btn-lg">
            Send money
          </Link>
          <Link to="/statement" className="btn btn-secondary btn-lg">
            View statement
          </Link>
        </div>
      </section>

      <h2 className="section-title">Your accounts</h2>
      <div className="account-grid">
        {list.map((a) => (
          <article key={a.id} className="account-card">
            <div className="account-top">
              <span className="account-type">{a.nickname || (a.type === 'savings' ? 'Savings account' : 'Current account')}</span>
              {a.status !== 'active' ? <span className="badge badge-warn">{a.status}</span> : null}
            </div>
            <p className="account-balance">{show(a.balance)}</p>
            <p className="account-number">
              <span className="mono">{groupDigits(a.accountNumber)}</span> <CopyButton text={a.accountNumber} />
            </p>
            {a.status === 'frozen' ? (
              <p className="small warn-text">This account is on hold. Please contact the bank to reactivate it.</p>
            ) : null}
          </article>
        ))}
        {list.length < 3 ? (
          <Link to="/profile#open-account" className="account-card account-add">
            + Open another account
          </Link>
        ) : null}
      </div>

      <div className="limit">
        <div className="limit-text">
          <span>Sent today</span>
          <span>
            {money(usedToday)} of {money(daily)} daily limit
          </span>
        </div>
        <div className="limit-bar" role="progressbar" aria-valuemin={0} aria-valuemax={daily} aria-valuenow={usedToday} aria-label="Daily transfer limit used">
          <span style={{ width: `${Math.min(100, (usedToday / daily) * 100)}%` }} />
        </div>
      </div>

      <div className="section-head">
        <h2 className="section-title">Recent activity</h2>
        <Link to="/statement">See all</Link>
      </div>
      <div className="card">
        {recent.loading && !recent.data ? (
          <Loading />
        ) : recent.data?.transactions.length ? (
          <TxList items={recent.data.transactions} />
        ) : (
          <EmptyState title="No transactions yet">
            <p>Share your account number to receive money, or visit a branch to deposit cash.</p>
          </EmptyState>
        )}
      </div>
    </>
  );
}
