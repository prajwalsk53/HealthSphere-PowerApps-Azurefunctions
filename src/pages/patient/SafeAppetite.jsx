import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { loadProfile, savePreferences, scanIngredients, deleteScan as deleteScanRecord } from '../../lib/safeAppetite';
import '../../assets/safe-appetite.css';

const COMMON_ALLERGENS = {
  'Peanuts': 'fa-seedling',
  'Tree Nuts': 'fa-tree',
  'Milk / Dairy': 'fa-glass-water',
  'Eggs': 'fa-egg',
  'Wheat / Gluten': 'fa-bread-slice',
  'Soy': 'fa-leaf',
  'Fish': 'fa-fish',
  'Shellfish': 'fa-shrimp',
  'Sesame': 'fa-circle-dot',
  'Mustard': 'fa-droplet',
  'Celery': 'fa-carrot',
  'Lupin': 'fa-spa',
  'Molluscs': 'fa-circle',
  'Sulphites': 'fa-flask',
};

const COMMON_INTOLERANCES = [
  'Lactose', 'Gluten', 'Fructose', 'Histamine', 'Caffeine',
  'Sorbitol', 'Salicylates', 'Artificial Sweeteners', 'MSG', 'Food Colourings',
];

const DIET_OPTIONS = [
  'Vegan', 'Vegetarian', 'Pescatarian', 'Flexitarian',
  'Keto', 'Paleo', 'Low FODMAP', 'Gluten-Free', 'Dairy-Free',
  'Halal', 'Kosher', 'Low Sodium', 'Low Sugar', 'High Protein',
];

const EXAMPLES = {
  chocolate: {
    name: 'Cadbury Dairy Milk Chocolate Bar',
    ingredients: 'Sugar, Cocoa butter, Dried whey (from Milk), Cocoa mass, Dried skimmed milk, Vegetable fats (Palm, Shea), Emulsifier (E442), Flavourings. Milk Chocolate contains: Milk solids 14% minimum, Cocoa solids 25% minimum. May contain nuts.',
  },
  bread: {
    name: 'Hovis Soft White Medium Bread',
    ingredients: 'Wheat Flour (with Calcium, Iron, Niacin, Thiamin), Water, Yeast, Salt, Soya Flour, Rapeseed Oil, Fermented Wheat Flour, Emulsifiers (E471, E481), Flour Treatment Agent (Ascorbic Acid).',
  },
  cereal: {
    name: "Kellogg's Corn Flakes",
    ingredients: 'Maize (Corn), Sugar, Salt, Barley Malt Flavouring, Vitamins and Minerals: Niacinamide (B3), Reduced Iron, Zinc Oxide, Pyridoxine Hydrochloride (B6), Riboflavin (B2), Thiamin Hydrochloride (B1), Folic Acid, Vitamin D.',
  },
  yogurt: {
    name: 'Fage Total 0% Greek Yogurt',
    ingredients: 'Pasteurised Skimmed Milk, Live Cultures (L. Bulgaricus, S. Thermophilus).',
  },
  crisp: {
    name: 'Walkers Ready Salted Crisps',
    ingredients: 'Potatoes, Sunflower Oil, Salt. May contain: Milk, Wheat, Barley, Oats, Rye.',
  },
  sauce: {
    name: 'Dolmio Bolognese Pasta Sauce',
    ingredients: 'Tomatoes (83%), Tomato Puree, Onion, Starch (Modified), Salt, Garlic, Sugar, Herbs, Spices, Citric Acid. May contain: Celery, Gluten.',
  },
};

const RESULT_ICON = { safe: 'fa-check-circle', caution: 'fa-triangle-exclamation', danger: 'fa-xmark-circle' };
const RESULT_LABEL = { safe: 'SAFE', caution: 'CAUTION', danger: 'DANGER' };
const RESULT_EMOJI = { safe: '✅', caution: '⚠️', danger: '🚨' };

const mapResult = (r) => (r === 'warning' ? 'caution' : r);

export default function SafeAppetite() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('scanner');
  const [allergyState, setAllergyState] = useState({});
  const [intoleranceState, setIntoleranceState] = useState({});
  const [dietPrefState, setDietPrefState] = useState(new Set());
  const [dislikeState, setDislikeState] = useState([]);
  const [customAllergen, setCustomAllergen] = useState('');
  const [customAllergenSev, setCustomAllergenSev] = useState('moderate');
  const [dislikeInput, setDislikeInput] = useState('');
  const [productName, setProductName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const data = await loadProfile(user.id);
    setProfile(data);

    const aState = {};
    (data.allergies || []).forEach(a => { aState[a.allergen.toLowerCase()] = { allergen: a.allergen, severity: a.severity }; });
    setAllergyState(aState);

    const iState = {};
    (data.intolerances || []).forEach(i => { iState[i.intolerance.toLowerCase()] = { name: i.intolerance, severity: i.severity }; });
    setIntoleranceState(iState);

    setDietPrefState(new Set((data.dietPrefs || []).map(d => d.preference)));
    setDislikeState((data.dislikes || []).map(d => d.ingredient));
  };

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Allergies ─────────────────────────────────────────────────────
  const toggleAllergen = (name) => {
    const key = name.toLowerCase();
    setAllergyState(prev => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { allergen: name, severity: 'moderate' };
      return next;
    });
  };

  const setAllergenSev = (name, level) => {
    const key = name.toLowerCase();
    setAllergyState(prev => ({ ...prev, [key]: { allergen: name, severity: level } }));
  };

  const addCustomAllergen = () => {
    const name = customAllergen.trim();
    if (!name) return;
    setAllergyState(prev => ({ ...prev, [name.toLowerCase()]: { allergen: name, severity: customAllergenSev } }));
    setCustomAllergen('');
  };

  const removeAllergen = (key) => {
    setAllergyState(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // ── Intolerances ──────────────────────────────────────────────────
  const toggleIntolerance = (name, checked) => {
    const key = name.toLowerCase();
    setIntoleranceState(prev => {
      const next = { ...prev };
      if (checked) { if (!next[key]) next[key] = { name, severity: 'moderate' }; }
      else delete next[key];
      return next;
    });
  };

  const setIntolSev = (name, level) => {
    const key = name.toLowerCase();
    setIntoleranceState(prev => ({ ...prev, [key]: { name, severity: level } }));
  };

  // ── Diet preferences ──────────────────────────────────────────────
  const toggleDiet = (opt) => {
    setDietPrefState(prev => {
      const next = new Set(prev);
      if (next.has(opt)) next.delete(opt); else next.add(opt);
      return next;
    });
  };

  // ── Dislikes ──────────────────────────────────────────────────────
  const addDislike = () => {
    const name = dislikeInput.trim();
    if (!name || dislikeState.includes(name)) { setDislikeInput(''); return; }
    setDislikeState(prev => [...prev, name]);
    setDislikeInput('');
  };

  const removeDislike = (name) => setDislikeState(prev => prev.filter(d => d !== name));

  // ── Save profile ──────────────────────────────────────────────────
  const saveProfile = async () => {
    setSaving(true);
    try {
      await savePreferences(user.id, {
        allergies: Object.values(allergyState),
        intolerances: Object.values(intoleranceState),
        diet_prefs: [...dietPrefState],
        dislikes: dislikeState,
      });
      await load();
      showToast('Profile saved successfully!', 'success');
    } catch {
      showToast('Save failed. Please try again.', 'error');
    }
    setSaving(false);
  };

  // ── Scanner ───────────────────────────────────────────────────────
  const loadExample = (key) => {
    const ex = EXAMPLES[key];
    setProductName(ex.name);
    setIngredients(ex.ingredients);
  };

  const clearScan = () => {
    setProductName('');
    setIngredients('');
    setScanResult(null);
    setScanError('');
  };

  const runScan = async () => {
    if (scanning) return;
    if (!productName.trim() && !ingredients.trim()) {
      showToast('Please enter a product name or paste an ingredients list.', 'error');
      return;
    }
    setScanning(true);
    setScanResult(null);
    setScanError('');
    try {
      const data = await scanIngredients(user.id, productName, ingredients);
      setScanResult(data);
      setProfile(prev => prev ? { ...prev, scans: [data.scan_result, ...prev.scans].slice(0, 10) } : prev);
    } catch (err) {
      setScanError(err.message || 'Connection error. Please try again.');
    }
    setScanning(false);
  };

  const deleteScan = async (id) => {
    if (!window.confirm('Delete this scan from history?')) return;
    await deleteScanRecord(id);
    setProfile(prev => ({ ...prev, scans: prev.scans.filter(s => s.id !== id) }));
    showToast('Scan deleted.', 'success');
  };

  if (!profile) return <div className="loading"><div className="spinner" /></div>;

  const presetKeys = Object.keys(COMMON_ALLERGENS).map(k => k.toLowerCase());
  const customAllergens = Object.entries(allergyState).filter(([key]) => !presetKeys.includes(key));

  return (
    <div className="sa-page">
      <div className="sa-actionbar">
        {saving && <span className="sa-saving"><i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--hs-blue)' }}></i> Saving…</span>}
        <button className="btn-hs btn-primary-hs btn-sm-hs" onClick={saveProfile} disabled={saving}>
          <i className="fas fa-save"></i> Save Profile
        </button>
      </div>

      {/* Hero banner */}
      <div className="sa-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1 }}>
          <div className="sa-hero-icon">🛡️</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.3px' }}>Your Food Safety Hub</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', marginTop: 4, maxWidth: 540 }}>
              Set your allergies, intolerances &amp; dietary preferences once. Then scan any food label instantly — AI checks every ingredient against your personal profile and warns you before you eat.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(255,255,255,.15)', borderRadius: 20, padding: '5px 14px', fontSize: 11.5, fontWeight: 700 }}><i className="fas fa-ban"></i> {profile.allergies.length} Food Allergies</span>
              <span style={{ background: 'rgba(255,255,255,.15)', borderRadius: 20, padding: '5px 14px', fontSize: 11.5, fontWeight: 700 }}><i className="fas fa-triangle-exclamation"></i> {profile.intolerances.length} Intolerances</span>
              <span style={{ background: 'rgba(255,255,255,.15)', borderRadius: 20, padding: '5px 14px', fontSize: 11.5, fontWeight: 700 }}><i className="fas fa-leaf"></i> {profile.dietPrefs.length} Diet Prefs</span>
              <span style={{ background: 'rgba(255,255,255,.15)', borderRadius: 20, padding: '5px 14px', fontSize: 11.5, fontWeight: 700 }}><i className="fas fa-barcode"></i> {profile.scans.length} Scans Done</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0, marginLeft: 24 }}>
          <div className="sa-score-ring" style={{ '--score': profile.profileScore }}>
            <div className="sa-score-inner">
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{profile.profileScore}%</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>PROFILE</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginTop: 6 }}>Profile complete</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sa-tabs">
        <button className={`sa-tab${activeTab === 'scanner' ? ' active' : ''}`} onClick={() => setActiveTab('scanner')}>
          <i className="fas fa-magnifying-glass"></i> Ingredient Scanner
        </button>
        <button className={`sa-tab${activeTab === 'allergies' ? ' active' : ''}`} onClick={() => setActiveTab('allergies')}>
          <i className="fas fa-ban"></i> Allergies
          {profile.allergies.length > 0 && <span className="sa-tab-badge" style={{ background: 'rgba(220,38,38,.15)', color: '#DC2626' }}>{profile.allergies.length}</span>}
        </button>
        <button className={`sa-tab${activeTab === 'intolerances' ? ' active' : ''}`} onClick={() => setActiveTab('intolerances')}>
          <i className="fas fa-triangle-exclamation"></i> Intolerances
        </button>
        <button className={`sa-tab${activeTab === 'diet' ? ' active' : ''}`} onClick={() => setActiveTab('diet')}>
          <i className="fas fa-leaf"></i> Diet &amp; Dislikes
        </button>
        <button className={`sa-tab${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>
          <i className="fas fa-clock-rotate-left"></i> Scan History
          {profile.scans.length > 0 && <span className="sa-tab-badge" style={{ background: '#DBEAFE', color: 'var(--hs-blue)' }}>{profile.scans.length}</span>}
        </button>
      </div>

      {/* PANEL: SCANNER */}
      {activeTab === 'scanner' && (
        <div className="sa-scanner-grid">
          <div>
            <div className="hs-card">
              <div className="hs-card-header">
                <span className="card-title"><i className="fas fa-magnifying-glass-plus" style={{ color: 'var(--sa-blue)' }}></i> Scan Ingredients</span>
                <span style={{ fontSize: 11, background: '#DBEAFE', color: 'var(--sa-blue)', padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}><i className="fas fa-shield-heart"></i> Smart Scan</span>
              </div>
              <div className="hs-card-body">
                <div style={{ marginBottom: 14 }}>
                  <label className="form-label">Product Name <span style={{ color: 'var(--hs-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input type="text" className="form-control" placeholder="e.g. Cadbury Dairy Milk, Kellogg's Corn Flakes…"
                    value={productName} onChange={e => setProductName(e.target.value)} />
                </div>

                <div className="scan-box">
                  <i className="fas fa-list-ul" style={{ fontSize: 28, color: '#93C5FD', marginBottom: 10 }}></i>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--hs-navy)', marginBottom: 6 }}>Paste Ingredients List</div>
                  <div style={{ fontSize: 12, color: 'var(--hs-muted)', marginBottom: 14 }}>Copy from a food label or packaging</div>
                  <textarea className="scan-textarea" rows={5}
                    placeholder="e.g. Wheat flour, Sugar, Palm oil, Cocoa (3%), Skimmed milk powder, Emulsifier (lecithin), Natural vanilla flavouring…"
                    value={ingredients} onChange={e => setIngredients(e.target.value)} />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--hs-muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Quick Examples</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button className="quick-pill" onClick={() => loadExample('chocolate')}>🍫 Chocolate Bar</button>
                    <button className="quick-pill" onClick={() => loadExample('bread')}>🍞 White Bread</button>
                    <button className="quick-pill" onClick={() => loadExample('cereal')}>🥣 Breakfast Cereal</button>
                    <button className="quick-pill" onClick={() => loadExample('yogurt')}>🥛 Greek Yogurt</button>
                    <button className="quick-pill" onClick={() => loadExample('crisp')}>🥔 Crisps / Chips</button>
                    <button className="quick-pill" onClick={() => loadExample('sauce')}>🫙 Pasta Sauce</button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn-hs btn-primary-hs" style={{ flex: 1, justifyContent: 'center' }} onClick={runScan} disabled={scanning}>
                    <i className="fas fa-shield-heart"></i> Scan Ingredients
                  </button>
                  <button className="btn-hs btn-outline-hs" onClick={clearScan}>
                    <i className="fas fa-rotate-left"></i> Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Result area */}
            {scanning && (
              <div className="scan-spinner">
                <div className="spin-ring"></div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--hs-navy)' }}>Scanning ingredients…</div>
                <div style={{ fontSize: 12, color: 'var(--hs-muted)' }}>AI is checking against your personal profile</div>
              </div>
            )}
            {!scanning && scanError && (
              <div className="scan-result-box result-caution"><b><i className="fas fa-circle-exclamation"></i> Error:</b> {scanError}</div>
            )}
            {!scanning && scanResult && (
              <ScanResultBox result={scanResult.result} productName={productName} />
            )}
          </div>

          {/* Right column */}
          <div>
            <div className="hs-card" style={{ marginBottom: 16 }}>
              <div className="hs-card-header"><span className="card-title"><i className="fas fa-id-card-clip"></i> Your Safety Profile</span></div>
              <div className="hs-card-body">
                {profile.allergies.length > 0 ? (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--hs-muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}><i className="fas fa-ban" style={{ color: 'var(--sa-red)' }}></i> ALLERGIES</div>
                    {profile.allergies.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: a.severity === 'severe' ? '#FEF2F2' : a.severity === 'moderate' ? '#FFFBEB' : '#F0FDF4', borderRadius: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--hs-navy)' }}>{a.allergen}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: a.severity === 'severe' ? '#DC2626' : a.severity === 'moderate' ? '#D97706' : '#16A34A', color: '#fff' }}>{a.severity.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--hs-muted)', padding: 10, background: '#FEF9C3', borderRadius: 8, marginBottom: 12 }}>
                    <i className="fas fa-circle-exclamation" style={{ color: '#D97706' }}></i> No allergies set — <a href="#" onClick={e => { e.preventDefault(); setActiveTab('allergies'); }} style={{ color: 'var(--hs-blue)' }}>add them</a>
                  </div>
                )}

                {profile.intolerances.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--hs-muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}><i className="fas fa-triangle-exclamation" style={{ color: 'var(--sa-amber)' }}></i> INTOLERANCES</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {profile.intolerances.map(i => (
                        <span key={i.id} style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '3px 10px', fontSize: 11.5, fontWeight: 600, color: '#92400E' }}>{i.intolerance}</span>
                      ))}
                    </div>
                  </div>
                )}

                {profile.dietPrefs.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--hs-muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}><i className="fas fa-leaf" style={{ color: 'var(--sa-green)' }}></i> DIET PREFERENCES</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {profile.dietPrefs.map(p => (
                        <span key={p.id} style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 8, padding: '3px 10px', fontSize: 11.5, fontWeight: 600, color: '#166534' }}>{p.preference}</span>
                      ))}
                    </div>
                  </div>
                )}

                {profile.allergies.length === 0 && profile.intolerances.length === 0 && profile.dietPrefs.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>👤</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--hs-navy)', marginBottom: 6 }}>Profile Empty</div>
                    <div style={{ fontSize: 12, color: 'var(--hs-muted)' }}>Set your allergies and preferences in the tabs above so the AI can protect you during scans.</div>
                    <button className="btn-hs btn-primary-hs btn-sm-hs" style={{ marginTop: 12 }} onClick={() => setActiveTab('allergies')}><i className="fas fa-plus"></i> Set Up Profile</button>
                  </div>
                )}
              </div>
            </div>

            <div className="hs-card">
              <div className="hs-card-header"><span className="card-title"><i className="fas fa-circle-info"></i> How It Works</span></div>
              <div className="hs-card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    ['1', 'Paste the ingredients list from any food packaging into the scanner.', '#1565C0'],
                    ['2', 'AI cross-checks every ingredient against your allergies, intolerances & diet preferences — including hidden ingredient names.', '#16A34A'],
                    ['3', 'Get an instant SAFE / CAUTION / DANGER result with specific alerts for anything flagged.', '#D97706'],
                    ['4', "Your scan history is saved so you can quickly check products you've scanned before.", '#7C3AED'],
                  ].map(step => (
                    <div key={step[0]} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: step[2], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{step[0]}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--hs-text)', lineHeight: 1.5 }}>{step[1]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANEL: ALLERGIES */}
      {activeTab === 'allergies' && (
        <div className="hs-card">
          <div className="hs-card-header">
            <span className="card-title"><i className="fas fa-ban" style={{ color: 'var(--sa-red)' }}></i> Food Allergies</span>
            <span style={{ fontSize: 12, color: 'var(--hs-muted)' }}>Select all that apply and set severity</span>
          </div>
          <div className="hs-card-body">
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#991B1B' }}>
              <i className="fas fa-circle-exclamation"></i> <strong>Important:</strong> This information helps the AI warn you about food products. Always consult your doctor for medical diagnosis.
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--hs-navy)', marginBottom: 14 }}>Common Food Allergens (Big 14)</div>
            <div className="allergen-grid">
              {Object.entries(COMMON_ALLERGENS).map(([name, icon]) => {
                const key = name.toLowerCase();
                const sev = allergyState[key]?.severity;
                return (
                  <div key={name} className={`allergen-chip${sev ? ` selected-${sev}` : ''}`} onClick={() => toggleAllergen(name)}>
                    <div className="chip-check"><i className="fas fa-check"></i></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i className={`fas ${icon}`} style={{ fontSize: 18, color: 'var(--hs-blue)' }}></i>
                      <div className="chip-name">{name}</div>
                    </div>
                    <div className="sev-btns">
                      {['mild', 'moderate', 'severe'].map(level => (
                        <button key={level} className={`sev-btn${sev === level ? ` active-${level}` : ''}`}
                          onClick={e => { e.stopPropagation(); setAllergenSev(name, level); }}>
                          {level === 'mild' ? 'Mild' : level === 'moderate' ? 'Moderate' : 'Severe'}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--hs-border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--hs-navy)', marginBottom: 12 }}>Add a Custom Allergy</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input type="text" className="form-control" style={{ flex: 1, minWidth: 200 }} placeholder="e.g. Kiwi, Latex, Pine nuts…"
                  value={customAllergen} onChange={e => setCustomAllergen(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomAllergen(); } }} />
                <select className="form-select" style={{ width: 130 }} value={customAllergenSev} onChange={e => setCustomAllergenSev(e.target.value)}>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
                <button className="btn-hs btn-primary-hs" onClick={addCustomAllergen}><i className="fas fa-plus"></i> Add</button>
              </div>
              <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {customAllergens.map(([key, a]) => (
                  <div key={key} className="dislike-tag">
                    <i className="fas fa-ban" style={{ color: 'var(--sa-red)', fontSize: 10 }}></i>
                    {a.allergen}
                    <span style={{ fontSize: 10, padding: '1px 6px', background: a.severity === 'severe' ? '#DC2626' : a.severity === 'moderate' ? '#D97706' : '#16A34A', color: '#fff', borderRadius: 8 }}>{a.severity}</span>
                    <button onClick={() => removeAllergen(key)}>×</button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <button className="btn-hs btn-primary-hs" onClick={saveProfile} disabled={saving}><i className="fas fa-save"></i> Save Allergies</button>
            </div>
          </div>
        </div>
      )}

      {/* PANEL: INTOLERANCES */}
      {activeTab === 'intolerances' && (
        <div className="hs-card">
          <div className="hs-card-header">
            <span className="card-title"><i className="fas fa-triangle-exclamation" style={{ color: 'var(--sa-amber)' }}></i> Food Intolerances</span>
            <span style={{ fontSize: 12, color: 'var(--hs-muted)' }}>Intolerances cause discomfort but not severe allergic reactions</span>
          </div>
          <div className="hs-card-body">
            <div className="intol-grid">
              {COMMON_INTOLERANCES.map(intol => {
                const key = intol.toLowerCase();
                const entry = intoleranceState[key];
                const checked = !!entry;
                const sev = entry?.severity || 'moderate';
                return (
                  <div key={intol} className="intol-row">
                    <input type="checkbox" id={`intol-${key}`} checked={checked}
                      onChange={e => toggleIntolerance(intol, e.target.checked)} />
                    <label htmlFor={`intol-${key}`}>{intol}</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['mild', 'moderate', 'severe'].map(level => (
                        <button key={level} className={`sev-btn${checked && sev === level ? ` active-${level}` : ''}`}
                          onClick={() => setIntolSev(intol, level)}>
                          {level === 'mild' ? 'Mild' : level === 'moderate' ? 'Mod' : 'Sev'}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 20 }}>
              <button className="btn-hs btn-primary-hs" onClick={saveProfile} disabled={saving}><i className="fas fa-save"></i> Save Intolerances</button>
            </div>
          </div>
        </div>
      )}

      {/* PANEL: DIET & DISLIKES */}
      {activeTab === 'diet' && (
        <>
          <div className="sa-diet-grid">
            <div className="hs-card">
              <div className="hs-card-header">
                <span className="card-title"><i className="fas fa-leaf" style={{ color: 'var(--sa-green)' }}></i> Dietary Preferences</span>
              </div>
              <div className="hs-card-body">
                <p style={{ fontSize: 13, color: 'var(--hs-muted)', marginBottom: 16 }}>Select all that apply to your diet. The AI will warn if a scanned product conflicts with these.</p>
                <div className="diet-grid">
                  {DIET_OPTIONS.map(opt => (
                    <button key={opt} className={`diet-badge${dietPrefState.has(opt) ? ' active' : ''}`} onClick={() => toggleDiet(opt)}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="hs-card">
              <div className="hs-card-header">
                <span className="card-title"><i className="fas fa-thumbs-down" style={{ color: 'var(--hs-muted)' }}></i> Ingredient Dislikes</span>
              </div>
              <div className="hs-card-body">
                <p style={{ fontSize: 13, color: 'var(--hs-muted)', marginBottom: 16 }}>Ingredients you personally dislike. The AI will flag these as informational (not a safety warning).</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input type="text" className="form-control" placeholder="e.g. Cilantro, Anchovies, Olives…"
                    value={dislikeInput} onChange={e => setDislikeInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDislike(); } }} />
                  <button className="btn-hs btn-primary-hs btn-sm-hs" onClick={addDislike}><i className="fas fa-plus"></i></button>
                </div>
                <div>
                  {dislikeState.map(d => (
                    <span key={d} className="dislike-tag">
                      {d}
                      <button onClick={() => removeDislike(d)}>×</button>
                    </span>
                  ))}
                </div>
                {dislikeState.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--hs-muted)', fontStyle: 'italic' }}>No dislikes added yet.</div>
                )}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="btn-hs btn-primary-hs" onClick={saveProfile} disabled={saving}><i className="fas fa-save"></i> Save Diet Preferences &amp; Dislikes</button>
          </div>
        </>
      )}

      {/* PANEL: HISTORY */}
      {activeTab === 'history' && (
        <div className="hs-card">
          <div className="hs-card-header">
            <span className="card-title"><i className="fas fa-clock-rotate-left"></i> Recent Scans</span>
            <span style={{ fontSize: 12, color: 'var(--hs-muted)' }}>Last 10 scans saved</span>
          </div>
          <div className="hs-card-body">
            {profile.scans.length > 0 ? profile.scans.map(scan => {
              const result = mapResult(scan.result);
              return (
                <div key={scan.id} className="hist-card">
                  <div className={`hist-dot ${result}`}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--hs-navy)' }}>{scan.productName || 'Unknown Product'}</div>
                    {scan.aiSummary && (
                      <div style={{ fontSize: 12, color: 'var(--hs-muted)', marginTop: 3, lineHeight: 1.4 }}>{scan.aiSummary.slice(0, 120)}...</div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--hs-muted)', marginTop: 4 }}><i className="fas fa-clock" style={{ fontSize: 10 }}></i> {new Date(scan.createdAt).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`result-badge ${result}`} style={{ padding: '5px 14px', fontSize: 12 }}>
                      <i className={`fas ${RESULT_ICON[result]}`}></i> {RESULT_LABEL[result]}
                    </span>
                    <button onClick={() => deleteScan(scan.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 14 }} title="Delete scan">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              );
            }) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 14 }}>🔍</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--hs-navy)', marginBottom: 8 }}>No Scans Yet</div>
                <div style={{ fontSize: 13, color: 'var(--hs-muted)', marginBottom: 16 }}>Use the Ingredient Scanner to analyse food products. Your scan history will appear here.</div>
                <button className="btn-hs btn-primary-hs" onClick={() => setActiveTab('scanner')}><i className="fas fa-magnifying-glass"></i> Start Scanning</button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={`sa-toast ${toast.type}`}>
          <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-xmark-circle'}`}></i> {toast.msg}
        </div>
      )}
    </div>
  );
}

function ScanResultBox({ result, productName }) {
  const overall = (result.overall || 'safe').toLowerCase();
  const alerts = result.alerts || [];
  const safeHighlights = result.safe_highlights || [];
  const summary = result.summary || '';
  const tip = result.tip || '';

  return (
    <div className={`scan-result-box result-${overall}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <span className={`result-badge ${overall}`}>
            <i className={`fas ${RESULT_ICON[overall]}`}></i> {RESULT_EMOJI[overall]} {RESULT_LABEL[overall] || overall.toUpperCase()}
          </span>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--hs-navy)', marginTop: 6 }}>{productName.trim() || 'Product'}</div>
        </div>
        {alerts.length > 0 && (
          <div style={{ fontSize: 13, fontWeight: 700, color: overall === 'danger' ? 'var(--sa-red)' : overall === 'caution' ? 'var(--sa-amber)' : 'var(--sa-green)' }}>
            {alerts.length} item{alerts.length > 1 ? 's' : ''} flagged
          </div>
        )}
      </div>

      {summary && (
        <div style={{ fontSize: 13, color: 'var(--hs-text)', marginBottom: 16, padding: '12px 16px', background: 'rgba(255,255,255,.6)', borderRadius: 10, lineHeight: 1.6 }}>{summary}</div>
      )}

      {alerts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--hs-muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Flagged Ingredients</div>
          {alerts.map((a, idx) => {
            const type = a.type || 'INFO';
            const iconFA = type === 'DANGER' ? 'fa-ban' : type === 'CAUTION' ? 'fa-triangle-exclamation' : 'fa-circle-info';
            return (
              <div key={idx} className={`alert-item t-${type}`}>
                <div className="alert-icon"><i className={`fas ${iconFA}`}></i></div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--hs-navy)' }}>{a.ingredient || ''}</div>
                  <div style={{ fontSize: 12, color: 'var(--hs-muted)', marginTop: 2 }}>{a.reason || ''}</div>
                  {a.matches && a.matches.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--hs-blue)', marginTop: 3, fontWeight: 600 }}><i className="fas fa-link"></i> Matches: {a.matches.join(', ')}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {safeHighlights.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}><i className="fas fa-thumbs-up"></i> Safe Highlights</div>
          <div>
            {safeHighlights.map((s, idx) => (
              <span key={idx} className="safe-pill"><i className="fas fa-check"></i> {s}</span>
            ))}
          </div>
        </div>
      )}

      {tip && (
        <div style={{ background: 'rgba(255,255,255,.7)', borderRadius: 10, padding: '12px 16px', fontSize: 12.5, color: 'var(--hs-muted)', borderLeft: '3px solid var(--sa-blue)' }}>
          <i className="fas fa-lightbulb" style={{ color: 'var(--sa-blue)' }}></i> <strong>Tip:</strong> {tip}
        </div>
      )}

      {alerts.length === 0 && overall === 'safe' && (
        <div style={{ textAlign: 'center', padding: 10 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sa-green)' }}>All clear! No allergens or violations detected.</div>
        </div>
      )}
    </div>
  );
}
