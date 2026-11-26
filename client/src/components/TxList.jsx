import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { dateTime, describeTx, money } from '../lib/format.js';

export function TxList({ items, showBalance = false }) {
  return (
    <ul className="tx-list">
      {items.map((t) => (
        <li key={t.id} className="tx">
          <span className={`tx-icon ${t.direction}`} aria-hidden="true">
            {t.direction === 'credit' ? <ArrowDownLeft size={18} strokeWidth={1.75} /> : <ArrowUpRight size={18} strokeWidth={1.75} />}
          </span>
          <div className="tx-main">
            <span className="tx-title">{describeTx(t)}</span>
            <span className="tx-sub">
              {dateTime(t.createdAt)}
              {t.kind === 'transfer' && t.description ? ` · ${t.description}` : ''}
            </span>
          </div>
          <div className="tx-amount">
            <span className={t.direction === 'credit' ? 'pos' : ''}>
              <span className="sr-only">{t.direction === 'credit' ? 'Received' : 'Sent'} </span>
              {t.direction === 'credit' ? '+' : '−'}
              {money(t.amount)}
            </span>
            {showBalance ? <span className="tx-sub">Bal {money(t.balanceAfter)}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
