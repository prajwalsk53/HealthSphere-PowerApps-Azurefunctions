import { useState, useEffect, useCallback } from 'react';
import { Hs_accesslogsService } from '../../generated/services/Hs_accesslogsService';
import { Hs_usersService } from '../../generated/services/Hs_usersService';
import { Hs_usershs_userrole } from '../../generated/models/Hs_usersModel';

const ROLE_CODES = Object.fromEntries(Object.entries(Hs_usershs_userrole).map(([code, label]) => [label, Number(code)]));
const ROLE_BADGE = { patient: 'info', doctor: 'success', admin: 'purple', government: 'warning', pharmacy: 'gray' };

const ACTION_TYPES = ['LOGIN', 'LOGOUT', 'VIEW', 'CREATE', 'UPDATE', 'DELETE', 'SUSPEND', 'EXPORT'];

function actionBadge(action) {
  if (!action) return <span className="badge badge-gray">—</span>;
  const up = action.toUpperCase();
  let cls = 'badge-info';
  if (/DELETE|SUSPEND|BLOCK|REVOKE/.test(up)) cls = 'badge-danger';
  else if (/LOGIN|AUTH|REGISTER|VERIFY/.test(up)) cls = 'badge-success';
  else if (/UPDATE|EDIT|MODIFY|RESET/.test(up)) cls = 'badge-warning';
  else if (/EXPORT|DOWNLOAD|PRINT/.test(up)) cls = 'badge-purple';
  return <code style={{ background: 'var(--bs-light, #f8f9fa)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }} className={`badge ${cls}`}>{action}</code>;
}

export default function AccessLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [action, setAction] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const logFilter = action ? `contains(hs_ction,'${action.replace(/'/g, "''")}')` : undefined;
    Hs_accesslogsService.getAll({ filter: logFilter, orderBy: ['createdon desc'], top: 200 })
      .then(async (logsResult) => {
        const logRows = logsResult.data || [];
        const userIds = [...new Set(logRows.map(l => l._hs_user_value).filter(Boolean))];
        if (!userIds.length) { setLogs([]); return; }
        const clauses = [`(${userIds.map(id => `hs_userid eq ${id}`).join(' or ')})`];
        if (role) clauses.push(`hs_userrole eq ${ROLE_CODES[role]}`);
        const term = search.trim();
        if (term) {
          const escaped = term.replace(/'/g, "''");
          clauses.push(`(contains(hs_fullname,'${escaped}') or contains(hs_emailaddress,'${escaped}'))`);
        }
        const usersResult = await Hs_usersService.getAll({ filter: clauses.join(' and ') });
        const userMap = Object.fromEntries((usersResult.data || []).map(u => [u.hs_userid, u]));
        const result = logRows
          .map(l => {
            const u = userMap[l._hs_user_value];
            if (!u) return null;
            return {
              id: l.hs_accesslogid,
              user_name: u.hs_fullname,
              email: u.hs_emailaddress,
              role: Hs_usershs_userrole[u.hs_userrole],
              action: l.hs_ction,
              ip_address: l.hs_paddress,
              created_at: l.createdon,
            };
          })
          .filter(Boolean);
        setLogs(result);
      })
      .finally(() => setLoading(false));
  }, [search, role, action]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {/* Filter bar */}
      <div className="card mb-4">
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-control"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="🔍 Search user name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="form-control" style={{ width: 150 }} value={role} onChange={e => setRole(e.target.value)}>
            <option value="">All Roles</option>
            {['patient', 'doctor', 'admin', 'government', 'pharmacy'].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select className="form-control" style={{ width: 160 }} value={action} onChange={e => setAction(e.target.value)}>
            <option value="">All Actions</option>
            {ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn btn-sm btn-secondary" onClick={load}>Refresh</button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <h3><i className="fas fa-history" style={{ marginRight: 8, color: '#1565C0' }}></i>System Access Logs</h3>
          <span className="badge badge-gray">{logs.length} records</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Email</th>
                <th>Action</th>
                <th>IP Address</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><div className="loading"><div className="spinner" /></div></td></tr>
              ) : logs.length ? logs.map(l => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 600 }}>{l.user_name}</td>
                  <td>
                    <span className={`badge badge-${ROLE_BADGE[l.role] || 'gray'}`} style={{ textTransform: 'capitalize' }}>
                      {l.role}
                    </span>
                  </td>
                  <td className="text-muted text-sm">{l.email}</td>
                  <td>{actionBadge(l.action)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }} className="text-muted">{l.ip_address || '—'}</td>
                  <td className="text-muted text-sm">{new Date(l.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              )) : (
                <tr><td colSpan={6}><div className="empty-state">No access logs found</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
