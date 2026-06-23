import { useState, useEffect, useCallback, Component } from 'react';
import api from '../../api/axios';
import { Hs_geneticdisease1sService } from '../../generated/services/Hs_geneticdisease1sService';

function toDisease(record) {
  return {
    id: record.hs_geneticdisease1id,
    name: record.hs_name || record.hs_geneticdisease1,
    inheritanceType: record.hs_inheritancetype,
    symptoms: record.hs_symptoms,
    foodTriggers: record.hs_foodtriggers,
    exerciseGuidance: record.hs_exerciseguidance,
    carePlan: record.hs_careplan,
  };
}

function toRecord(form) {
  return {
    hs_geneticdisease1: form.name,
    hs_name: form.name,
    hs_inheritancetype: form.inheritance_type || undefined,
    hs_symptoms: form.symptoms || undefined,
    hs_foodtriggers: form.food_triggers || undefined,
    hs_exerciseguidance: form.exercise_guidance || undefined,
    hs_careplan: form.care_plan || undefined,
  };
}

const CARE_PLAN_BADGE = {
  intensive:  'badge-danger',
  moderate:   'badge-warning',
  standard:   'badge-info',
  preventive: 'badge-success',
};

const INHERITANCE_OPTIONS = [
  { value: 'complex',              label: 'Complex / Multifactorial' },
  { value: 'autosomal_dominant',   label: 'Autosomal Dominant' },
  { value: 'autosomal_recessive',  label: 'Autosomal Recessive' },
  { value: 'x_linked',             label: 'X-Linked' },
  { value: 'mitochondrial',        label: 'Mitochondrial' },
];

const CARE_PLAN_OPTIONS = ['standard', 'moderate', 'intensive', 'preventive'];

const EMPTY_FORM = { name: '', inheritance_type: 'complex', symptoms: '', food_triggers: '', exercise_guidance: '', care_plan: 'standard' };

function trunc(str, n) {
  if (!str) return '—';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

/* ── Error Boundary (prevents modal crashes from blanking the page) ── */
class ErrorBoundary extends Component {
  state = { crashed: false, msg: '' };
  static getDerivedStateFromError(err) { return { crashed: true, msg: err.message }; }
  render() {
    if (this.state.crashed)
      return (
        <div className="alert alert-danger" style={{ margin: 20 }}>
          <i className="fas fa-exclamation-circle" style={{ marginRight: 6 }}></i>
          Something went wrong: {this.state.msg}
          <button type="button" className="btn btn-sm btn-outline" style={{ marginLeft: 12 }}
            onClick={() => this.setState({ crashed: false, msg: '' })}>
            Dismiss
          </button>
        </div>
      );
    return this.props.children;
  }
}

/* ── Disease Form Modal ────────────────────────────────────────────── */
function DiseaseModal({ initial = EMPTY_FORM, onSave, onClose, title }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-header" style={{ background: 'var(--primary)', borderRadius: '12px 12px 0 0' }}>
          <h3 style={{ color: '#fff' }}><i className="fas fa-dna" style={{ marginRight: 8 }}></i>{title}</h3>
          <button className="modal-close" style={{ color: '#fff' }} onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Disease Name *</label>
                <input className="form-control" required value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Inheritance Type</label>
                <select className="form-control" value={form.inheritance_type} onChange={e => set('inheritance_type', e.target.value)}>
                  {INHERITANCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Care Plan</label>
                <select className="form-control" value={form.care_plan} onChange={e => set('care_plan', e.target.value)}>
                  {CARE_PLAN_OPTIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Key Symptoms</label>
                <textarea className="form-control" rows={3} value={form.symptoms} onChange={e => set('symptoms', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Food Triggers / Related Genes</label>
                <textarea className="form-control" rows={2} value={form.food_triggers} onChange={e => set('food_triggers', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Exercise Guidance</label>
                <input className="form-control" value={form.exercise_guidance} onChange={e => set('exercise_guidance', e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
              <i className="fas fa-info-circle"></i> Data may be sourced from MedlinePlus Genetics / NCBI MedGen
            </div>
          </div>
          <div className="modal-footer">
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
              <i className="fas fa-download"></i> {saving ? 'Saving…' : 'Save to Registry'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Safe renderer: prevents React error #31 (object as child) ─────── */
const safeStr = (v) => (v == null || typeof v === 'object') ? null : String(v);

/* ── NLM Detail Modal ──────────────────────────────────────────────── */
function NLMDetailModal({ detail, loading, error, onImport, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640, width: '95vw' }}>
        {/* Header */}
        <div className="modal-header" style={{ background: 'linear-gradient(135deg,#7C3AED,#4285F4)', borderRadius: '8px 8px 0 0' }}>
          <h3 style={{ color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🧬</span>
            {loading ? 'Loading details…' : error ? 'Error' : (safeStr(detail?.name) || 'NLM MedGen')}
          </h3>
          <button type="button" className="modal-close" style={{ color: '#fff' }} onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px', maxHeight: '65vh', overflowY: 'auto' }}>
          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto 14px' }} />
              <p style={{ margin: 0 }}>Fetching from NCBI MedGen…</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="alert alert-danger">
              <i className="fas fa-exclamation-circle" style={{ marginRight: 6 }}></i>{error}
            </div>
          )}

          {/* Detail */}
          {detail && !loading && !error && (
            <>
              {/* Source badge + NLM link */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ background: '#EDE9FE', color: '#7C3AED', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                  NLM MedGen
                </span>
                {detail.url && (
                  <a
                    href={detail.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: '#1565C0', textDecoration: 'none', fontWeight: 500 }}
                    onClick={e => e.stopPropagation()}
                  >
                    View on NCBI <i className="fas fa-external-link-alt" style={{ fontSize: 10 }}></i>
                  </a>
                )}
              </div>

              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
                {[
                  { label: 'Inheritance',    value: safeStr(detail.inheritance_label) },
                  { label: 'Related Genes',  value: safeStr(detail.genes),   purple: true },
                  { label: 'Also Known As',  value: safeStr(detail.synonyms) },
                ].map(({ label, value, purple }) => (
                  <div key={label} style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>
                      {label}
                    </div>
                    <div style={{ fontWeight: 700, color: purple ? '#7C3AED' : 'var(--primary)', fontSize: 13 }}>
                      {value || '—'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Definition / Symptoms */}
              {safeStr(detail.symptoms) && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', marginBottom: 6 }}>
                    <i className="fas fa-stethoscope" style={{ color: '#1565C0', marginRight: 6 }}></i>
                    Definition / Key Symptoms
                  </div>
                  <p style={{
                    fontSize: 13, color: '#374151', lineHeight: 1.7,
                    background: 'var(--bg)', borderRadius: 8, padding: 14, margin: 0,
                  }}>
                    {safeStr(detail.symptoms)}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
          {detail && !loading && !error && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#4285F4)', border: 'none' }}
              onClick={() => { onImport(detail); onClose(); }}
            >
              <i className="fas fa-download" style={{ marginRight: 6 }}></i>Import to Registry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */
export default function Diseases() {
  const [tab, setTab]           = useState('local');
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  // Modal state
  const [modal, setModal]       = useState(null); // null | { mode:'add'|'edit', initial }

  // NLM state
  const [nlmQuery,   setNlmQuery]   = useState('');
  const [nlmResults, setNlmResults] = useState([]);
  const [nlmLoading, setNlmLoading] = useState(false);
  const [nlmError,   setNlmError]   = useState('');
  // NLM detail modal
  const [nlmModal,        setNlmModal]        = useState(false);
  const [nlmDetail,       setNlmDetail]       = useState(null);
  const [nlmDetailLoading,setNlmDetailLoading]= useState(false);
  const [nlmDetailError,  setNlmDetailError]  = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const options = search.trim()
      ? { filter: `contains(hs_name,'${search.trim()}') or contains(hs_geneticdisease1,'${search.trim()}')` }
      : undefined;
    Hs_geneticdisease1sService.getAll(options)
      .then(result => setDiseases((result.data || []).map(toDisease)))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  /* ── CRUD ── */
  const handleSave = async (form) => {
    if (modal?.mode === 'edit') {
      await Hs_geneticdisease1sService.update(modal.id, toRecord(form));
    } else {
      await Hs_geneticdisease1sService.create(toRecord(form));
    }
    setModal(null);
    load();
  };

  const del = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await Hs_geneticdisease1sService.delete(id);
    load();
  };

  /* ── NLM Search ── */
  const searchNLM = async () => {
    if (!nlmQuery.trim()) return;
    setNlmResults([]); setNlmDetail(null); setNlmError(''); setNlmLoading(true);
    try {
      const r = await api.get('/bridge/diseases/nlm-search', { params: { q: nlmQuery } });
      if (r.data.error) setNlmError(r.data.error);
      else setNlmResults(r.data.results || []);
    } catch { setNlmError('Network error. Please try again.'); }
    finally { setNlmLoading(false); }
  };

  const loadDetail = async (slug, name) => {
    // Open modal immediately with loading state
    setNlmModal(true);
    setNlmDetail(null);
    setNlmDetailError('');
    setNlmDetailLoading(true);
    try {
      const r = await api.get('/bridge/diseases/nlm-search', { params: { type: 'detail', slug } });
      if (r.data?.error) {
        setNlmDetailError(r.data.error);
      } else {
        setNlmDetail(r.data);
      }
    } catch (err) {
      setNlmDetailError(err?.response?.data?.error || 'Failed to load details. Please try again.');
    } finally {
      setNlmDetailLoading(false);
    }
  };

  const closeNlmModal = () => {
    setNlmModal(false);
    setNlmDetail(null);
    setNlmDetailError('');
    setNlmDetailLoading(false);
  };

  const openImport = (detail) => {
    setModal({
      mode: 'add',
      initial: {
        name: detail.name || '',
        inheritance_type: detail.inheritance || 'complex',
        symptoms: detail.symptoms || '',
        food_triggers: detail.genes || '',
        exercise_guidance: '',
        care_plan: 'standard',
      },
    });
  };

  /* ── Tab styles ── */
  const tabStyle = (t) => ({
    padding: '10px 20px', fontSize: 13, fontWeight: 700,
    border: 'none', background: 'none', cursor: 'pointer',
    color: tab === t ? '#1565C0' : 'var(--text-muted)',
    borderBottom: tab === t ? '2px solid #1565C0' : '2px solid transparent',
    marginBottom: -2,
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
            <i className="fas fa-dna" style={{ color: '#1565C0', marginRight: 8 }}></i>Genetic Diseases Registry
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{diseases.length} conditions</div>
        </div>
        {tab === 'local' && (
          <button className="btn btn-primary" onClick={() => setModal({ mode: 'add', initial: EMPTY_FORM })}>
            <i className="fas fa-plus"></i> Add Disease
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        <button style={tabStyle('local')} onClick={() => setTab('local')}>
          <i className="fas fa-database"></i> Local Registry&nbsp;
          <span style={{ background: '#1565C0', color: '#fff', padding: '1px 7px', borderRadius: 10, fontSize: 11 }}>{diseases.length}</span>
        </button>
        <button style={tabStyle('nlm')} onClick={() => setTab('nlm')}>
          <i className="fas fa-flask"></i> Search MedlinePlus&nbsp;
          <span style={{ background: '#7C3AED', color: '#fff', padding: '1px 7px', borderRadius: 10, fontSize: 11 }}>NLM</span>
        </button>
      </div>

      {/* ── LOCAL TAB ── */}
      {tab === 'local' && (
        <div className="card">
          {/* Search bar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <input
              className="form-control"
              style={{ maxWidth: 320 }}
              placeholder="🔍 Search diseases..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="table-wrap">
            <table style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Inheritance</th>
                  <th>Key Symptoms</th>
                  <th>Food Triggers</th>
                  <th>Exercise Guidance</th>
                  <th>Care Plan</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7}><div className="loading"><div className="spinner" /></div></td></tr>
                ) : diseases.length ? diseases.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{d.name}</td>
                    <td style={{ fontSize: 12 }}>
                      {d.inheritanceType
                        ? d.inheritanceType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                        : '—'}
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 150 }}>{trunc(d.symptoms, 80)}</td>
                    <td style={{ fontSize: 12, maxWidth: 120 }}>{trunc(d.foodTriggers, 60)}</td>
                    <td style={{ fontSize: 12, maxWidth: 130 }}>{trunc(d.exerciseGuidance, 70)}</td>
                    <td>
                      {d.carePlan
                        ? <span className={`badge ${CARE_PLAN_BADGE[d.carePlan] || 'badge-gray'}`}>{d.carePlan.charAt(0).toUpperCase() + d.carePlan.slice(1)}</span>
                        : <span className="badge badge-gray">—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-sm btn-outline"
                          title="Edit"
                          onClick={() => setModal({
                            mode: 'edit', id: d.id,
                            initial: { name: d.name, inheritance_type: d.inheritanceType || 'complex', symptoms: d.symptoms || '', food_triggers: d.foodTriggers || '', exercise_guidance: d.exerciseGuidance || '', care_plan: d.carePlan || 'standard' },
                          })}
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button className="btn btn-sm btn-danger" title="Delete" onClick={() => del(d.id, d.name)}>
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7}><div className="empty-state">No diseases found{search ? ` for "${search}"` : ''}</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── NLM TAB ── */}
      {tab === 'nlm' && (
        <div>
          {/* Search input */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="form-control"
                style={{ flex: 1, maxWidth: 480 }}
                placeholder="Search: e.g. cystic fibrosis, sickle cell, BRCA..."
                value={nlmQuery}
                onChange={e => setNlmQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchNLM()}
              />
              <button className="btn btn-primary" onClick={searchNLM} disabled={nlmLoading}>
                <i className={`fas ${nlmLoading ? 'fa-spinner fa-spin' : 'fa-search'}`}></i> Search
              </button>
            </div>
          </div>

          {/* Error */}
          {nlmError && <div className="alert alert-danger" style={{ marginBottom: 16 }}><i className="fas fa-exclamation-circle"></i> {nlmError}</div>}

          {/* Loading */}
          {nlmLoading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <i className="fas fa-spinner fa-spin fa-2x"></i>
              <p style={{ marginTop: 12 }}>Searching MedlinePlus Genetics (NCBI MedGen)...</p>
            </div>
          )}

          {/* Empty prompt */}
          {!nlmLoading && !nlmError && nlmResults.length === 0 && !nlmDetail && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <i className="fas fa-dna fa-3x" style={{ marginBottom: 16, opacity: 0.3 }}></i>
              <p>Search for any genetic condition using the MedlinePlus Genetics (NCBI MedGen) database.</p>
            </div>
          )}

          {/* Results grid */}
          {nlmResults.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16, marginBottom: 16 }}>
              {nlmResults.map(item => (
                <div
                  key={item.slug}
                  style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#1565C0'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#7C3AED,#4285F4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>🧬</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>{item.name}</div>
                      <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600, marginTop: 1 }}>NLM MedGen</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 12px' }}>{item.snippet}</p>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ width: '100%', background: 'linear-gradient(135deg,#7C3AED,#4285F4)', color: '#fff', border: 'none', justifyContent: 'center' }}
                    onClick={e => { e.preventDefault(); e.stopPropagation(); loadDetail(item.slug, item.name); }}
                  >
                    <i className="fas fa-search-plus" style={{ marginRight: 6 }}></i>Load Full Details
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* NLM detail opens in a modal — see below */}
        </div>
      )}

      {/* NLM Full Detail Modal */}
      {nlmModal && (
        <ErrorBoundary key={String(nlmModal)}>
          <NLMDetailModal
            detail={nlmDetail}
            loading={nlmDetailLoading}
            error={nlmDetailError}
            onImport={openImport}
            onClose={closeNlmModal}
          />
        </ErrorBoundary>
      )}

      {/* Add / Edit Disease Modal */}
      {modal && (
        <DiseaseModal
          title={modal.mode === 'edit' ? 'Edit Genetic Disease' : 'Import / Add Genetic Condition'}
          initial={modal.initial}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
