import { Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { accountLabel, dateTime, groupDigits, money } from '../lib/format.js';
import { Alert, Button, Field, Loading } from '../components/ui.jsx';

const AMOUNT_RX = /^\d{1,9}(\.\d{1,2})?$/;
const toPaise = (v) => Math.round(Number(v) * 100);

export default function SendMoney() {
  const { data, loading, error: loadError, reload } = useApi('/accounts');
  const [step, setStep] = useState('form'); // form -> review -> done
  const [mode, setMode] = useState('other'); // other | own
  const [form, setForm] = useState({ fromAccount: '', toAccount: '', amount: '', description: '' });
  const [recipient, setRecipient] = useState(null);
  const [lookup, setLookup] = useState({ state: 'idle', message: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  // One key per transfer attempt: if the request is sent twice (double-click, retry), the bank only processes it once.
  const [idempotencyKey, setKey] = useState(() => crypto.randomUUID());

  const accounts = useMemo(() => (data?.accounts || []).filter((a) => a.status === 'active'), [data]);
  const from = accounts.find((a) => a.accountNumber === form.fromAccount);
  const toDigits = form.toAccount.replace(/\D/g, '');

  useEffect(() => {
    if (accounts.length && !form.fromAccount) setForm((f) => ({ ...f, fromAccount: accounts[0].accountNumber }));
  }, [accounts, form.fromAccount]);

  // Look up the recipient's name as soon as 12 digits are entered, so the user can check it's the right person.
  useEffect(() => {
    if (mode !== 'other') return;
    setRecipient(null);
    if (toDigits.length !== 12) {
      setLookup({ state: 'idle', message: '' });
      return;
    }
    let cancelled = false;
    setLookup({ state: 'loading', message: '' });
    api(`/recipient/${toDigits}`)
      .then((r) => {
        if (cancelled) return;
        setRecipient(r);
        setLookup({ state: 'ok', message: '' });
      })
      .catch((e) => !cancelled && setLookup({ state: 'error', message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [toDigits, mode]);

  if (loading && !data) return <Loading />;
  if (loadError) return <Alert>{loadError.message}</Alert>;
  if (!accounts.length) {
    return (
      <div className="narrow">
        <h1>Send money</h1>
        <Alert kind="info">You don't have an active account to send from. Please contact the bank.</Alert>
      </div>
    );
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const ownTargets = accounts.filter((a) => a.accountNumber !== form.fromAccount);
  const remainingLimit = data.limits.daily - data.limits.usedToday;

  function review(e) {
    e.preventDefault();
    setError('');
    const errs = {};
    const amt = form.amount.trim().replace(/,/g, '');
    if (!AMOUNT_RX.test(amt) || Number(amt) <= 0) errs.amount = 'Enter an amount like 500 or 1250.50';
    else if (toPaise(amt) > from.balance) errs.amount = `You only have ${money(from.balance)} in this account`;
    else if (toPaise(amt) > remainingLimit) errs.amount = `You can send up to ${money(remainingLimit)} more today`;
    if (mode === 'other') {
      if (toDigits.length !== 12) errs.toAccount = 'Account numbers are 12 digits';
      else if (toDigits === form.fromAccount) errs.toAccount = 'You cannot send money to the same account';
      else if (!recipient) errs.toAccount = lookup.message || 'Please wait while we check this account';
    } else if (!form.toAccount) errs.toAccount = 'Choose which account to move money into';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setForm((f) => ({ ...f, amount: amt }));
    setStep('review');
  }

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const r = await api('/transfers', {
        method: 'POST',
        body: {
          fromAccount: form.fromAccount,
          toAccount: mode === 'other' ? toDigits : form.toAccount,
          amount: form.amount,
          description: form.description.trim() || undefined,
          idempotencyKey,
        },
      });
      setReceipt(r);
      setStep('done');
      reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setForm({ fromAccount: form.fromAccount, toAccount: '', amount: '', description: '' });
    setRecipient(null);
    setReceipt(null);
    setKey(crypto.randomUUID());
    setStep('form');
  }

  const toName =
    mode === 'other' ? recipient?.name : accountLabel(accounts.find((a) => a.accountNumber === form.toAccount) || { accountNumber: '' });
  const toNumber = mode === 'other' ? toDigits : form.toAccount;

  if (step === 'done') {
    return (
      <div className="narrow">
        <div className="card success-card" role="status">
          <div className="success-icon" aria-hidden="true">
            <Check size={32} strokeWidth={2} />
          </div>
          <h1>Money sent</h1>
          <p className="big-amount">{money(receipt.amount)}</p>
          <p>to {toName}</p>
          <dl className="details">
            <div>
              <dt>To account</dt>
              <dd className="mono">{groupDigits(toNumber)}</dd>
            </div>
            <div>
              <dt>Reference number</dt>
              <dd className="mono">{receipt.reference}</dd>
            </div>
            <div>
              <dt>Date and time</dt>
              <dd>{dateTime(receipt.createdAt)}</dd>
            </div>
            <div>
              <dt>Balance left</dt>
              <dd>{money(receipt.balanceAfter)}</dd>
            </div>
          </dl>
          <div className="row-actions">
            <Button onClick={startOver}>Send more money</Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Print receipt
            </Button>
            <Link to="/" className="btn btn-ghost">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="narrow">
        <p className="steps">Step 2 of 2</p>
        <h1>Check and confirm</h1>
        <p className="muted">Money sent to another person cannot be taken back. Please check the details.</p>
        <Alert>{error}</Alert>
        <div className="card">
          <p className="review-amount">{money(toPaise(form.amount))}</p>
          <dl className="details">
            <div>
              <dt>From</dt>
              <dd>{accountLabel(from)}</dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>
                {toName}
                <br />
                <span className="mono">{groupDigits(toNumber)}</span>
              </dd>
            </div>
            {form.description.trim() ? (
              <div>
                <dt>Note</dt>
                <dd>{form.description.trim()}</dd>
              </div>
            ) : null}
            <div>
              <dt>Balance after</dt>
              <dd>{money(from.balance - toPaise(form.amount))}</dd>
            </div>
          </dl>
          <div className="row-actions">
            <Button onClick={confirm} loading={busy} className="btn-lg">
              Confirm and send
            </Button>
            <Button variant="ghost" onClick={() => setStep('form')} disabled={busy}>
              Go back and edit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="narrow">
      <p className="steps">Step 1 of 2</p>
      <h1>Send money</h1>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'other'} className={mode === 'other' ? 'active' : ''} onClick={() => { setMode('other'); setForm({ ...form, toAccount: '' }); setErrors({}); }}>
          To someone else
        </button>
        <button
          role="tab"
          aria-selected={mode === 'own'}
          className={mode === 'own' ? 'active' : ''}
          disabled={accounts.length < 2}
          title={accounts.length < 2 ? 'You need two accounts for this' : undefined}
          onClick={() => { setMode('own'); setForm({ ...form, toAccount: '' }); setErrors({}); }}
        >
          Between my accounts
        </button>
      </div>

      <form className="card" onSubmit={review} noValidate>
        <Field label="Send from" hint={from ? `Available: ${money(from.balance)}` : ''}>
          {(id) => (
            <select id={id} value={form.fromAccount} onChange={set('fromAccount')}>
              {accounts.map((a) => (
                <option key={a.id} value={a.accountNumber}>
                  {accountLabel(a)} · {money(a.balance)}
                </option>
              ))}
            </select>
          )}
        </Field>

        {mode === 'other' ? (
          <Field label="Receiver's account number" error={errors.toAccount} hint="12 digits. Ask the person to share it with you.">
            {(id) => (
              <>
                <input id={id} inputMode="numeric" autoComplete="off" className="mono" placeholder="5012 3456 7890" value={form.toAccount} maxLength={16} onChange={set('toAccount')} />
                {lookup.state === 'loading' ? <p className="lookup">Checking account…</p> : null}
                {lookup.state === 'ok' && recipient ? (
                  <p className="lookup lookup-ok">
                    <Check size={16} strokeWidth={2} aria-hidden="true" /> Account holder: <strong>{recipient.name}</strong>
                    {recipient.own ? ' (this is your own account)' : ''}
                  </p>
                ) : null}
                {lookup.state === 'error' && !errors.toAccount ? <p className="lookup lookup-bad">{lookup.message}</p> : null}
              </>
            )}
          </Field>
        ) : (
          <Field label="Send to" error={errors.toAccount}>
            {(id) => (
              <select id={id} value={form.toAccount} onChange={set('toAccount')}>
                <option value="">Choose an account</option>
                {ownTargets.map((a) => (
                  <option key={a.id} value={a.accountNumber}>
                    {accountLabel(a)} · {money(a.balance)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        <Field label="Amount" error={errors.amount} hint={`You can send up to ${money(Math.max(0, remainingLimit))} more today`}>
          {(id) => (
            <div className="input-prefix">
              <span aria-hidden="true">₹</span>
              <input id={id} inputMode="decimal" autoComplete="off" placeholder="0" value={form.amount} onChange={set('amount')} />
            </div>
          )}
        </Field>
        <div className="quick-amounts" aria-label="Quick amounts">
          {[500, 1000, 2000, 5000].map((v) => (
            <button type="button" key={v} className="chip" onClick={() => setForm({ ...form, amount: String(v) })}>
              ₹{v.toLocaleString('en-IN')}
            </button>
          ))}
        </div>

        <Field label="Note (optional)" hint="For example: rent, groceries, gift">
          {(id) => <input id={id} maxLength={140} value={form.description} onChange={set('description')} />}
        </Field>

        <Button type="submit" className="btn-block btn-lg">
          Continue
        </Button>
      </form>
    </div>
  );
}
