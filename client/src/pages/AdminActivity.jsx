import { useApi } from '../lib/useApi.js';
import { dateTime, money } from '../lib/format.js';
import { Alert, Button, Loading } from '../components/ui.jsx';

const LABELS = {
  'user.register': 'Opened a new profile',
  'user.login': 'Signed in',
  'user.logout': 'Signed out',
  'user.locked': 'Sign-in locked after wrong passwords',
  'user.password_changed': 'Changed password',
  'account.open': 'Opened an account',
  'transfer.create': 'Sent money',
  'admin.deposit': 'Staff cash deposit',
  'admin.withdraw': 'Staff cash withdrawal',
  'admin.account_freeze': 'Staff froze an account',
  'admin.account_unfreeze': 'Staff unfroze an account',
  'admin.user_disabled': 'Staff disabled a profile',
  'admin.user_active': 'Staff enabled a profile',
};

export default function AdminActivity() {
  const { data, error, loading, reload } = useApi('/admin/audit');

  return (
    <>
      <div className="section-head">
        <h1>Activity log</h1>
        <Button variant="secondary" onClick={reload} loading={loading}>
          Refresh
        </Button>
      </div>
      <p className="muted">The latest 100 security and money events. This log cannot be edited.</p>
      {error ? <Alert>{error.message}</Alert> : null}
      {!data ? (
        <Loading />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What happened</th>
                <th>Details</th>
                <th>IP address</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((l) => (
                <tr key={l.id} className={l.action === 'user.locked' ? 'row-warn' : ''}>
                  <td className="nowrap">{dateTime(l.createdAt)}</td>
                  <td>
                    {l.actor?.name || '—'}
                    <br />
                    <span className="small muted">{l.actor?.email}</span>
                  </td>
                  <td>{LABELS[l.action] || l.action}</td>
                  <td className="small">
                    {l.target ? <span className="mono">{l.target}</span> : null}
                    {l.details?.amount ? ` · ${money(l.details.amount)}` : ''}
                    {l.details?.reference ? ` · ${l.details.reference}` : ''}
                  </td>
                  <td className="small mono">{l.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
