import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Hs_prescriptionsService } from '../../generated/services/Hs_prescriptionsService';
import { Hs_prescriptionshs_status } from '../../generated/models/Hs_prescriptionsModel';
import { Hs_appointmentsService } from '../../generated/services/Hs_appointmentsService';
import { Hs_usersService } from '../../generated/services/Hs_usersService';

function toPrescription(r, patientNameById) {
  return {
    id: r.hs_prescriptionid,
    patient_name: patientNameById[r._hs_patient_value] || r.hs_patientname,
    medication_name: r.hs_medicationname,
    dosage: r.hs_dosage,
    frequency: r.hs_frequency,
    startDate: r.hs_startdate,
    endDate: r.hs_enddate,
    status: r.hs_status == null || Hs_prescriptionshs_status[r.hs_status] === 'active' ? 'active' : 'ended',
  };
}

export default function DoctorPrescriptions() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ patient_id: '', medication_name: '', dosage: '', frequency: '', duration: '', start_date: new Date().toISOString().split('T')[0], end_date: '', instructions: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    Promise.all([
      Hs_prescriptionsService.getAll({ filter: `_hs_doctor_value eq ${user.id}`, orderBy: ['createdon desc'] }),
      Hs_appointmentsService.getAll({ filter: `_hs_doctor_value eq ${user.id}` }),
    ]).then(async ([p, appts]) => {
      const rxRows = p.data || [];
      const patientIds = [...new Set([...rxRows.map(r => r._hs_patient_value), ...(appts.data || []).map(a => a._hs_patient_value)].filter(Boolean))];
      let patientNameById = {};
      if (patientIds.length) {
        const usersResult = await Hs_usersService.getAll({ filter: patientIds.map(id => `hs_userid eq ${id}`).join(' or ') });
        const userRows = usersResult.data || [];
        patientNameById = Object.fromEntries(userRows.map(u => [u.hs_userid, u.hs_fullname]));
        setPatients(userRows.map(u => ({ id: u.hs_userid, name: u.hs_fullname })));
      } else {
        setPatients([]);
      }
      setPrescriptions(rxRows.map(r => toPrescription(r, patientNameById)));
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await Hs_prescriptionsService.create({
        'hs_Patient@odata.bind': `/hs_users(${form.patient_id})`,
        'hs_Doctor@odata.bind': `/hs_users(${user.id})`,
        hs_medicationname: form.medication_name,
        hs_dosage: form.dosage || undefined,
        hs_frequency: form.frequency || undefined,
        hs_duration: form.duration || undefined,
        hs_startdate: form.start_date || undefined,
        hs_enddate: form.end_date || undefined,
        hs_instructions: form.instructions || undefined,
      });
      load(); setShowModal(false);
    } catch (err) { alert(err.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="flex-between mb-4">
        <div />
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Issue Prescription</button>
      </div>
      <div className="card">
        <div className="card-header">
          <h3><i className="fas fa-pills" /> All Prescriptions ({prescriptions.length})</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Patient</th><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
            <tbody>
              {prescriptions.length ? prescriptions.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.patient_name}</td>
                  <td>💊 {p.medication_name}</td>
                  <td>{p.dosage}</td>
                  <td>{p.frequency}</td>
                  <td>{p.startDate ? new Date(p.startDate).toLocaleDateString('en-GB') : '—'}</td>
                  <td>{p.endDate ? new Date(p.endDate).toLocaleDateString('en-GB') : '—'}</td>
                  <td><span className={`badge badge-${p.status === 'active' ? 'success' : 'gray'}`}>{p.status === 'active' ? 'Active' : 'Ended'}</span></td>
                </tr>
              )) : <tr><td colSpan={7}><div className="empty-state">No prescriptions</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <h3>Issue Prescription</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Patient *</label>
                  <select className="form-control" required value={form.patient_id} onChange={e => setForm({...form, patient_id: e.target.value})}>
                    <option value="">Select patient</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Medication Name *</label>
                  <input className="form-control" required value={form.medication_name} onChange={e => setForm({...form, medication_name: e.target.value})} />
                </div>
                <div className="grid grid-2 gap-2">
                  <div className="form-group"><label className="form-label">Dosage *</label><input className="form-control" required value={form.dosage} onChange={e => setForm({...form, dosage: e.target.value})} placeholder="e.g. 500mg" /></div>
                  <div className="form-group"><label className="form-label">Frequency *</label><input className="form-control" required value={form.frequency} onChange={e => setForm({...form, frequency: e.target.value})} placeholder="e.g. Twice daily" /></div>
                  <div className="form-group"><label className="form-label">Duration</label><input className="form-control" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} placeholder="e.g. 7 days" /></div>
                  <div className="form-group"><label className="form-label">Start Date</label><input type="date" className="form-control" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">End Date</label><input type="date" className="form-control" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></div>
                </div>
                <div className="form-group"><label className="form-label">Instructions</label><textarea className="form-control" rows={3} value={form.instructions} onChange={e => setForm({...form, instructions: e.target.value})} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Issuing...' : 'Issue Prescription'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
