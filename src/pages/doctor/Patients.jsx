import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Hs_appointmentsService } from '../../generated/services/Hs_appointmentsService';
import { Hs_usersService } from '../../generated/services/Hs_usersService';
import { Hs_allergiesService } from '../../generated/services/Hs_allergiesService';
import { Hs_allergieshs_severity } from '../../generated/models/Hs_allergiesModel';
import { Hs_healthmetricsService } from '../../generated/services/Hs_healthmetricsService';
import { Hs_medicalrecordsService } from '../../generated/services/Hs_medicalrecordsService';
import { Hs_medicalrecordshs_status } from '../../generated/models/Hs_medicalrecordsModel';
import { Hs_prescriptionsService } from '../../generated/services/Hs_prescriptionsService';
import { Hs_prescriptionshs_status } from '../../generated/models/Hs_prescriptionsModel';
import { Hs_clinicalnotesService } from '../../generated/services/Hs_clinicalnotesService';
import { Hs_clinicalnoteshs_notetype } from '../../generated/models/Hs_clinicalnotesModel';

const TEST_TYPES = ['Blood Test','Urine Test','Lipid Panel','Thyroid Function','X-Ray','MRI','CT Scan','ECG','HbA1c','Blood Glucose','Full Blood Count','Liver Function'];
const FREQUENCIES = ['Once daily (morning)','Once daily (night)','Twice daily','Three times daily','Every 8 hours','As needed (PRN)','Weekly'];
const FILE_BASE = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');
const STATUS_CODES = Object.fromEntries(Object.entries(Hs_medicalrecordshs_status).map(([code, label]) => [label, Number(code)]));
const NOTE_TYPE_CODES = Object.fromEntries(Object.entries(Hs_clinicalnoteshs_notetype).map(([code, label]) => [label, Number(code)]));

const PTABS = [
  ['labs', 'fa-flask', 'Lab Results'],
  ['rx', 'fa-pills', 'Prescriptions'],
  ['add-lab', 'fa-plus-circle', 'Add Lab Result'],
  ['add-rx', 'fa-prescription', 'Add Prescription'],
  ['notes', 'fa-notes-medical', 'Notes'],
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function labStatusBadge(s) {
  const m = { normal: 'success', elevated: 'warning', low: 'info', critical: 'danger', pending: 'gray' };
  return <span className={`badge badge-${m[s] || 'gray'}`}>{s}</span>;
}

export default function DoctorPatients() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState('labs');

  const [noteForm, setNoteForm] = useState({ note_type: 'general', content: '' });
  const [noteMsg, setNoteMsg] = useState(null);

  const [labForm, setLabForm] = useState({ test_type: '', result: '', status: 'normal', notes: '', test_date: new Date().toISOString().split('T')[0] });
  const [labSubmitting, setLabSubmitting] = useState(false);
  const [labMsg, setLabMsg] = useState(null);

  const [rxForm, setRxForm] = useState({ medication_name: '', dosage: '', frequency: '', duration: '30', start_date: new Date().toISOString().split('T')[0], instructions: '' });
  const [rxSubmitting, setRxSubmitting] = useState(false);
  const [rxMsg, setRxMsg] = useState(null);

  useEffect(() => {
    setLoading(true);
    Hs_appointmentsService.getAll({ filter: `_hs_doctor_value eq ${user.id}` }).then(async (apptsResult) => {
      const patientIds = [...new Set((apptsResult.data || []).map(a => a._hs_patient_value).filter(Boolean))];
      const lastVisitByPatient = {};
      (apptsResult.data || []).forEach(a => {
        const pid = a._hs_patient_value;
        if (!pid) return;
        if (!lastVisitByPatient[pid] || a.hs_appointmentdate > lastVisitByPatient[pid]) lastVisitByPatient[pid] = a.hs_appointmentdate;
      });
      if (!patientIds.length) { setPatients([]); return; }
      const [usersResult, allergiesResult, metricsResult] = await Promise.all([
        Hs_usersService.getAll({ filter: patientIds.map(id => `hs_userid eq ${id}`).join(' or ') }),
        Hs_allergiesService.getAll({ filter: patientIds.map(id => `_hs_patient_value eq ${id}`).join(' or ') }),
        Hs_healthmetricsService.getAll({ filter: patientIds.map(id => `_hs_user_value eq ${id}`).join(' or '), orderBy: ['hs_recordedat desc'] }),
      ]);
      const allergyByPatient = {};
      (allergiesResult.data || []).forEach(a => { if (!allergyByPatient[a._hs_patient_value]) allergyByPatient[a._hs_patient_value] = a.hs_allergen; });
      const bpByPatient = {};
      (metricsResult.data || []).forEach(m => { if (!(m._hs_user_value in bpByPatient)) bpByPatient[m._hs_user_value] = m.hs_systolic; });
      let list = (usersResult.data || []).map(u => ({
        id: u.hs_userid,
        name: u.hs_fullname,
        email: u.hs_emailaddress,
        nhs_id: u.hs_nhsidentifier,
        date_of_birth: u.hs_dateofbirth,
        gender: u.hs_gender,
        blood_type: u.hs_bloodtype,
        phone: u.hs_phonenumber,
        last_visit: lastVisitByPatient[u.hs_userid],
        allergy: allergyByPatient[u.hs_userid],
        bp_sys: bpByPatient[u.hs_userid],
      }));
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        list = list.filter(p => (p.name || '').toLowerCase().includes(term));
      }
      setPatients(list);
    }).finally(() => setLoading(false));
  }, [search]);

  const reloadDetails = async (id) => {
    const [labsResult, rxResult, allergiesResult, vitalsResult, notesResult] = await Promise.all([
      Hs_medicalrecordsService.getAll({ filter: `_hs_patient_value eq ${id}`, orderBy: ['hs_testdate desc'] }),
      Hs_prescriptionsService.getAll({ filter: `_hs_patient_value eq ${id}`, orderBy: ['createdon desc'] }),
      Hs_allergiesService.getAll({ filter: `_hs_patient_value eq ${id}` }),
      Hs_healthmetricsService.getAll({ filter: `_hs_user_value eq ${id}`, orderBy: ['hs_recordedat desc'], top: 10 }),
      Hs_clinicalnotesService.getAll({ filter: `_hs_patient_value eq ${id}`, orderBy: ['createdon desc'] }),
    ]);
    const noteRows = notesResult.data || [];
    const doctorIds = [...new Set(noteRows.map(n => n._hs_doctor_value).filter(Boolean))];
    let doctorNameById = {};
    if (doctorIds.length) {
      const doctorsRes = await Hs_usersService.getAll({ filter: doctorIds.map(d => `hs_userid eq ${d}`).join(' or ') });
      doctorNameById = Object.fromEntries((doctorsRes.data || []).map(u => [u.hs_userid, u.hs_fullname]));
    }
    const data = {
      labs: (labsResult.data || []).map(l => ({
        id: l.hs_medicalrecordid,
        testType: l.hs_testtype,
        result: l.hs_result,
        status: Hs_medicalrecordshs_status[l.hs_status] || 'pending',
        testDate: l.hs_testdate,
        filePath: null,
      })),
      prescriptions: (rxResult.data || []).map(p => ({
        id: p.hs_prescriptionid,
        medicationName: p.hs_medicationname,
        instructions: p.hs_instructions,
        dosage: p.hs_dosage,
        frequency: p.hs_frequency,
        startDate: p.hs_startdate,
        endDate: p.hs_enddate,
        status: p.hs_status == null || Hs_prescriptionshs_status[p.hs_status] === 'active' ? 'active' : 'ended',
        filePath: null,
      })),
      allergies: (allergiesResult.data || []).map(a => ({
        id: a.hs_allergyid,
        allergen: a.hs_allergen,
        severity: Hs_allergieshs_severity[a.hs_severity],
      })),
      vitals: (vitalsResult.data || []).map(v => ({
        systolic: v.hs_systolic,
        diastolic: v.hs_diastolic,
        heartRate: v.hs_heartrate,
        oxygenSaturation: v.hs_oxygensaturation,
        weight: v.hs_weight,
        steps: v.hs_steps,
        sleepHours: v.hs_sleephours,
      })),
      notes: noteRows.map(n => ({
        id: n.hs_clinicalnoteid,
        content: n.hs_content,
        doctor_name: doctorNameById[n._hs_doctor_value] || n.hs_doctorname || (n._hs_doctor_value === user.id ? user.name : undefined),
        createdAt: n.createdon,
      })),
    };
    setDetails(data);
    return data;
  };

  const viewDetails = async (patient) => {
    setSelected(patient);
    setTab('labs');
    setLabMsg(null);
    setRxMsg(null);
    setDetailLoading(true);
    await reloadDetails(patient.id);
    setDetailLoading(false);
  };

  const addNote = async (e) => {
    e.preventDefault();
    await Hs_clinicalnotesService.create({
      'hs_Patient@odata.bind': `/hs_users(${selected.id})`,
      'hs_Doctor@odata.bind': `/hs_users(${user.id})`,
      hs_notetitle: `${noteForm.note_type.replace('_', ' ')} note`,
      hs_notetype: NOTE_TYPE_CODES[noteForm.note_type],
      hs_content: noteForm.content,
    });
    setNoteMsg('Note added!');
    setNoteForm({ note_type: 'general', content: '' });
    await reloadDetails(selected.id);
    setTimeout(() => setNoteMsg(null), 3000);
  };

  const addLabResult = async (e) => {
    e.preventDefault();
    if (!labForm.test_type || !labForm.result) return;
    setLabSubmitting(true);
    try {
      await Hs_medicalrecordsService.create({
        'hs_Patient@odata.bind': `/hs_users(${selected.id})`,
        'hs_Doctor@odata.bind': `/hs_users(${user.id})`,
        hs_testtype: labForm.test_type,
        hs_result: labForm.result,
        hs_status: STATUS_CODES[labForm.status],
        hs_notes: labForm.notes || undefined,
        hs_testdate: labForm.test_date || undefined,
      });
      await reloadDetails(selected.id);
      setLabForm({ test_type: '', result: '', status: 'normal', notes: '', test_date: new Date().toISOString().split('T')[0] });
      setLabMsg(`Lab result added and is now visible to the patient.`);
      setTab('labs');
    } catch (err) {
      setLabMsg(err.message || 'Failed to add lab result.');
    } finally { setLabSubmitting(false); }
  };

  const addPrescription = async (e) => {
    e.preventDefault();
    if (!rxForm.medication_name || !rxForm.dosage || !rxForm.frequency) return;
    setRxSubmitting(true);
    try {
      const duration = parseInt(rxForm.duration, 10) || 30;
      const end = new Date(rxForm.start_date);
      end.setDate(end.getDate() + duration);
      await Hs_prescriptionsService.create({
        'hs_Patient@odata.bind': `/hs_users(${selected.id})`,
        'hs_Doctor@odata.bind': `/hs_users(${user.id})`,
        hs_medicationname: rxForm.medication_name,
        hs_dosage: rxForm.dosage,
        hs_frequency: rxForm.frequency,
        hs_duration: `${duration} days`,
        hs_startdate: rxForm.start_date || undefined,
        hs_enddate: end.toISOString().split('T')[0],
        hs_instructions: rxForm.instructions || undefined,
      });
      await reloadDetails(selected.id);
      setRxForm({ medication_name: '', dosage: '', frequency: '', duration: '30', start_date: new Date().toISOString().split('T')[0], instructions: '' });
      setRxMsg(`Prescription for ${rxForm.medication_name} added successfully.`);
      setTab('rx');
    } catch (err) {
      setRxMsg(err.message || 'Failed to add prescription.');
    } finally { setRxSubmitting(false); }
  };

  const calcAge = (dob) => {
    if (!dob) return '—';
    return Math.floor((new Date() - new Date(dob)) / (1000 * 60 * 60 * 24 * 365.25));
  };

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: selected ? '1fr 1.5fr' : '1fr' }}>
      {/* Patient List */}
      <div className="card" style={{ maxHeight: 'calc(100vh - 130px)', overflowY: 'auto' }}>
        <div className="card-header">
          <h3>Patients ({patients.length})</h3>
        </div>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <input className="form-control" placeholder="🔍 Search patients..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        {loading ? <div className="loading"><div className="spinner" /></div> : (
          patients.map(p => (
            <div key={p.id} onClick={() => viewDetails(p)}
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between',
                background: selected?.id === p.id ? '#eff6ff' : 'white',
              }}
              onMouseOver={e => { if (selected?.id !== p.id) e.currentTarget.style.background = '#f8faff'; }}
              onMouseOut={e => { if (selected?.id !== p.id) e.currentTarget.style.background = 'white'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="user-avatar">{p.name?.split(' ').map(n => n[0]).join('').slice(0,2)}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    NHS: {p.nhs_id} · Last: {p.last_visit ? new Date(p.last_visit).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A'}
                  </div>
                  {p.allergy && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>
                      <i className="fas fa-exclamation-triangle" /> {p.allergy}
                    </div>
                  )}
                </div>
              </div>
              {p.bp_sys && (
                <div style={{ textAlign: 'right', fontSize: 12, flexShrink: 0 }}>
                  <div style={{ fontWeight: 700 }}>{p.bp_sys}/{p.bp_sys - 42}</div>
                  <div style={{ color: 'var(--text-muted)' }}>mmHg</div>
                </div>
              )}
            </div>
          ))
        )}
        {!loading && !patients.length && <div className="empty-state"><div className="empty-icon">👥</div><p>No patients found</p></div>}
      </div>

      {/* Patient Details */}
      {selected && (
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 130px)' }}>
          {/* Header */}
          <div className="card mb-4">
            <div className="card-body" style={{ background: 'var(--primary)', borderRadius: 11, color: '#fff', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, flexShrink: 0 }}>
                {selected.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: 18 }}>{selected.name}</h4>
                <div style={{ fontSize: 13, opacity: .8 }}>
                  NHS ID: {selected.nhs_id} · DOB: {selected.date_of_birth ? new Date(selected.date_of_birth).toLocaleDateString('en-GB') : '—'} · Blood: {selected.blood_type || '—'}
                </div>
              </div>
              <Link to="/doctor/messages" className="btn btn-sm btn-primary"><i className="fas fa-comment" /> Message</Link>
              <button className="btn btn-sm btn-ghost" style={{ color: '#fff' }} onClick={() => setSelected(null)}>✕</button>
            </div>
          </div>

          {/* Quick info grid */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="grid grid-2 gap-3">
                {[
                  ['Age', calcAge(selected.date_of_birth) + ' years'],
                  ['NHS ID', selected.nhs_id],
                  ['Blood Type', selected.blood_type || 'Unknown'],
                  ['Gender', selected.gender || 'Not specified'],
                  ['Phone', selected.phone || '—'],
                  ['Email', selected.email],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {detailLoading ? <div className="loading"><div className="spinner" /></div> : details && (
            <>
              {/* Vitals */}
              {details.vitals?.length > 0 && (
                <div className="card mb-4">
                  <div className="card-header"><h3>Latest Vitals</h3></div>
                  <div className="card-body">
                    {(() => {
                      const v = details.vitals[0];
                      return (
                        <div className="grid grid-3 gap-2">
                          {[
                            ['BP', v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : '—', 'mmHg'],
                            ['Heart Rate', v.heartRate || '—', 'bpm'],
                            ['SpO2', v.oxygenSaturation ? `${v.oxygenSaturation}%` : '—', ''],
                            ['Weight', v.weight ? `${v.weight} kg` : '—', ''],
                            ['Steps', v.steps ? v.steps.toLocaleString() : '—', ''],
                            ['Sleep', v.sleepHours ? `${v.sleepHours}h` : '—', ''],
                          ].map(([l, val]) => (
                            <div key={l} style={{ textAlign: 'center', background: 'var(--bg)', borderRadius: 8, padding: 10 }}>
                              <div style={{ fontWeight: 700, fontSize: 16 }}>{val}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Allergies */}
              {details.allergies?.length > 0 && (
                <div className="card mb-4">
                  <div className="card-header"><h3>⚠️ Allergies</h3></div>
                  <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {details.allergies.map(a => (
                      <span key={a.id} className={`badge badge-${a.severity === 'severe' ? 'danger' : 'warning'}`}
                        style={{ fontSize: 13, padding: '4px 12px' }}>
                        {a.allergen} ({a.severity})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab nav */}
              <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 10, padding: 5, border: '1px solid var(--border)', marginBottom: 14, width: 'fit-content', flexWrap: 'wrap' }}>
                {PTABS.map(([k, ic, lbl]) => (
                  <button key={k} onClick={() => setTab(k)}
                    style={{
                      padding: '7px 14px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: tab === k ? 'var(--primary-light)' : 'transparent',
                      color: tab === k ? '#fff' : 'var(--text-muted)', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}>
                    <i className={`fas ${ic}`} /> {lbl}
                  </button>
                ))}
              </div>

              {/* Lab Results */}
              {tab === 'labs' && (
                <div className="card mb-4">
                  <div className="card-header">
                    <h3><i className="fas fa-flask" /> Lab Results ({details.labs?.length || 0})</h3>
                    <button className="btn btn-sm btn-outline" onClick={() => setTab('add-lab')}>+ Add Result</button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Test</th><th>Result</th><th>Status</th><th>Date</th><th>File</th></tr></thead>
                      <tbody>
                        {details.labs?.length ? details.labs.map(l => (
                          <tr key={l.id}>
                            <td style={{ fontWeight: 600 }}>{l.testType}</td>
                            <td style={{ fontSize: 12, maxWidth: 220 }}>{l.result}</td>
                            <td>{labStatusBadge(l.status)}</td>
                            <td style={{ fontSize: 12 }}>{l.testDate ? new Date(l.testDate).toLocaleDateString('en-GB') : '—'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {l.filePath ? (
                                <a href={`${FILE_BASE}/uploads/${l.filePath}`} target="_blank" rel="noreferrer" download
                                  style={{ fontSize: 11, background: '#16A34A', color: '#fff', padding: '3px 8px', borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}>
                                  <i className="fas fa-download" /> File
                                </a>
                              ) : <span style={{ fontSize: 11, color: '#ccc' }}>—</span>}
                            </td>
                          </tr>
                        )) : <tr><td colSpan={5}><div className="empty-state">No lab results yet</div></td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Prescriptions */}
              {tab === 'rx' && (
                <div className="card mb-4">
                  <div className="card-header">
                    <h3><i className="fas fa-pills" /> Prescriptions ({details.prescriptions?.length || 0})</h3>
                    <button className="btn btn-sm btn-outline" onClick={() => setTab('add-rx')}>+ New Prescription</button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Start</th><th>End</th><th>Status</th><th>File</th></tr></thead>
                      <tbody>
                        {details.prescriptions?.length ? details.prescriptions.map(m => {
                          const ended = m.endDate && new Date(m.endDate) < new Date();
                          return (
                            <tr key={m.id}>
                              <td><strong>{m.medicationName}</strong><br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.instructions || ''}</span></td>
                              <td>{m.dosage}</td>
                              <td>{m.frequency}</td>
                              <td style={{ fontSize: 12 }}>{m.startDate ? new Date(m.startDate).toLocaleDateString('en-GB') : '—'}</td>
                              <td style={{ fontSize: 12, color: ended ? 'var(--danger)' : 'inherit' }}>{m.endDate ? new Date(m.endDate).toLocaleDateString('en-GB') : '—'}</td>
                              <td><span className={`badge badge-${m.status === 'active' ? 'success' : 'gray'}`}>{m.status}</span></td>
                              <td>
                                {m.filePath ? (
                                  <a href={`${FILE_BASE}/uploads/${m.filePath}`} target="_blank" rel="noreferrer" download
                                    style={{ fontSize: 11, background: '#7C3AED', color: '#fff', padding: '3px 8px', borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}>
                                    <i className="fas fa-download" /> File
                                  </a>
                                ) : <span style={{ fontSize: 11, color: '#ccc' }}>—</span>}
                              </td>
                            </tr>
                          );
                        }) : <tr><td colSpan={7}><div className="empty-state">No prescriptions yet</div></td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Add Lab Result */}
              {tab === 'add-lab' && (
                <div className="card mb-4">
                  <div className="card-header"><h3><i className="fas fa-plus-circle" style={{ color: '#16A34A' }} /> Add Lab Result</h3></div>
                  <div className="card-body">
                    {labMsg && <div className="alert alert-success mb-3">{labMsg}</div>}
                    <form onSubmit={addLabResult}>
                      <div className="grid grid-2 gap-2">
                        <div className="form-group">
                          <label className="form-label">Test Type *</label>
                          <select className="form-control" required value={labForm.test_type}
                            onChange={e => setLabForm({ ...labForm, test_type: e.target.value })}>
                            <option value="">Select test</option>
                            {TEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Result Status *</label>
                          <select className="form-control" value={labForm.status}
                            onChange={e => setLabForm({ ...labForm, status: e.target.value })}>
                            {['normal','elevated','low','critical','pending'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Result / Findings *</label>
                        <textarea className="form-control" rows={3} required placeholder="e.g. Haemoglobin 13.5 g/dL — within normal range..."
                          value={labForm.result} onChange={e => setLabForm({ ...labForm, result: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Test Date</label>
                        <input type="date" className="form-control" value={labForm.test_date}
                          onChange={e => setLabForm({ ...labForm, test_date: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Clinical Notes (optional)</label>
                        <textarea className="form-control" rows={2} placeholder="Clinical interpretation, recommendations..."
                          value={labForm.notes} onChange={e => setLabForm({ ...labForm, notes: e.target.value })} />
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="submit" className="btn btn-primary" disabled={labSubmitting}>
                          <i className="fas fa-save" /> {labSubmitting ? 'Saving...' : 'Save & Notify Patient'}
                        </button>
                        <button type="button" className="btn btn-outline" onClick={() => setTab('labs')}>Cancel</button>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                        <i className="fas fa-info-circle" /> This result will immediately appear in the patient's Medical Records dashboard.
                      </p>
                    </form>
                  </div>
                </div>
              )}

              {/* Add Prescription */}
              {tab === 'add-rx' && (
                <div className="card mb-4">
                  <div className="card-header"><h3><i className="fas fa-prescription" style={{ color: '#7C3AED' }} /> Add Prescription</h3></div>
                  <div className="card-body">
                    {rxMsg && <div className="alert alert-success mb-3">{rxMsg}</div>}
                    <form onSubmit={addPrescription}>
                      <div className="grid grid-2 gap-2">
                        <div className="form-group">
                          <label className="form-label">Medication Name *</label>
                          <input className="form-control" required placeholder="e.g. Metformin" value={rxForm.medication_name}
                            onChange={e => setRxForm({ ...rxForm, medication_name: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Dosage *</label>
                          <input className="form-control" required placeholder="e.g. 500mg" value={rxForm.dosage}
                            onChange={e => setRxForm({ ...rxForm, dosage: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Frequency *</label>
                          <select className="form-control" required value={rxForm.frequency}
                            onChange={e => setRxForm({ ...rxForm, frequency: e.target.value })}>
                            <option value="">Select frequency...</option>
                            {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Duration</label>
                          <select className="form-control" value={rxForm.duration}
                            onChange={e => setRxForm({ ...rxForm, duration: e.target.value })}>
                            <option value="7">7 days</option>
                            <option value="14">14 days</option>
                            <option value="30">1 month</option>
                            <option value="60">2 months</option>
                            <option value="90">3 months</option>
                            <option value="180">6 months</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Start Date</label>
                          <input type="date" className="form-control" value={rxForm.start_date}
                            onChange={e => setRxForm({ ...rxForm, start_date: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Special Instructions</label>
                          <input className="form-control" placeholder="e.g. Take with food" value={rxForm.instructions}
                            onChange={e => setRxForm({ ...rxForm, instructions: e.target.value })} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="submit" className="btn btn-primary" disabled={rxSubmitting}>
                          <i className="fas fa-pills" /> {rxSubmitting ? 'Saving...' : 'Issue Prescription'}
                        </button>
                        <button type="button" className="btn btn-outline" onClick={() => setTab('rx')}>Cancel</button>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                        <i className="fas fa-info-circle" /> This prescription will immediately appear in the patient's Medications tab.
                      </p>
                    </form>
                  </div>
                </div>
              )}

              {/* Notes */}
              {tab === 'notes' && (
                <div className="card">
                  <div className="card-header"><h3><i className="fas fa-notes-medical" /> Clinical Notes</h3></div>
                  <div className="card-body">
                    {noteMsg && <div className="alert alert-success mb-3">{noteMsg}</div>}
                    {!details.notes?.length && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>No notes yet.</p>}
                    {details.notes?.map(note => (
                      <div key={note.id} style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 10, borderLeft: '3px solid var(--primary-light)' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                          Dr. {note.doctor_name} · {timeAgo(note.createdAt)}
                        </div>
                        <p style={{ fontSize: 13, margin: 0 }}>{note.content}</p>
                      </div>
                    ))}
                    <form onSubmit={addNote}>
                      <div className="form-group">
                        <label className="form-label">Note Type</label>
                        <select className="form-control" value={noteForm.note_type}
                          onChange={e => setNoteForm({...noteForm, note_type: e.target.value})}>
                          {['general','follow_up','diagnosis','prescription','referral'].map(t => (
                            <option key={t} value={t}>{t.replace('_',' ')}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Note Content</label>
                        <textarea className="form-control" rows={2} required placeholder="Add clinical note..."
                          value={noteForm.content} onChange={e => setNoteForm({...noteForm, content: e.target.value})} />
                      </div>
                      <button type="submit" className="btn btn-primary btn-sm"><i className="fas fa-save" /> Add Note</button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
