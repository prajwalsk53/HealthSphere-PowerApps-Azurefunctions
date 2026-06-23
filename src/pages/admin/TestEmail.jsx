import { useState, useEffect } from 'react';
import api from '../../api/axios';

const EMAIL_TYPES = [
  { value: 'test',             label: '✅ Basic Test Email' },
  { value: 'welcome',          label: '🎉 Patient Welcome' },
  { value: 'approval_request', label: '⏳ Admin — New Application Pending' },
  { value: 'approved',         label: '✅ Account Approved' },
  { value: 'rejected',         label: '❌ Account Rejected' },
  { value: 'appointment',      label: '📅 Appointment Confirmed' },
  { value: 'emergency',        label: '🚨 Emergency Alert' },
  { value: 'prescription',     label: '💊 Prescription Issued' },
];

const TRIGGERS = [
  { event: 'Patient registers',          recipient: 'Patient',               template: 'Welcome email with NHS ID',                              active: true  },
  { event: 'Doctor/Gov registers',       recipient: 'Applicant',             template: 'Application received — pending review',                   active: true  },
  { event: 'Doctor/Gov registers',       recipient: 'Admin',                 template: 'New application pending approval (with details)',          active: true  },
  { event: 'Admin approves account',     recipient: 'Doctor / Gov Analyst',  template: 'Account approved — login now',                            active: true  },
  { event: 'Admin rejects account',      recipient: 'Doctor / Gov Analyst',  template: 'Rejection with reason',                                   active: true  },
  { event: 'Appointment booked',         recipient: 'Patient',               template: 'Appointment confirmation with details',                   active: true  },
  { event: 'Appointment booked',         recipient: 'Doctor',                template: 'New patient appointment notification',                    active: true  },
  { event: 'Emergency chat message',     recipient: 'Doctor',                template: '🚨 Urgent alert email with message preview',               active: true  },
  { event: 'Appointment cancelled',      recipient: 'Patient',               template: 'Cancellation confirmation',                               active: true  },
  { event: 'Prescription issued',        recipient: 'Patient',               template: 'New prescription details',                                active: false },
  { event: 'Critical lab result',        recipient: 'Patient',               template: 'Urgent lab result alert',                                 active: false },
];

export default function TestEmail() {
  const [config,   setConfig]   = useState(null);
  const [to,       setTo]       = useState('');
  const [type,     setType]     = useState('test');
  const [sending,  setSending]  = useState(false);
  const [result,   setResult]   = useState(null);   // { ok, to, msg }

  useEffect(() => {
    api.get('/bridge/email/config').then(r => setConfig(r.data)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const body = { type, to: to.trim() || undefined };
      const { data } = await api.post('/bridge/email/send', body);
      setResult({
        ok: data.success !== false,
        to: data.to,
        msg: data.success !== false
          ? `Email sent successfully! Check the inbox at ${data.to}`
          : 'Email sending failed. Check SMTP credentials in the backend environment.',
      });
    } catch (err) {
      setResult({ ok: false, msg: err.response?.data?.error || 'Email sending failed. Check SMTP credentials in the backend environment.' });
    } finally {
      setSending(false);
    }
  };

  const cfgRows = config ? [
    { label: 'SMTP Host',    value: config.smtpHost  || '—' },
    { label: 'Port',         value: config.smtpPort  || '—' },
    { label: 'From Address', value: config.mailFrom  || '—' },
    { label: 'Admin Email',  value: config.systemEmail || '—' },
  ] : [];

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
          <i className="fas fa-envelope" style={{ color: '#1565C0', marginRight: 8 }}></i>Email System Test
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          Test all email automations &middot; Sending from{' '}
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{config?.mailFrom || '…'}</span>
        </div>
      </div>

      {/* Result alert */}
      {result && (
        <div style={{
          background: result.ok ? '#DCFCE7' : '#FEE2E2',
          border: `1px solid ${result.ok ? '#BBF7D0' : '#FECACA'}`,
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: 16,
          color: result.ok ? '#166534' : '#991B1B',
          fontSize: 14,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <i className={`fas fa-${result.ok ? 'check-circle' : 'exclamation-circle'} fa-lg`}></i>
          <div>{result.msg}</div>
        </div>
      )}

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 900, marginBottom: 20 }}>

        {/* LEFT — Email Configuration */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-cog" style={{ marginRight: 6, color: '#1565C0' }}></i>Email Configuration</h3>
          </div>
          <div className="card-body">
            {cfgRows.length ? cfgRows.map(row => (
              <div key={row.label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: 13,
              }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{row.label}</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>{row.value}</span>
              </div>
            )) : (
              <div className="loading"><div className="spinner" /></div>
            )}

            <div style={{
              marginTop: 14,
              padding: '10px 14px',
              background: 'var(--bg)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text-muted)',
              lineHeight: 1.6,
            }}>
              <i className="fas fa-info-circle" style={{ color: '#1565C0', marginRight: 5 }}></i>
              Configure via environment variables: <code>SMTP_HOST</code>, <code>SMTP_PORT</code>,{' '}
              <code>SMTP_USER</code>, <code>SMTP_PASS</code>, <code>EMAIL_FROM</code>, <code>MAIL_ADMIN</code>.
              Use port 465 for SSL or 587 for STARTTLS.
            </div>
          </div>
        </div>

        {/* RIGHT — Send Test Email */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-paper-plane" style={{ marginRight: 6, color: '#1565C0' }}></i>Send Test Email</h3>
          </div>
          <div className="card-body">
            <form onSubmit={submit}>
              <div className="form-group">
                <label className="form-label">Send To</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder={config?.systemEmail || 'admin@healthsphere.nhs.uk'}
                  value={to}
                  onChange={e => { setTo(e.target.value); setResult(null); }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Type</label>
                <select
                  className="form-control"
                  value={type}
                  onChange={e => { setType(e.target.value); setResult(null); }}
                >
                  {EMAIL_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={sending}
              >
                {sending
                  ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, display: 'inline-block', marginRight: 6 }} />Sending…</>
                  : <><i className="fas fa-paper-plane" style={{ marginRight: 6 }}></i>Send Test Email</>}
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* Automated email triggers table */}
      <div className="card" style={{ maxWidth: 900 }}>
        <div className="card-header">
          <h3><i className="fas fa-sitemap" style={{ marginRight: 6, color: '#1565C0' }}></i>Automated Email Triggers</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Trigger Event</th>
                <th>Recipient</th>
                <th>Template</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {TRIGGERS.map((t, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{t.event}</td>
                  <td>{t.recipient}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.template}</td>
                  <td>
                    {t.active
                      ? <span className="badge badge-success">✅ Active</span>
                      : <span className="badge badge-gray">Available</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
