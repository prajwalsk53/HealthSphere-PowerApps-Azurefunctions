import { useState } from 'react';

const ZONES = {
  'Diet & Food': {
    healthy: [
      { title: 'Balanced Breakfast', msg: 'High in protein and fiber on target this week.', tags: ['Oats + Fruit', 'Boiled Eggs', 'Unsweetened Yogurt'] },
      { title: 'Calorie Goal', msg: '530 / 2,500 kcal consumed' },
    ],
    attention: [
      { title: 'Low Fiber Detected', msg: 'Add leafy greens or lentils to lunch. Swap white rice for brown.', tags: ['Add 1 cup salad', 'Swap white rice for brown'] },
      { title: 'Sugary Snacks', msg: '2 high-sugar items logged this week.', action: 'Diet Recommendations' },
    ],
    critical: [
      { title: 'High Sodium Consumption', msg: '34% above recommended average. Reduce packaged snacks and processed meats. Cook with herbs instead of extra salt.', tags: ['Reduce packaged foods', 'Use herbs instead of salt'] },
      { title: 'Foods to Avoid', msg: 'Doctor noted: limit instant noodles and crisps.' },
    ],
  },
  'Exercise & Activity': {
    healthy: [
      { title: 'Consistent Activity', msg: '4 active days this week. HR stable.', tags: ['Morning Walk', 'Stretching'] },
    ],
    attention: [
      { title: 'Low Moderate Intensity', msg: 'Add 15 min cardio daily.', tags: ['Cycling', 'Light Jog'], action: 'View Exercise Plan' },
    ],
    critical: [
      { title: 'Sedentary Streak', msg: 'No activity logged for 2 days.', action: 'Start 10-min routine' },
    ],
  },
  'Medical Checkups': {
    healthy: [
      { title: 'Blood Pressure', msg: 'Stable within target range.' },
    ],
    attention: [
      { title: 'Vitamin D', msg: 'Below range — add sunlight and supplements.' },
    ],
    critical: [
      { title: 'Glucose Spikes', msg: 'Refined carbs causing fluctuations.', action: "View Doctor's Note" },
    ],
  },
  'Mental & Emotional': {
    healthy: [
      { title: 'Positivity Score', msg: '92% — excellent emotional wellbeing this week.' },
    ],
    attention: [
      { title: 'Stress Detected', msg: 'Moderate stress on 3 days. Try breathing exercises.' },
    ],
    critical: [],
  },
  'Sleep & Recovery': {
    healthy: [
      { title: 'Sleep Duration', msg: 'Average 7.8h — within recommended range.' },
    ],
    attention: [
      { title: 'Sleep Inconsistency', msg: '2 nights below 6h. Maintain a fixed sleep schedule.' },
    ],
    critical: [],
  },
  Hydration: {
    healthy: [
      { title: 'Well Hydrated', msg: 'Averaged 7 glasses daily this week.' },
    ],
    attention: [
      { title: "Today's Intake Low", msg: 'Only 3 glasses so far. Target: 8.', action: 'Log Water' },
    ],
    critical: [],
  },
  Environment: {
    healthy: [
      { title: 'Air Quality', msg: 'Good air quality in Leicester today.' },
    ],
    attention: [
      { title: 'Pollen Alert', msg: 'Moderate pollen — take antihistamine if needed.' },
    ],
    critical: [],
  },
};

const CAT_ICONS = {
  'Diet & Food': 'fa-drumstick-bite',
  'Exercise & Activity': 'fa-running',
  'Medical Checkups': 'fa-stethoscope',
  'Mental & Emotional': 'fa-brain',
  'Sleep & Recovery': 'fa-moon',
  Hydration: 'fa-tint',
  Environment: 'fa-leaf',
};

const CATEGORIES = Object.keys(ZONES);

function ZoneColumn({ items, color, bg, textColor, label, dotColor, emptyText, btnClass }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: bg, borderRadius: 6, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: textColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      </div>
      {items.map((item, i) => (
        <div className={`health-zone zone-${color}`} key={i}>
          <div className="zone-title">{item.title}</div>
          <div className="zone-items" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{item.msg}</div>
          {item.tags && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {item.tags.map((tag, j) => <span className={`zone-tag ${color === 'healthy' ? 'green' : color === 'attention' ? 'yellow' : 'red'}`} key={j}>{tag}</span>)}
            </div>
          )}
          {item.action && (
            <button className={`btn btn-sm ${btnClass}`} style={{ marginTop: 10 }}>{item.action}</button>
          )}
        </div>
      ))}
      {!items.length && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 10, textAlign: 'center', opacity: 0.5 }}>{emptyText}</div>
      )}
    </div>
  );
}

export default function HealthAnalysis() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [period, setPeriod] = useState('Daily');

  const displayZones = activeCategory === 'all' ? ZONES : { [activeCategory]: ZONES[activeCategory] || { healthy: [], attention: [], critical: [] } };

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h2 style={{ margin: 0 }}><i className="fas fa-chart-bar" style={{ color: 'var(--primary-light)' }} /> Overall Health Analysis</h2>
          <div className="text-muted text-sm">Personalised health evaluation across 7 dimensions</div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 8, padding: 4, border: '1px solid var(--border)' }}>
          {['Daily', 'Weekly', 'Monthly'].map(v => (
            <button key={v} onClick={() => setPeriod(v)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: period === v ? 'var(--primary-light)' : 'transparent', color: period === v ? '#fff' : 'var(--text-muted)' }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
        {/* Left: Category filter */}
        <div>
          <div className="card">
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Categories</div>
              {CATEGORIES.map(cat => (
                <div key={cat} className={`doc-filter-item${activeCategory === cat ? ' active' : ''}`} onClick={() => setActiveCategory(cat)}>
                  <span><i className={`fas ${CAT_ICONS[cat] || 'fa-circle'}`} style={{ width: 16, textAlign: 'center', marginRight: 6 }} />{cat}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div className="doc-filter-item" style={{ color: 'var(--primary-light)', background: 'var(--bg)', fontWeight: 600 }} onClick={() => setActiveCategory('all')}>
                  <span><i className="fas fa-th" style={{ width: 16, textAlign: 'center', marginRight: 6 }} />View All</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Analysis zones */}
        <div>
          {Object.entries(displayZones).map(([catName, sections]) => (
            <div style={{ marginBottom: 20 }} key={catName}>
              <h6 style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 14, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className={`fas ${CAT_ICONS[catName] || 'fa-circle'}`} style={{ color: 'var(--primary-light)' }} />
                {catName}
              </h6>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <ZoneColumn items={sections.healthy} color="healthy" bg="#DCFCE7" textColor="#166534" dotColor="#16A34A" label="Healthy" emptyText="—" />
                <ZoneColumn items={sections.attention} color="attention" bg="#FEF3C7" textColor="#92400E" dotColor="#D97706" label="Attention" emptyText="—" btnClass="btn-outline" />
                <ZoneColumn items={sections.critical} color="critical" bg="#FEE2E2" textColor="#991B1B" dotColor="#DC2626" label="Requires Action" emptyText="No critical alerts" btnClass="btn-danger" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
