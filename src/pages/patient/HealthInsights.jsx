import { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { useAuth } from '../../context/AuthContext';
import { Hs_healthmetricsService } from '../../generated/services/Hs_healthmetricsService';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

function toMetric(r) {
  return {
    recordedAt: r.hs_recordedat, heartRate: r.hs_heartrate, systolic: r.hs_systolic, diastolic: r.hs_diastolic,
    steps: r.hs_steps, sleepHours: r.hs_sleephours, oxygenSaturation: r.hs_oxygensaturation,
    temperature: r.hs_temperature, stressLevel: r.hs_stresslevel, caloriesBurned: r.hs_caloriesburned,
  };
}

const FALLBACK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FALLBACK_HR = [72, 74, 78, 70, 76, 73, 74];
const FALLBACK_SYS = [120, 118, 122, 116, 124, 119, 118];
const FALLBACK_DIA = [78, 76, 79, 74, 81, 77, 76];
const FALLBACK_STEPS = [8200, 7495, 5100, 9200, 6300, 10500, 4800];
const FALLBACK_SLEEP = [8.0, 6.5, 7.5, 7.0, 8.2, 6.0, 7.83];
const FALLBACK_NUTRITION = [1100, 980, 1250, 1400, 1100, 1300, 1270];

function ProgressCircle({ pct, color, size = 80, label, stroke = 6 }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" stroke="rgba(255,255,255,.15)" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} strokeDasharray={circ}
          strokeDashoffset={animated ? offset : circ} fill="none" strokeLinecap="round"
          style={{ transformOrigin: 'center', transform: 'rotate(-90deg)', transition: 'stroke-dashoffset 1.2s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{Math.round(pct)}%</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.6)' }}>{label}</span>
      </div>
    </div>
  );
}

const sparkOptions = (color) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  elements: { point: { radius: 0 } },
  scales: { x: { display: false }, y: { display: false } },
});

const darkLineOptions = (multi = false) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: multi, labels: { color: 'rgba(255,255,255,.7)' } } },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: 'rgba(255,255,255,.5)' } },
    y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: 'rgba(255,255,255,.5)' } },
  },
});

const darkBarOptions = () => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,.5)' } },
    y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: 'rgba(255,255,255,.5)' } },
  },
});

export default function HealthInsights() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('Daily');

  useEffect(() => {
    Hs_healthmetricsService.getAll({ filter: `_hs_user_value eq ${user.id}`, orderBy: ['hs_recordedat desc'], top: 7 })
      .then(r => setData({ metrics: (r.data || []).map(toMetric) }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const { metrics = [] } = data || {};
  const latest = metrics[0] || {};
  const weekly = [...metrics].slice(0, 7).reverse();

  const labels = weekly.length ? weekly.map(m => new Date(m.recordedAt).toLocaleDateString('en-GB', { weekday: 'short' })) : FALLBACK_LABELS;
  const hrData = weekly.length ? weekly.map(m => m.heartRate || 0) : FALLBACK_HR;
  const sysData = weekly.length ? weekly.map(m => m.systolic || 0) : FALLBACK_SYS;
  const diaData = weekly.length ? weekly.map(m => m.diastolic || 0) : FALLBACK_DIA;
  const stepsData = weekly.length ? weekly.map(m => m.steps || 0) : FALLBACK_STEPS;
  const sleepData = weekly.length ? weekly.map(m => parseFloat(m.sleepHours) || 0) : FALLBACK_SLEEP;

  const sleepHours = latest.sleepHours ?? 7.8;
  const heartRate = latest.heartRate ?? 74;
  const spo2 = latest.oxygenSaturation ?? 97;
  const temp = latest.temperature ?? 36.2;
  const stressLevel = latest.stressLevel ?? 45;
  const stressLabel = ['Low', 'Moderate', 'High'][Math.min(Math.round(stressLevel / 40), 2)] || 'Moderate';
  const steps = latest.steps ?? 7495;
  const caloriesBurned = latest.caloriesBurned ?? 195;
  const stepPct = Math.min(Math.round(steps / 100), 100);

  return (
    <div style={{ background: '#0A1929', borderRadius: 'var(--radius)', padding: 24, minHeight: 'calc(100vh - 140px)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.1)', borderRadius: 8, padding: 4 }}>
          {['Daily', 'Weekly', 'Monthly'].map(v => (
            <button key={v} onClick={() => setPeriod(v)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: period === v ? 'var(--primary-light)' : 'transparent', color: period === v ? '#fff' : 'rgba(255,255,255,.6)' }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Live Metrics */}
      <div className="section-title-dark"><i className="fas fa-broadcast-tower" /> Live Metrics</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>

        {/* Nutrition */}
        <div className="insight-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="card-label"><i className="fas fa-utensils" /> Nutrition</div>
              <div className="big-value">1,270<span className="big-unit">kcal</span></div>
              <div className="card-sub">1,882 kcal remaining</div>
            </div>
            <ProgressCircle pct={60} color="#1565C0" label="Quality" />
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <span style={{ background: 'rgba(255,255,255,.1)', padding: '4px 10px', borderRadius: 6, fontSize: 11 }}>Protein: 128g</span>
            <span style={{ background: 'rgba(255,255,255,.1)', padding: '4px 10px', borderRadius: 6, fontSize: 11 }}>Carbs: 173g</span>
            <span style={{ background: 'rgba(255,255,255,.1)', padding: '4px 10px', borderRadius: 6, fontSize: 11 }}>Fat: 199g</span>
          </div>
          <div style={{ marginTop: 16, height: 60 }}>
            <Line data={{ labels: FALLBACK_LABELS, datasets: [{ data: FALLBACK_NUTRITION, borderColor: '#1565C0', borderWidth: 2, fill: false, tension: 0.4 }] }} options={sparkOptions()} />
          </div>
        </div>

        {/* Exercise */}
        <div className="insight-card" style={{ background: 'linear-gradient(135deg,#0A2342 0%,#1B4332 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="card-label"><i className="fas fa-running" /> Exercise</div>
              <div className="big-value">950<span className="big-unit">kcal</span></div>
              <div className="card-sub">Burned today</div>
            </div>
            <ProgressCircle pct={81} color="#16A34A" label="Quality" />
          </div>
          <div style={{ background: 'rgba(255,255,255,.07)', borderRadius: 8, padding: '8px 12px', marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <i className="fas fa-dumbbell" style={{ color: '#22C55E' }} />
            <span>Morning Walk</span>
            <span style={{ marginLeft: 'auto', opacity: 0.7 }}>30min · 180kcal</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,.07)', borderRadius: 8, padding: '8px 12px', marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <i className="fas fa-dumbbell" style={{ color: '#22C55E' }} />
            <span>Strength Training</span>
            <span style={{ marginLeft: 'auto', opacity: 0.7 }}>45min · 320kcal</span>
          </div>
        </div>

        {/* Sleep */}
        <div className="insight-card" style={{ background: 'linear-gradient(135deg,#1E1B4B 0%,#312E81 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="card-label"><i className="fas fa-moon" /> Sleep Analysis</div>
              <div className="big-value">{sleepHours}<span className="big-unit">h</span></div>
              <div className="card-sub">Sleep Duration</div>
            </div>
            <ProgressCircle pct={81} color="#7C3AED" label="Quality" />
          </div>
          <div style={{ marginTop: 16, height: 60 }}>
            <Line data={{ labels, datasets: [{ data: sleepData, borderColor: '#7C3AED', borderWidth: 2, fill: false, tension: 0.4 }] }} options={sparkOptions()} />
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,.7)' }}>
            ✨ You slept better than yesterday!
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>

        {/* Mental Health */}
        <div className="insight-card" style={{ background: 'linear-gradient(135deg,#064E3B 0%,#065F46 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="card-label"><i className="fas fa-brain" /> Mental Health</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Self Love &amp; Positivity</div>
              <div className="card-sub">Emotional wellbeing</div>
            </div>
            <ProgressCircle pct={92} color="#22C55E" label="Quality" />
          </div>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {['Mood: Positive', 'Stress: Low', 'Focus: High', 'Energy: Good'].map(item => (
              <div key={item} style={{ background: 'rgba(255,255,255,.1)', borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>✓ {item}</div>
            ))}
          </div>
        </div>

        {/* Heart Rate */}
        <div className="insight-card" style={{ background: 'linear-gradient(135deg,#7F1D1D 0%,#991B1B 100%)' }}>
          <div className="card-label"><i className="fas fa-heartbeat" /> Heart Rate</div>
          <div className="big-value">{heartRate}<span className="big-unit">bpm (avg)</span></div>
          <div className="card-sub">Resting HR: {heartRate - 2} +/-2 bpm</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {['ECG: Normal', `SpO₂: ${spo2}%`, `Temp: ${temp}°C`, `Stress: ${stressLabel}`].map(c => (
              <span key={c} style={{ background: 'rgba(255,255,255,.15)', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600 }}>{c}</span>
            ))}
          </div>
          <div style={{ marginTop: 16, height: 60 }}>
            <Line data={{ labels, datasets: [{ data: hrData, borderColor: '#EF4444', borderWidth: 2, fill: false, tension: 0.4 }] }} options={sparkOptions()} />
          </div>
          <div style={{ marginTop: 12 }}>
            <details>
              <summary style={{ cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,.8)' }}>Show details ▼</summary>
              <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,.6)', lineHeight: 1.8 }}>
                Heart rate: Continuous monitoring with alerts for high/slow rates.<br />
                ECG: Detects irregular rhythm (AFib).<br />
                SpO₂: Oxygen saturation for sleep &amp; respiration.<br />
                Temp: Tracks skin temperature &amp; health trends.
              </div>
            </details>
          </div>
        </div>

        {/* Daily Walking */}
        <div className="insight-card" style={{ background: 'linear-gradient(135deg,#0C4A6E 0%,#0369A1 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="card-label"><i className="fas fa-walking" /> Daily Walking</div>
              <div className="big-value" style={{ fontSize: 42 }}>{steps.toLocaleString()}</div>
              <div className="card-sub">Steps today</div>
            </div>
            <i className="fas fa-chevron-up" style={{ fontSize: 20, opacity: 0.5 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>3.5</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>km Distance</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{Math.round(caloriesBurned)}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>kcal Burned</div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
              <span>0</span><span>Goal: 10,000</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${stepPct}%`, background: '#22C55E', height: '100%', borderRadius: 4, transition: 'width 1s ease' }} />
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Charts */}
      <div style={{ marginTop: 24 }}>
        <div className="section-title-dark">7-Day Trend Analysis</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="dark-chart-card">
            <h6 style={{ color: '#fff', marginBottom: 16, fontSize: 13 }}>Heart Rate Trend</h6>
            <div style={{ height: 180 }}>
              <Line data={{ labels, datasets: [{ label: 'HR (bpm)', data: hrData, borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,.1)', fill: true, tension: 0.4, pointBackgroundColor: '#EF4444', pointRadius: 3 }] }} options={darkLineOptions(false)} />
            </div>
          </div>
          <div className="dark-chart-card">
            <h6 style={{ color: '#fff', marginBottom: 16, fontSize: 13 }}>Blood Pressure</h6>
            <div style={{ height: 180 }}>
              <Line data={{ labels, datasets: [
                { label: 'Systolic', data: sysData, borderColor: '#1565C0', fill: false, tension: 0.4, pointRadius: 3 },
                { label: 'Diastolic', data: diaData, borderColor: '#00B4D8', fill: false, tension: 0.4, pointRadius: 3 },
              ] }} options={darkLineOptions(true)} />
            </div>
          </div>
          <div className="dark-chart-card">
            <h6 style={{ color: '#fff', marginBottom: 16, fontSize: 13 }}>Daily Steps</h6>
            <div style={{ height: 180 }}>
              <Bar data={{ labels, datasets: [{ data: stepsData, backgroundColor: stepsData.map((v, i) => v === Math.max(...stepsData) ? '#22C55E' : '#1E40AF'), borderRadius: 4, borderSkipped: false }] }} options={darkBarOptions()} />
            </div>
          </div>
          <div className="dark-chart-card">
            <h6 style={{ color: '#fff', marginBottom: 16, fontSize: 13 }}>Sleep Hours</h6>
            <div style={{ height: 180 }}>
              <Bar data={{ labels, datasets: [{ data: sleepData, backgroundColor: sleepData.map(v => v >= 7 ? '#7C3AED' : '#EF4444'), borderRadius: 4, borderSkipped: false }] }} options={darkBarOptions()} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
