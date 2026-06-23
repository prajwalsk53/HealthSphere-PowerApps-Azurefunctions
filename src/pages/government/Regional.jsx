import { useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Title, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const REGIONS = [
  { name: 'East Midlands',    risk: 'critical',  primary: 'Hypertension',    cases: 4821, change: 34,  pop: 4.9,  hosp: 12, color: '#DC2626', bg: '#FEE2E2' },
  { name: 'North West',       risk: 'critical',  primary: 'Type 2 Diabetes', cases: 6103, change: 22,  pop: 7.4,  hosp: 18, color: '#DC2626', bg: '#FEE2E2' },
  { name: 'North East',       risk: 'attention', primary: 'Obesity',         cases: 2987, change: 18,  pop: 2.7,  hosp: 8,  color: '#D97706', bg: '#FEF3C7' },
  { name: 'Yorkshire',        risk: 'attention', primary: 'Mental Health',   cases: 3412, change: 12,  pop: 5.5,  hosp: 14, color: '#D97706', bg: '#FEF3C7' },
  { name: 'South East',       risk: 'attention', primary: 'Respiratory',     cases: 2190, change: 10,  pop: 9.2,  hosp: 22, color: '#D97706', bg: '#FEF3C7' },
  { name: 'West Midlands',    risk: 'attention', primary: 'Cardiovascular',  cases: 3750, change: 8,   pop: 5.9,  hosp: 15, color: '#D97706', bg: '#FEF3C7' },
  { name: 'London',           risk: 'healthy',   primary: 'Hypertension',    cases: 5210, change: 2,   pop: 9.0,  hosp: 30, color: '#16A34A', bg: '#DCFCE7' },
  { name: 'South West',       risk: 'healthy',   primary: 'Diabetes',        cases: 1820, change: -3,  pop: 5.7,  hosp: 11, color: '#16A34A', bg: '#DCFCE7' },
  { name: 'East of England',  risk: 'healthy',   primary: 'Obesity',         cases: 2100, change: 1,   pop: 6.3,  hosp: 13, color: '#16A34A', bg: '#DCFCE7' },
  { name: 'Wales',            risk: 'healthy',   primary: 'Diabetes',        cases: 1450, change: -5,  pop: 3.2,  hosp: 9,  color: '#16A34A', bg: '#DCFCE7' },
  { name: 'Scotland',         risk: 'healthy',   primary: 'Obesity',         cases: 2340, change: -8,  pop: 5.5,  hosp: 14, color: '#16A34A', bg: '#DCFCE7' },
  { name: 'Northern Ireland', risk: 'healthy',   primary: 'Hypertension',    cases: 890,  change: -2,  pop: 1.9,  hosp: 6,  color: '#16A34A', bg: '#DCFCE7' },
];

const RISK_META = {
  critical:  { label: 'Requires Action', color: '#DC2626', bg: '#FEE2E2' },
  attention: { label: 'Needs Attention', color: '#D97706', bg: '#FEF3C7' },
  healthy:   { label: 'Healthy',         color: '#16A34A', bg: '#DCFCE7' },
};

const CONDITIONS = ['All Conditions','Hypertension','Type 2 Diabetes','Obesity','Mental Health','Respiratory','Cardiovascular'];

const BAR_DATA = {
  labels:   REGIONS.map(r => r.name),
  datasets: [{
    label: 'Cases',
    data: REGIONS.map(r => r.cases),
    backgroundColor: REGIONS.map(r => r.color + 'BB'),
    borderRadius: 5, borderSkipped: false,
  }],
};

const BAR_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 40 } },
    y: { grid: { color: '#EFF6FF' }, ticks: { callback: v => v >= 1000 ? (v/1000).toFixed(0)+'k' : v } },
  },
};

const DONUT_DATA = {
  labels: ['Hypertension','Type 2 Diabetes','Obesity','Mental Health','Respiratory','Cardiovascular'],
  datasets: [{
    data: [10921, 7553, 6140, 3412, 2190, 3750],
    backgroundColor: ['#1565C0','#DC2626','#D97706','#7C3AED','#0891B2','#16A34A'],
    borderWidth: 2, borderColor: '#fff',
  }],
};

const DONUT_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } } },
};

export default function GovRegional() {
  const [search,    setSearch]    = useState('');
  const [condition, setCondition] = useState('All Conditions');

  const filtered = REGIONS.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
                        r.primary.toLowerCase().includes(search.toLowerCase());
    const matchCond   = condition === 'All Conditions' || r.primary === condition;
    return matchSearch && matchCond;
  });

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
            <i className="fas fa-map-marked-alt" style={{ color: '#1565C0', marginRight: 8 }}></i>
            Regional Health Risk Map
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Anonymised population-level data · UK Regions · {today}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-control"
            style={{ width: 180, fontSize: 13 }}
            value={condition}
            onChange={e => setCondition(e.target.value)}
          >
            {CONDITIONS.map(c => <option key={c}>{c}</option>)}
          </select>
          <button className="btn btn-outline btn-sm">
            <i className="fas fa-download" style={{ marginRight: 6 }}></i>Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Critical Regions',    value: '2',    icon: 'fa-exclamation-triangle', color: '#DC2626', bg: '#FEE2E2', sub: 'Immediate action required' },
          { label: 'Under Watch',         value: '4',    icon: 'fa-eye',                  color: '#D97706', bg: '#FEF3C7', sub: 'Needs monitoring' },
          { label: 'Healthy Regions',     value: '6',    icon: 'fa-check-circle',         color: '#16A34A', bg: '#DCFCE7', sub: 'Within safe thresholds' },
          { label: 'Population Covered',  value: '66.4M',icon: 'fa-users',               color: '#1565C0', bg: '#DBEAFE', sub: 'Across 12 regions' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fas ${k.icon}`} style={{ fontSize: 18, color: k.color }}></i>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)', lineHeight: 1.1 }}>{k.value}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginTop: 2 }}>{k.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{k.sub}</div>
              </div>
            </div>
            <div style={{ height: 3, background: k.color, opacity: .7 }} />
          </div>
        ))}
      </div>

      {/* Main grid: SVG Map + Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, marginBottom: 20 }}>

        {/* UK SVG Heat Map */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-map" style={{ marginRight: 6, color: '#1565C0' }}></i>UK Heat Map</h3>
            <div style={{ display: 'flex', gap: 10, fontSize: 11, fontWeight: 600 }}>
              {[['#DC2626','Critical'],['#D97706','Attention'],['#16A34A','Healthy']].map(([c,l]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, background: c, borderRadius: 2, display: 'inline-block' }}></span>{l}
                </span>
              ))}
            </div>
          </div>
          <div style={{ background: '#0A1929', borderRadius: '0 0 12px 12px', display: 'flex', justifyContent: 'center', padding: 8 }}>
            <svg viewBox="0 0 300 510" style={{ width: '100%', maxHeight: 480 }} fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Scotland */}
              <path d="M82,16 L175,14 L194,52 L184,95 L158,115 L128,107 L100,122 L82,112 L70,82 L78,46 Z"
                fill="#16A34A" fillOpacity=".75" stroke="#fff" strokeWidth="1.5"/>
              <text x="132" y="70" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="Inter">Scotland</text>
              <text x="132" y="83" textAnchor="middle" fill="rgba(255,255,255,.8)" fontSize="7.5">−8% Healthy</text>

              {/* Northern Ireland */}
              <path d="M22,106 L68,97 L72,126 L52,138 L22,128 Z"
                fill="#16A34A" fillOpacity=".75" stroke="#fff" strokeWidth="1.5"/>
              <text x="47" y="120" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="700" fontFamily="Inter">N. Ireland</text>

              {/* North East */}
              <path d="M148,124 L210,114 L218,152 L200,170 L158,165 L143,147 Z"
                fill="#D97706" fillOpacity=".85" stroke="#fff" strokeWidth="1.5"/>
              <text x="180" y="145" textAnchor="middle" fill="#fff" fontSize="8.5" fontWeight="700" fontFamily="Inter">North East</text>
              <text x="180" y="157" textAnchor="middle" fill="rgba(255,255,255,.9)" fontSize="7.5">+18% ↑</text>

              {/* North West — CRITICAL */}
              <path d="M88,142 L146,146 L158,164 L142,190 L100,194 L78,180 L76,160 Z"
                fill="#DC2626" fillOpacity=".88" stroke="#fff" strokeWidth="1.5"/>
              <text x="117" y="170" textAnchor="middle" fill="#fff" fontSize="8.5" fontWeight="800" fontFamily="Inter">North West</text>
              <text x="117" y="182" textAnchor="middle" fill="rgba(255,255,255,.95)" fontSize="7.5">+22% ⚠ CRITICAL</text>

              {/* Yorkshire */}
              <path d="M158,164 L218,154 L226,190 L208,208 L165,204 L148,190 Z"
                fill="#D97706" fillOpacity=".82" stroke="#fff" strokeWidth="1.5"/>
              <text x="188" y="185" textAnchor="middle" fill="#fff" fontSize="8.5" fontWeight="700" fontFamily="Inter">Yorkshire</text>
              <text x="188" y="197" textAnchor="middle" fill="rgba(255,255,255,.9)" fontSize="7.5">+12% ↑</text>

              {/* Wales */}
              <path d="M50,212 L100,204 L108,234 L94,258 L58,260 L40,244 L44,224 Z"
                fill="#16A34A" fillOpacity=".75" stroke="#fff" strokeWidth="1.5"/>
              <text x="74" y="236" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="Inter">Wales</text>
              <text x="74" y="248" textAnchor="middle" fill="rgba(255,255,255,.85)" fontSize="7.5">−5% Healthy</text>

              {/* West Midlands */}
              <path d="M102,204 L160,207 L168,240 L148,257 L106,254 L94,236 Z"
                fill="#D97706" fillOpacity=".82" stroke="#fff" strokeWidth="1.5"/>
              <text x="132" y="234" textAnchor="middle" fill="#fff" fontSize="8.5" fontWeight="700" fontFamily="Inter">W. Midlands</text>
              <text x="132" y="246" textAnchor="middle" fill="rgba(255,255,255,.9)" fontSize="7.5">+8% ↑</text>

              {/* East Midlands — CRITICAL: thicker border */}
              <path d="M163,207 L230,198 L238,234 L222,257 L168,255 L158,240 Z"
                fill="#DC2626" fillOpacity=".92" stroke="#FF6B6B" strokeWidth="2.5"/>
              <text x="196" y="226" textAnchor="middle" fill="#fff" fontSize="8.5" fontWeight="800" fontFamily="Inter">East Midlands</text>
              <text x="196" y="238" textAnchor="middle" fill="rgba(255,255,255,.95)" fontSize="7.5">+34% ⚠ CRITICAL</text>

              {/* East of England */}
              <path d="M232,200 L278,196 L286,232 L270,255 L238,252 Z"
                fill="#16A34A" fillOpacity=".75" stroke="#fff" strokeWidth="1.5"/>
              <text x="258" y="228" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" fontFamily="Inter">East England</text>
              <text x="258" y="240" textAnchor="middle" fill="rgba(255,255,255,.8)" fontSize="7">+1%</text>

              {/* London */}
              <path d="M168,260 L232,257 L238,284 L220,300 L172,298 L160,282 Z"
                fill="#16A34A" fillOpacity=".75" stroke="#fff" strokeWidth="1.5"/>
              <text x="198" y="280" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="Inter">London</text>
              <text x="198" y="292" textAnchor="middle" fill="rgba(255,255,255,.85)" fontSize="7.5">+2% Stable</text>

              {/* South East */}
              <path d="M163,300 L248,294 L256,330 L234,352 L188,354 L160,338 Z"
                fill="#D97706" fillOpacity=".75" stroke="#fff" strokeWidth="1.5"/>
              <text x="208" y="325" textAnchor="middle" fill="#fff" fontSize="8.5" fontWeight="700" fontFamily="Inter">South East</text>
              <text x="208" y="337" textAnchor="middle" fill="rgba(255,255,255,.9)" fontSize="7.5">+10% ↑</text>

              {/* South West */}
              <path d="M60,308 L160,302 L160,340 L138,362 L94,370 L56,354 L46,332 Z"
                fill="#16A34A" fillOpacity=".75" stroke="#fff" strokeWidth="1.5"/>
              <text x="104" y="338" textAnchor="middle" fill="#fff" fontSize="8.5" fontWeight="700" fontFamily="Inter">South West</text>
              <text x="104" y="350" textAnchor="middle" fill="rgba(255,255,255,.85)" fontSize="7.5">−3% Healthy</text>

              {/* Compass rose */}
              <text x="268" y="450" textAnchor="middle" fill="rgba(255,255,255,.3)" fontSize="11" fontFamily="Inter">N</text>
              <line x1="268" y1="455" x2="268" y2="470" stroke="rgba(255,255,255,.2)" strokeWidth="1"/>
            </svg>
          </div>
        </div>

        {/* Regional Health Data Table */}
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <h3><i className="fas fa-table" style={{ marginRight: 6, color: '#1565C0' }}></i>Regional Health Data</h3>
            <input
              type="text"
              className="form-control"
              placeholder="Search region..."
              style={{ width: 180, fontSize: 12 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Risk Level</th>
                  <th>Primary Condition</th>
                  <th>Cases</th>
                  <th>Population</th>
                  <th style={{ textAlign: 'center' }}>Hospitals</th>
                  <th>Change</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? filtered.map(r => {
                  const meta = RISK_META[r.risk];
                  const arrow = r.change > 0 ? '↑' : '↓';
                  const changeColor = r.change > 15 ? '#DC2626' : r.change > 4 ? '#D97706' : '#16A34A';
                  return (
                    <tr key={r.name}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0, display: 'inline-block' }}></span>
                          <strong>{r.name}</strong>
                        </div>
                      </td>
                      <td>
                        <span style={{ background: meta.bg, color: meta.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{r.primary}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{r.cases.toLocaleString()}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.pop.toFixed(1)}M</td>
                      <td style={{ textAlign: 'center', fontSize: 13 }}>{r.hosp}</td>
                      <td>
                        <span style={{ color: changeColor, fontWeight: 800, fontSize: 14 }}>
                          {arrow} {Math.abs(r.change)}%
                        </span>
                      </td>
                      <td>
                        {r.risk === 'critical' ? (
                          <button className="btn btn-sm btn-danger">
                            <i className="fas fa-file-alt" style={{ marginRight: 4 }}></i>Brief
                          </button>
                        ) : r.risk === 'attention' ? (
                          <button className="btn btn-sm btn-outline">
                            <i className="fas fa-eye" style={{ marginRight: 4 }}></i>Monitor
                          </button>
                        ) : (
                          <span style={{ color: '#16A34A', fontWeight: 700, fontSize: 13 }}>&#10003; OK</span>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">No regions match your search</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Bottom charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-chart-bar" style={{ marginRight: 6, color: '#1565C0' }}></i>Cases by Region</h3>
          </div>
          <div className="card-body" style={{ height: 250 }}>
            <Bar data={BAR_DATA} options={BAR_OPTS} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-chart-pie" style={{ marginRight: 6, color: '#1565C0' }}></i>Condition Distribution</h3>
          </div>
          <div className="card-body" style={{ height: 250 }}>
            <Doughnut data={DONUT_DATA} options={DONUT_OPTS} />
          </div>
        </div>
      </div>
    </div>
  );
}
