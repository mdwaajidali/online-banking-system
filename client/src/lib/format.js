const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

/** Amounts come from the API as whole paise. */
export const money = (paise) => inr.format((paise ?? 0) / 100);

/** 501234567890 -> "5012 3456 7890" */
export const groupDigits = (n) => String(n).replace(/(\d{4})(?=\d)/g, '$1 ');

/** Shows only the last four digits: "•••• 7890" */
export const maskAccount = (n) => `•••• ${String(n).slice(-4)}`;

export const dateTime = (d) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export const dateOnly = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const accountLabel = (a) =>
  `${a.nickname || (a.type === 'savings' ? 'Savings' : 'Current')} ${maskAccount(a.accountNumber)}`;

export function describeTx(t) {
  if (t.kind === 'deposit') return t.description || 'Cash deposit';
  if (t.kind === 'withdrawal') return t.description || 'Cash withdrawal';
  const who = t.counterparty?.name || groupDigits(t.counterparty?.accountNumber || '');
  return t.direction === 'debit' ? `To ${who}` : `From ${who}`;
}
