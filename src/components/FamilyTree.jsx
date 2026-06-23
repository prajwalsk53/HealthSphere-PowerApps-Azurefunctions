import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Hs_familyhistoriesService } from '../generated/services/Hs_familyhistoriesService';

const HIGH_K = ['heart', 'cancer', 'stroke', 'hypertension', 'cholesterol', 'diabetes', 'brca', 'coronary', 'atrial', 'angina', 'fibrillation'];
const MID_K = ['thyroid', 'calcium', 'arthritis', 'anxiety', 'obesity', 'asthma', 'eczema', 'osteoporosis', 'fatty liver', 'degeneration'];

const RISK_NOTES = {
  heart: 'Family history of heart disease doubles your cardiovascular risk. Discuss heart health screening with your GP.',
  coronary: 'Coronary artery disease has strong hereditary components. Regular BP and cholesterol checks are essential.',
  stroke: 'Family history of stroke increases your risk by up to 50%. Monitor BP, cholesterol and AF symptoms.',
  hypertension: 'Hypertension in a first-degree relative raises your lifetime risk by 25–50%. Regular monitoring is recommended.',
  cholesterol: 'Familial hypercholesterolaemia is inherited. A fasting lipid panel is strongly recommended for you.',
  diabetes: 'Type 2 diabetes risk increases up to 40% with an affected parent or sibling. Annual HbA1c screening advised.',
  cancer: 'Some cancers have genetic components. Discuss family history and screening schedules with your GP.',
  brca: 'BRCA gene variants significantly elevate breast/ovarian cancer risk. Genetic counselling is urgently recommended.',
  thyroid: 'Thyroid disorders and thyroid cancer can run in families. Annual TSH monitoring is prudent.',
  anxiety: 'Anxiety disorders have hereditary elements. CBT and mindfulness can be effective preventative strategies.',
  obesity: 'Obesity risk is partly hereditary. Combined with your diabetes family history, weight management is important.',
  atrial: 'Atrial fibrillation has genetic components and raises stroke risk. Report palpitations to your GP.',
  osteoporosis: 'Osteoporosis is partly hereditary. Ensure adequate calcium/vitamin D and consider a DEXA scan.',
};

const PILL_MAP = {
  heart: 'red', cancer: 'red', stroke: 'red', hypertension: 'red', cholesterol: 'red', brca: 'red', diabetes: 'red', coronary: 'red', atrial: 'red',
  thyroid: 'orange', anxiety: 'orange', obesity: 'orange', asthma: 'orange', arthritis: 'orange', calcium: 'orange', eczema: 'orange', fatty: 'orange',
};

function riskColor(conds) {
  const t = conds.map(c => c.conditionName.toLowerCase()).join(' ');
  if (HIGH_K.some(k => t.includes(k))) return '#DC2626';
  if (MID_K.some(k => t.includes(k))) return '#D97706';
  return '#16A34A';
}

function condColor(name) {
  const t = name.toLowerCase();
  if (HIGH_K.some(k => t.includes(k))) return '#DC2626';
  if (MID_K.some(k => t.includes(k))) return '#D97706';
  return '#16A34A';
}
const condBg = (c) => ({ '#DC2626': '#FEE2E2', '#D97706': '#FEF3C7', '#16A34A': '#DCFCE7' }[c] || '#F1F5F9');

function CondPills({ conds, max = 2 }) {
  if (!conds.length) return <span className="cpill cpill-grey">No data</span>;
  return (
    <>
      {conds.slice(0, max).map((c, i) => {
        let cls = 'green';
        const t = c.conditionName.toLowerCase();
        for (const [k, v] of Object.entries(PILL_MAP)) { if (t.includes(k)) { cls = v; break; } }
        const short = c.conditionName.length > 21 ? c.conditionName.slice(0, 19) + '…' : c.conditionName;
        return <span key={i} className={`cpill cpill-${cls}`}>{short}</span>;
      })}
      {conds.length > max && <span className="cpill cpill-grey">+{conds.length - max} more</span>}
    </>
  );
}

function fGrpByPerson(records) {
  const out = {};
  for (const r of records) (out[r.relationName] ||= []).push(r);
  return out;
}
function shortName(n) { return (n || '').split(' (')[0]; }

function FCard({ avatar, name, rel, conds = [], placeholder = false, you = false, deceased = false, decYear = null, onClick }) {
  const cls = ['fcard', placeholder && 'fcard-ph', you && 'fcard-you'].filter(Boolean).join(' ');
  const rc = !placeholder && !you ? riskColor(conds) : 'transparent';
  return (
    <div className={cls} onClick={!placeholder && !you ? onClick : undefined}>
      {deceased && <span className="fcard-dec">Deceased{decYear ? ` ${decYear}` : ''}</span>}
      <span className="fcard-av">{avatar}</span>
      <div className="fcard-name">{name}</div>
      <div className="fcard-rel">{rel}</div>
      <div className="fcard-pills">
        {you ? <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>You</span> : <CondPills conds={conds} />}
      </div>
      <div className="fcard-riskbar" style={{ background: rc }} />
    </div>
  );
}

function FPlaceholder({ avatar, rel }) {
  return <FCard avatar={avatar} name="Unknown" rel={rel} placeholder />;
}

function EmptyBox({ lines, tall = true }) {
  return (
    <div style={{ width: 136, height: tall ? 166 : 140, border: '2px dashed var(--border)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: .35 }}>
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
        {lines.map((l, i) => <span key={i}>{l}{i < lines.length - 1 && <br />}</span>)}
      </div>
    </div>
  );
}

export default function FamilyTree({ familyHistory, user, onAdded }) {
  const { user: currentUser } = useAuth();
  const [person, setPerson] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ relation: '', relation_name: '', condition_name: '', year_diagnosed: '', year_deceased: '', notes: '' });

  const famByRel = {};
  for (const f of familyHistory) (famByRel[f.relation] ||= []).push(f);

  const pgfR = famByRel.grandfather_paternal || [];
  const pgmR = famByRel.grandmother_paternal || [];
  const mgfR = famByRel.grandfather_maternal || [];
  const mgmR = famByRel.grandmother_maternal || [];
  const fatR = famByRel.father || [];
  const motR = famByRel.mother || [];
  const brtR = famByRel.brother || [];
  const sisR = famByRel.sister || [];
  const uncPat = fGrpByPerson(famByRel.uncle_paternal || []);
  const auntPat = fGrpByPerson(famByRel.aunt_paternal || []);
  const uncMat = fGrpByPerson(famByRel.uncle_maternal || []);
  const auntMat = fGrpByPerson(famByRel.aunt_maternal || []);
  const couPat = fGrpByPerson(famByRel.cousin_paternal || []);
  const couMat = fGrpByPerson(famByRel.cousin_maternal || []);

  const totalMembers = new Set(familyHistory.map(f => f.relationName)).size;
  const totalConds = familyHistory.length;

  const openPerson = (name, rel, av, conds, dec, decYr) => setPerson({ name, rel, av, conds, dec, decYr });

  const submitAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Hs_familyhistoriesService.create({
        'hs_User@odata.bind': `/hs_users(${currentUser.id})`,
        hs_relation: form.relation,
        hs_relationname: form.relation_name || undefined,
        hs_conditionname: form.condition_name,
        hs_diagnosisyear: form.year_diagnosed ? Number(form.year_diagnosed) : undefined,
        hs_yeardeceased: form.year_deceased ? Number(form.year_deceased) : undefined,
        hs_notes: form.notes || undefined,
      });
      setShowAdd(false);
      setForm({ relation: '', relation_name: '', condition_name: '', year_diagnosed: '', year_deceased: '', notes: '' });
      onAdded?.();
    } finally { setSaving(false); }
  };

  return (
    <div className="ft-page">
      <div className="ft-hdr">
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#0A1F44,#1565C0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🧬</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)' }}>Family Medical Tree</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{totalMembers} members &middot; {totalConds} conditions &middot; Click any card for full details &amp; genetic risk</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><i className="fas fa-plus" /> Add Member</button>
      </div>

      <div className="ft-scroll">
        <div className="ft-inner">
          <div className="ftree-v2">

            {/* ROW 1 — YOU + SIBLINGS */}
            <div className="ft-row" style={{ gap: 0, justifyContent: 'center', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', paddingTop: 30 }}>
                {Object.entries(fGrpByPerson(brtR)).map(([nm, cs]) => (
                  <div key={nm} style={{ display: 'flex', alignItems: 'center' }}>
                    <FCard avatar="👦" name={shortName(nm)} rel="Brother" conds={cs} onClick={() => openPerson(shortName(nm), 'Brother', '👦', cs)} />
                    <div className="c-h" style={{ width: 16 }} />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--primary-light)', marginBottom: 8, padding: '3px 12px', background: '#DBEAFE', borderRadius: 20 }}>You</div>
                <FCard avatar="🧑" name={user?.name || 'You'} rel="You" you />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', paddingTop: 30 }}>
                {Object.entries(fGrpByPerson(sisR)).map(([nm, cs]) => (
                  <div key={nm} style={{ display: 'flex', alignItems: 'center' }}>
                    <div className="c-h" style={{ width: 16 }} />
                    <FCard avatar="👧" name={shortName(nm)} rel="Sister" conds={cs} onClick={() => openPerson(shortName(nm), 'Sister', '👧', cs)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="c-center-v"><div className="c-v" style={{ height: 36 }} /></div>

            {/* ROW 2 — PARENTS */}
            <div className="ft-row" style={{ gap: 0, justifyContent: 'center', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="sec-label" style={{ color: '#1565C0', background: '#DBEAFE' }}>Maternal Side</div>
                {motR.length
                  ? <FCard avatar="👩" name={motR[0].relationName} rel="Mother" conds={motR} deceased={!!motR[0].yearDeceased} decYear={motR[0].yearDeceased}
                      onClick={() => openPerson(motR[0].relationName, 'Mother', '👩', motR, !!motR[0].yearDeceased, motR[0].yearDeceased)} />
                  : <FPlaceholder avatar="👩" rel="Mother" />}
              </div>
              <div className="c-h" style={{ width: 70, marginTop: 66 }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="sec-label" style={{ color: '#7C3AED', background: '#EDE9FE' }}>Paternal Side</div>
                {fatR.length
                  ? <FCard avatar="👨" name={fatR[0].relationName} rel="Father" conds={fatR} deceased={!!fatR[0].yearDeceased} decYear={fatR[0].yearDeceased}
                      onClick={() => openPerson(fatR[0].relationName, 'Father', '👨', fatR, !!fatR[0].yearDeceased, fatR[0].yearDeceased)} />
                  : <FPlaceholder avatar="👨" rel="Father" />}
              </div>
            </div>

            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-around', padding: '0 120px' }}>
              <div className="c-v" style={{ height: 36 }} />
              <div className="c-v" style={{ height: 36 }} />
            </div>

            {/* ROW 3 — GRANDPARENTS */}
            <div className="ft-row" style={{ gap: 60, justifyContent: 'center', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                <div className="sec-label" style={{ color: '#1565C0', background: '#EFF6FF' }}>Mother's Parents</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {mgfR.length
                    ? <FCard avatar="👴" name={mgfR[0].relationName} rel="Mat. Grandfather" conds={mgfR} deceased={!!mgfR[0].yearDeceased} decYear={mgfR[0].yearDeceased}
                        onClick={() => openPerson(mgfR[0].relationName, 'Mat. Grandfather', '👴', mgfR, !!mgfR[0].yearDeceased, mgfR[0].yearDeceased)} />
                    : <FPlaceholder avatar="👴" rel="Mat. Grandfather" />}
                  <div className="c-h" style={{ width: 32 }} />
                  {mgmR.length
                    ? <FCard avatar="👵" name={mgmR[0].relationName} rel="Mat. Grandmother" conds={mgmR} deceased={!!mgmR[0].yearDeceased} decYear={mgmR[0].yearDeceased}
                        onClick={() => openPerson(mgmR[0].relationName, 'Mat. Grandmother', '👵', mgmR, !!mgmR[0].yearDeceased, mgmR[0].yearDeceased)} />
                    : <FPlaceholder avatar="👵" rel="Mat. Grandmother" />}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                <div className="sec-label" style={{ color: '#7C3AED', background: '#F5F3FF' }}>Father's Parents</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {pgfR.length
                    ? <FCard avatar="👴" name={pgfR[0].relationName} rel="Pat. Grandfather" conds={pgfR} deceased={!!pgfR[0].yearDeceased} decYear={pgfR[0].yearDeceased}
                        onClick={() => openPerson(pgfR[0].relationName, 'Pat. Grandfather', '👴', pgfR, !!pgfR[0].yearDeceased, pgfR[0].yearDeceased)} />
                    : <FPlaceholder avatar="👴" rel="Pat. Grandfather" />}
                  <div className="c-h" style={{ width: 32 }} />
                  {pgmR.length
                    ? <FCard avatar="👵" name={pgmR[0].relationName} rel="Pat. Grandmother" conds={pgmR} deceased={!!pgmR[0].yearDeceased} decYear={pgmR[0].yearDeceased}
                        onClick={() => openPerson(pgmR[0].relationName, 'Pat. Grandmother', '👵', pgmR, !!pgmR[0].yearDeceased, pgmR[0].yearDeceased)} />
                    : <FPlaceholder avatar="👵" rel="Pat. Grandmother" />}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-around', padding: '0 120px' }}>
              <div className="c-v" style={{ height: 36 }} />
              <div className="c-v" style={{ height: 36 }} />
            </div>

            {/* ROW 4 — AUNTS & UNCLES */}
            <div className="ft-row" style={{ gap: 60, justifyContent: 'center', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                {(Object.keys(uncMat).length || Object.keys(auntMat).length) ? (
                  <>
                    <div className="sec-label" style={{ color: '#1565C0', background: '#EFF6FF' }}>Mother's Siblings</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {Object.entries(uncMat).map(([nm, cs]) => (
                        <FCard key={nm} avatar="👨‍💼" name={shortName(nm)} rel="Mother's Brother" conds={cs} onClick={() => openPerson(shortName(nm), "Mother's Brother", '👨‍💼', cs)} />
                      ))}
                      {Object.entries(auntMat).map(([nm, cs]) => (
                        <FCard key={nm} avatar="👩‍💼" name={shortName(nm)} rel="Mother's Sister" conds={cs} onClick={() => openPerson(shortName(nm), "Mother's Sister", '👩‍💼', cs)} />
                      ))}
                    </div>
                  </>
                ) : <EmptyBox lines={['No maternal', 'aunts/uncles', 'recorded']} />}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                {(Object.keys(uncPat).length || Object.keys(auntPat).length) ? (
                  <>
                    <div className="sec-label" style={{ color: '#7C3AED', background: '#F5F3FF' }}>Father's Siblings</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {Object.entries(uncPat).map(([nm, cs]) => (
                        <FCard key={nm} avatar="👨‍💼" name={shortName(nm)} rel="Father's Brother" conds={cs} onClick={() => openPerson(shortName(nm), "Father's Brother", '👨‍💼', cs)} />
                      ))}
                      {Object.entries(auntPat).map(([nm, cs]) => (
                        <FCard key={nm} avatar="👩‍💼" name={shortName(nm)} rel="Father's Sister" conds={cs} onClick={() => openPerson(shortName(nm), "Father's Sister", '👩‍💼', cs)} />
                      ))}
                    </div>
                  </>
                ) : <EmptyBox lines={['No paternal', 'aunts/uncles', 'recorded']} />}
              </div>
            </div>

            {/* ROW 5 — COUSINS */}
            {(Object.keys(couMat).length || Object.keys(couPat).length) > 0 && (
              <>
                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-around', padding: '0 120px' }}>
                  <div className="c-v" style={{ height: 36 }} />
                  <div className="c-v" style={{ height: 36 }} />
                </div>
                <div className="ft-row" style={{ gap: 60, justifyContent: 'center', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                    {Object.keys(couMat).length ? (
                      <>
                        <div className="sec-label" style={{ color: '#1565C0', background: '#EFF6FF' }}>Mother's Side Cousins</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {Object.entries(couMat).map(([nm, cs]) => (
                            <div key={nm} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <FCard avatar="🧒" name={shortName(nm)} rel="Maternal Cousin" conds={cs} onClick={() => openPerson(shortName(nm), 'Maternal Cousin', '🧒', cs)} />
                              <div style={{ fontSize: 8.5, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 136, lineHeight: 1.3 }}>{nm}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : <EmptyBox lines={['No maternal', 'cousins recorded']} tall={false} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                    {Object.keys(couPat).length ? (
                      <>
                        <div className="sec-label" style={{ color: '#7C3AED', background: '#F5F3FF' }}>Father's Side Cousins</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {Object.entries(couPat).map(([nm, cs]) => (
                            <div key={nm} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <FCard avatar="🧒" name={shortName(nm)} rel="Paternal Cousin" conds={cs} onClick={() => openPerson(shortName(nm), 'Paternal Cousin', '🧒', cs)} />
                              <div style={{ fontSize: 8.5, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 136, lineHeight: 1.3 }}>{nm}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : <EmptyBox lines={['No paternal', 'cousins recorded']} tall={false} />}
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="ft-legend">
        <strong style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: .8 }}>Risk:</strong>
        <div className="ftleg-i"><span className="ftleg-d" style={{ background: '#DC2626' }} /> High (Heart, Cancer, Stroke, BP, Diabetes)</div>
        <div className="ftleg-i"><span className="ftleg-d" style={{ background: '#D97706' }} /> Moderate (Thyroid, Anxiety, Obesity, Asthma)</div>
        <div className="ftleg-i"><span className="ftleg-d" style={{ background: '#16A34A' }} /> Low Risk</div>
        <div className="ftleg-i"><span className="ftleg-d" style={{ border: '1.5px dashed #9BAEC8', background: 'none' }} /> No data</div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}><i className="fas fa-hand-pointer" /> Click any card for full details</div>
      </div>

      {/* Person Detail Modal */}
      {person && (
        <div className="modal-overlay" onClick={() => setPerson(null)}>
          <div className="ft-modal" onClick={e => e.stopPropagation()}>
            <div className="ft-modal-top" style={{ background: riskColor(person.conds) }}>
              <span style={{ fontSize: 36 }}>{person.av}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{person.name}</div>
                <div style={{ fontSize: 12, opacity: .75, marginTop: 2 }}>{person.rel}{person.dec ? ` · Deceased ${person.decYr || ''}` : ''}</div>
              </div>
              <button onClick={() => setPerson(null)} style={{ background: 'rgba(255,255,255,.2)', border: 'none', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 18, color: 'inherit' }}>&times;</button>
            </div>
            <div className="ft-modal-body">
              {!person.conds.length ? (
                <p style={{ padding: 20, textAlign: 'center', color: '#5E7A99' }}>No medical conditions recorded for this family member.</p>
              ) : (
                <>
                  {person.conds.map((c, i) => {
                    const col = condColor(c.conditionName), bg = condBg(col);
                    let note = '';
                    for (const [k, v] of Object.entries(RISK_NOTES)) { if (c.conditionName.toLowerCase().includes(k)) { note = v; break; } }
                    return (
                      <div key={i} style={{ borderLeft: `4px solid ${col}`, borderRadius: 10, padding: '14px 16px', marginBottom: 12, background: `${bg}44`, border: `1px solid ${col}22` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: '#0A1F44' }}>{c.conditionName}</div>
                          {c.diagnosisYear && <span style={{ background: bg, color: col, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Diagnosed {c.diagnosisYear}</span>}
                        </div>
                        {c.notes && <p style={{ fontSize: 13, color: '#374151', margin: '0 0 8px', lineHeight: 1.6 }}>{c.notes}</p>}
                        {note && (
                          <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,.8)', borderRadius: 7, padding: '9px 12px', marginTop: 8 }}>
                            <i className="fas fa-dna" style={{ color: col, marginTop: 2, flexShrink: 0, fontSize: 13 }} />
                            <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.5 }}><strong>Your genetic risk:</strong> {note}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <i className="fas fa-lightbulb" style={{ color: '#1565C0', marginTop: 2, flexShrink: 0 }} />
                    <div style={{ fontSize: 12.5, color: '#1E40AF', lineHeight: 1.6 }}>
                      <strong>NHS Recommendation:</strong> Share this family history with your GP. Genetic risk factors can be managed through early screening, lifestyle changes, and preventive care.
                      <br />
                      <Link to="/patient/appointments" style={{ color: '#1565C0', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                        <i className="fas fa-calendar-plus" /> Book appointment with your doctor
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'var(--primary)', color: '#fff' }}>
              <h3 style={{ color: '#fff' }}><i className="fas fa-user-plus" /> Add Family Member</h3>
              <button className="modal-close" style={{ color: '#fff' }} onClick={() => setShowAdd(false)}>&times;</button>
            </div>
            <form onSubmit={submitAdd} style={{ padding: 22 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="form-label">Relation *</label>
                  <select className="form-control" required value={form.relation} onChange={e => setForm({ ...form, relation: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="father">Father</option>
                    <option value="mother">Mother</option>
                    <option value="brother">Brother</option>
                    <option value="sister">Sister</option>
                    <option value="grandfather_paternal">Grandfather (Father's side)</option>
                    <option value="grandmother_paternal">Grandmother (Father's side)</option>
                    <option value="grandfather_maternal">Grandfather (Mother's side)</option>
                    <option value="grandmother_maternal">Grandmother (Mother's side)</option>
                    <option value="uncle_paternal">Uncle (Father's Brother)</option>
                    <option value="aunt_paternal">Aunt (Father's Sister)</option>
                    <option value="uncle_maternal">Uncle (Mother's Brother)</option>
                    <option value="aunt_maternal">Aunt (Mother's Sister)</option>
                    <option value="cousin_paternal">Cousin (Father's side)</option>
                    <option value="cousin_maternal">Cousin (Mother's side)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Name</label>
                  <input type="text" className="form-control" placeholder="Full name" value={form.relation_name} onChange={e => setForm({ ...form, relation_name: e.target.value })} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Condition *</label>
                  <input type="text" className="form-control" required placeholder="e.g. Type 2 Diabetes" value={form.condition_name} onChange={e => setForm({ ...form, condition_name: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Year Diagnosed</label>
                  <input type="number" className="form-control" placeholder="e.g. 2010" min="1900" max="2030" value={form.year_diagnosed} onChange={e => setForm({ ...form, year_diagnosed: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Year Deceased</label>
                  <input type="number" className="form-control" placeholder="Leave blank if alive" min="1900" max="2030" value={form.year_deceased} onChange={e => setForm({ ...form, year_deceased: e.target.value })} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Notes (optional)</label>
                  <textarea className="form-control" rows={2} placeholder="Additional details..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving}>
                <i className="fas fa-save" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
