import { useState, useEffect } from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Hs_usersService } from '../../generated/services/Hs_usersService';
import { Hs_usershs_userrole } from '../../generated/models/Hs_usersModel';
import { Hs_medicalrecordsService } from '../../generated/services/Hs_medicalrecordsService';
import { Hs_medicalrecordshs_status } from '../../generated/models/Hs_medicalrecordsModel';
import { Hs_appointmentsService } from '../../generated/services/Hs_appointmentsService';
import { Hs_prescriptionsService } from '../../generated/services/Hs_prescriptionsService';
import { Hs_prescriptionshs_status } from '../../generated/models/Hs_prescriptionsModel';

const ROLE_CODES = Object.fromEntries(Object.entries(Hs_usershs_userrole).map(([c, l]) => [l, Number(c)]));
const MEDREC_STATUS_CODES = Object.fromEntries(Object.entries(Hs_medicalrecordshs_status).map(([c, l]) => [l, Number(c)]));
const PRES_STATUS_CODES = Object.fromEntries(Object.entries(Hs_prescriptionshs_status).map(([c, l]) => [l, Number(c)]));

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const TREND_DATA = {
  labels: MONTHS,
  datasets: [
    { label: 'Hypertension', data: [120,135,142,138,155,148,162,170,155,168,180,192], borderColor: '#1565C0', backgroundColor: 'rgba(21,101,192,.08)', tension: .4, fill: true },
    { label: 'Diabetes',     data: [80,88,92,85,95,100,98,105,112,108,115,122],       borderColor: '#DC2626', backgroundColor: 'rgba(220,38,38,.06)',    tension: .4, fill: true },
    { label: 'Obesity',      data: [65,70,68,72,75,78,80,82,85,88,90,95],             borderColor: '#D97706', backgroundColor: 'rgba(217,119,6,.06)',    tension: .4, fill: true },
  ],
};

const PIE_DATA = {
  labels: ['Hypertension','Type 2 Diabetes','Obesity','Thyroid','Other'],
  datasets: [{ data: [30,25,20,15,10], backgroundColor: ['#1565C0','#00B4D8','#16A34A','#D97706','#DC2626'], borderWidth: 2, borderColor: '#fff' }],
};

const ADMISSIONS_DATA = {
  labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul'],
  datasets: [
    { label: 'New Patients', data: [80,95,112,98,125,110,135], backgroundColor: '#1565C0', borderRadius: 4 },
    { label: 'Follow-up',    data: [45,58,72,65,82,70,90],     backgroundColor: '#00B4D8', borderRadius: 4 },
  ],
};

const REGIONS = [
  { region: 'East Midlands', condition: 'Hypertension / Sodium', zone: 'critical',  change: '+34%' },
  { region: 'North West',    condition: 'Type 2 Diabetes',        zone: 'critical',  change: '+22%' },
  { region: 'North East',    condition: 'Obesity',                zone: 'attention', change: '+18%' },
  { region: 'South East',    condition: 'Respiratory',            zone: 'attention', change: '+10%' },
  { region: 'Yorkshire',     condition: 'Mental Health',          zone: 'attention', change: '+12%' },
  { region: 'London',        condition: 'Hypertension',           zone: 'healthy',   change: '+2%'  },
  { region: 'Wales',         condition: 'Diabetes',               zone: 'healthy',   change: '-5%'  },
  { region: 'Scotland',      condition: 'Obesity',                zone: 'healthy',   change: '-8%'  },
];

const ZONE_COLOR = { critical: '#DC2626', attention: '#D97706', healthy: '#16A34A' };

const ALERTS = [
  { ico: '🚨', type: 'CRITICAL', title: 'East Midlands Sodium Spike',        msg: 'Diet-related hypertension 34% above national average. Draft NHS campaign recommended.', color: '#DC2626', bg: '#FEE2E2' },
  { ico: '⚠️', type: 'WARNING',  title: 'Type 2 Diabetes — NW England',      msg: 'New cases increased 22% over 6 months. School nutrition intervention flagged.',          color: '#D97706', bg: '#FEF3C7' },
  { ico: '⚠️', type: 'WARNING',  title: 'Obesity Trends — NE England',        msg: 'Sedentary behaviour up 18%. Active transport policy proposed.',                          color: '#D97706', bg: '#FEF3C7' },
  { ico: 'ℹ️', type: 'INFO',     title: 'Vaccination Coverage — Q4 2025',     msg: 'Covid booster uptake at 78%. Target: 85%. Push campaign scheduled.',                    color: '#0891B2', bg: '#CFFAFE' },
];

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
  scales: { x: { grid: { display: false } }, y: { grid: { color: '#EFF6FF' } } },
};

const BAR_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'top' } },
  scales: { x: { grid: { display: false } }, y: { grid: { color: '#EFF6FF' } } },
};

const PIE_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'right', labels: { boxWidth: 14, padding: 14 } } },
};

const PERIODS = ['Daily', 'Weekly', 'Monthly', 'Yearly'];

export default function GovDashboard() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [period,  setPeriod]  = useState('Monthly');
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  useEffect(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    Promise.all([
      Hs_usersService.getAll({ filter: `hs_userrole eq ${ROLE_CODES.patient}` }),
      Hs_medicalrecordsService.getAll({ filter: `hs_status eq ${MEDREC_STATUS_CODES.critical}` }),
      Hs_appointmentsService.getAll({ filter: `hs_appointmentdate ge ${monthStart}` }),
      Hs_prescriptionsService.getAll({ filter: `hs_status eq ${PRES_STATUS_CODES.active}` }),
    ]).then(([patientsRes, criticalRes, apptsRes, presRes]) => {
      setStats({
        totalPatients: (patientsRes.data || []).length,
        criticalAlerts: (criticalRes.data || []).length,
        appointments: (apptsRes.data || []).length,
        activePrescriptions: (presRes.data || []).length,
      });
    }).finally(() => setLoading(false));
  }, []);

  const kpis = [
    { label: 'Registered Patients',  value: stats?.totalPatients?.toLocaleString() ?? '—', icon: 'fa-users',             color: '#1565C0', bg: '#DBEAFE', sub: <><span style={{ color:'#16A34A' }}>↑ 12%</span> this month</> },
    { label: 'Critical Alerts',      value: stats?.criticalAlerts ?? '—',                  icon: 'fa-exclamation-triangle',color: '#D97706', bg: '#FEF3C7', sub: <><span style={{ color:'#DC2626' }}>↑ 8%</span> Requires action</> },
    { label: 'Total Appointments',   value: stats?.appointments?.toLocaleString() ?? '—',  icon: 'fa-calendar-check',     color: '#0891B2', bg: '#CFFAFE', sub: null },
    { label: 'Active Prescriptions', value: stats?.activePrescriptions ?? '—',              icon: 'fa-pills',              color: '#16A34A', bg: '#DCFCE7', sub: null },
    { label: 'High-Risk Regions',    value: '3',                                            icon: 'fa-map-marker-alt',     color: '#DC2626', bg: '#FEE2E2', sub: 'East Midlands, NW, NE' },
  ];

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
            <i className="fas fa-landmark" style={{ color: '#1565C0', marginRight: 8 }}></i>
            Public Health Analytics Dashboard
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Dept. of Health &amp; Social Care · Anonymised Data · {today}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Period selector */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 8, padding: 4, border: '1px solid var(--border)' }}>
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: period === p ? '#1565C0' : 'transparent',
                  color: period === p ? '#fff' : 'var(--text-muted)',
                  transition: 'all .15s',
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="btn btn-outline btn-sm">
            <i className="fas fa-download" style={{ marginRight: 6 }}></i>Export Report
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fas ${k.icon}`} style={{ fontSize: 18, color: k.color }}></i>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', lineHeight: 1.1 }}>
                  {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : k.value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>{k.label}</div>
                {k.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>}
              </div>
            </div>
            <div style={{ height: 3, background: k.color, opacity: .7 }} />
          </div>
        ))}
      </div>

      {/* Charts row 1: Trend line + Pie */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* National Disease Trends */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-chart-line" style={{ marginRight: 6, color: '#1565C0' }}></i>National Disease Trends (2025)</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { label: '● Hypertension', bg: '#DBEAFE', color: '#1565C0' },
                { label: '● Diabetes',     bg: '#FEE2E2', color: '#DC2626' },
                { label: '● Obesity',      bg: '#FEF3C7', color: '#D97706' },
              ].map(l => (
                <span key={l.label} style={{ background: l.bg, color: l.color, padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <div className="card-body" style={{ height: 280 }}>
            <Line data={TREND_DATA} options={CHART_OPTS} />
          </div>
        </div>

        {/* Disease Distribution Pie */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-chart-pie" style={{ marginRight: 6, color: '#1565C0' }}></i>Disease Distribution</h3>
          </div>
          <div className="card-body" style={{ height: 280 }}>
            <Pie data={PIE_DATA} options={PIE_OPTS} />
          </div>
        </div>
      </div>

      {/* Row 2: UK Map + Regional Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* UK Region SVG Map */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-map-marked-alt" style={{ marginRight: 6, color: '#1565C0' }}></i>Regional Health Risk Map — UK</h3>
          </div>
          <div className="card-body">
            <div style={{ background: '#0f172a', borderRadius: 12, padding: 12, minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 400 600" style={{ width: '100%', maxHeight: 320 }} fill="none">
                <text x="200" y="28" textAnchor="middle" fill="rgba(255,255,255,.4)" fontSize="12" fontFamily="Inter">UK Regional Heat Map — High Sodium Risk</text>
                {/* Scotland */}
                <ellipse cx="200" cy="100" rx="80" ry="70" fill="rgba(21,101,192,.4)" stroke="#1565C0" strokeWidth="1"/>
                <text x="200" y="105" textAnchor="middle" fill="rgba(255,255,255,.8)" fontSize="11">Scotland</text>
                {/* North England */}
                <rect x="130" y="180" width="140" height="80" rx="8" fill="rgba(220,38,38,.5)" stroke="#DC2626" strokeWidth="1"/>
                <text x="200" y="225" textAnchor="middle" fill="rgba(255,255,255,.9)" fontSize="11">North England</text>
                <text x="200" y="240" textAnchor="middle" fill="rgba(255,255,255,.7)" fontSize="9">HIGH RISK ▲</text>
                {/* East Midlands */}
                <rect x="140" y="270" width="120" height="70" rx="8" fill="rgba(220,38,38,.7)" stroke="#DC2626" strokeWidth="2"/>
                <text x="200" y="308" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">East Midlands</text>
                <text x="200" y="323" textAnchor="middle" fill="rgba(255,255,255,.8)" fontSize="9">CRITICAL ⚠</text>
                {/* South */}
                <ellipse cx="195" cy="400" rx="100" ry="60" fill="rgba(217,119,6,.4)" stroke="#D97706" strokeWidth="1"/>
                <text x="195" y="405" textAnchor="middle" fill="rgba(255,255,255,.8)" fontSize="11">South England</text>
                {/* Wales */}
                <ellipse cx="100" cy="310" rx="45" ry="55" fill="rgba(22,163,74,.4)" stroke="#16A34A" strokeWidth="1"/>
                <text x="100" y="315" textAnchor="middle" fill="rgba(255,255,255,.8)" fontSize="9">Wales</text>
              </svg>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { color: '#DC2626', label: 'Critical Risk' },
                { color: '#D97706', label: 'Moderate Risk' },
                { color: '#1565C0', label: 'Low Risk' },
                { color: '#16A34A', label: 'Healthy' },
              ].map(l => (
                <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: l.color, flexShrink: 0 }}></span>
                  {l.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Regional Breakdown Table */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-table" style={{ marginRight: 6, color: '#1565C0' }}></i>Regional Breakdown</h3>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 420 }}>
            {REGIONS.map(r => {
              const color = ZONE_COLOR[r.zone];
              return (
                <div key={r.region} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }}></span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.region}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.condition}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color }}>{r.change}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Hospital Admissions + Active Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Admissions bar chart */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-hospital" style={{ marginRight: 6, color: '#1565C0' }}></i>Hospital Admissions (2025)</h3>
          </div>
          <div className="card-body" style={{ height: 250 }}>
            <Bar data={ADMISSIONS_DATA} options={BAR_OPTS} />
          </div>
        </div>

        {/* Active Public Health Alerts */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-bell" style={{ marginRight: 6, color: '#1565C0' }}></i>Active Public Health Alerts</h3>
            <span className="badge badge-danger">3 critical</span>
          </div>
          <div>
            {ALERTS.map((a, i) => (
              <div key={i} style={{
                padding: '14px 20px', borderBottom: '1px solid var(--border)',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                background: `${a.bg}18`,
              }}>
                <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1.2 }}>{a.ico}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: a.color, background: a.bg, padding: '2px 8px', borderRadius: 4, letterSpacing: '.5px' }}>
                      {a.type}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{a.title}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{a.msg}</p>
                </div>
                <button className="btn btn-outline btn-sm" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                  Draft Brief
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
