import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import FamilyTree from '../../components/FamilyTree';
import { Hs_medicalrecordsService } from '../../generated/services/Hs_medicalrecordsService';
import { Hs_medicalrecordshs_status } from '../../generated/models/Hs_medicalrecordsModel';
import { Hs_prescriptionsService } from '../../generated/services/Hs_prescriptionsService';
import { Hs_prescriptionshs_status } from '../../generated/models/Hs_prescriptionsModel';
import { Hs_allergiesService } from '../../generated/services/Hs_allergiesService';
import { Hs_allergieshs_severity } from '../../generated/models/Hs_allergiesModel';
import { Hs_vaccinationsService } from '../../generated/services/Hs_vaccinationsService';
import { Hs_appointmentsService } from '../../generated/services/Hs_appointmentsService';
import { Hs_appointmentshs_status } from '../../generated/models/Hs_appointmentsModel';
import { Hs_doctorsService } from '../../generated/services/Hs_doctorsService';
import { Hs_familyhistoriesService } from '../../generated/services/Hs_familyhistoriesService';
import { nhsCondition } from '../../lib/nhsCondition';

function toLab(r, doctorByUserId) {
  const doc = doctorByUserId[r._hs_doctor_value];
  return {
    id: r.hs_medicalrecordid,
    testType: r.hs_testtype,
    testDate: r.hs_testdate,
    status: Hs_medicalrecordshs_status[r.hs_status] || 'pending',
    result: r.hs_result,
    doctor_name: doc?.hs_username || r.hs_doctorname,
    filePath: r.hs_filepath,
  };
}

function toPrescription(r, doctorByUserId) {
  const doc = doctorByUserId[r._hs_doctor_value];
  return {
    id: r.hs_prescriptionid,
    medicationName: r.hs_medicationname,
    dosage: r.hs_dosage,
    frequency: r.hs_frequency,
    duration: r.hs_duration,
    instructions: r.hs_instructions,
    doctor_name: doc?.hs_username || r.hs_doctorname,
    status: Hs_prescriptionshs_status[r.hs_status] || 'active',
  };
}

function toAllergy(r) {
  return {
    id: r.hs_allergyid,
    allergen: r.hs_allergen,
    severity: Hs_allergieshs_severity[r.hs_severity],
    reaction: r.hs_reaction,
    notes: r.hs_notes,
  };
}

function toVaccination(r) {
  return {
    id: r.hs_vaccinationid,
    vaccineName: r.hs_vaccinename,
    doseNumber: r.hs_dosenumber,
    dateAdministered: r.hs_dateadministered,
    nextDueDate: r.hs_nextduedate,
    administeredBy: r.hs_administeredby,
  };
}

function toAppointment(r, doctorByUserId) {
  const doc = doctorByUserId[r._hs_doctor_value];
  return {
    id: r.hs_appointmentid,
    doctor_name: doc?.hs_username || r.hs_doctorname,
    specialization: doc?.hs_specialization,
    appointmentDate: r.hs_appointmentdate,
    appointmentTime: r.hs_appointmenttime,
    status: Hs_appointmentshs_status[r.hs_status] || 'pending',
    notes: r.hs_notes,
  };
}

function toFamily(r) {
  return {
    id: r.hs_familyhistoryid,
    relation: r.hs_relation,
    relationName: r.hs_relationname,
    conditionName: r.hs_conditionname,
    diagnosisYear: r.hs_diagnosisyear,
    yearDeceased: r.hs_yeardeceased,
    notes: r.hs_notes,
  };
}

const TABS = [
  { key: 'records', icon: 'fa-flask', label: 'Lab Results' },
  { key: 'appointments', icon: 'fa-calendar', label: 'Appointments' },
  { key: 'allergies', icon: 'fa-allergies', label: 'Allergies' },
  { key: 'vaccinations', icon: 'fa-syringe', label: 'Vaccinations' },
  { key: 'medications', icon: 'fa-pills', label: 'Medications' },
  { key: 'family', icon: 'fa-users', label: 'Family History' },
];

const RECORD_ICONS = {
  blood: '🩸', urine: '🧪', lipid: '💉', thyroid: '🦋',
  xray: '🔬', 'x-ray': '🔬', mri: '🧠', ecg: '❤️', heart: '❤️', scan: '🔬',
};
const STATUS_COLORS = { normal: '#16A34A', elevated: '#D97706', low: '#0891B2', critical: '#DC2626', pending: '#5E7A99' };

const ALLERGY_ICONS = [
  { keys: ['penicillin', 'aspirin', 'ibuprofen', 'sulfa', 'medication', 'drug'], icon: '💊' },
  { keys: ['peanut', 'nut', 'milk', 'egg', 'shellfish', 'gluten', 'food', 'soy', 'wheat', 'lactose'], icon: '🍎' },
  { keys: ['pollen', 'dust', 'pet', 'mould', 'mold', 'latex', 'grass', 'environmental'], icon: '🌿' },
];
function allergyIcon(allergen) {
  const t = (allergen || '').toLowerCase();
  for (const g of ALLERGY_ICONS) if (g.keys.some(k => t.includes(k))) return g.icon;
  return '⚠️';
}
function recordIcon(testType) {
  const t = (testType || '').toLowerCase();
  for (const [k, icon] of Object.entries(RECORD_ICONS)) if (t.includes(k)) return icon;
  return '📋';
}

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export default function MedicalRecords() {
  const { user } = useAuth();
  const [tab, setTab] = useState('records');
  const [data, setData] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [familyHistory, setFamilyHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nhsModal, setNhsModal] = useState(null); // { title, loading, error, summary, url }

  const loadAll = () => {
    Promise.all([
      Hs_medicalrecordsService.getAll({ filter: `_hs_patient_value eq ${user.id}`, orderBy: ['hs_testdate desc'] }),
      Hs_prescriptionsService.getAll({ filter: `_hs_patient_value eq ${user.id}`, orderBy: ['createdon desc'] }),
      Hs_allergiesService.getAll({ filter: `_hs_patient_value eq ${user.id}` }),
      Hs_vaccinationsService.getAll({ filter: `_hs_user_value eq ${user.id}`, orderBy: ['hs_dateadministered desc'] }),
      Hs_appointmentsService.getAll({ filter: `_hs_patient_value eq ${user.id}` }),
      Hs_doctorsService.getAll(),
      Hs_familyhistoriesService.getAll({ filter: `_hs_user_value eq ${user.id}` }),
    ]).then(([m, p, al, v, a, docs, f]) => {
      const doctorByUserId = Object.fromEntries((docs.data || []).map(d => [d._hs_user_value, d]));
      setData({
        labs: (m.data || []).map(r => toLab(r, doctorByUserId)),
        prescriptions: (p.data || []).map(r => toPrescription(r, doctorByUserId)),
        allergies: (al.data || []).map(toAllergy),
        vaccinations: (v.data || []).map(toVaccination),
      });
      setAppointments((a.data || []).map(r => toAppointment(r, doctorByUserId)));
      setFamilyHistory((f.data || []).map(toFamily));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const statusBadge = (s) => {
    const map = { normal: 'success', elevated: 'warning', low: 'info', critical: 'danger', pending: 'gray' };
    return <span className={`badge badge-${map[s] || 'gray'}`}>{s}</span>;
  };
  const severityBadge = (s) => {
    const map = { mild: 'success', moderate: 'warning', severe: 'danger' };
    return <span className={`badge badge-${map[s] || 'gray'}`}>{s ? s[0].toUpperCase() + s.slice(1) : ''}</span>;
  };

  const showNHSGuide = async (condition) => {
    setNhsModal({ title: condition, loading: true, error: null, summary: null, url: null });
    try {
      const data = await nhsCondition(condition);
      if (data.error) {
        setNhsModal({ title: condition, loading: false, error: data.error, summary: null, url: null });
      } else {
        setNhsModal({ title: data.name || condition, loading: false, error: null, summary: data.summary, url: data.url });
      }
    } catch {
      setNhsModal({ title: condition, loading: false, error: 'Could not load NHS information. Please check your connection.', summary: null, url: null });
    }
  };

  return (
    <div>
      <div className="flex-between mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="text-muted text-sm">
          Patient: <strong>{user?.name}</strong> &middot; NHS: <strong>{user?.nhsId || '—'}</strong>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          <span><i className="fas fa-tint" /> {user?.bloodType || '—'}</span>
          <span><i className="fas fa-birthday-cake" /> {user?.dateOfBirth ? formatDate(user.dateOfBirth) : '—'}</span>
        </div>
      </div>

      <div className="record-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`record-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            <i className={`fas ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Lab Results ── */}
      {tab === 'records' && (
        <div className="record-grid">
          {data?.labs?.map(r => (
            <div key={r.id} className="card" style={{ borderTop: `3px solid ${STATUS_COLORS[r.status] || '#5E7A99'}` }}>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 28 }}>{recordIcon(r.testType)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>{r.testType}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(r.testDate)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    {statusBadge(r.status)}
                    <button className="nhs-guide-btn" onClick={() => showNHSGuide(r.testType)}>
                      <img src="https://www.nhs.uk/nhschoicesContent/imagecontent/icons/apple-touch-icon.png" alt="" /> NHS Guide
                    </button>
                  </div>
                </div>
                {r.result && <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginBottom: 10 }}>{r.result}</p>}
                {(r.doctor_name || r.filePath) && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <span>
                      {r.doctor_name && <><i className="fas fa-user-md" /> Dr. {r.doctor_name}</>}
                      {r.doctor_name && r.testDate && ' · '}
                      {r.testDate && <><i className="fas fa-calendar" /> Added {formatDate(r.testDate)}</>}
                    </span>
                    {r.filePath && (
                      <a href={`http://localhost:5002/${r.filePath}`} target="_blank" rel="noreferrer" download
                        style={{ fontSize: 11, background: '#16A34A', color: '#fff', padding: '3px 10px', borderRadius: 5, textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <i className="fas fa-download" /> Download Attached File
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {!data?.labs?.length && (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <div className="empty-icon"><i className="fas fa-flask" /></div>
              <p>No medical records found.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Appointments ── */}
      {tab === 'appointments' && (
        <div className="card">
          <div className="card-header"><h3><i className="fas fa-calendar-check" /> All Appointments</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Doctor</th><th>Specialization</th><th>Date &amp; Time</th><th>Status</th><th>Notes</th></tr></thead>
              <tbody>
                {appointments.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>Dr. {a.doctor_name}</td>
                    <td>{a.specialization || '—'}</td>
                    <td>{formatDate(a.appointmentDate)} {new Date(a.appointmentTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{statusBadge(a.status)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.notes || '—'}</td>
                  </tr>
                ))}
                {!appointments.length && <tr><td colSpan={5} className="empty-state">No appointments found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Allergies ── */}
      {tab === 'allergies' && (
        <div className="record-grid record-grid-sm">
          {data?.allergies?.map(a => (
            <div key={a.id} className="card">
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>{allergyIcon(a.allergen)}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>{a.allergen}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    {severityBadge(a.severity)}
                    <button className="nhs-guide-btn" onClick={() => showNHSGuide(`${a.allergen} allergy`)}>
                      <img src="https://www.nhs.uk/nhschoicesContent/imagecontent/icons/apple-touch-icon.png" alt="" /> NHS Guide
                    </button>
                  </div>
                </div>
                {a.reaction && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0 0' }}>{a.reaction}</p>}
                {a.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>{a.notes}</p>}
              </div>
            </div>
          ))}
          {!data?.allergies?.length && (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <div className="empty-icon"><i className="fas fa-allergies" /></div>
              <p>No allergies on record</p>
            </div>
          )}
        </div>
      )}

      {/* ── Vaccinations ── */}
      {tab === 'vaccinations' && (
        <div className="card">
          <div className="card-header"><h3><i className="fas fa-syringe" /> Immunisation History</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Vaccine</th><th>Dose</th><th>Date</th><th>Next Due</th><th>By</th><th>Status</th></tr></thead>
              <tbody>
                {data?.vaccinations?.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>💉 {v.vaccineName}</td>
                    <td>Dose {v.doseNumber}</td>
                    <td>{v.dateAdministered ? formatDate(v.dateAdministered) : '—'}</td>
                    <td>{v.nextDueDate ? formatDate(v.nextDueDate) : '—'}</td>
                    <td>{v.administeredBy || '—'}</td>
                    <td>{v.dateAdministered ? <span className="badge badge-success">Completed</span> : <span className="badge badge-warning">Due</span>}</td>
                  </tr>
                ))}
                {!data?.vaccinations?.length && <tr><td colSpan={6} className="empty-state">No vaccinations on record</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Medications ── */}
      {tab === 'medications' && (
        <div className="card">
          <div className="card-header"><h3><i className="fas fa-pills" /> Prescriptions &amp; Medications</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Prescribed By</th><th>Status</th></tr></thead>
              <tbody>
                {data?.prescriptions?.map(p => (
                  <tr key={p.id}>
                    <td>
                      <strong>💊 {p.medicationName}</strong>
                      {p.instructions && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.instructions}</div>}
                    </td>
                    <td>{p.dosage || '—'}</td>
                    <td>{p.frequency || '—'}</td>
                    <td>{p.duration || '—'}</td>
                    <td>{p.doctor_name ? `Dr. ${p.doctor_name}` : '—'}</td>
                    <td>{p.status === 'active' ? <span className="badge badge-success">Active</span> : <span className="badge badge-gray">Ended</span>}</td>
                  </tr>
                ))}
                {!data?.prescriptions?.length && <tr><td colSpan={6} className="empty-state">No prescriptions found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Family History ── */}
      {tab === 'family' && (
        <FamilyTree familyHistory={familyHistory} user={user} onAdded={loadAll} />
      )}

      {/* ── NHS Guide Modal ── */}
      {nhsModal && (
        <div className="modal-overlay" onClick={() => setNhsModal(null)}>
          <div className="modal nhs-modal" onClick={e => e.stopPropagation()}>
            <div className="nhs-modal-header">
              <div className="nhs-modal-logo"><img src="https://www.nhs.uk/nhschoicesContent/imagecontent/icons/apple-touch-icon.png" alt="NHS" /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{nhsModal.title}</div>
                <div style={{ fontSize: 11, opacity: .8 }}>NHS Official Health Information</div>
              </div>
              <button className="modal-close" style={{ color: '#fff' }} onClick={() => setNhsModal(null)}>&times;</button>
            </div>
            <div className="nhs-modal-body">
              {nhsModal.loading && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div className="spinner" style={{ margin: '0 auto 16px' }} />
                  <div style={{ color: '#6b7280', fontSize: 13 }}>Loading NHS information...</div>
                </div>
              )}
              {!nhsModal.loading && nhsModal.error && (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                  <p style={{ color: '#6b7280', fontSize: 14 }}>NHS information for "<strong>{nhsModal.title}</strong>" wasn't found automatically.</p>
                  <a href={`https://www.nhs.uk/search/results/?q=${encodeURIComponent(nhsModal.title)}`} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16, background: '#005EB8', color: '#fff', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                    🔗 Search on NHS.uk
                  </a>
                </div>
              )}
              {!nhsModal.loading && !nhsModal.error && (
                <>
                  <div style={{ background: '#EFF6FF', borderLeft: '4px solid #005EB8', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                    <p style={{ margin: 0, fontSize: 13.5, color: '#1e3a5f', lineHeight: 1.7 }}>{nhsModal.summary}</p>
                  </div>
                  <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#92400E' }}>
                    <strong>⚠️ Important:</strong> This information is for guidance only. Always consult your doctor for personal medical advice.
                  </div>
                </>
              )}
            </div>
            <div className="nhs-modal-footer">
              <span style={{ fontSize: 11, color: '#6b7280' }}>Source: NHS.uk / Wikipedia — for guidance only</span>
              {nhsModal.url && <a href={nhsModal.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: '#005EB8', textDecoration: 'none' }}>Read more →</a>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
