import { useState, useEffect } from 'react';
import { Hs_usersService } from '../../generated/services/Hs_usersService';
import { Hs_usershs_userrole } from '../../generated/models/Hs_usersModel';
import { Hs_medicalrecordsService } from '../../generated/services/Hs_medicalrecordsService';
import { Hs_medicalrecordshs_status } from '../../generated/models/Hs_medicalrecordsModel';
import { Hs_appointmentsService } from '../../generated/services/Hs_appointmentsService';
import { Hs_prescriptionsService } from '../../generated/services/Hs_prescriptionsService';
import { Hs_prescriptionshs_status } from '../../generated/models/Hs_prescriptionsModel';
import { Hs_fooddatabasesService } from '../../generated/services/Hs_fooddatabasesService';
import { Hs_geneticdisease1sService } from '../../generated/services/Hs_geneticdisease1sService';

const ROLE_CODES = Object.fromEntries(Object.entries(Hs_usershs_userrole).map(([c, l]) => [l, Number(c)]));
const MEDREC_STATUS_CODES = Object.fromEntries(Object.entries(Hs_medicalrecordshs_status).map(([c, l]) => [l, Number(c)]));
const PRES_STATUS_CODES = Object.fromEntries(Object.entries(Hs_prescriptionshs_status).map(([c, l]) => [l, Number(c)]));

const REPORTS = [
  {
    id: 'RPT-2025-Q3', title: 'Q3 2025 National Health Summary',
    type: 'quarterly', status: 'published', date: '2025-10-01',
    author: 'William Jayson', pages: 42, size: '3.8 MB',
    icon: 'fas fa-file-alt', color: '#1565C0', bg: '#DBEAFE',
    summary: 'Comprehensive quarterly review covering hypertension trends, diabetes prevalence, vaccination rates, and regional disparities across England and Wales.',
    highlights: [
      'Hypertension cases up 34% in East Midlands',
      'Diabetes under-40 cohort growing fastest',
      'Vaccination booster at 78% — below 85% target',
      'London active travel reducing CVD by 6%',
    ],
  },
  {
    id: 'RPT-2025-EM', title: 'East Midlands Sodium Intervention Study',
    type: 'regional', status: 'published', date: '2025-09-15',
    author: 'Sarah Mitchell', pages: 28, size: '2.1 MB',
    icon: 'fas fa-map-marker-alt', color: '#DC2626', bg: '#FEE2E2',
    summary: 'In-depth analysis of sodium consumption patterns in East Midlands and their correlation with hypertension hospitalisations. Includes proposed NHS campaign framework.',
    highlights: [
      'Average salt intake: 11.2g/day (NHS limit: 6g)',
      '4,821 new hypertension cases in 8 months',
      'Campaign projected to reduce intake by 18%',
      'Estimated NHS saving: £24M over 3 years',
    ],
  },
  {
    id: 'RPT-2025-MH', title: 'Mental Health Capacity & Demand Analysis',
    type: 'thematic', status: 'under_review', date: '2025-10-20',
    author: 'Dr. Priya Sharma', pages: 36, size: '2.9 MB',
    icon: 'fas fa-brain', color: '#7C3AED', bg: '#EDE9FE',
    summary: 'National review of CAMHS and adult mental health service capacity against rising demand. Identifies structural gaps and makes workforce recommendations.',
    highlights: [
      'Referrals up 12% — capacity up only 4%',
      '18+ week average waiting time',
      '400 additional counsellors needed',
      'Digital NHS app services as interim measure',
    ],
  },
  {
    id: 'RPT-2025-VACC', title: 'Winter Vaccination Campaign Assessment',
    type: 'campaign', status: 'draft', date: '2025-10-28',
    author: 'Mark Henderson', pages: 18, size: '1.4 MB',
    icon: 'fas fa-syringe', color: '#16A34A', bg: '#DCFCE7',
    summary: 'Assessment of 2025 winter booster campaign effectiveness and recommendations for closing the gap in under-40 uptake before the winter respiratory season.',
    highlights: [
      '78% national uptake vs 85% target',
      'Under-40 uptake at only 54%',
      'Mobile unit deployment recommended',
      'GP text-reminder pilot showed +12% conversion',
    ],
  },
  {
    id: 'RPT-2025-OB', title: 'Childhood Obesity Prevention Programme — 2025',
    type: 'annual', status: 'published', date: '2025-07-12',
    author: 'Claire Watson', pages: 54, size: '5.2 MB',
    icon: 'fas fa-child', color: '#D97706', bg: '#FEF3C7',
    summary: 'Annual review of childhood obesity rates and the effectiveness of school nutrition programmes, sugar taxes, and NHS healthy eating campaigns.',
    highlights: [
      'Childhood obesity plateaued at 22.1%',
      'School meal reform reduced processed food by 31%',
      'Sugar tax contributes £1.2B annually to NHS',
      'Scotland model reducing rates by 8% — replication recommended',
    ],
  },
  {
    id: 'RPT-2024-Q4', title: 'Q4 2024 National Health Summary',
    type: 'quarterly', status: 'archived', date: '2025-01-10',
    author: 'William Jayson', pages: 40, size: '3.5 MB',
    icon: 'fas fa-archive', color: '#5E7A99', bg: '#F1F5F9',
    summary: 'Q4 2024 comprehensive health review — baseline data against which Q1–Q3 2025 trends are measured.',
    highlights: [
      'Hypertension baseline: 142k cases',
      'Diabetes: 98k cases',
      'Obesity: 78k cases',
      'Vaccination rate: 74%',
    ],
  },
];

const STATUS_META = {
  published:    { color: '#16A34A', bg: '#DCFCE7', label: 'Published' },
  under_review: { color: '#D97706', bg: '#FEF3C7', label: 'Under Review' },
  draft:        { color: '#0891B2', bg: '#CFFAFE', label: 'Draft' },
  archived:     { color: '#5E7A99', bg: '#F1F5F9', label: 'Archived' },
};

const TYPE_LABEL = {
  quarterly: 'Quarterly Report',
  regional:  'Regional Study',
  thematic:  'Thematic Report',
  campaign:  'Campaign Review',
  annual:    'Annual Report',
};

const TABS = [
  { key: 'all',          label: 'All Reports' },
  { key: 'published',    label: 'Published' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'draft',        label: 'Draft' },
  { key: 'archived',     label: 'Archived' },
];

const EMPTY_NEW = { title: '', type: 'quarterly', summary: '' };

export default function GovReports() {
  const [stats,      setStats]      = useState(null);
  const [filter,     setFilter]     = useState('all');
  const [search,     setSearch]     = useState('');
  const [showNew,    setShowNew]    = useState(false);
  const [showGen,    setShowGen]    = useState(false);
  const [newForm,    setNewForm]    = useState(EMPTY_NEW);
  const [localRpts,  setLocalRpts]  = useState(REPORTS);

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  useEffect(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    Promise.all([
      Hs_usersService.getAll({ filter: `hs_userrole eq ${ROLE_CODES.patient}` }),
      Hs_medicalrecordsService.getAll({ filter: `hs_status eq ${MEDREC_STATUS_CODES.critical}` }),
      Hs_appointmentsService.getAll({ filter: `hs_appointmentdate ge ${monthStart}` }),
      Hs_prescriptionsService.getAll({ filter: `hs_status eq ${PRES_STATUS_CODES.active}` }),
      Hs_fooddatabasesService.getAll(),
      Hs_geneticdisease1sService.getAll(),
    ]).then(([patientsRes, criticalRes, apptsRes, presRes, foodRes, diseasesRes]) => {
      setStats({
        totalPatients: (patientsRes.data || []).length,
        criticalAlerts: (criticalRes.data || []).length,
        appointments: (apptsRes.data || []).length,
        activePrescriptions: (presRes.data || []).length,
        totalFoods: (foodRes.data || []).length,
        totalDiseases: (diseasesRes.data || []).length,
      });
    }).catch(() => {});
  }, []);

  const visible = localRpts.filter(r => {
    const matchTab =
      filter === 'all' ||
      r.status === filter ||
      r.type   === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.title.toLowerCase().includes(q)   ||
      r.author.toLowerCase().includes(q)  ||
      r.summary.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  const handleNewSubmit = (e) => {
    e.preventDefault();
    if (!newForm.title.trim()) return;
    const rpt = {
      id:     `RPT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      title:  newForm.title,
      type:   newForm.type,
      status: 'draft',
      date:   new Date().toISOString().slice(0, 10),
      author: 'Current User',
      pages:  0,
      size:   '—',
      icon:   'fas fa-file-alt',
      color:  '#0891B2',
      bg:     '#CFFAFE',
      summary:    newForm.summary || 'Draft report — summary pending.',
      highlights: [],
    };
    setLocalRpts(prev => [rpt, ...prev]);
    setShowNew(false);
    setNewForm(EMPTY_NEW);
  };

  const LIVE_STATS = [
    { label: 'Registered Patients',   value: stats?.totalPatients,        icon: 'fa-users',           color: '#1565C0', bg: '#DBEAFE' },
    { label: 'Total Appointments',    value: stats?.appointments,         icon: 'fa-calendar-check',  color: '#0891B2', bg: '#CFFAFE' },
    { label: 'Active Prescriptions',  value: stats?.activePrescriptions,  icon: 'fa-pills',           color: '#16A34A', bg: '#DCFCE7' },
    { label: 'Critical Cases',        value: stats?.criticalAlerts,       icon: 'fa-exclamation',     color: '#DC2626', bg: '#FEE2E2' },
    { label: 'Food Items (DB)',        value: stats?.totalFoods,           icon: 'fa-drumstick-bite',  color: '#D97706', bg: '#FEF3C7' },
    { label: 'Genetic Diseases (DB)', value: stats?.totalDiseases,        icon: 'fa-dna',             color: '#7C3AED', bg: '#EDE9FE' },
  ];

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
            <i className="fas fa-file-alt" style={{ color: '#1565C0', marginRight: 8 }}></i>
            Policy Reports &amp; Publications
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            DHSC internal reports · Anonymised HealthSphere data · {today}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <i className="fas fa-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13, pointerEvents: 'none' }}></i>
            <input
              className="form-control"
              style={{ paddingLeft: 32, width: 220, fontSize: 13 }}
              placeholder="Search reports..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
            <i className="fas fa-plus" style={{ marginRight: 6 }}></i>New Report
          </button>
        </div>
      </div>

      {/* Live data KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 22 }}>
        {LIVE_STATS.map(k => (
          <div key={k.label} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 14px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fas ${k.icon}`} style={{ fontSize: 16, color: k.color }}></i>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)', lineHeight: 1.1 }}>
                  {k.value == null
                    ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    : k.value.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{k.label}</div>
              </div>
            </div>
            <div style={{ height: 3, background: k.color, opacity: .7 }} />
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${filter === t.key ? '#1565C0' : 'var(--border)'}`,
              background: filter === t.key ? '#1565C0' : '#fff',
              color: filter === t.key ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all .15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Reports grid */}
      {visible.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(380px,1fr))', gap: 18, marginBottom: 20 }}>
          {visible.map(r => {
            const sm = STATUS_META[r.status] || STATUS_META.draft;
            return (
              <div key={r.id} className="card" style={{ borderTop: `4px solid ${r.color}`, padding: 0 }}>
                <div style={{ padding: '18px 20px' }}>

                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: r.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20, color: r.color }}>
                      <i className={r.icon}></i>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ background: sm.bg, color: sm.color, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                          {sm.label}
                        </span>
                        <span style={{ background: 'var(--bg)', color: 'var(--text-muted)', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                          {TYPE_LABEL[r.type] || r.type}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)', lineHeight: 1.4 }}>{r.title}</div>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, flexWrap: 'wrap' }}>
                    <span><i className="fas fa-hashtag" style={{ marginRight: 3 }}></i>{r.id}</span>
                    <span><i className="fas fa-user" style={{ marginRight: 3 }}></i>{r.author}</span>
                    <span><i className="fas fa-calendar" style={{ marginRight: 3 }}></i>
                      {new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    {r.pages > 0 && (
                      <span><i className="fas fa-file-pdf" style={{ marginRight: 3 }}></i>{r.pages} pages · {r.size}</span>
                    )}
                  </div>

                  {/* Summary */}
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 12px' }}>{r.summary}</p>

                  {/* Key Highlights */}
                  {r.highlights.length > 0 && (
                    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-muted)', marginBottom: 6 }}>
                        Key Highlights
                      </div>
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {r.highlights.map((h, i) => (
                          <li key={i} style={{ fontSize: 12.5, color: 'var(--primary)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <span style={{ color: r.color, marginTop: 1, flexShrink: 0 }}>&#10003;</span>
                            {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {r.status === 'published' || r.status === 'archived' ? (
                      <>
                        <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                          <i className="fas fa-download" style={{ marginRight: 6 }}></i>Download PDF
                        </button>
                        <button className="btn btn-outline btn-sm">
                          <i className="fas fa-share-alt" style={{ marginRight: 6 }}></i>Share
                        </button>
                      </>
                    ) : r.status === 'under_review' ? (
                      <>
                        <button className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                          <i className="fas fa-eye" style={{ marginRight: 6 }}></i>View Draft
                        </button>
                        <button className="btn btn-sm" style={{ background: '#16A34A', color: '#fff', border: 'none' }}>
                          <i className="fas fa-check" style={{ marginRight: 6 }}></i>Approve
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                        <i className="fas fa-edit" style={{ marginRight: 6 }}></i>Continue Editing
                      </button>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="empty-state">
            <i className="fas fa-file-alt" style={{ fontSize: 36, marginBottom: 12, opacity: .3 }}></i>
            <p>{search ? `No reports match "${search}"` : 'No reports in this category'}</p>
          </div>
        </div>
      )}

      {/* Generate Custom Report CTA */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 20, padding: '24px 28px',
          background: 'linear-gradient(135deg,#0A1F44 0%,#1565C0 100%)', color: '#fff',
          flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>📊</div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>Generate Custom Report</h4>
            <p style={{ margin: 0, fontSize: 13, opacity: .8 }}>
              Select regions, conditions, date ranges and metrics to compile a bespoke anonymised health report from HealthSphere data.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button
              onClick={() => setShowGen(true)}
              style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: '1.5px solid rgba(255,255,255,.3)', padding: '10px 20px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
            >
              <i className="fas fa-cog" style={{ marginRight: 6 }}></i>Configure
            </button>
            <button
              onClick={() => setShowGen(true)}
              style={{ background: '#fff', color: '#1565C0', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
            >
              <i className="fas fa-chart-bar" style={{ marginRight: 6 }}></i>Generate Now
            </button>
          </div>
        </div>
      </div>

      {/* ── New Report Modal ── */}
      {showNew && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header" style={{ background: 'var(--primary)', borderRadius: '12px 12px 0 0' }}>
              <h3 style={{ color: '#fff' }}><i className="fas fa-plus" style={{ marginRight: 8 }}></i>New Policy Report</h3>
              <button className="modal-close" style={{ color: '#fff' }} onClick={() => setShowNew(false)}>&times;</button>
            </div>
            <form onSubmit={handleNewSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Report Title *</label>
                  <input className="form-control" required placeholder="e.g. Q4 2025 National Health Summary"
                    value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Report Type</label>
                  <select className="form-control" value={newForm.type} onChange={e => setNewForm(f => ({ ...f, type: e.target.value }))}>
                    {Object.entries(TYPE_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Summary / Scope</label>
                  <textarea className="form-control" rows={3} placeholder="Briefly describe the report scope..."
                    value={newForm.summary} onChange={e => setNewForm(f => ({ ...f, summary: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  <i className="fas fa-plus" style={{ marginRight: 6 }}></i>Create Report
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowNew(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Generate Report Modal ── */}
      {showGen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowGen(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg,#0A1F44,#1565C0)', borderRadius: '12px 12px 0 0' }}>
              <h3 style={{ color: '#fff' }}><i className="fas fa-chart-bar" style={{ marginRight: 8 }}></i>Generate Custom Report</h3>
              <button className="modal-close" style={{ color: '#fff' }} onClick={() => setShowGen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Region</label>
                  <select className="form-control">
                    <option>All Regions</option>
                    <option>East Midlands</option><option>North West</option>
                    <option>North East</option><option>Yorkshire</option>
                    <option>South East</option><option>West Midlands</option>
                    <option>London</option><option>South West</option>
                    <option>East of England</option><option>Wales</option>
                    <option>Scotland</option><option>Northern Ireland</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Primary Condition</label>
                  <select className="form-control">
                    <option>All Conditions</option>
                    <option>Hypertension</option><option>Type 2 Diabetes</option>
                    <option>Obesity</option><option>Mental Health</option>
                    <option>Respiratory</option><option>Cardiovascular</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Report Type</label>
                  <select className="form-control">
                    {Object.entries(TYPE_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date From</label>
                  <input type="date" className="form-control" defaultValue="2025-01-01" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date To</label>
                  <input type="date" className="form-control" defaultValue={new Date().toISOString().slice(0,10)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Include Metrics</label>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                    {['Case counts','Population data','Hospital admissions','Prescription data','Vaccination rates','Regional comparisons'].map(m => (
                      <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" defaultChecked /> {m}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', background: 'linear-gradient(135deg,#0A1F44,#1565C0)', border: 'none' }}
                onClick={() => setShowGen(false)}>
                <i className="fas fa-chart-bar" style={{ marginRight: 6 }}></i>Generate Report
              </button>
              <button className="btn btn-outline" onClick={() => setShowGen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
