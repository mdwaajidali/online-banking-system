import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { accountLabel, dateOnly, groupDigits, money } from '../lib/format.js';
import { Alert, Button, EmptyState, Field, Loading, Modal } from '../components/ui.jsx';

function CashModal({ account, direction, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isDeposit = direction === 'deposit';

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0) {
      setError('Enter an amount like 500 or 1250.50');
      return;
    }
    setBusy(true);
    try {
      const r = await api(`/admin/accounts/${account.accountNumber}/${direction}`, {
        method: 'POST',
        body: { amount: amount.trim(), description: note.trim() || undefined },
      });
      onDone(`${isDeposit ? 'Deposited' : 'Withdrew'} ${money(Math.round(Number(amount) * 100))}. New balance ${money(r.balance)}. Ref ${r.reference}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={isDeposit ? 'Cash deposit' : 'Cash withdrawal'} onClose={onClose}>
      <p className="muted">
        {accountLabel(account)} · Balance {money(account.balance)}
      </p>
      <form onSubmit={submit} noValidate>
        <Alert>{error}</Alert>
        <Field label="Amount">
          {(id) => (
            <div className="input-prefix">
              <span aria-hidden="true">₹</span>
              <input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
          )}
        </Field>
        <Field label="Note (optional)">{(id) => <input id={id} maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        <div className="row-actions">
          <Button type="submit" loading={busy}>
            {isDeposit ? 'Deposit' : 'Withdraw'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminCustomers() {
  const stats = useApi('/admin/stats');
  const [q, setQ] = useState('');
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cash, setCash] = useState(null);

  async function load(query = q) {
    try {
      const d = await api(`/admin/customers?q=${encodeURIComponent(query.trim())}`);
      setCustomers(d.customers);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const refresh = (message) => {
    setNotice(message);
    setCash(null);
    load();
    stats.reload();
  };

  async function setAccountStatus(a, status) {
    const verb = status === 'frozen' ? 'Freeze' : 'Unfreeze';
    if (!window.confirm(`${verb} account ${groupDigits(a.accountNumber)}?`)) return;
    try {
      await api(`/admin/accounts/${a.accountNumber}`, { method: 'PATCH', body: { status } });
      refresh(`Account ${groupDigits(a.accountNumber)} is now ${status}.`);
    } catch (e) {
      setError(e.message);
    }
  }

  async function setUserStatus(c, status) {
    const msg = status === 'disabled' ? `Disable ${c.name}'s profile? They will be signed out and unable to sign in.` : `Enable ${c.name}'s profile?`;
    if (!window.confirm(msg)) return;
    try {
      await api(`/admin/users/${c.id}`, { method: 'PATCH', body: { status } });
      refresh(`${c.name}'s profile is now ${status}.`);
    } catch (e) {
      setError(e.message);
    }
  }

  const s = stats.data;
  return (
    <>
      <h1>Bank overview</h1>
      <div className="stat-grid">
        {[
          ['Customers', s?.customers],
          ['Open accounts', s?.accounts],
          ['Money held', s ? money(s.totalDeposits) : null],
          ['Transactions today', s?.transactionsToday],
          ['Accounts on hold', s?.frozen],
        ].map(([label, value]) => (
          <div key={label} className="stat">
            <span className="stat-label">{label}</span>
            <span className="stat-value">{value ?? '—'}</span>
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2 className="section-title">Customers</h2>
      </div>
      <div className="field">
        <label htmlFor="q">Search customers</label>
        <input id="q" type="search" placeholder="Name, email, phone or account number" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Alert kind="success">{notice}</Alert>
      <Alert>{error}</Alert>

      {!customers ? (
        <Loading />
      ) : !customers.length ? (
        <EmptyState title="No customers match your search" />
      ) : (
        <div className="stack">
          {customers.map((c) => (
            <article key={c.id} className="card customer">
              <div className="customer-head">
                <div>
                  <h3>
                    {c.name} {c.status !== 'active' ? <span className="badge badge-warn">{c.status}</span> : null}
                  </h3>
                  <p className="small muted">
                    {c.email}
                    {c.phone ? ` · ${c.phone}` : ''} · Joined {dateOnly(c.createdAt)}
                  </p>
                </div>
                <Button variant="ghost" className="btn-sm" onClick={() => setUserStatus(c, c.status === 'active' ? 'disabled' : 'active')}>
                  {c.status === 'active' ? 'Disable profile' : 'Enable profile'}
                </Button>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Type</th>
                      <th className="num">Balance</th>
                      <th>Status</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.accounts.map((a) => (
                      <tr key={a.id}>
                        <td className="mono">{groupDigits(a.accountNumber)}</td>
                        <td>{a.type}</td>
                        <td className="num">{money(a.balance)}</td>
                        <td>
                          <span className={`badge ${a.status === 'active' ? 'badge-ok' : 'badge-warn'}`}>{a.status}</span>
                        </td>
                        <td className="actions">
                          <Button className="btn-sm" disabled={a.status !== 'active'} onClick={() => setCash({ account: a, direction: 'deposit' })}>
                            Deposit
                          </Button>
                          <Button variant="secondary" className="btn-sm" disabled={a.status !== 'active'} onClick={() => setCash({ account: a, direction: 'withdraw' })}>
                            Withdraw
                          </Button>
                          <Button variant="ghost" className="btn-sm" onClick={() => setAccountStatus(a, a.status === 'active' ? 'frozen' : 'active')}>
                            {a.status === 'active' ? 'Freeze' : 'Unfreeze'}
                          </Button>
                          <Link className="btn btn-ghost btn-sm" to={`/admin/statement/${a.accountNumber}`}>
                            Statement
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}

      {cash ? <CashModal {...cash} onClose={() => setCash(null)} onDone={refresh} /> : null}
    </>
  );
}
