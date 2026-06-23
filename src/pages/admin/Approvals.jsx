import { useState, useEffect, useCallback } from 'react';
import { Hs_usersService } from '../../generated/services/Hs_usersService';
import { Hs_usershs_userrole, Hs_usershs_accountstatus } from '../../generated/models/Hs_usersModel';
import { Hs_doctorsService } from '../../generated/services/Hs_doctorsService';
import { Hs_notificationsService } from '../../generated/services/Hs_notificationsService';
import { Hs_notificationshs_type } from '../../generated/models/Hs_notificationsModel';

const ROLE_CODES = Object.fromEntries(Object.entries(Hs_usershs_userrole).map(([code, label]) => [label, Number(code)]));
const STATUS_CODES = Object.fromEntries(Object.entries(Hs_usershs_accountstatus).map(([code, label]) => [label, Number(code)]));
const NOTIFICATION_TYPE_CODES = Object.fromEntries(Object.entries(Hs_notificationshs_type).map(([code, label]) => [label, Number(code)]));

function toUser(record) {
  return {
    id: record.hs_userid,
    name: record.hs_fullname,
    email: record.hs_emailaddress,
    role: Hs_usershs_userrole[record.hs_userrole],
    phone: record.hs_phonenumber,
    nhsId: record.hs_nhsidentifier,
    createdAt: record.createdon,
  };
}

const ROLE_STYLE = {
  doctor:     { color: '#16A34A', bg: '#DCFCE7', icon: 'fa-user-md',  label: 'Doctor' },
  government: { color: '#7C3AED', bg: '#EDE9FE', icon: 'fa-landmark', label: 'Gov. Analyst' },
  pharmacy:   { color: '#0891B2', bg: '#ECFEFF', icon: 'fa-pills',    label: 'Medical Team' },
};

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Approvals() {
  const [data, setData]       = useState({ pending: [], approved: [], rejected: [] });
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [rejectModal, setRejectModal] = useState(null); // { id, name }
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const approvalRoles = ['doctor', 'government', 'pharmacy'].map(r => `hs_userrole eq ${ROLE_CODES[r]}`).join(' or ');
    Promise.all([
      Hs_usersService.getAll({ filter: `hs_accountstatus eq ${STATUS_CODES.pending} and (${approvalRoles})`, orderBy: ['createdon desc'] }),
      Hs_usersService.getAll({
        filter: `hs_accountstatus eq ${STATUS_CODES.active} and (hs_userrole eq ${ROLE_CODES.doctor} or hs_userrole eq ${ROLE_CODES.government})`,
        orderBy: ['createdon desc'], top: 20,
      }),
      Hs_usersService.getAll({ filter: `hs_accountstatus eq ${STATUS_CODES.suspended} and (${approvalRoles})`, orderBy: ['createdon desc'], top: 10 }),
      Hs_doctorsService.getAll(),
    ]).then(([pendingResult, approvedResult, rejectedResult, doctorsResult]) => {
      const doctorByUserId = Object.fromEntries((doctorsResult.data || []).map(d => [d._hs_user_value, d]));
      const withDoctorInfo = (u) => {
        const doc = doctorByUserId[u.id];
        return { ...u, hcpcNumber: doc?.hs_hcpcnumber, specialization: doc?.hs_specialization, hospital: doc?.hs_hospital, experienceYears: doc?.hs_experienceyears, bio: doc?.hs_bio };
      };
      setData({
        pending: (pendingResult.data || []).map(toUser).map(withDoctorInfo),
        approved: (approvedResult.data || []).map(toUser).map(withDoctorInfo),
        rejected: (rejectedResult.data || []).map(toUser),
      });
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const approve = async (id, name, roleLabel) => {
    if (!confirm(`Approve ${name} as ${roleLabel}?`)) return;
    setSubmitting(true);
    try {
      const user = data.pending.find(p => p.id === id);
      await Hs_usersService.update(id, { hs_accountstatus: STATUS_CODES.active });
      const doc = (await Hs_doctorsService.getAll({ filter: `_hs_user_value eq ${id}` })).data?.[0];
      if (doc) await Hs_doctorsService.update(doc.hs_doctorid, { hs_hcpcverified: true });
      await Hs_notificationsService.create({
        'hs_User@odata.bind': `/hs_users(${id})`,
        hs_title: 'Account Approved — Welcome to HealthSphere',
        hs_message: `Your ${user?.role || ''} account has been approved by the administration team. You can now sign in.`,
        hs_type: NOTIFICATION_TYPE_CODES.system,
        hs_isread: false,
      });
      showSuccess('Account approved successfully.');
      load();
    } finally { setSubmitting(false); }
  };

  const openReject = (id, name) => {
    setRejectModal({ id, name });
    setRejectReason('');
  };

  const confirmReject = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const reason = rejectReason || 'Application did not meet requirements.';
      await Hs_usersService.update(rejectModal.id, { hs_accountstatus: STATUS_CODES.suspended });
      await Hs_notificationsService.create({
        'hs_User@odata.bind': `/hs_users(${rejectModal.id})`,
        hs_title: 'Account Application — Decision',
        hs_message: `Your application has not been approved. Reason: ${reason}. Please contact admin@healthsphere.nhs.uk for further information.`,
        hs_type: NOTIFICATION_TYPE_CODES.system,
        hs_isread: false,
      });
      setRejectModal(null);
      showSuccess('Application rejected.');
      load();
    } finally { setSubmitting(false); }
  };

  const { pending, approved, rejected } = data;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
          <i className="fas fa-user-check" style={{ color: '#1565C0', marginRight: 8 }}></i>Account Approvals
        </div>
        {!loading && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {pending.length} pending &middot; {approved.length} approved &middot; {rejected.length} rejected
          </div>
        )}
      </div>

      {/* Success alert */}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <i className="fas fa-check-circle"></i> {success}
        </div>
      )}

      {/* ── PENDING ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3><i className="fas fa-hourglass-half" style={{ color: '#D97706', marginRight: 6 }}></i>Pending Approval</h3>
          {pending.length > 0 && <span className="badge badge-danger">{pending.length} waiting</span>}
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : pending.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <i className="fas fa-check-double" style={{ fontSize: 36, opacity: 0.3 }}></i>
            <p style={{ marginTop: 12 }}>No pending applications — all caught up!</p>
          </div>
        ) : pending.map((p) => {
          const rs = ROLE_STYLE[p.role] || ROLE_STYLE.doctor;
          const details = [
            p.phone           && { label: 'Phone',            value: p.phone },
            p.hcpcNumber      && { label: 'HCPC / GMC Number', value: p.hcpcNumber, mono: true },
            p.specialization  && { label: 'Specialization',   value: p.specialization },
            p.hospital        && { label: 'Hospital / Clinic', value: p.hospital },
            p.experienceYears && { label: 'Experience',        value: `${p.experienceYears} years` },
            p.nhsId           && { label: 'NHS ID',            value: p.nhsId, mono: true },
          ].filter(Boolean);

          return (
            <div key={p.id} style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'flex-start' }}>

                {/* Left: info */}
                <div>
                  {/* Name row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 46, height: 46, borderRadius: '50%', background: rs.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: rs.color, flexShrink: 0 }}>
                      <i className={`fas ${rs.icon}`}></i>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)' }}>{p.name}</span>
                        <span className="badge" style={{ background: rs.bg, color: rs.color }}>{rs.label}</span>
                        <span className="badge badge-warning">⏳ Pending</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        {p.email} &middot; Applied {new Date(p.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  {/* Detail chips */}
                  {details.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8, marginBottom: p.bio ? 10 : 0 }}>
                      {details.map(d => (
                        <div key={d.label} style={{ background: 'var(--bg)', borderRadius: 7, padding: '8px 12px' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{d.label}</div>
                          <div style={{ fontWeight: 600, color: 'var(--primary)', fontFamily: d.mono ? 'monospace' : 'inherit', fontSize: 13 }}>{d.value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bio */}
                  {p.bio && (
                    <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 12.5, color: 'var(--text)', borderLeft: `3px solid ${rs.color}` }}>
                      <strong>Bio:</strong> {p.bio}
                    </div>
                  )}
                </div>

                {/* Right: action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>
                  <button className="btn btn-success" disabled={submitting} onClick={() => approve(p.id, p.name, rs.label)} style={{ justifyContent: 'center' }}>
                    <i className="fas fa-check"></i> Approve
                  </button>
                  <button className="btn btn-danger" disabled={submitting} onClick={() => openReject(p.id, p.name)} style={{ justifyContent: 'center' }}>
                    <i className="fas fa-times"></i> Reject
                  </button>
                  <a href={`mailto:${p.email}`} className="btn btn-outline btn-sm" style={{ justifyContent: 'center' }}>
                    <i className="fas fa-envelope"></i> Email
                  </a>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* ── APPROVED ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3><i className="fas fa-check-circle" style={{ color: '#16A34A', marginRight: 6 }}></i>Recently Approved</h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Doctors &amp; Gov. Analysts</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Role</th><th>Specialization / Organisation</th><th>NHS ID</th><th>Date</th><th>Status</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><div className="loading"><div className="spinner" /></div></td></tr>
              ) : approved.length ? approved.map(a => {
                const rs = ROLE_STYLE[a.role] || ROLE_STYLE.doctor;
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: rs.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: rs.color, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                          {initials(a.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge" style={{ background: rs.bg, color: rs.color }}>{rs.label}</span></td>
                    <td style={{ fontSize: 13 }}>{a.specialization || a.hospital || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{a.nhsId || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(a.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td><span className="badge badge-success">Approved</span></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No approved professionals yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── REJECTED ── */}
      {rejected.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-times-circle" style={{ color: '#DC2626', marginRight: 6 }}></i>Rejected Applications</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rejected.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.email}</td>
                    <td style={{ textTransform: 'capitalize', fontSize: 13 }}>{r.role}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td><span className="badge badge-danger">Rejected</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRejectModal(null)}>
          <div className="modal">
            <div className="modal-header" style={{ background: '#DC2626', color: '#fff', borderRadius: '12px 12px 0 0' }}>
              <h3 style={{ color: '#fff' }}><i className="fas fa-times-circle"></i> Reject Application</h3>
              <button className="modal-close" style={{ color: '#fff' }} onClick={() => setRejectModal(null)}>&times;</button>
            </div>
            <form onSubmit={confirmReject}>
              <div className="modal-body">
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Rejecting application for <strong>{rejectModal.name}</strong>. Please provide a reason.
                </p>
                <label className="form-label">Reason for Rejection</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="e.g. HCPC number could not be verified. Please resubmit with valid credentials."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  required
                  style={{ marginBottom: 0, resize: 'vertical' }}
                />
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-danger" disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
                  <i className="fas fa-times"></i> {submitting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setRejectModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
