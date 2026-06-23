import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import { Hs_fooddatabasesService } from '../../generated/services/Hs_fooddatabasesService';
import { Hs_fooddatabaseshs_healthrating } from '../../generated/models/Hs_fooddatabasesModel';

const HEALTH_RATING_CODES = Object.fromEntries(
  Object.entries(Hs_fooddatabaseshs_healthrating).map(([code, label]) => [label, Number(code)])
);

const CATEGORIES = ['Fruit', 'Vegetable', 'Grain', 'Protein Food', 'Dairy', 'Snack/Processed', 'Beverage', 'Supplement', 'Other'];

const RATING_MAP = { excellent: 'success', good: 'info', moderate: 'warning', poor: 'danger' };

const BLANK_FORM = {
  name: '', category: '', calories: '', protein: '', carbs: '',
  sugar: '', fat: '', fiber: '', sodium: '',
  allergens: '', avoid_if: '', vitamins: '', portion_size: '',
  health_rating: 'moderate',
};

function toFood(record) {
  return {
    id: record.hs_fooddatabaseid,
    name: record.hs_foodname,
    category: record.hs_category_1,
    calories: record.hs_calories,
    protein: record.hs_protein,
    carbs: record.hs_carbs,
    sugar: record.hs_sugar,
    fat: record.hs_fat,
    fiber: record.hs_fiber,
    sodium: record.hs_sodium,
    allergens: record.hs_allergens,
    avoidIf: record.hs_avoidif,
    vitamins: record.hs_vitamins,
    portionSize: record.hs_portionsize,
    healthRating: Hs_fooddatabaseshs_healthrating[record.hs_healthrating] || 'moderate',
  };
}

function foodCode(id) {
  return 'FD-' + String(id).slice(0, 8).toUpperCase();
}

function truncate(str, n = 28) {
  if (!str) return '—';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function RatingBadge({ r }) {
  return <span className={`badge badge-${RATING_MAP[r] || 'gray'}`} style={{ textTransform: 'capitalize' }}>{r || 'moderate'}</span>;
}

export default function FoodDatabase() {
  const [tab, setTab]         = useState('local');
  const [foods, setFoods]     = useState([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(BLANK_FORM);
  const [saving, setSaving]       = useState(false);

  // Online search tab
  const [apiQuery,   setApiQuery]   = useState('');
  const [apiResults, setApiResults] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError,   setApiError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const trimmed = search.trim().replace(/'/g, "''");
      const options = trimmed
        ? { filter: `contains(hs_foodname,'${trimmed}') or contains(hs_category_1,'${trimmed}')` }
        : undefined;
      const result = await Hs_fooddatabasesService.getAll(options);
      setFoods((result.data || []).map(toFood));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

  const openAdd = (prefill = {}) => {
    setForm({ ...BLANK_FORM, ...prefill });
    setShowModal(true);
  };

  const add = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Hs_fooddatabasesService.create({
        hs_name: form.name,
        hs_foodname: form.name,
        hs_category_1: form.category || undefined,
        hs_calories: form.calories ? Number(form.calories) : undefined,
        hs_protein: form.protein ? Number(form.protein) : undefined,
        hs_carbs: form.carbs ? Number(form.carbs) : undefined,
        hs_sugar: form.sugar ? Number(form.sugar) : undefined,
        hs_fat: form.fat ? Number(form.fat) : undefined,
        hs_fiber: form.fiber ? Number(form.fiber) : undefined,
        hs_sodium: form.sodium ? Number(form.sodium) : undefined,
        hs_allergens: form.allergens || undefined,
        hs_avoidif: form.avoid_if || undefined,
        hs_vitamins: form.vitamins || undefined,
        hs_portionsize: form.portion_size || undefined,
        hs_healthrating: HEALTH_RATING_CODES[form.health_rating],
      });
      flash('Food item added to database.');
      load();
      setShowModal(false);
    } finally { setSaving(false); }
  };

  const del = async (id, name) => {
    if (!confirm(`Delete "${name}" from the database?`)) return;
    await Hs_fooddatabasesService.delete(id);
    flash('Food item deleted.');
    load();
  };

  const doApiSearch = async (e) => {
    e.preventDefault();
    if (!apiQuery.trim()) return;
    setApiLoading(true);
    setApiError('');
    setApiResults([]);
    try {
      const r = await api.get('/bridge/food-database/search-api', { params: { q: apiQuery } });
      if (r.data?.error) setApiError(r.data.error);
      else setApiResults(r.data);
    } catch (err) {
      setApiError(err.response?.data?.error || 'Search failed. Try again.');
    } finally { setApiLoading(false); }
  };

  const importItem = (item) => {
    openAdd({
      name: item.food_name,
      category: item.category,
      calories: item.calories_per_100g || '',
      protein: item.protein_g || '',
      carbs: item.carbs_g || '',
      sugar: item.sugar_g || '',
      fat: item.fats_g || '',
      fiber: item.fiber_g || '',
      sodium: item.sodium_mg || '',
      health_rating: 'moderate',
    });
  };

  const f = (v) => { setForm(p => ({ ...p, ...v })); };

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
            <i className="fas fa-drumstick-bite" style={{ color: '#D97706', marginRight: 8 }}></i>Food Database
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {foods.length} items in local registry
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => openAdd()}>
          <i className="fas fa-plus" style={{ marginRight: 6 }}></i>Add Food
        </button>
      </div>

      {/* Success alert */}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <i className="fas fa-check-circle"></i> {success}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {[
          { key: 'local',  icon: 'fa-database',       label: 'Local Database' },
          { key: 'search', icon: 'fa-search',          label: 'Search Online' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 22px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 14,
              color: tab === t.key ? '#D97706' : 'var(--text-muted)',
              borderBottom: tab === t.key ? '2px solid #D97706' : '2px solid transparent',
              marginBottom: -2,
              transition: 'all 0.15s',
            }}
          >
            <i className={`fas ${t.icon}`} style={{ marginRight: 7 }}></i>{t.label}
          </button>
        ))}
      </div>

      {/* ─── LOCAL DATABASE TAB ─── */}
      {tab === 'local' && (
        <div>
          {/* Search filter */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                className="form-control"
                style={{ flex: 1 }}
                placeholder="🔍 Search by food name or category..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button className="btn btn-sm btn-outline" onClick={load}>
                <i className="fas fa-sync"></i> Refresh
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="card">
            <div className="card-header">
              <h3><i className="fas fa-list" style={{ marginRight: 6, color: '#D97706' }}></i>Food Items</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{foods.length} records</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>Food ID</th>
                    <th>Food Name</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Cal/100g</th>
                    <th style={{ textAlign: 'right' }}>Protein</th>
                    <th style={{ textAlign: 'right' }}>Sugar</th>
                    <th style={{ textAlign: 'right' }}>Fats</th>
                    <th style={{ textAlign: 'right' }}>Fiber</th>
                    <th>Health Rating</th>
                    <th>Avoid If</th>
                    <th>Allergy Risk</th>
                    <th>Vitamins/Minerals</th>
                    <th>Portion/Limit</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={14}><div className="loading"><div className="spinner" /></div></td></tr>
                  ) : foods.length ? foods.map(item => (
                    <tr key={item.id}>
                      <td>
                        <code style={{ fontFamily: 'monospace', fontSize: 11, color: '#1565C0', fontWeight: 600 }}>
                          {foodCode(item.id)}
                        </code>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>
                          <i className="fas fa-apple-alt" style={{ color: '#D97706', marginRight: 5, fontSize: 11 }}></i>
                          {item.name}
                        </span>
                      </td>
                      <td>
                        {item.category ? (
                          <span style={{
                            background: '#FEF3C7', color: '#92400E',
                            padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          }}>{item.category}</span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.calories ?? '—'}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{item.protein != null ? `${parseFloat(item.protein).toFixed(1)}g` : '—'}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{item.sugar != null ? `${parseFloat(item.sugar).toFixed(1)}g` : '—'}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{item.fat != null ? `${parseFloat(item.fat).toFixed(1)}g` : '—'}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{item.fiber != null ? `${parseFloat(item.fiber).toFixed(1)}g` : '—'}</td>
                      <td><RatingBadge r={item.healthRating} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 130 }}>{truncate(item.avoidIf)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 130 }}>{truncate(item.allergens)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 140 }}>{truncate(item.vitamins)}</td>
                      <td style={{ fontSize: 12 }}>{item.portionSize || '—'}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => del(item.id, item.name)}
                          title="Delete"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={14}>
                        <div className="empty-state">
                          {search ? 'No food items match your search' : 'No food items in database. Add one or search online.'}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── SEARCH ONLINE TAB ─── */}
      {tab === 'search' && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h3><i className="fas fa-globe" style={{ marginRight: 6, color: '#0891B2' }}></i>Search Open Food Facts</h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Free public food database</span>
            </div>
            <div className="card-body">
              <form onSubmit={doApiSearch} style={{ display: 'flex', gap: 10 }}>
                <input
                  className="form-control"
                  style={{ flex: 1 }}
                  placeholder="Search food items e.g. apple, chicken, broccoli..."
                  value={apiQuery}
                  onChange={e => setApiQuery(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" disabled={apiLoading || !apiQuery.trim()}>
                  {apiLoading
                    ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, display: 'inline-block', marginRight: 6 }} />Searching…</>
                    : <><i className="fas fa-search" style={{ marginRight: 6 }}></i>Search</>}
                </button>
              </form>
            </div>
          </div>

          {apiError && (
            <div className="alert alert-danger" style={{ marginBottom: 16 }}>
              <i className="fas fa-exclamation-circle"></i> {apiError}
            </div>
          )}

          {apiResults.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {apiResults.map((item, i) => (
                <div key={i} className="card" style={{ overflow: 'hidden' }}>
                  {/* Food image */}
                  <div style={{
                    height: 140, background: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.food_name}
                        style={{ maxHeight: 140, maxWidth: '100%', objectFit: 'cover', width: '100%' }}
                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    <div style={{
                      display: item.image ? 'none' : 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      width: '100%', height: '100%', color: '#D97706', fontSize: 40,
                    }}>
                      <i className="fas fa-apple-alt"></i>
                    </div>
                  </div>

                  <div className="card-body" style={{ padding: 14 }}>
                    {/* Name + category */}
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, lineHeight: 1.3 }}>{item.food_name}</div>
                    {item.category && (
                      <span style={{
                        background: '#DBEAFE', color: '#1E40AF',
                        padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, display: 'inline-block', marginBottom: 10,
                        textTransform: 'capitalize',
                      }}>{item.category}</span>
                    )}

                    {/* Macros grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
                      {[
                        { label: 'Cal', value: `${item.calories_per_100g}`, unit: 'kcal' },
                        { label: 'Protein', value: `${item.protein_g}g`, unit: '' },
                        { label: 'Carbs', value: `${item.carbs_g}g`, unit: '' },
                        { label: 'Sugar', value: `${item.sugar_g}g`, unit: '' },
                        { label: 'Fats', value: `${item.fats_g}g`, unit: '' },
                        { label: 'Fiber', value: `${item.fiber_g}g`, unit: '' },
                      ].map(m => (
                        <div key={m.label} style={{ textAlign: 'center', background: '#F9FAFB', borderRadius: 6, padding: '4px 2px' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{m.value}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.label}</div>
                        </div>
                      ))}
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', fontSize: 13 }}
                      onClick={() => importItem(item)}
                    >
                      <i className="fas fa-download" style={{ marginRight: 6 }}></i>Import to Database
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!apiLoading && !apiError && apiResults.length === 0 && apiQuery && (
            <div className="empty-state">No results found. Try a different search term.</div>
          )}

          {!apiQuery && !apiLoading && (
            <div className="empty-state" style={{ padding: 48 }}>
              <i className="fas fa-search" style={{ fontSize: 32, color: '#D97706', display: 'block', marginBottom: 12 }}></i>
              Search the Open Food Facts database to import food items into your local registry.
            </div>
          )}
        </div>
      )}

      {/* ─── ADD / IMPORT MODAL ─── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 680, width: '95vw' }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #D97706, #F59E0B)', color: 'white', borderRadius: '8px 8px 0 0' }}>
              <h3 style={{ color: 'white', margin: 0 }}>
                <i className="fas fa-plus-circle" style={{ marginRight: 8 }}></i>Add Food Item
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)} style={{ color: 'white' }}>✕</button>
            </div>

            <form onSubmit={add}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '65vh', overflowY: 'auto', padding: '20px 24px' }}>

                {/* Row 1: Name + Category */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Food Name <span style={{ color: '#DC2626' }}>*</span></label>
                    <input
                      className="form-control"
                      required
                      placeholder="e.g. Brown Rice"
                      value={form.name}
                      onChange={e => f({ name: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Category</label>
                    <select className="form-control" value={form.category} onChange={e => f({ category: e.target.value })}>
                      <option value="">Select category…</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 2: Macros */}
                <div>
                  <label className="form-label" style={{ marginBottom: 8, display: 'block', fontWeight: 600 }}>
                    Nutrition per 100g
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {[
                      { key: 'calories', label: 'Calories (kcal)', type: 'number' },
                      { key: 'protein',  label: 'Protein (g)',     type: 'number', step: '0.1' },
                      { key: 'carbs',    label: 'Carbs (g)',       type: 'number', step: '0.1' },
                      { key: 'sugar',    label: 'Sugar (g)',       type: 'number', step: '0.1' },
                      { key: 'fat',      label: 'Fats (g)',        type: 'number', step: '0.1' },
                      { key: 'fiber',    label: 'Fiber (g)',       type: 'number', step: '0.1' },
                      { key: 'sodium',   label: 'Sodium (mg)',     type: 'number', step: '0.1' },
                    ].map(({ key, label, type, step }) => (
                      <div className="form-group" key={key} style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: 11 }}>{label}</label>
                        <input
                          className="form-control"
                          type={type}
                          min="0"
                          step={step || '1'}
                          placeholder="0"
                          value={form[key]}
                          onChange={e => f({ [key]: e.target.value })}
                        />
                      </div>
                    ))}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Health Rating</label>
                      <select className="form-control" value={form.health_rating} onChange={e => f({ health_rating: e.target.value })}>
                        <option value="excellent">Excellent</option>
                        <option value="good">Good</option>
                        <option value="moderate">Moderate</option>
                        <option value="poor">Poor</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row 3: Risk fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Allergy Risk</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Milk, Wheat, Nuts"
                      value={form.allergens}
                      onChange={e => f({ allergens: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Avoid If</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Diabetics, Lactose intolerant"
                      value={form.avoid_if}
                      onChange={e => f({ avoid_if: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 4: Vitamins + Portion */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Vitamins / Minerals</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Vitamin C, Iron, Zinc"
                      value={form.vitamins}
                      onChange={e => f({ vitamins: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Portion / Limit</label>
                    <input
                      className="form-control"
                      placeholder="e.g. 1 cup / 240ml"
                      value={form.portion_size}
                      onChange={e => f({ portion_size: e.target.value })}
                    />
                  </div>
                </div>

              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving
                    ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, display: 'inline-block', marginRight: 6 }} />Saving…</>
                    : <><i className="fas fa-save" style={{ marginRight: 6 }}></i>Add Food Item</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
