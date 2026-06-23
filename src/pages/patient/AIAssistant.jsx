import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Hs_usersService } from '../../generated/services/Hs_usersService';
import { Hs_healthmetricsService } from '../../generated/services/Hs_healthmetricsService';
import { Hs_allergiesService } from '../../generated/services/Hs_allergiesService';
import { Hs_allergieshs_severity } from '../../generated/models/Hs_allergiesModel';
import { Hs_prescriptionsService } from '../../generated/services/Hs_prescriptionsService';
import { Hs_prescriptionshs_status } from '../../generated/models/Hs_prescriptionsModel';
import { Hs_appointmentsService } from '../../generated/services/Hs_appointmentsService';
import { Hs_appointmentshs_status } from '../../generated/models/Hs_appointmentsModel';
import { Hs_doctorsService } from '../../generated/services/Hs_doctorsService';
import { drugLookup } from '../../lib/drugLookup';

const PRES_STATUS_CODES = Object.fromEntries(Object.entries(Hs_prescriptionshs_status).map(([c, l]) => [l, Number(c)]));
const APPT_STATUS_CODES = Object.fromEntries(Object.entries(Hs_appointmentshs_status).map(([c, l]) => [l, Number(c)]));

function toMetric(r) {
  return { systolic: r.hs_systolic, diastolic: r.hs_diastolic, heartRate: r.hs_heartrate, oxygenSaturation: r.hs_oxygensaturation, sleepHours: r.hs_sleephours };
}

const QUICK_QUESTIONS = [
  { icon: '💊', text: 'What are the side effects of Amlodipine?' },
  { icon: '🩺', text: 'My blood pressure is 135/85 — is that high?' },
  { icon: '😴', text: 'How can I improve my sleep quality?' },
  { icon: '🧂', text: 'How do I reduce my sodium intake?' },
  { icon: '❤️', text: 'My heart rate is 95 bpm — should I be concerned?' },
  { icon: '🏃', text: 'What exercise is best for high blood pressure?' },
  { icon: '😰', text: 'I feel anxious — what can I do?' },
  { icon: '💧', text: 'How much water should I drink daily?' },
  { icon: '📅', text: 'When should I book a GP appointment?' },
  { icon: '🌡️', text: 'I have a fever of 38.5°C — what should I do?' },
];

const CAPABILITIES = [
  { icon: '💊', title: 'Medications', text: 'Explain medications & side effects' },
  { icon: '📊', title: 'Your Metrics', text: 'Interpret your BP, HR, SpO₂, sleep' },
  { icon: '🥗', title: 'Diet & Lifestyle', text: 'NHS nutrition & exercise advice' },
  { icon: '🩺', title: 'Symptoms', text: 'Understand symptoms & when to act' },
  { icon: '🧠', title: 'Mental Health', text: 'Wellbeing support & NHS resources' },
  { icon: '📅', title: 'Appointments', text: 'When & how to book your GP' },
];

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatAI(text) {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n- /g, '<br>• ')
    .replace(/\n(\d+)\. /g, '<br>$1. ')
    .replace(/\n/g, '<br>');
}

function AIBubble({ text }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    const words = text.split(' ');
    let i = 0;
    const id = setInterval(() => {
      i += 3;
      if (i >= words.length) { setShown(text); clearInterval(id); return; }
      setShown(words.slice(0, i).join(' ') + '...');
    }, 18);
    return () => clearInterval(id);
  }, [text]);
  return <div className="aia-bubble" dangerouslySetInnerHTML={{ __html: formatAI(shown) }} />;
}

function buildFdaSection(text, label) {
  if (!text) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>{label}</div>
      <div style={{ color: 'var(--text)', fontSize: 11.5, lineHeight: 1.55 }}>{text}</div>
    </div>
  );
}

export default function AIAssistant() {
  const { user } = useAuth();
  const [context, setContext] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [drugQuery, setDrugQuery] = useState('');
  const [drugLoading, setDrugLoading] = useState(false);
  const [drugResult, setDrugResult] = useState(null); // { error } | { hasFDA, hasNHS, label, recalls, nhs, tabs, activeTab }
  const [showRecalls, setShowRecalls] = useState(false);
  const messagesRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const [userRes, metricsRes, allergyRes, presRes, apptRes] = await Promise.all([
          Hs_usersService.get(user.id),
          Hs_healthmetricsService.getAll({ filter: `_hs_user_value eq ${user.id}`, orderBy: ['hs_recordedat desc'], top: 1 }),
          Hs_allergiesService.getAll({ filter: `_hs_patient_value eq ${user.id}`, top: 3 }),
          Hs_prescriptionsService.getAll({ filter: `_hs_patient_value eq ${user.id} and hs_status eq ${PRES_STATUS_CODES.active}`, top: 4 }),
          Hs_appointmentsService.getAll({
            filter: `_hs_patient_value eq ${user.id} and (hs_status eq ${APPT_STATUS_CODES.confirmed} or hs_status eq ${APPT_STATUS_CODES.pending}) and hs_appointmentdate ge ${new Date().toISOString().slice(0, 10)}`,
            orderBy: ['hs_appointmentdate asc'], top: 1,
          }),
        ]);
        const u = userRes.data;
        const nextAppt = apptRes.data?.[0];
        let docStr = 'your registered GP';
        if (nextAppt) {
          const doc = (await Hs_doctorsService.getAll({ filter: `_hs_user_value eq ${nextAppt._hs_doctor_value}` })).data?.[0];
          const rawName = doc?.hs_doctor1 || nextAppt.hs_doctorname || '';
          docStr = `Dr. ${rawName.replace(/^dr\.?\s+/i, '')}${doc?.hs_specialization ? ` (${doc.hs_specialization})` : ''}`;
        }
        setContext({
          user: { name: u.hs_fullname, nhsId: u.hs_nhsidentifier },
          metrics: metricsRes.data?.[0] ? toMetric(metricsRes.data[0]) : null,
          allergies: (allergyRes.data || []).map(a => ({ id: a.hs_allergyid, allergen: a.hs_allergen, severity: Hs_allergieshs_severity[a.hs_severity] })),
          medications: (presRes.data || []).map(p => ({ id: p.hs_prescriptionid, medicationName: p.hs_medicationname, dosage: p.hs_dosage })),
          docStr,
        });
      } catch { /* leave context null, chat still works via rule-based fallback */ }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, isLoading]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const sendMessage = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || isLoading) return;

    setInput('');
    setTimeout(autoResize, 0);
    setIsLoading(true);
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: 'user', content: msg, time: now() }]);

    try {
      const { data } = await api.post('/bridge/ai/chat', {
        message: msg, history: history.slice(-10),
        user: context?.user || { name: user?.name, bloodType: user?.bloodType, nhsId: user?.nhsId },
        meds: context?.medications || [], allergies: context?.allergies || [],
        metrics: context?.metrics || null, docStr: context?.docStr || 'your registered GP',
      });
      if (data.error) throw new Error(data.error);
      const source = data.source === 'gemini'
        ? { icon: 'fa-magic', color: '#4285F4', label: 'Gemini AI' }
        : { icon: 'fa-database', color: 'var(--text-muted)', label: 'Built-in' };
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'I could not generate a response. Please try again.', time: now(), source }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Sorry, I encountered an error. Please try again or contact your doctor directly.\n\n**Error:** ${err.message || 'Connection issue'}`, time: now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const askAbout = (question) => {
    setInput(question);
    sendMessage(question);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => {
    if (!messages.length) return;
    if (!confirm('Clear chat history?')) return;
    setMessages([]);
  };

  // ── Drug lookup ─────────────────────────────────────────────────
  const lookupDrug = async (prefill) => {
    const q = (prefill ?? drugQuery).trim();
    if (!q) return;
    if (prefill) setDrugQuery(prefill);

    setDrugLoading(true);
    setDrugResult(null);
    try {
      const [labelRes, recallRes, nhsRes] = await Promise.all([
        drugLookup(q, 'label').catch(() => ({ error: true })),
        drugLookup(q, 'recall').catch(() => ({ recalls: [] })),
        api.get('/bridge/ai/nhs-medicine', { params: { drug: q } }).then(r => r.data).catch(() => null),
      ]);

      const hasFDA = !labelRes.error;
      const hasNHS = nhsRes && !nhsRes.error && nhsRes.name;

      if (!hasFDA && !hasNHS) {
        const genericHint = {
          calpol: 'paracetamol', nurofen: 'ibuprofen', panadol: 'paracetamol',
          brufen: 'ibuprofen', ventolin: 'salbutamol', piriton: 'chlorphenamine',
          gaviscon: 'alginate', canesten: 'clotrimazole', daktarin: 'miconazole',
        }[q.toLowerCase()];
        setDrugResult({ notFound: true, genericHint, q });
        return;
      }

      const tabs = [
        { id: 'info', label: 'Info', hidden: !hasFDA },
        { id: 'effects', label: 'Side Effects', hidden: !hasFDA },
        { id: 'inter', label: 'Interactions', hidden: !hasFDA },
        { id: 'nhs', label: '🏥 NHS', hidden: !hasNHS },
      ].filter(t => !t.hidden);

      setDrugResult({ q, hasFDA, hasNHS, label: labelRes, recalls: recallRes.recalls || [], nhs: nhsRes, tabs, activeTab: tabs[0]?.id });
    } catch {
      setDrugResult({ fetchError: true });
    } finally {
      setDrugLoading(false);
    }
  };

  const renderTabContent = () => {
    const { activeTab, label, nhs } = drugResult;
    if (activeTab === 'info') {
      return <>{buildFdaSection(label.indications, 'What it treats')}{buildFdaSection(label.dosage, 'Dosage')}</>;
    }
    if (activeTab === 'effects') {
      return <>{buildFdaSection(label.adverse_reactions, 'Adverse Reactions')}{buildFdaSection(label.warnings, 'Warnings')}</>;
    }
    if (activeTab === 'inter') {
      return <>{buildFdaSection(label.drug_interactions, 'Drug Interactions')}{buildFdaSection(label.contraindications, 'Contraindications')}</>;
    }
    if (activeTab === 'nhs') {
      return (
        <>
          {nhs.description && buildFdaSection(nhs.description, 'Overview')}
          {(nhs.sections || []).slice(0, 4).map((s, i) => buildFdaSection(s.content, s.heading) && <div key={i}>{buildFdaSection(s.content, s.heading)}</div>)}
        </>
      );
    }
    return null;
  };

  const metrics = context?.metrics;
  const meds = context?.medications || [];
  const allergies = context?.allergies || [];
  const firstName = user?.name?.split(' ')[0] || '';

  return (
    <div className="aia-wrap">
      {/* LEFT: Patient Context */}
      <div className="aia-context">
        <div className="aia-section">
          <div className="aia-title">Your Health Summary</div>
          <div className="aia-item">
            <span className="aii-icon">🩸</span>
            <span className="aii-label">Blood</span>
            <span className="aii-val">{context?.user?.bloodType || 'N/A'}</span>
          </div>
          {metrics && (
            <>
              <div className="aia-item">
                <span className="aii-icon">💓</span>
                <span className="aii-label">BP</span>
                <span className="aii-val">{metrics.systolic}/{metrics.diastolic} mmHg</span>
              </div>
              <div className="aia-item">
                <span className="aii-icon">❤️</span>
                <span className="aii-label">Heart</span>
                <span className="aii-val">{metrics.heartRate} bpm</span>
              </div>
              <div className="aia-item">
                <span className="aii-icon">🫁</span>
                <span className="aii-label">SpO₂</span>
                <span className="aii-val">{metrics.oxygenSaturation}%</span>
              </div>
              <div className="aia-item">
                <span className="aii-icon">🌙</span>
                <span className="aii-label">Sleep</span>
                <span className="aii-val">{metrics.sleepHours}h</span>
              </div>
            </>
          )}
        </div>

        {meds.length > 0 && (
          <div className="aia-section">
            <div className="aia-title">Active Medications</div>
            {meds.slice(0, 4).map(m => (
              <div className="aia-item" key={m.id} style={{ cursor: 'pointer' }} onClick={() => lookupDrug(m.medicationName)} title={`Look up ${m.medicationName} in FDA database`}>
                <span className="aii-icon">💊</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--primary)' }}>{m.medicationName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.dosage} &middot; <span style={{ color: 'var(--primary-light)' }}>FDA + NHS lookup</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {allergies.length > 0 && (
          <div className="aia-section">
            <div className="aia-title">Allergies</div>
            {allergies.slice(0, 3).map(a => (
              <div className="aia-item" key={a.id}>
                <span className="aii-icon">⚠️</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--primary)' }}>{a.allergen}</div>
                  <div style={{ fontSize: 11, color: a.severity === 'severe' ? 'var(--danger)' : 'var(--text-muted)', textTransform: 'capitalize' }}>{a.severity}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Drug lookup */}
        <div className="aia-section">
          <div className="aia-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Drug Lookup
            <span style={{ fontSize: 9, background: '#DCFCE7', color: '#16A34A', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>FDA</span>
            <span style={{ fontSize: 9, background: '#DBEAFE', color: '#1D4ED8', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>NHS</span>
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
            <input type="text" className="aia-drug-input" placeholder="e.g. Amlodipine, Ibuprofen…"
              value={drugQuery} onChange={e => setDrugQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookupDrug()} />
            <button className="aia-drug-search-btn" onClick={() => lookupDrug()} title="Search FDA">
              <i className="fas fa-search" />
            </button>
          </div>

          {drugLoading && (
            <div style={{ textAlign: 'center', padding: 10, color: 'var(--text-muted)', fontSize: 12 }}>
              <i className="fas fa-spinner fa-spin" /> Searching FDA &amp; NHS databases…
            </div>
          )}

          {drugResult?.notFound && (
            <div style={{ padding: 8, border: '1px solid #FECACA', borderRadius: 8, background: '#FEF2F2' }}>
              <div style={{ color: '#DC2626', fontSize: 12, fontWeight: 600, marginBottom: 4 }}><i className="fas fa-exclamation-circle" /> Not found in FDA or NHS databases</div>
              <div style={{ fontSize: 11.5, color: '#7F1D1D' }}>
                {drugResult.genericHint
                  ? <>Try: <a href="#" onClick={e => { e.preventDefault(); lookupDrug(drugResult.genericHint); }} style={{ color: 'var(--primary-light)' }}>{drugResult.genericHint}</a> (generic name)</>
                  : <>Try the <strong>generic/active ingredient</strong> name instead of the brand name.</>}
              </div>
              <a href="https://www.nhs.uk/medicines/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#1D4ED8', display: 'inline-block', marginTop: 6 }}><i className="fas fa-external-link-alt" /> Browse NHS Medicines A–Z</a>
            </div>
          )}

          {drugResult?.fetchError && (
            <div style={{ color: 'var(--danger)', padding: 6, fontSize: 12 }}><i className="fas fa-exclamation-circle" /> Failed to reach FDA database. Try again.</div>
          )}

          {drugResult && !drugResult.notFound && !drugResult.fetchError && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: 'var(--bg)', padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12.5 }}>{drugResult.label.brand_name || drugResult.label.generic_name || drugResult.q}</div>
                    {drugResult.label.brand_name && drugResult.label.generic_name && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{drugResult.label.generic_name}</div>
                    )}
                  </div>
                  {drugResult.recalls.length > 0
                    ? <span style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>⚠ {drugResult.recalls.length} recall{drugResult.recalls.length > 1 ? 's' : ''}</span>
                    : <span style={{ background: '#DCFCE7', color: '#16A34A', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>✓ No recalls</span>}
                </div>
                {drugResult.label.manufacturer && <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 3 }}>{drugResult.label.manufacturer}</div>}
              </div>
              <div style={{ padding: '8px 10px 6px' }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  {drugResult.tabs.map(t => (
                    <button key={t.id} className={`aia-tab-btn${t.id === drugResult.activeTab ? ' active' : ''}`}
                      onClick={() => setDrugResult(prev => ({ ...prev, activeTab: t.id }))}>{t.label}</button>
                  ))}
                </div>
                <div style={{ padding: '8px 0', maxHeight: 320, overflowY: 'auto' }}>
                  {renderTabContent() || <span style={{ color: 'var(--text-muted)' }}>No data available.</span>}
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', padding: '8px 10px', display: 'flex', gap: 6 }}>
                <button onClick={() => askAbout(`Tell me everything about ${drugResult.q} — its uses, side effects, interactions and any safety warnings`)}
                  style={{ flex: 1, background: 'var(--primary-light)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <i className="fas fa-robot" /> Ask AI
                </button>
                {drugResult.recalls.length > 0 && (
                  <button onClick={() => setShowRecalls(true)}
                    style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 7, padding: '6px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <i className="fas fa-exclamation-triangle" /> Recalls
                  </button>
                )}
              </div>
              {drugResult.hasNHS && drugResult.nhs.url && (
                <div style={{ padding: '6px 10px', background: '#F0F9FF', borderTop: '1px solid #BAE6FD', fontSize: 10, color: '#0369A1' }}>
                  <a href={drugResult.nhs.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0369A1' }}>NHS content &rarr;</a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick questions */}
        <div className="aia-section">
          <div className="aia-title">Quick Questions</div>
          {QUICK_QUESTIONS.map((qq, i) => (
            <button className="aia-qq" key={i} onClick={() => askAbout(qq.text)}>
              <span className="aiq-icon">{qq.icon}</span>
              <span>{qq.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN: Chat */}
      <div className="aia-chat">
        <div className="aia-messages" ref={messagesRef}>
          {messages.length === 0 ? (
            <div className="aia-welcome">
              <div className="aia-orb"><i className="fas fa-robot" /></div>
              <div className="aia-welcome-title">Hello, {firstName}! 👋</div>
              <div className="aia-welcome-sub">
                I'm your HealthSphere AI health assistant. I can answer your health questions, explain your metrics, help with medications, and more — using your personal health data for personalised advice.
              </div>
              <div className="aia-cap-grid">
                {CAPABILITIES.map((c, i) => (
                  <div className="aia-cap-card" key={i}>
                    <span className="aic-icon">{c.icon}</span>
                    <div>
                      <div className="aic-title">{c.title}</div>
                      <div className="aic-text">{c.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div className={`aia-msg ${m.role === 'user' ? 'user' : 'ai'}`} key={i}>
                  <div className="aia-avatar">
                    {m.role === 'user' ? (user?.name?.[0] || '').toUpperCase() : <i className="fas fa-robot" />}
                  </div>
                  <div className="aia-msg-content">
                    {m.role === 'user'
                      ? <div className="aia-bubble" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                      : <AIBubble text={m.content} />}
                    <div className="aia-msg-time">
                      {m.time}
                      {m.source && (
                        <span className="aia-msg-source" style={{ display: 'inline' }}>
                          &nbsp;&middot;&nbsp;<i className={`fas ${m.source.icon}`} style={{ color: m.source.color }} /> {m.source.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="aia-msg ai">
                  <div className="aia-avatar"><i className="fas fa-robot" /></div>
                  <div className="aia-msg-content">
                    <div className="aia-typing">
                      <div className="aia-typing-dot" /><div className="aia-typing-dot" /><div className="aia-typing-dot" />
                    </div>
                    <div className="aia-msg-time">HealthSphere AI is thinking...</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="aia-input-area">
          <div className="aia-disclaimer">
            <i className="fas fa-shield-alt" style={{ color: 'var(--primary-light)' }} />
            AI health information only — not a replacement for medical diagnosis. Always consult your doctor.
          </div>
          <div className="aia-input-row">
            <div className="aia-input-wrap">
              <textarea ref={textareaRef} className="aia-textarea" rows={1}
                placeholder="Ask me anything about your health... (e.g. 'What causes high blood pressure?')"
                value={input}
                onChange={e => { setInput(e.target.value); autoResize(); }}
                onKeyDown={handleKey} />
            </div>
            <button className="aia-send-btn" onClick={() => sendMessage()} disabled={isLoading || !input.trim()} title="Send (Enter)">
              <i className="fas fa-paper-plane" style={{ fontSize: 16, marginLeft: 2 }} />
            </button>
            {messages.length > 0 && (
              <button className="aia-clear-btn" onClick={clearChat} title="Clear chat">
                <i className="fas fa-trash" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recalls modal */}
      {showRecalls && drugResult?.recalls?.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowRecalls(false); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 15 }}>FDA Recalls: {drugResult.label?.brand_name || drugResult.label?.generic_name || drugResult.q}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{drugResult.recalls.length} recall record{drugResult.recalls.length > 1 ? 's' : ''} found</div>
              </div>
              <button onClick={() => setShowRecalls(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280', lineHeight: 1 }}>&times;</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#F9FAFB' }}>
                <th style={{ padding: 8, fontSize: 11, textAlign: 'left', color: '#6B7280' }}>Date</th>
                <th style={{ padding: 8, fontSize: 11, textAlign: 'left', color: '#6B7280' }}>Class</th>
                <th style={{ padding: 8, fontSize: 11, textAlign: 'left', color: '#6B7280' }}>Reason</th>
              </tr></thead>
              <tbody>
                {drugResult.recalls.map((r, i) => {
                  const date = r.date ? r.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : 'N/A';
                  const cls = { 'Class I': '#DC2626', 'Class II': '#D97706', 'Class III': '#16A34A' }[r.classification] || '#6B7280';
                  return (
                    <tr key={i}>
                      <td style={{ padding: '6px 8px', fontSize: 11, color: '#6B7280' }}>{date}</td>
                      <td style={{ padding: '6px 8px', fontSize: 11 }}><span style={{ background: cls + '22', color: cls, borderRadius: 4, padding: '1px 5px', fontWeight: 700, fontSize: 10 }}>{r.classification || 'N/A'}</span></td>
                      <td style={{ padding: '6px 8px', fontSize: 11 }}>{r.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: '12px 20px', background: '#FEF3C7', borderTop: '1px solid #FDE68A', fontSize: 11.5, color: '#92400E' }}>
              <strong>Note:</strong> This data is from the FDA OpenFDA database (US recalls). Consult your pharmacist or doctor for guidance.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
