import { useState } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ── Chart datasets ─────────────────────────────────────────────── */
const MAIN_TREND = {
  labels: MONTHS,
  datasets: [
    { label:'Hypertension',    data:[120,135,142,138,155,148,162,170,155,168,180,192], borderColor:'#1565C0', backgroundColor:'rgba(21,101,192,.07)',  tension:.4, fill:true, pointRadius:3, pointBackgroundColor:'#1565C0' },
    { label:'Type 2 Diabetes', data:[80,88,92,85,95,100,98,105,112,108,115,122],       borderColor:'#DC2626', backgroundColor:'rgba(220,38,38,.06)',    tension:.4, fill:true, pointRadius:3, pointBackgroundColor:'#DC2626' },
    { label:'Obesity',         data:[65,70,68,72,75,78,80,82,85,88,90,95],             borderColor:'#D97706', backgroundColor:'rgba(217,119,6,.06)',    tension:.4, fill:true, pointRadius:3, pointBackgroundColor:'#D97706' },
    { label:'Mental Health',   data:[50,55,60,58,65,68,70,75,72,78,80,84],             borderColor:'#7C3AED', backgroundColor:'rgba(124,58,237,.05)',   tension:.4, fill:true, pointRadius:3, pointBackgroundColor:'#7C3AED' },
    { label:'Respiratory',     data:[40,55,48,42,38,32,30,28,35,42,52,58],             borderColor:'#0891B2', backgroundColor:'rgba(8,145,178,.05)',    tension:.4, fill:true, pointRadius:3, pointBackgroundColor:'#0891B2' },
  ],
};

const AGE_DATA = {
  labels: ['0–17','18–29','30–44','45–59','60–74','75+'],
  datasets: [
    { label:'Hypertension', data:[5,12,28,55,82,95], backgroundColor:'#1565C0', borderRadius:4 },
    { label:'Diabetes',     data:[2,8,22,48,68,72],  backgroundColor:'#DC2626', borderRadius:4 },
  ],
};

const ADMISSION_DATA = {
  labels: MONTHS,
  datasets: [
    { label:'Emergency', data:[8200,8800,9100,8600,9400,9800,10200,10800,9900,10500,11200,12000], borderColor:'#DC2626', tension:.4, fill:false, pointRadius:2 },
    { label:'Planned',   data:[6200,6500,6800,6600,7000,7200,7100,7500,7300,7600,7900,8200],     borderColor:'#1565C0', tension:.4, fill:false, pointRadius:2 },
  ],
};

const VACC_DATA = {
  labels: ['Vaccinated','Partially','Unvaccinated'],
  datasets: [{ data:[78,8,14], backgroundColor:['#16A34A','#D97706','#DC2626'], borderWidth:2, borderColor:'#fff' }],
};

const YOY_DATA = {
  labels: ['Hypertension','Diabetes','Obesity','Mental Health','Respiratory','Cardiovascular'],
  datasets: [
    { label:'2023', data:[142,98,78,62,65,55],  backgroundColor:'rgba(21,101,192,.4)', borderRadius:4 },
    { label:'2024', data:[168,112,88,74,58,62], backgroundColor:'rgba(21,101,192,.7)', borderRadius:4 },
    { label:'2025', data:[192,122,95,84,58,70], backgroundColor:'#1565C0',             borderRadius:4 },
  ],
};

/* ── Shared chart options ─────────────────────────────────────────── */
const kTick  = { callback: v => v + 'k' };
const kTickK = { callback: v => v >= 1000 ? (v/1000).toFixed(0)+'k' : v };
const gridBlue = { color: '#EFF6FF' };
const noGrid   = { display: false };

const MAIN_OPTS = {
  responsive:true, maintainAspectRatio:false,
  plugins:{ legend:{display:false}, tooltip:{mode:'index',intersect:false} },
  scales:{ x:{grid:noGrid}, y:{grid:gridBlue, ticks:kTick} },
};
const AGE_OPTS = {
  responsive:true, maintainAspectRatio:false,
  plugins:{ legend:{ position:'top', labels:{ font:{size:10}, boxWidth:10 } } },
  scales:{ x:{grid:noGrid}, y:{grid:gridBlue} },
};
const ADM_OPTS = {
  responsive:true, maintainAspectRatio:false,
  plugins:{ legend:{ position:'top', labels:{ font:{size:10}, boxWidth:10 } } },
  scales:{ x:{grid:noGrid, ticks:{font:{size:9}}}, y:{grid:gridBlue, ticks:kTickK} },
};
const VACC_OPTS = {
  responsive:true, maintainAspectRatio:false,
  cutout:'65%',
  plugins:{ legend:{ position:'bottom', labels:{ font:{size:11}, boxWidth:12 } } },
};
const YOY_OPTS = {
  responsive:true, maintainAspectRatio:false,
  plugins:{ legend:{ position:'top' } },
  scales:{ x:{grid:noGrid}, y:{grid:gridBlue, ticks:kTick} },
};

/* ── Key findings ─────────────────────────────────────────────────── */
const FINDINGS = [
  {
    title:  'High Sodium Diet Linked to Hypertension Spike',
    detail: 'East Midlands salt intake 34% above NHS recommended levels. Direct correlation found with hypertension hospitalisations in Q3 2025.',
    status: 'critical',
    rec:    'Draft NHS reduced-salt awareness campaign targeting East Midlands supermarkets and schools.',
  },
  {
    title:  'Type 2 Diabetes Rising in Under-40s',
    detail: 'North West seeing 22% increase, notably in 25–40 age group. Sedentary lifestyle and processed food consumption identified as key drivers.',
    status: 'critical',
    rec:    'Commission workplace wellness programmes and subsidised gym access for low-income households.',
  },
  {
    title:  'Obesity Trend Stabilising in London',
    detail: 'London showing only +2% growth vs national average of +18%. Cycle superhighway and active travel policy cited as contributing factors.',
    status: 'healthy',
    rec:    'Scale London active travel model to North East and West Midlands — potential 8% reduction projected.',
  },
  {
    title:  'Mental Health Demand Exceeding Capacity',
    detail: 'Yorkshire mental health referrals up 12% but NHS capacity only increased 4%. Average waiting time now 18+ weeks.',
    status: 'attention',
    rec:    'Emergency funding review for CAMHS. Recruit 400 additional counsellors by Q1 2026.',
  },
  {
    title:  'Vaccination Coverage Below Target',
    detail: 'Covid booster at 78% nationally vs 85% target. Over-65s: 91%. Under-40s: 54%. Gap widening each quarter.',
    status: 'attention',
    rec:    'Targeted outreach programme for under-40 demographic via GP surgeries and mobile vaccination units.',
  },
];

const STATUS_META = {
  critical:  { color:'#DC2626', bg:'#FEE2E2', label:'Requires Action' },
  attention: { color:'#D97706', bg:'#FEF3C7', label:'Needs Attention' },
  healthy:   { color:'#16A34A', bg:'#DCFCE7', label:'Positive Trend'  },
};

const LEGEND_DOTS = [
  { label:'Hypertension',    color:'#1565C0' },
  { label:'Type 2 Diabetes', color:'#DC2626' },
  { label:'Obesity',         color:'#D97706' },
  { label:'Mental Health',   color:'#7C3AED' },
  { label:'Respiratory',     color:'#0891B2' },
];

const KPIS = [
  { label:'Hypertension',    value:'192k', sub:'↑ 34% vs last year', subColor:'#DC2626', icon:'fa-heart',   color:'#DC2626', bg:'#FEE2E2' },
  { label:'Type 2 Diabetes', value:'122k', sub:'↑ 22% vs last year', subColor:'#DC2626', icon:'fa-tint',    color:'#D97706', bg:'#FEF3C7' },
  { label:'Obesity',         value:'95k',  sub:'↑ 18% vs last year', subColor:'#DC2626', icon:'fa-weight',  color:'#1565C0', bg:'#DBEAFE' },
  { label:'Mental Health',   value:'84k',  sub:'↑ 12% vs last year', subColor:'#DC2626', icon:'fa-brain',   color:'#7C3AED', bg:'#EDE9FE' },
  { label:'Vaccination Rate',value:'78%',  sub:'Target: 85%',        subColor:'#D97706', icon:'fa-syringe', color:'#16A34A', bg:'#DCFCE7' },
];

const PERIODS = ['3M','6M','1Y','3Y'];

export default function GovTrends() {
  const [period, setPeriod] = useState('1Y');

  return (
    <div>
      {/* Page header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:'var(--primary)' }}>
            <i className="fas fa-chart-line" style={{ color:'#1565C0', marginRight:8 }}></i>
            National Trend Analysis
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
            Population health trends · England &amp; Wales · 2025
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {/* Period selector */}
          <div style={{ display:'flex', gap:4, background:'var(--bg)', borderRadius:8, padding:4, border:'1px solid var(--border)' }}>
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding:'6px 14px', borderRadius:6, border:'none', fontSize:12, fontWeight:600, cursor:'pointer',
                background: period===p ? '#1565C0' : 'transparent',
                color:      period===p ? '#fff'    : 'var(--text-muted)',
                transition:'all .15s',
              }}>{p}</button>
            ))}
          </div>
          <button className="btn btn-outline btn-sm">
            <i className="fas fa-download" style={{ marginRight:6 }}></i>Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, marginBottom:22 }}>
        {KPIS.map(k => (
          <div key={k.label} className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 16px 12px' }}>
              <div style={{ width:42, height:42, borderRadius:12, background:k.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`fas ${k.icon}`} style={{ fontSize:18, color:k.color }}></i>
              </div>
              <div>
                <div style={{ fontSize:22, fontWeight:800, color:'var(--primary)', lineHeight:1.1 }}>{k.value}</div>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', marginTop:2 }}>{k.label}</div>
                <div style={{ fontSize:11, color:k.subColor, marginTop:2, fontWeight:600 }}>{k.sub}</div>
              </div>
            </div>
            <div style={{ height:3, background:k.color, opacity:.7 }} />
          </div>
        ))}
      </div>

      {/* Main trend chart */}
      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-header" style={{ flexWrap:'wrap', gap:8 }}>
          <h3>
            <i className="fas fa-chart-line" style={{ marginRight:6, color:'#1565C0' }}></i>
            National Disease Trends — Jan to Dec 2025 (thousands)
          </h3>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            {LEGEND_DOTS.map(l => (
              <span key={l.label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'var(--text-muted)' }}>
                <span style={{ width:12, height:3, background:l.color, borderRadius:2, display:'inline-block', flexShrink:0 }}></span>
                {l.label}
              </span>
            ))}
          </div>
        </div>
        <div className="card-body" style={{ height:300 }}>
          <Line data={MAIN_TREND} options={MAIN_OPTS} />
        </div>
      </div>

      {/* 3 sub-charts */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:20, marginBottom:20 }}>
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-users" style={{ marginRight:6, color:'#1565C0' }}></i>Age Group Breakdown</h3>
          </div>
          <div className="card-body" style={{ height:220 }}>
            <Bar data={AGE_DATA} options={AGE_OPTS} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-hospital" style={{ marginRight:6, color:'#1565C0' }}></i>Hospital Admissions</h3>
          </div>
          <div className="card-body" style={{ height:220 }}>
            <Line data={ADMISSION_DATA} options={ADM_OPTS} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-syringe" style={{ marginRight:6, color:'#1565C0' }}></i>Vaccination Coverage</h3>
          </div>
          <div className="card-body" style={{ height:220 }}>
            <Doughnut data={VACC_DATA} options={VACC_OPTS} />
          </div>
        </div>
      </div>

      {/* Year-on-Year comparison */}
      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-header">
          <h3>
            <i className="fas fa-balance-scale" style={{ marginRight:6, color:'#1565C0' }}></i>
            Year-on-Year Comparison (2023 vs 2024 vs 2025)
          </h3>
        </div>
        <div className="card-body" style={{ height:260 }}>
          <Bar data={YOY_DATA} options={YOY_OPTS} />
        </div>
      </div>

      {/* Key Findings & Recommendations */}
      <div className="card">
        <div className="card-header">
          <h3>
            <i className="fas fa-lightbulb" style={{ marginRight:6, color:'#1565C0' }}></i>
            Key Findings &amp; Recommendations
          </h3>
          <span className="badge badge-danger">2 critical</span>
        </div>
        <div>
          {FINDINGS.map((f, i) => {
            const sm = STATUS_META[f.status];
            return (
              <div key={i} style={{ padding:'18px 22px', borderBottom:'1px solid var(--border)', display:'flex', gap:16, alignItems:'flex-start' }}>
                <span style={{ background:sm.bg, color:sm.color, padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:'nowrap', marginTop:2 }}>
                  {sm.label}
                </span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:'var(--primary)', marginBottom:5 }}>{f.title}</div>
                  <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:6, lineHeight:1.6 }}>{f.detail}</div>
                  <div style={{ fontSize:12, color:'#1565C0', display:'flex', alignItems:'flex-start', gap:6 }}>
                    <i className="fas fa-arrow-right" style={{ marginTop:2, flexShrink:0 }}></i>
                    <span><strong>Recommended:</strong> {f.rec}</span>
                  </div>
                </div>
                <button className="btn btn-outline btn-sm" style={{ flexShrink:0, marginTop:2 }}>
                  <i className="fas fa-file-alt" style={{ marginRight:5 }}></i>Draft Policy
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
