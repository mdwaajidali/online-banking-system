import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { accountLabel, dateTime, describeTx, groupDigits, money } from '../lib/format.js';
import { Alert, Button, EmptyState, Loading } from '../components/ui.jsx';
import { TxList } from '../components/TxList.jsx';

function toCSV(rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Date', 'Description', 'Reference', 'Note', 'Debit (INR)', 'Credit (INR)', 'Balance (INR)'];
  const lines = rows.map((t) =>
    [
      dateTime(t.createdAt),
      describeTx(t),
      t.reference,
      t.kind === 'transfer' ? t.description : '',
      t.direction === 'debit' ? (t.amount / 100).toFixed(2) : '',
      t.direction === 'credit' ? (t.amount / 100).toFixed(2) : '',
      (t.balanceAfter / 100).toFixed(2),
    ]
      .map(esc)
      .join(',')
  );
  return [header.map(esc).join(','), ...lines].join('\r\n');
}

export default function Statement() {
  const params = useParams(); // staff view: /admin/statement/:number
  const own = useApi(params.number ? null : '/accounts');
  const [account, setAccount] = useState(params.number || '');
  const [filters, setFilters] = useState({ direction: 'all', from: '', to: '', search: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ loading: true });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!account && own.data?.accounts.length) setAccount(own.data.accounts[0].accountNumber);
  }, [own.data, account]);

  const query = (p, limit = 20) => {
    const q = new URLSearchParams({ page: p, limit, direction: filters.direction });
    if (filters.from) q.set('from', filters.from);
    if (filters.to) q.set('to', filters.to);
    if (filters.search.trim()) q.set('search', filters.search.trim());
    return `/accounts/${account}/transactions?${q}`;
  };

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    setResult((r) => ({ ...r, loading: true }));
    const t = setTimeout(() => {
      api(query(page))
        .then((d) => !cancelled && setResult({ data: d }))
        .catch((e) => !cancelled && setResult({ error: e }));
    }, 250); // wait for the user to stop typing in search
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, page, filters]);

  const setFilter = (k) => (e) => {
    setPage(1);
    setFilters({ ...filters, [k]: e.target.value });
  };

  async function download() {
    setDownloading(true);
    try {
      const d = await api(query(1, 500));
      const blob = new Blob(['﻿' + toCSV(d.transactions)], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `statement-${account.slice(-4)}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloading(false);
    }
  }

  if (!params.number && own.loading && !own.data) return <Loading />;
  if (own.error) return <Alert>{own.error.message}</Alert>;

  const data = result.data;
  return (
    <>
      {params.number ? (
        <p>
          <Link to="/admin" className="back-link"><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to customers</Link>
        </p>
      ) : null}
      <div className="section-head">
        <h1>Statement</h1>
        <div className="row-actions">
          <Button variant="secondary" onClick={download} loading={downloading} disabled={!data?.total}>
            Download (Excel/CSV)
          </Button>
          <Button variant="ghost" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      <div className="card filters">
        {params.number ? (
          <div className="field">
            <span className="label-like">Account</span>
            <p className="mono">{groupDigits(params.number)}</p>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="acct">Account</label>
            <select id="acct" value={account} onChange={(e) => { setPage(1); setAccount(e.target.value); }}>
              {own.data.accounts.map((a) => (
                <option key={a.id} value={a.accountNumber}>
                  {accountLabel(a)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="dir">Show</label>
          <select id="dir" value={filters.direction} onChange={setFilter('direction')}>
            <option value="all">All transactions</option>
            <option value="credit">Money in</option>
            <option value="debit">Money out</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="from">From date</label>
          <input id="from" type="date" value={filters.from} onChange={setFilter('from')} />
        </div>
        <div className="field">
          <label htmlFor="to">To date</label>
          <input id="to" type="date" value={filters.to} onChange={setFilter('to')} />
        </div>
        <div className="field field-wide">
          <label htmlFor="search">Search</label>
          <input id="search" type="search" placeholder="Name, note or reference" value={filters.search} onChange={setFilter('search')} />
        </div>
      </div>

      {data?.account ? (
        <p className="muted statement-meta">
          {data.total} transaction{data.total === 1 ? '' : 's'} · Current balance <strong>{money(data.account.balance)}</strong>
        </p>
      ) : null}

      <div className="card">
        {result.error ? (
          <Alert>{result.error.message}</Alert>
        ) : !data ? (
          <Loading />
        ) : data.transactions.length ? (
          <TxList items={data.transactions} showBalance />
        ) : (
          <EmptyState title="No transactions found">
            <p>Try changing the dates or filters.</p>
          </EmptyState>
        )}
      </div>

      {data && data.pages > 1 ? (
        <nav className="pager" aria-label="Pages">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" /> Newer
          </Button>
          <span>
            Page {page} of {data.pages}
          </span>
          <Button variant="ghost" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
            Older <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </nav>
      ) : null}
    </>
  );
}
