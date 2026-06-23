import { useState, useEffect, useMemo, useRef } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Hs_dietlogsService } from '../../generated/services/Hs_dietlogsService';
import { Hs_dietlogshs_mealtype } from '../../generated/models/Hs_dietlogsModel';
import { Hs_waterlogsService } from '../../generated/services/Hs_waterlogsService';
import { Hs_healthmetricsService } from '../../generated/services/Hs_healthmetricsService';
import { Hs_familyhistoriesService } from '../../generated/services/Hs_familyhistoriesService';
import { Hs_fooddatabasesService } from '../../generated/services/Hs_fooddatabasesService';

ChartJS.register(ArcElement, Tooltip, Legend);

const MEAL_TYPE_CODES = Object.fromEntries(Object.entries(Hs_dietlogshs_mealtype).map(([code, label]) => [label, Number(code)]));

function toDietLog(r) {
  return {
    id: r.hs_dietlogid,
    foodName: r.hs_foodname,
    mealType: Hs_dietlogshs_mealtype[r.hs_mealtype],
    calories: r.hs_calories,
    protein: r.hs_protein,
    carbs: r.hs_carbs,
    fat: r.hs_fat,
    fiber: r.hs_fiber,
    logDate: r.hs_logdate,
  };
}

const GOALS = { calories: 2500, protein: 60, carbs: 300, fats: 65, fiber: 25 };

const MEAL_META = {
  breakfast: { icon: '🌅', label: 'Breakfast', range: '300–1170 Cal' },
  lunch: { icon: '☀️', label: 'Lunch', range: '225–370 Cal' },
  snack: { icon: '🍎', label: 'Snack', range: '195–210 Cal' },
  dinner: { icon: '🌙', label: 'Dinner', range: '355–570 Cal' },
};

const QUICK_QUESTIONS = [
  { icon: '🥗', text: "What should I eat today based on my health?" },
  { icon: '🐟', text: 'How to make grilled salmon?' },
  { icon: '🌾', text: 'How to make heart-healthy oatmeal?' },
  { icon: '⚠️', text: 'What foods should I avoid with high blood pressure?' },
  { icon: '💪', text: 'Give me a high protein low sodium meal idea' },
  { icon: '🔥', text: 'How many calories do I have left today?' },
];

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function aiMd(text) {
  let html = escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => '<ul>' + m + '</ul>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
  return html;
}

function AddMealModal({ initialType, today, onClose, onAdded }) {
  const { user } = useAuth();
  const [mealType, setMealType] = useState(initialType || 'breakfast');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [portion, setPortion] = useState(100);
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState({ name: '', calories: '', protein: '', carbs: '', fats: '', fiber: '' });
  const [submitting, setSubmitting] = useState(false);
  const searchTimer = useRef(null);

  const doSearch = (q) => {
    setSearch(q);
    clearTimeout(searchTimer.current);
    setShowDropdown(true);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const localRes = await Hs_fooddatabasesService.getAll({ filter: q ? `contains(hs_foodname,'${q.replace(/'/g, "''")}')` : undefined, top: 20 });
        const local = (localRes.data || []).map(f => ({ name: f.hs_foodname, calories: f.hs_calories, protein: f.hs_protein, carbs: f.hs_carbs, fat: f.hs_fat, fiber: f.hs_fiber }));
        let combined = local;
        if (local.length < 5 && q.length >= 2) {
          const { data: external } = await api.get('/bridge/ai/food-search', { params: { query: q } }).catch(() => ({ data: [] }));
          combined = [...local, ...(Array.isArray(external) ? external : [])];
        }
        setResults(combined.filter(f => f.calories != null));
      } catch { setResults([]); }
      setSearching(false);
    }, q.length >= 2 ? 280 : 0);
  };

  useEffect(() => { doSearch(''); }, []);

  const selectFood = (f) => {
    setSelectedFood(f);
    setSearch(f.name);
    setPortion(100);
    setShowDropdown(false);
    if (manualMode) setManualMode(false);
  };

  const macros = useMemo(() => {
    if (!selectedFood) return null;
    const factor = (parseFloat(portion) || 0) / 100;
    return {
      cal: Math.round((selectedFood.calories || 0) * factor),
      prot: ((+selectedFood.protein || 0) * factor).toFixed(1),
      carbs: ((+selectedFood.carbs || 0) * factor).toFixed(1),
      fats: ((+selectedFood.fat || 0) * factor).toFixed(1),
      fiber: ((+selectedFood.fiber || 0) * factor).toFixed(1),
    };
  }, [selectedFood, portion]);

  const submit = async () => {
    let payload;
    if (manualMode) {
      if (!manual.name.trim()) return alert('Please enter a food name.');
      payload = {
        food_name: manual.name, meal_type: mealType, log_date: today,
        calories: manual.calories || 0, protein: manual.protein || 0,
        carbs: manual.carbs || 0, fat: manual.fats || 0, fiber: manual.fiber || 0,
      };
    } else {
      if (!selectedFood) return alert('Please search and select a food, or use "Enter manually".');
      payload = {
        food_name: selectedFood.name, meal_type: mealType, log_date: today,
        calories: macros.cal, protein: macros.prot, carbs: macros.carbs, fat: macros.fats, fiber: macros.fiber,
      };
    }
    setSubmitting(true);
    try {
      await Hs_dietlogsService.create({
        'hs_User@odata.bind': `/hs_users(${user.id})`,
        hs_foodname: payload.food_name,
        hs_mealtype: MEAL_TYPE_CODES[payload.meal_type],
        hs_logdate: payload.log_date,
        hs_calories: Number(payload.calories) || 0,
        hs_protein: Number(payload.protein) || 0,
        hs_carbs: Number(payload.carbs) || 0,
        hs_fat: Number(payload.fat) || 0,
        hs_fiber: Number(payload.fiber) || 0,
      });
      onAdded();
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to add meal');
    } finally { setSubmitting(false); }
  };

  const toggleManual = () => {
    setManualMode(m => !m);
    if (!manualMode) { setSelectedFood(null); setSearch(''); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div>
            <h3><i className="fas fa-utensils" /> Log Meal</h3>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Search our food database or enter manually</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          {/* Meal type tabs */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Meal Type</div>
            <div className="meal-type-tabs">
              {Object.entries(MEAL_META).map(([type, meta]) => (
                <button key={type} type="button" className={`mtt-btn${mealType === type ? ' active' : ''}`} onClick={() => setMealType(type)}>
                  <span className="mtt-emoji">{meta.icon}</span>{meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* Food search */}
          {!manualMode && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Search Food</div>
              <div className="food-search-wrap">
                <i className="fas fa-search fs-icon" />
                <input type="text" className="form-control" placeholder="e.g. Grilled Chicken, Oats, Salmon, Broccoli…"
                  autoComplete="off" value={search}
                  onChange={e => doSearch(e.target.value)}
                  onFocus={() => setShowDropdown(true)} />
                {showDropdown && (
                  <div className="food-dropdown" onMouseLeave={() => setShowDropdown(false)}>
                    {searching ? (
                      <div className="fd-empty"><i className="fas fa-circle-notch fa-spin" /> Searching…</div>
                    ) : results.length ? results.map(f => (
                      <div className="fd-item" key={`${f.source || 'local'}-${f.id || f.name}`} onClick={() => selectFood(f)}>
                        <div className="fd-icon">🍽️</div>
                        <div className="fd-info">
                          <div className="fd-name">{f.name}</div>
                          <div className="fd-meta">{f.source === 'spoonacular' ? 'Spoonacular' : 'Health Database'}</div>
                        </div>
                        <span className={`fd-rating ${f.healthRating || 'good'}`}>{f.healthRating || 'good'}</span>
                        <div className="fd-cal">{Math.round(f.calories)}<br /><span style={{ fontSize: 9, fontWeight: 500 }}>kcal/100g</span></div>
                      </div>
                    )) : (
                      <div className="fd-empty">No foods found for "<b>{search || 'your search'}</b>".<br /><small>Try a different term or use "Enter manually" below.</small></div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Selected food card */}
          {selectedFood && !manualMode && (
            <div className="selected-food-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 24 }}>🍽️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)' }}>{selectedFood.name}</div>
                  <span className={`fd-rating ${selectedFood.healthRating || 'good'}`}>{selectedFood.healthRating || 'good'}</span>
                </div>
                <button type="button" onClick={() => { setSelectedFood(null); setSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }} title="Clear selection">×</button>
              </div>

              <div className="portion-row">
                <label>Portion:</label>
                <input type="number" className="form-control" value={portion} min={1} max={2000} onChange={e => setPortion(e.target.value)} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>g</span>
              </div>

              <div className="macro-pills">
                <div className="macro-pill"><div className="mp-val">{macros.cal}</div><div className="mp-lbl">kcal</div></div>
                <div className="macro-pill"><div className="mp-val">{macros.prot}g</div><div className="mp-lbl">Protein</div></div>
                <div className="macro-pill"><div className="mp-val">{macros.carbs}g</div><div className="mp-lbl">Carbs</div></div>
                <div className="macro-pill"><div className="mp-val">{macros.fats}g</div><div className="mp-lbl">Fats</div></div>
                <div className="macro-pill"><div className="mp-val">{macros.fiber}g</div><div className="mp-lbl">Fiber</div></div>
              </div>
            </div>
          )}

          {/* Manual entry toggle */}
          <div style={{ marginTop: 12 }}>
            <button type="button" className="manual-toggle" onClick={toggleManual}>
              <i className={`fas ${manualMode ? 'fa-search' : 'fa-pencil-alt'}`} style={{ fontSize: 10 }} />
              {manualMode ? ' Search food database instead' : ' Food not found? Enter manually'}
            </button>
          </div>

          {/* Manual fields */}
          {manualMode && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
              <div className="form-group">
                <label className="form-label">Food Name *</label>
                <input type="text" className="form-control" placeholder="e.g. Homemade Dal, Protein Bar…"
                  value={manual.name} onChange={e => setManual({ ...manual, name: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Calories (kcal)</label>
                  <input type="number" className="form-control" placeholder="0" min={0} value={manual.calories} onChange={e => setManual({ ...manual, calories: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Protein (g)</label>
                  <input type="number" className="form-control" placeholder="0" min={0} step="0.1" value={manual.protein} onChange={e => setManual({ ...manual, protein: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Carbs (g)</label>
                  <input type="number" className="form-control" placeholder="0" min={0} step="0.1" value={manual.carbs} onChange={e => setManual({ ...manual, carbs: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Fats (g)</label>
                  <input type="number" className="form-control" placeholder="0" min={0} step="0.1" value={manual.fats} onChange={e => setManual({ ...manual, fats: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Fiber (g)</label>
                  <input type="number" className="form-control" placeholder="0" min={0} step="0.1" value={manual.fiber} onChange={e => setManual({ ...manual, fiber: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button type="button" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={submitting} onClick={submit}>
              {submitting ? 'Adding...' : <><i className="fas fa-plus" /> Add Meal</>}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DietTracker() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [waterLogId, setWaterLogId] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [familyHistory, setFamilyHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState(null);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiMsgsRef = useRef(null);

  const today = new Date().toISOString().split('T')[0];

  const load = () => {
    Promise.all([
      Hs_dietlogsService.getAll({ filter: `_hs_user_value eq ${user.id} and hs_logdate eq ${today}` }),
      Hs_waterlogsService.getAll({ filter: `_hs_user_value eq ${user.id} and hs_logdate eq ${today}` }),
      Hs_healthmetricsService.getAll({ filter: `_hs_user_value eq ${user.id}`, orderBy: ['hs_recordedat desc'], top: 1 }),
      Hs_familyhistoriesService.getAll({ filter: `_hs_user_value eq ${user.id}` }),
    ]).then(([dietRes, waterRes, metricsRes, famRes]) => {
      setLogs((dietRes.data || []).map(toDietLog));
      setWaterGlasses(waterRes.data?.[0]?.hs_glasses || 0);
      setWaterLogId(waterRes.data?.[0]?.hs_waterlogid || null);
      const m = metricsRes.data?.[0];
      setMetrics(m ? { systolic: m.hs_systolic } : null);
      setFamilyHistory((famRes.data || []).map(f => ({ conditionName: f.hs_conditionname })));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    setAiMessages([{
      role: 'assistant',
      content: `**Hi ${user?.name?.split(' ')[0] || 'there'}! 👋** I'm your AI Meal Assistant.\n\nI know your health data — I'll give you personalised recipes and nutrition guidance.\n\n*Try clicking one of the quick questions below or ask me anything!*`,
    }]);
  }, [user]);

  useEffect(() => {
    if (aiMsgsRef.current) aiMsgsRef.current.scrollTop = aiMsgsRef.current.scrollHeight;
  }, [aiMessages, aiLoading]);

  const totals = useMemo(() => logs.reduce((acc, l) => ({
    calories: acc.calories + (l.calories || 0),
    protein: acc.protein + parseFloat(l.protein || 0),
    carbs: acc.carbs + parseFloat(l.carbs || 0),
    fats: acc.fats + parseFloat(l.fat || 0),
    fiber: acc.fiber + parseFloat(l.fiber || 0),
  }), { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 }), [logs]);

  const byType = useMemo(() => {
    const map = { breakfast: [], lunch: [], snack: [], dinner: [] };
    for (const l of logs) (map[l.mealType] || (map[l.mealType] = [])).push(l);
    return map;
  }, [logs]);

  const recs = useMemo(() => {
    const bpSys = metrics?.systolic || 120;
    const conditions = familyHistory.map(f => (f.conditionName || '').toLowerCase());
    const hasHeartRisk = conditions.some(c => c.includes('heart') || c.includes('cholesterol'));
    const hasDiabRisk = conditions.some(c => c.includes('diabet'));
    const hasHypertRisk = bpSys >= 130 || conditions.some(c => c.includes('hypertension'));

    return {
      breakfast: {
        meal: hasDiabRisk ? 'Overnight Oats with Berries & Flaxseeds' : 'Greek Yogurt Parfait with Granola',
        why: hasDiabRisk ? 'Low GI oats stabilise blood sugar. Berries add antioxidants.' : 'High protein, probiotic-rich start to the day.',
        kcal: 320, icon: '🌅', tags: ['Low GI', 'High Fibre', 'Heart-Healthy'],
      },
      lunch: {
        meal: hasHeartRisk ? 'Grilled Salmon with Quinoa & Spinach Salad' : 'Chicken & Avocado Wholegrain Wrap',
        why: hasHeartRisk ? 'Omega-3 from salmon directly reduces cardiovascular risk from your family history.' : 'Lean protein and healthy fats for sustained energy.',
        kcal: 480, icon: '☀️', tags: ['Omega-3 Rich', 'Low Sodium', 'Protein'],
      },
      snack: {
        meal: 'Walnuts, Almonds & Apple Slices',
        why: 'Walnuts provide plant-based Omega-3. Apple fibre supports cholesterol management.',
        kcal: 200, icon: '🍎', tags: ['Heart-Healthy', 'Low Sugar'],
      },
      dinner: {
        meal: hasHypertRisk ? 'Herb-Baked Chicken with Roasted Vegetables & Brown Rice' : 'Lentil & Vegetable Curry with Brown Rice',
        why: hasHypertRisk ? 'No added salt — uses herbs for flavour. Brown rice is low GI. Potassium from veg supports BP.' : 'High in plant protein and fibre. Excellent for heart health.',
        kcal: 520, icon: '🌙', tags: [hasHypertRisk ? 'Low Sodium' : 'High Protein', 'Complex Carbs', 'Filling'],
      },
    };
  }, [metrics, familyHistory]);

  const macroBars = [
    { label: 'Calories', val: totals.calories, goal: GOALS.calories, color: '#1565C0', unit: 'kcal' },
    { label: 'Protein', val: totals.protein, goal: GOALS.protein, color: '#16A34A', unit: 'g' },
    { label: 'Carbs', val: totals.carbs, goal: GOALS.carbs, color: '#00B4D8', unit: 'g' },
    { label: 'Fats', val: totals.fats, goal: GOALS.fats, color: '#D97706', unit: 'g' },
    { label: 'Fiber', val: totals.fiber, goal: GOALS.fiber, color: '#7C3AED', unit: 'g' },
  ];

  const doughnutData = {
    labels: ['Protein', 'Carbs', 'Fats', 'Fiber'],
    datasets: [{
      data: [Math.round(totals.protein), Math.round(totals.carbs), Math.round(totals.fats), Math.round(totals.fiber)],
      backgroundColor: ['#1565C0', '#00B4D8', '#D97706', '#16A34A'],
      borderWidth: 2, borderColor: '#fff',
    }],
  };

  const saveWater = async (glasses) => {
    setWaterGlasses(glasses);
    if (waterLogId) {
      await Hs_waterlogsService.update(waterLogId, { hs_glasses: glasses });
    } else {
      const result = await Hs_waterlogsService.create({
        'hs_User@odata.bind': `/hs_users(${user.id})`,
        hs_waterlog1: `${user.id}-${today}`,
        hs_logdate: today,
        hs_glasses: glasses,
      });
      setWaterLogId(result.data?.hs_waterlogid || null);
    }
  };

  const sendMealMsg = async (text) => {
    const msg = (text ?? aiInput).trim();
    if (!msg || aiLoading) return;
    setAiInput('');
    const history = aiMessages.map(m => ({ role: m.role, content: m.content }));
    setAiMessages(prev => [...prev, { role: 'user', content: msg }]);
    setAiLoading(true);
    try {
      const { data } = await api.post('/bridge/ai/chat', { message: msg, history: history.slice(-8), user: { name: user?.name, nhsId: user?.nhsId } });
      setAiMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Sorry, I could not process that. Please try again.' }]);
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Connection error. Please try again.' }]);
    } finally { setAiLoading(false); }
  };

  const askMeal = (q) => sendMealMsg(q);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h2 style={{ margin: 0 }}><i className="fas fa-utensils" style={{ color: 'var(--primary-light)' }} /> Diet & Nutrition Tracker</h2>
          <div className="text-muted text-sm">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} &middot; Goal: 2,500 kcal/day</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModalType('breakfast')}>
          <i className="fas fa-plus" /> Log Meal
        </button>
      </div>

      {/* AI Meal Plan */}
      <div className="card" style={{ marginBottom: 18, borderLeft: '4px solid #16A34A' }}>
        <div className="flex-between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, color: 'var(--primary)' }}><i className="fas fa-brain" style={{ color: '#16A34A' }} /> AI Meal Plan — Personalised for You</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, background: '#DCFCE7', color: '#166534', padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}><i className="fas fa-magic" /> Based on your health data</span>
          </div>
        </div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {Object.entries(recs).map(([type, rec]) => (
            <div className="rec-card" key={type} onClick={() => askMeal(`How do I prepare ${rec.meal}?`)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{rec.icon}</span>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-muted)' }}>{type}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--primary)', lineHeight: 1.3 }}>{rec.meal}</div>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>{rec.why}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {rec.tags.map(tag => <span className="rec-tag" key={tag}>{tag}</span>)}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-light)' }}>~{rec.kcal} kcal</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--primary-light)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <i className="fas fa-robot" /> Click for recipe &amp; steps
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="diet-wrap">
        {/* Left: Nutrition Summary */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><h3><i className="fas fa-chart-pie" /> Today's Nutrition</h3></div>
            <div className="card-body">
              <div style={{ position: 'relative', height: 180, marginBottom: 16 }}>
                <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } }} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--primary)' }}>{Math.round(totals.calories)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>kcal</div>
                </div>
              </div>
              {macroBars.map(m => {
                const pct = Math.min(Math.round((m.val / m.goal) * 100), 100);
                return (
                  <div className="macro-bar-wrap" key={m.label}>
                    <div className="macro-label">
                      <span>{m.label}</span>
                      <span>{Math.round(m.val * 10) / 10}{m.unit} / {m.goal}</span>
                    </div>
                    <div className="macro-bar">
                      <div className="macro-fill" style={{ width: `${pct}%`, background: m.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Water Tracker */}
          <div className="card">
            <div className="card-header"><h3><i className="fas fa-tint" /> Water Intake</h3></div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{waterGlasses} / 8 glasses today</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                {Array.from({ length: 8 }, (_, i) => i + 1).map(i => (
                  <div key={i} className={`water-glass${i <= waterGlasses ? ' filled' : ''}`} title={`Glass ${i}`} onClick={() => saveWater(i === waterGlasses ? i - 1 : i)} style={{ cursor: 'pointer' }}>
                    <i className="fas fa-tint" style={{ fontSize: 14, color: i <= waterGlasses ? '#fff' : 'var(--border)' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Center: Meals by type */}
        <div>
          {Object.entries(MEAL_META).map(([type, meta]) => {
            const typeMeals = byType[type] || [];
            const typeCal = typeMeals.reduce((s, m) => s + (m.calories || 0), 0);
            return (
              <div className="card" style={{ marginBottom: 16 }} key={type}>
                <div className="flex-between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{meta.icon} {meta.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rec. {meta.range}</span>
                    <button className="btn btn-sm btn-outline" onClick={() => setModalType(type)} title={`Add ${meta.label}`}>
                      <i className="fas fa-plus" /> Add
                    </button>
                  </div>
                </div>
                <div>
                  {typeMeals.length ? (
                    <>
                      {typeMeals.map(meal => (
                        <div className="meal-row" key={meal.id}>
                          <div className="meal-icon">🍽</div>
                          <div className="meal-info">
                            <div className="meal-name">{meal.foodName}</div>
                            <div className="meal-meta">P: {Math.round((meal.protein || 0) * 10) / 10}g &nbsp;·&nbsp; C: {Math.round((meal.carbs || 0) * 10) / 10}g &nbsp;·&nbsp; F: {Math.round((meal.fat || 0) * 10) / 10}g</div>
                          </div>
                          <div className="meal-cal">{Math.round(meal.calories || 0)} kcal</div>
                        </div>
                      ))}
                      <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--primary-light)', padding: '8px 16px' }}>
                        Total: {Math.round(typeCal)} kcal
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
                      <i className="fas fa-utensils" style={{ opacity: .3, fontSize: 24 }} />
                      <p style={{ marginTop: 8 }}>No {meta.label.toLowerCase()} logged yet.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: AI Meal Assistant */}
        <div>
          <div className="card" style={{ height: '100%' }}>
            <div className="card-header" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>AI Meal Assistant</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} /> Online &middot; Personalised for you
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body ai-panel" style={{ padding: 14 }}>
              {/* Quick prompts */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 7 }}>Quick Questions</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {QUICK_QUESTIONS.map(q => (
                    <button className="quick-pill" key={q.text} onClick={() => askMeal(q.text)}>{q.icon} {q.text}</button>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div className="ai-msgs" ref={aiMsgsRef}>
                {aiMessages.map((m, i) => (
                  <div className={`ai-msg ${m.role === 'user' ? 'ai-out' : 'ai-in'}`} key={i}>
                    <div className="ai-av">
                      {m.role === 'user' ? (user?.name?.charAt(0).toUpperCase() || 'U') : <i className="fas fa-robot" style={{ fontSize: 11 }} />}
                    </div>
                    <div className="ai-bubble ai-md" dangerouslySetInnerHTML={{ __html: aiMd(m.content) }} />
                  </div>
                ))}
                {aiLoading && (
                  <div className="ai-msg ai-in">
                    <div className="ai-av"><i className="fas fa-robot" style={{ fontSize: 11 }} /></div>
                    <div className="ai-typing"><span /><span /><span /></div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" className="form-control" placeholder="e.g. How do I make grilled chicken?"
                  style={{ fontSize: 13, borderRadius: 20 }} value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMealMsg(); } }} />
                <button onClick={() => sendMealMsg()} disabled={aiLoading} style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--primary-light)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fas fa-paper-plane" style={{ fontSize: 14 }} />
                </button>
              </div>
              <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10.5, color: 'var(--text-muted)' }}>
                <i className="fas fa-shield-alt" style={{ color: 'var(--primary-light)' }} /> AI considers your allergies &amp; health profile
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalType && (
        <AddMealModal initialType={modalType} today={today} onClose={() => setModalType(null)} onAdded={load} />
      )}
    </div>
  );
}
