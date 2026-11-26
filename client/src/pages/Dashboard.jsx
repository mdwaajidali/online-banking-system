import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, FileText, Plus, Send } from 'lucide-react';
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

function today() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Dashboard() {
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
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="muted">{today()}</p>
        </div>
      </div>

      <section className="card summary" aria-label="Total balance">
        <div>
          <p className="summary-label">
            Total balance
            <button className="icon-btn icon-btn-sm" onClick={toggleHidden} aria-pressed={hidden} aria-label={hidden ? 'Show balances' : 'Hide balances'} title={hidden ? 'Show balances' : 'Hide balances'}>
              {hidden ? <Eye size={18} strokeWidth={1.75} /> : <EyeOff size={18} strokeWidth={1.75} />}
            </button>
          </p>
          <p className="summary-amount">{show(total)}</p>
          <p className="muted small">
            Across {list.length} {list.length === 1 ? 'account' : 'accounts'}
          </p>
        </div>
        <div className="row-actions">
          <Link to="/send" className="btn btn-primary">
            <Send size={18} strokeWidth={1.75} aria-hidden="true" />
            Send money
          </Link>
          <Link to="/statement" className="btn btn-ghost">
            <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
            Statement
          </Link>
        </div>
      </section>

      <div className="section-head">
        <h2>Your accounts</h2>
        {list.length < 3 ? (
          <Link to="/profile#open-account" className="btn btn-ghost btn-sm">
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            Open another account
          </Link>
        ) : null}
      </div>
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
        <h2>Recent activity</h2>
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
