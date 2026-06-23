import { useState, useEffect, useCallback } from 'react';
import { Hs_usersService } from '../../generated/services/Hs_usersService';
import { Hs_usershs_userrole, Hs_usershs_accountstatus } from '../../generated/models/Hs_usersModel';
import { Hs_accesslogsService } from '../../generated/services/Hs_accesslogsService';

const ROLE_CODES = Object.fromEntries(Object.entries(Hs_usershs_userrole).map(([code, label]) => [label, Number(code)]));
const STATUS_CODES = Object.fromEntries(Object.entries(Hs_usershs_accountstatus).map(([code, label]) => [label, Number(code)]));

function toUser(record) {
  return {
    id: record.hs_userid,
    name: record.hs_fullname,
    email: record.hs_emailaddress,
    role: Hs_usershs_userrole[record.hs_userrole],
    status: Hs_usershs_accountstatus[record.hs_accountstatus] || 'active',
    nhsId: record.hs_nhsidentifier,
    dateOfBirth: record.hs_dateofbirth,
  };
}

function timeAgo(date) {
  if (!date) return 'Never';
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)     return `${diff}s ago`;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function maskIp(ip) {
  if (!ip) return '—';
  const p = ip.split('.');
  return p.length === 4 ? `${p[0]}.${p[1]}.*.*` : ip;
}

const ROLE_STYLE = {
  patient:    { bg: '#DBEAFE', color: '#1E40AF' },
  doctor:     { bg: '#DCFCE7', color: '#166534' },
  admin:      { bg: '#FEF3C7', color: '#92400E' },
  government: { bg: '#EDE9FE', color: '#5B21B6' },
  pharmacy:   { bg: '#ECFEFF', color: '#0E7490' },
};

export default function AdminUsers() {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [role,     setRole]     = useState('');
  const [status,   setStatus]   = useState('');
  const [success,  setSuccess]  = useState('');
  const [selected, setSelected] = useState(new Set());
  const [acting,   setActing]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setSelected(new Set());
    const clauses = [];
    if (role) clauses.push(`hs_userrole eq ${ROLE_CODES[role]}`);
    if (status) clauses.push(`hs_accountstatus eq ${STATUS_CODES[status]}`);
    const term = search.trim();
    if (term) {
      const escaped = term.replace(/'/g, "''");
      clauses.push(`(contains(hs_fullname,'${escaped}') or contains(hs_emailaddress,'${escaped}') or contains(hs_nhsidentifier,'${escaped}'))`);
    }
    Hs_usersService.getAll({ filter: clauses.join(' and ') || undefined, orderBy: ['createdon desc'], top: 100 })
      .then(async (result) => {
        const list = (result.data || []).map(toUser);
        const userIds = list.map(u => u.id);
        if (userIds.length) {
          const logsResult = await Hs_accesslogsService.getAll({
            filter: userIds.map(id => `_hs_user_value eq ${id}`).join(' or '),
            orderBy: ['createdon desc'],
          });
          const lastByUser = {};
          (logsResult.data || []).forEach(l => {
            if (!lastByUser[l._hs_user_value]) lastByUser[l._hs_user_value] = { ip: l.hs_paddress, time: l.createdon };
          });
          list.forEach(u => {
            u.lastIp = lastByUser[u.id]?.ip;
            u.lastLogin = lastByUser[u.id]?.time;
          });
        }
        setUsers(list);
      })
      .finally(() => setLoading(false));
  }, [search, role, status]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

  const toggleAll = (e) =>
    setSelected(e.target.checked ? new Set(users.map(u => u.id)) : new Set());

  const toggleRow = (id) =>
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const doStatus = async (id, newStatus) => {
    setActing(id);
    try {
      await Hs_usersService.update(id, { hs_accountstatus: STATUS_CODES[newStatus] });
      flash(`User status updated to ${newStatus}.`);
      load();
    } finally { setActing(null); }
  };

  const doDelete = async (id, name) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    setActing(id);
    try {
      await Hs_usersService.delete(id);
      flash('User deleted successfully.');
      load();
    } finally { setActing(null); }
  };

  const allChecked = users.length > 0 && selected.size === users.length;
  const someChecked = selected.size > 0 && selected.size < users.length;

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
            <i className="fas fa-users" style={{ color: '#1565C0', marginRight: 8 }}></i>User Management
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {loading ? 'Loading…' : `${users.length} users found`}
          </div>
        </div>
      </div>

      {/* Success alert */}
      {success && (
        <div style={{
          background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 8,
          padding: '12px 16px', marginBottom: 16, color: '#166534', fontSize: 13, fontWeight: 600,
        }}>
          <i className="fas fa-check-circle" style={{ marginRight: 6 }}></i>{success}
        </div>
      )}

      {/* Filter bar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <i className="fas fa-search" style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', fontSize: 13, pointerEvents: 'none',
            }}></i>
            <input
              className="form-control"
              style={{ paddingLeft: 32 }}
              placeholder="Search by name, email, NHS ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
            />
          </div>
          <select className="form-control" style={{ width: 150 }} value={role} onChange={e => setRole(e.target.value)}>
            <option value="">All Roles</option>
            <option value="patient">Patient</option>
            <option value="doctor">Doctor</option>
            <option value="admin">Admin</option>
            <option value="government">Government</option>
            <option value="pharmacy">Pharmacy</option>
          </select>
          <select className="form-control" style={{ width: 150 }} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={load}>
            <i className="fas fa-filter" style={{ marginRight: 6 }}></i>Filter
          </button>
          <button className="btn btn-sm btn-outline" onClick={load} title="Refresh">
            <i className="fas fa-sync"></i>
          </button>
        </div>
      </div>

      {/* Main table */}
      <div className="card">
        <div className="card-header">
          <h3>
            <i className="fas fa-users" style={{ marginRight: 6, color: '#1565C0' }}></i>
            User Login Management
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {selected.size > 0 && (
              <span style={{ fontSize: 12, color: '#1565C0', fontWeight: 600 }}>
                {selected.size} selected
              </span>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{users.length} users</span>
            <button className="btn btn-sm btn-outline" title="Export (coming soon)">
              <i className="fas fa-download" style={{ marginRight: 5 }}></i>Export
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    onChange={toggleAll}
                    checked={allChecked}
                    ref={el => { if (el) el.indeterminate = someChecked; }}
                  />
                </th>
                <th>User Name</th>
                <th>NHS Login ID</th>
                <th>Role</th>
                <th>IP Address</th>
                <th>Date of Birth</th>
                <th>Access</th>
                <th>Last Logged In</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9}><div className="loading"><div className="spinner" /></div></td></tr>
              ) : users.length ? users.map(u => {
                const rs = ROLE_STYLE[u.role] || { bg: '#F3F4F6', color: '#374151' };
                const isActing = acting === u.id;
                return (
                  <tr key={u.id} style={selected.has(u.id) ? { background: '#EFF6FF' } : {}}>

                    {/* Checkbox */}
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggleRow(u.id)}
                      />
                    </td>

                    {/* Name + avatar */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, #1565C0, #1976D2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 700, fontSize: 11,
                        }}>
                          {initials(u.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* NHS ID */}
                    <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#1565C0' }}>
                      {u.nhsId || <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}
                    </td>

                    {/* Role chip */}
                    <td>
                      <span style={{
                        background: rs.bg, color: rs.color,
                        padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                        textTransform: 'capitalize', whiteSpace: 'nowrap',
                      }}>
                        {u.role}
                      </span>
                    </td>

                    {/* IP (masked) */}
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                      {maskIp(u.lastIp)}
                    </td>

                    {/* DOB */}
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {u.dateOfBirth
                        ? new Date(u.dateOfBirth).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '—'}
                    </td>

                    {/* Access status */}
                    <td>
                      {u.status === 'active'
                        ? <span className="badge badge-success">Active</span>
                        : u.status === 'pending'
                        ? <span className="badge badge-warning">Pending</span>
                        : u.status === 'suspended'
                        ? <span className="badge badge-danger">Suspended</span>
                        : <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>{u.status}</span>}
                    </td>

                    {/* Last login */}
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {timeAgo(u.lastLogin)}
                    </td>

                    {/* Actions */}
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {u.status === 'active' ? (
                          <button
                            className="btn btn-sm btn-outline"
                            title="Suspend"
                            disabled={isActing}
                            onClick={() => doStatus(u.id, 'suspended')}
                            style={{ color: '#D97706', borderColor: '#D97706' }}
                          >
                            <i className="fas fa-ban"></i>
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm btn-outline"
                            title="Activate"
                            disabled={isActing}
                            onClick={() => doStatus(u.id, 'active')}
                            style={{ color: '#16A34A', borderColor: '#16A34A' }}
                          >
                            <i className="fas fa-check"></i>
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-danger"
                          title="Delete"
                          disabled={isActing}
                          onClick={() => doDelete(u.id, u.name)}
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      {search || role || status ? 'No users match your filters' : 'No users found'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
