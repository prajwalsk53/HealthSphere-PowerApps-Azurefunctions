import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import { Hs_usersService } from '../../generated/services/Hs_usersService';
import { Hs_appointmentsService } from '../../generated/services/Hs_appointmentsService';
import { Hs_medicalrecordsService } from '../../generated/services/Hs_medicalrecordsService';
import { Hs_allergiesService } from '../../generated/services/Hs_allergiesService';
import { Hs_vaccinationsService } from '../../generated/services/Hs_vaccinationsService';
import { Hs_prescriptionsService } from '../../generated/services/Hs_prescriptionsService';
import { Hs_dietlogsService } from '../../generated/services/Hs_dietlogsService';
import { Hs_healthmetricsService } from '../../generated/services/Hs_healthmetricsService';
import { Hs_messagesService } from '../../generated/services/Hs_messagesService';
import { Hs_fooddatabasesService } from '../../generated/services/Hs_fooddatabasesService';
import { Hs_geneticdisease1sService } from '../../generated/services/Hs_geneticdisease1sService';

const TABLE_SERVICES = {
  users: Hs_usersService,
  appointments: Hs_appointmentsService,
  medical_records: Hs_medicalrecordsService,
  allergies: Hs_allergiesService,
  vaccinations: Hs_vaccinationsService,
  prescriptions: Hs_prescriptionsService,
  diet_logs: Hs_dietlogsService,
  health_metrics: Hs_healthmetricsService,
  messages: Hs_messagesService,
  food_database: Hs_fooddatabasesService,
  genetic_diseases: Hs_geneticdisease1sService,
};

const EMAIL_TYPES = [
  { value: 'test',             label: 'Basic Test Email' },
  { value: 'welcome',          label: 'Patient Welcome' },
  { value: 'approval_request', label: 'Approval Request (to admin)' },
  { value: 'approved',         label: 'Account Approved' },
  { value: 'rejected',         label: 'Account Rejected' },
  { value: 'appointment',      label: 'Appointment Confirmation' },
  { value: 'emergency',        label: 'Emergency Alert' },
  { value: 'prescription',     label: 'Prescription Issued' },
];

const DB_ICON = {
  users:           { icon: 'fa-users',         color: '#1565C0' },
  appointments:    { icon: 'fa-calendar-check', color: '#0891B2' },
  medical_records: { icon: 'fa-file-medical',   color: '#7C3AED' },
  allergies:       { icon: 'fa-exclamation-triangle', color: '#D97706' },
  vaccinations:    { icon: 'fa-syringe',        color: '#16A34A' },
  prescriptions:   { icon: 'fa-pills',          color: '#DC2626' },
  diet_logs:       { icon: 'fa-carrot',         color: '#EA580C' },
  health_metrics:  { icon: 'fa-heartbeat',      color: '#E11D48' },
  messages:        { icon: 'fa-envelope',       color: '#0891B2' },
  food_database:   { icon: 'fa-drumstick-bite', color: '#D97706' },
  genetic_diseases:{ icon: 'fa-dna',            color: '#7C3AED' },
};

export default function Settings() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbRefreshing, setDbRefreshing] = useState(false);

  // General settings form
  const [form,    setForm]    = useState({ appName: '', systemEmail: '', nhsLogin: 'enabled' });
  const [saved,   setSaved]   = useState(false);

  // Email test
  const [emailType,   setEmailType]   = useState('test');
  const [emailTo,     setEmailTo]     = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult,  setEmailResult]  = useState(null);

  const load = useCallback(async (dbOnly = false) => {
    if (dbOnly) setDbRefreshing(true);
    else setLoading(true);
    try {
      const entries = await Promise.all(
        Object.entries(TABLE_SERVICES).map(async ([key, service]) => [key, (await service.getAll()).data?.length || 0])
      );
      const tables = Object.fromEntries(entries);
      const result = { appName: 'HealthSphere', systemEmail: '', tables };
      setData(result);
      if (!dbOnly) {
        setForm({ appName: result.appName, systemEmail: result.systemEmail, nhsLogin: 'enabled' });
      }
    } finally {
      setLoading(false);
      setDbRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSettings = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  };

  const sendTest = async (e) => {
    e.preventDefault();
    setEmailSending(true);
    setEmailResult(null);
    try {
      const body = { type: emailType };
      if (emailTo.trim()) body.to = emailTo.trim();
      const r = await api.post('/bridge/email/send', body);
      setEmailResult({ ok: r.data.success !== false, to: r.data.to, msg: r.data.success ? `Test email sent to ${r.data.to}` : 'Email sending failed — check SMTP configuration.' });
    } catch (err) {
      setEmailResult({ ok: false, msg: err.response?.data?.error || 'Failed to send test email.' });
    } finally {
      setEmailSending(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
          <i className="fas fa-cog" style={{ color: '#1565C0', marginRight: 8 }}></i>System Settings
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          HealthSphere administration &amp; configuration
        </div>
      </div>

      <div style={{ maxWidth: 700 }}>

        {/* ─── GENERAL SETTINGS ─── */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3><i className="fas fa-cog" style={{ marginRight: 6, color: '#1565C0' }}></i>General Settings</h3>
          </div>
          <div className="card-body">
            {saved && (
              <div className="alert alert-success" style={{ marginBottom: 16 }}>
                <i className="fas fa-check-circle"></i> Settings saved successfully.
              </div>
            )}
            <form onSubmit={saveSettings}>
              <div className="form-group">
                <label className="form-label">Application Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.appName}
                  onChange={e => setForm(p => ({ ...p, appName: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">System Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={form.systemEmail}
                  onChange={e => setForm(p => ({ ...p, systemEmail: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">NHS Login Integration</label>
                <select
                  className="form-control"
                  value={form.nhsLogin}
                  onChange={e => setForm(p => ({ ...p, nhsLogin: e.target.value }))}
                >
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary">
                <i className="fas fa-save" style={{ marginRight: 6 }}></i>Save Settings
              </button>
            </form>
          </div>
        </div>

        {/* ─── DATABASE STATUS ─── */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3><i className="fas fa-database" style={{ marginRight: 6, color: '#1565C0' }}></i>Database Status</h3>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => load(true)}
              disabled={dbRefreshing}
              style={{ fontSize: 12 }}
            >
              {dbRefreshing
                ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2, display: 'inline-block', marginRight: 4 }} />Refreshing…</>
                : <><i className="fas fa-sync-alt" style={{ marginRight: 4 }}></i>Refresh</>}
            </button>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {data?.tables && Object.entries(data.tables).map(([table, count]) => {
                const meta = DB_ICON[table] || { icon: 'fa-table', color: '#6B7280' };
                return (
                  <div key={table} style={{
                    background: 'var(--bg)',
                    padding: '10px 14px',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    border: '1px solid var(--border)',
                  }}>
                    <i className={`fas ${meta.icon}`} style={{ color: meta.color, width: 16, textAlign: 'center' }}></i>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, flex: 1, color: 'var(--primary)' }}>{table}</span>
                    <span style={{ fontWeight: 700, color: meta.color, fontSize: 13 }}>
                      {Number(count).toLocaleString()}
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11, marginLeft: 3 }}>rows</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── EMAIL CONFIGURATION ─── */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-envelope" style={{ marginRight: 6, color: '#1565C0' }}></i>Email Configuration</h3>
          </div>
          <div className="card-body">
            {/* Config info row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'System Email', value: data?.systemEmail || '—', icon: 'fa-at' },
                { label: 'App Name',     value: data?.appName || 'HealthSphere', icon: 'fa-tag' },
              ].map(row => (
                <div key={row.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                    <i className={`fas ${row.icon}`} style={{ marginRight: 5 }}></i>{row.label}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, fontFamily: 'monospace' }}>{row.value}</div>
                </div>
              ))}
            </div>

            {/* Send test email form */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: 'var(--primary)' }}>
                <i className="fas fa-paper-plane" style={{ marginRight: 6, color: '#1565C0' }}></i>Send Test Email
              </div>

              {emailResult && (
                <div className={`alert alert-${emailResult.ok ? 'success' : 'danger'}`} style={{ marginBottom: 14 }}>
                  <i className={`fas fa-${emailResult.ok ? 'check-circle' : 'exclamation-circle'}`}></i> {emailResult.msg}
                </div>
              )}

              <form onSubmit={sendTest}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Email Type</label>
                    <select
                      className="form-control"
                      value={emailType}
                      onChange={e => { setEmailType(e.target.value); setEmailResult(null); }}
                    >
                      {EMAIL_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Send To (optional)</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder={data?.systemEmail || 'admin@healthsphere.nhs.uk'}
                      value={emailTo}
                      onChange={e => { setEmailTo(e.target.value); setEmailResult(null); }}
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={emailSending}>
                  {emailSending
                    ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, display: 'inline-block', marginRight: 6 }} />Sending…</>
                    : <><i className="fas fa-paper-plane" style={{ marginRight: 6 }}></i>Send Test Email</>}
                </button>
              </form>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
