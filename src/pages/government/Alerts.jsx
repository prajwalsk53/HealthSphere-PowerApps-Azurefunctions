import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Hs_publichealthalertsService } from '../../generated/services/Hs_publichealthalertsService';
import { Hs_publichealthalertshs_severity } from '../../generated/models/Hs_publichealthalertsModel';

const SEVERITY_TO_DV = { critical: 'High', warning: 'Medium', info: 'Low' };
const DV_SEVERITY_CODES = Object.fromEntries(Object.entries(Hs_publichealthalertshs_severity).map(([c, l]) => [l, Number(c)]));
const DV_TO_TYPE = { High: 'critical', Medium: 'warning', Low: 'info' };

// ── Static pre-analysed alerts matching PHP data ──────────────────────────────
const BASE_ALERTS = [
  {
    id: 's1', type: 'critical', icon: '🚨',
    title: 'East Midlands — Hypertension Spike',
    region: 'East Midlands', condition: 'Hypertension', change: '+34%',
    detail: 'Diet-related hypertension 34% above national average. Salt intake per capita recorded at 11.2g/day vs NHS recommended 6g/day. 4,821 new cases logged Q3 2025.',
    recommendation: 'Draft NHS reduced-salt campaign targeting East Midlands supermarkets, schools, and community centres. Estimated reach: 2.1M residents.',
    deadline: '2025-11-15', status: 'open', affected: '4,821 patients',
  },
  {
    id: 's2', type: 'critical', icon: '🚨',
    title: 'North West — Type 2 Diabetes Surge',
    region: 'North West', condition: 'Type 2 Diabetes', change: '+22%',
    detail: '6,103 new Type 2 Diabetes diagnoses in North West this year. Under-40 cohort accounts for 38% of new cases — a 5-year high. Processed food consumption and physical inactivity are primary drivers.',
    recommendation: 'Commission workplace wellness programmes and subsidised gym access for low-income households. Recommend school nutrition intervention pilot.',
    deadline: '2025-11-30', status: 'open', affected: '6,103 patients',
  },
  {
    id: 's3', type: 'warning', icon: '⚠️',
    title: 'North East — Obesity Trend',
    region: 'North East', condition: 'Obesity', change: '+18%',
    detail: 'BMI above 30 recorded in 31% of North East adults — up from 26% in 2023. Strong correlation with sedentary commuting patterns and reduced green space access.',
    recommendation: 'Active transport policy proposal: subsidised cycling infrastructure and 10,000-step challenge campaign through NHS app.',
    deadline: '2025-12-15', status: 'in_review', affected: '2,987 patients',
  },
  {
    id: 's4', type: 'warning', icon: '⚠️',
    title: 'Yorkshire — Mental Health Waiting Times',
    region: 'Yorkshire', condition: 'Mental Health', change: '+12%',
    detail: 'NHS mental health referrals up 12% in Yorkshire but capacity only increased 4%. Average CAMHS waiting time now 18.4 weeks, far exceeding the 4-week target.',
    recommendation: 'Emergency funding allocation for 400 additional counsellors. Expand digital mental health services via NHS app for interim support.',
    deadline: '2025-11-01', status: 'in_review', affected: '3,412 referrals',
  },
  {
    id: 's5', type: 'warning', icon: '⚠️',
    title: 'National — Vaccination Coverage Below Target',
    region: 'National', condition: 'Covid-19 Booster', change: '78% (target: 85%)',
    detail: 'Booster uptake at 78% nationally. Over-65s: 91% — well above target. Under-40s: only 54%. Gap widening by 2% per quarter. Risk of winter wave if not addressed.',
    recommendation: 'Targeted mobile vaccination unit deployment in urban under-40 hotspots. GP text-reminder campaign with personalised booking links.',
    deadline: '2025-10-31', status: 'escalated', affected: '~8.2M unvaccinated',
  },
  {
    id: 's6', type: 'info', icon: 'ℹ️',
    title: 'London — Positive Active Travel Trend',
    region: 'London', condition: 'Cardiovascular / Obesity', change: '+2% (below avg)',
    detail: 'London showing only +2% growth in obesity vs national +18%. Cycle Superhighway and ULEZ expansion credited with 14% increase in active commuting. CVD hospitalisations down 6%.',
    recommendation: 'Share London model findings with transport ministers in North East and West Midlands. Commission feasibility study for regional replication.',
    deadline: '2026-01-15', status: 'resolved', affected: 'Positive — 9M residents',
  },
  {
    id: 's7', type: 'info', icon: 'ℹ️',
    title: 'Scotland — Diet Intervention Success',
    region: 'Scotland', condition: 'Obesity / Diabetes', change: '-8%',
    detail: 'Scotland recording −8% in diet-related illness following 2023 sugar tax extension and school meal programme reform. Progress exceeds WHO targets.',
    recommendation: 'Document findings for cross-UK policy brief. Recommend extending sugar tax to ultra-processed foods nationally.',
    deadline: '2026-02-01', status: 'resolved', affected: 'Positive — 5.5M residents',
  },
];

const REGIONS = ['All Regions', 'National', 'London', 'East Midlands', 'North West', 'North East', 'Yorkshire', 'Scotland'];

const TYPE_STYLE = {
  critical: { color: '#DC2626', bg: '#FEE2E2', label: 'Critical', borderColor: '#DC2626' },
  warning:  { color: '#D97706', bg: '#FEF3C7', label: 'Warning',  borderColor: '#D97706' },
  info:     { color: '#0891B2', bg: '#CFFAFE', label: 'Info',     borderColor: null },
};

const STATUS_STYLE = {
  open:      { color: '#DC2626', bg: '#FEE2E2', label: 'Open' },
  in_review: { color: '#D97706', bg: '#FEF3C7', label: 'In Review' },
  escalated: { color: '#7C3AED', bg: '#EDE9FE', label: 'Escalated' },
  resolved:  { color: '#16A34A', bg: '#DCFCE7', label: 'Resolved' },
};

const STATUS_FILTERS = [
  { key: 'all',      label: 'All Alerts' },
  { key: 'critical', label: 'Critical' },
  { key: 'warning',  label: 'Warning' },
  { key: 'in_review',label: 'In Review' },
  { key: 'resolved', label: 'Resolved' },
];

function fmtDeadline(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function alertCode(id) {
  const n = typeof id === 'string' ? id.replace('s', '') : id;
  return 'ALERT-' + String(n).padStart(3, '0');
}

export default function GovAlerts() {
  const { user } = useAuth();
  const [alerts,    setAlerts]    = useState(() => BASE_ALERTS.map(a => ({ ...a })));
  const [filterStatus, setFilter] = useState('all');
  const [filterRegion, setRegion] = useState('All Regions');
  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState({ title: '', message: '', severity: 'warning', region: 'National' });
  const [saving,    setSaving]    = useState(false);
  const [success,   setSuccess]   = useState('');

  // Fetch user-issued alerts from DB and merge
  const loadDbAlerts = useCallback(async () => {
    try {
      const { data } = await Hs_publichealthalertsService.getAll({ orderBy: ['createdon desc'] });
      const dbAlerts = (data || []).map(a => {
        const type = DV_TO_TYPE[Hs_publichealthalertshs_severity[a.hs_severity]] || 'info';
        return {
          id:             `db-${a.hs_publichealthalertid}`,
          type,
          icon:           type === 'critical' ? '🚨' : type === 'warning' ? '⚠️' : 'ℹ️',
          title:          a.hs_title,
          region:         a.hs_region || 'National',
          condition:      '',
          change:         '',
          detail:         a.hs_message || '',
          recommendation: '',
          deadline:       null,
          status:         'open',
          affected:       '',
          issuedAt:       a.createdon,
        };
      });
      setAlerts([...dbAlerts, ...BASE_ALERTS.map(a => ({ ...a }))]);
    } catch {
      // fallback to static only
    }
  }, []);

  useEffect(() => { loadDbAlerts(); }, [loadDbAlerts]);

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

  const updateStatus = (id, newStatus) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
  };

  const issue = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Hs_publichealthalertsService.create({
        'hs_IssuedBy@odata.bind': `/hs_users(${user.id})`,
        hs_publicalertname: form.title,
        hs_title: form.title,
        hs_message: form.message,
        hs_severity: DV_SEVERITY_CODES[SEVERITY_TO_DV[form.severity]],
        hs_region: form.region,
        hs_alertdatetime: new Date().toISOString(),
      });
      flash('Health alert issued successfully.');
      setShowModal(false);
      setForm({ title: '', message: '', severity: 'warning', region: 'National' });
      loadDbAlerts();
    } finally { setSaving(false); }
  };

  // KPI counts (from full unfiltered list)
  const kpi = {
    critical:  alerts.filter(a => a.type === 'critical').length,
    warning:   alerts.filter(a => a.type === 'warning').length,
    in_review: alerts.filter(a => a.status === 'in_review').length,
    resolved:  alerts.filter(a => a.status === 'resolved').length,
  };

  // Filtered list
  const filtered = alerts.filter(a => {
    const matchStatus =
      filterStatus === 'all' ||
      a.type === filterStatus ||
      a.status === filterStatus;
    const matchRegion =
      filterRegion === 'All Regions' || a.region === filterRegion;
    return matchStatus && matchRegion;
  });

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
            <i className="fas fa-bell" style={{ color: '#1565C0', marginRight: 8 }}></i>Public Health Alerts
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Real-time alerts requiring policy intervention &middot;{' '}
            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm btn-outline">
            <i className="fas fa-download" style={{ marginRight: 6 }}></i>Export PDF
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => setShowModal(true)}>
            <i className="fas fa-plus" style={{ marginRight: 6 }}></i>Raise Alert
          </button>
        </div>
      </div>

      {/* Success flash */}
      {success && (
        <div style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#166534', fontSize: 13, fontWeight: 600 }}>
          <i className="fas fa-check-circle" style={{ marginRight: 6 }}></i>{success}
        </div>
      )}

      {/* KPI stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Critical Alerts', value: kpi.critical,  icon: 'fa-exclamation-circle', color: '#DC2626', bg: '#FEF2F2', sub: 'Immediate action needed' },
          { label: 'Warnings',        value: kpi.warning,   icon: 'fa-exclamation-triangle',color: '#D97706', bg: '#FFFBEB', sub: 'Under monitoring' },
          { label: 'In Review',       value: kpi.in_review, icon: 'fa-search',              color: '#1565C0', bg: '#EFF6FF', sub: 'Policy team assigned' },
          { label: 'Resolved',        value: kpi.resolved,  icon: 'fa-check-double',        color: '#16A34A', bg: '#F0FDF4', sub: 'Closed this quarter' },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <div className="stat-icon" style={{ background: c.bg, color: c.color }}>
              <i className={`fas ${c.icon}`}></i>
            </div>
            <div className="stat-info">
              <div className="stat-label">{c.label}</div>
              <div className="stat-value">{c.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>Filter:</span>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${filterStatus === f.key ? '#1565C0' : 'var(--border)'}`,
              background: filterStatus === f.key ? '#1565C0' : '#fff',
              color: filterStatus === f.key ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}
        <select
          value={filterRegion}
          onChange={e => setRegion(e.target.value)}
          style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            border: '1.5px solid var(--border)', background: '#fff',
            color: 'var(--text-muted)', cursor: 'pointer',
          }}
        >
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Alert cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filtered.length ? filtered.map(alert => {
          const ts = TYPE_STYLE[alert.type]   || TYPE_STYLE.info;
          const ss = STATUS_STYLE[alert.status] || STATUS_STYLE.open;
          const resolved = alert.status === 'resolved';
          return (
            <div
              key={alert.id}
              className="card"
              style={{
                borderLeft: ts.borderColor ? `4px solid ${ts.borderColor}` : undefined,
                transition: 'box-shadow 0.15s',
              }}
            >
              <div className="card-body" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

                  {/* Emoji icon */}
                  <div style={{ fontSize: 28, flexShrink: 0, lineHeight: 1, marginTop: 2 }}>
                    {alert.icon}
                  </div>

                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Badges row */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ background: ts.bg, color: ts.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                        {ts.label}
                      </span>
                      <span style={{ background: ss.bg, color: ss.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                        {ss.label}
                      </span>
                      <span style={{ background: 'var(--bg)', color: 'var(--text-muted)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                        <i className="fas fa-map-marker-alt" style={{ marginRight: 4 }}></i>{alert.region}
                      </span>
                      {alert.condition && (
                        <span style={{ background: 'var(--bg)', color: 'var(--text-muted)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                          {alert.condition}{alert.change ? ` · ${alert.change}` : ''}
                        </span>
                      )}
                      {alert.issuedAt && (
                        <span style={{ background: 'var(--bg)', color: 'var(--text-muted)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                          <i className="fas fa-clock" style={{ marginRight: 4 }}></i>
                          {new Date(alert.issuedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h5 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: 'var(--primary)' }}>
                      {alert.title}
                    </h5>

                    {/* Detail */}
                    {alert.detail && (
                      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, margin: '0 0 12px' }}>
                        {alert.detail}
                      </p>
                    )}

                    {/* Recommended Action box */}
                    {alert.recommendation && (
                      <div style={{
                        background: 'var(--bg)', borderRadius: 8, padding: '12px 14px',
                        marginBottom: 12, borderLeft: '3px solid #1565C0',
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-muted)', marginBottom: 4 }}>
                          <i className="fas fa-lightbulb" style={{ color: '#1565C0', marginRight: 5 }}></i>
                          Recommended Action
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>
                          {alert.recommendation}
                        </p>
                      </div>
                    )}

                    {/* Footer meta */}
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      {alert.deadline && (
                        <span>
                          <i className="fas fa-calendar" style={{ marginRight: 4 }}></i>
                          Deadline: <strong style={{ color: 'var(--primary)' }}>{fmtDeadline(alert.deadline)}</strong>
                        </span>
                      )}
                      {alert.affected && (
                        <span>
                          <i className="fas fa-users" style={{ marginRight: 4 }}></i>
                          Affected: <strong style={{ color: 'var(--primary)' }}>{alert.affected}</strong>
                        </span>
                      )}
                      <span>
                        <i className="fas fa-tag" style={{ marginRight: 4 }}></i>
                        ID: <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: 3, fontSize: 11 }}>
                          {alertCode(alert.id)}
                        </code>
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                    {!resolved ? (
                      <>
                        <button className="btn btn-sm btn-primary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          <i className="fas fa-file-alt" style={{ marginRight: 5 }}></i>Draft Policy
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ fontSize: 12 }}
                          onClick={() => updateStatus(alert.id, 'escalated')}
                        >
                          <i className="fas fa-share" style={{ marginRight: 5 }}></i>Escalate
                        </button>
                        <button
                          className="btn btn-sm btn-success"
                          style={{ fontSize: 12 }}
                          onClick={() => updateStatus(alert.id, 'resolved')}
                        >
                          <i className="fas fa-check" style={{ marginRight: 5 }}></i>Resolve
                        </button>
                      </>
                    ) : (
                      <button style={{
                        background: '#DCFCE7', color: '#16A34A', border: 'none',
                        borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600,
                        cursor: 'default',
                      }}>
                        <i className="fas fa-check-double" style={{ marginRight: 5 }}></i>Closed
                      </button>
                    )}
                  </div>

                </div>
              </div>
            </div>
          );
        }) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <i className="fas fa-bell-slash" style={{ fontSize: 50, opacity: 0.2, display: 'block', marginBottom: 16 }}></i>
            <p style={{ fontSize: 14, marginBottom: 12 }}>No alerts match the selected filters.</p>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => { setFilter('all'); setRegion('All Regions'); }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* ── Raise Alert Modal ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)', borderRadius: '8px 8px 0 0' }}>
              <h3 style={{ color: '#fff', margin: 0 }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }}></i>Raise Public Health Alert
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)} style={{ color: '#fff' }}>✕</button>
            </div>
            <form onSubmit={issue}>
              <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Alert Title <span style={{ color: '#DC2626' }}>*</span></label>
                  <input
                    className="form-control"
                    required
                    placeholder="e.g. South West — Rising Respiratory Infections"
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Alert Details <span style={{ color: '#DC2626' }}>*</span></label>
                  <textarea
                    className="form-control"
                    rows={4}
                    required
                    placeholder="Describe the situation, affected population, and key statistics..."
                    value={form.message}
                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Severity</label>
                    <select className="form-control" value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}>
                      <option value="critical">🚨 Critical</option>
                      <option value="warning">⚠️ Warning</option>
                      <option value="info">ℹ️ Info</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Region</label>
                    <select className="form-control" value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))}>
                      {['National','London','East Midlands','West Midlands','North West','North East','South West','South East','Yorkshire','East of England','Scotland','Wales','Northern Ireland'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger" disabled={saving}>
                  {saving
                    ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, display: 'inline-block', marginRight: 6 }} />Issuing…</>
                    : <><i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }}></i>Issue Alert</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
