import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Hs_doctorsService } from '../../generated/services/Hs_doctorsService';
import { Hs_appointmentsService } from '../../generated/services/Hs_appointmentsService';
import { Hs_appointmentshs_status } from '../../generated/models/Hs_appointmentsModel';
import { toDoctor, fetchSlots, STATUS_CODES } from '../../lib/doctorSlots';

const statusBadge = (s) => {
  const map = { pending: 'warning', confirmed: 'info', completed: 'success', cancelled: 'danger', arrived: 'purple', waiting: 'warning' };
  return <span className={`badge badge-${map[s] || 'gray'}`}>{s}</span>;
};

function toAppointment(record) {
  return {
    id: record.hs_appointmentid,
    doctorUserId: record._hs_doctor_value,
    doctor_name: record.hs_doctorname,
    appointmentDate: record.hs_appointmentdate,
    appointmentTime: record.hs_appointmenttime,
    reason: record.hs_reason,
    status: Hs_appointmentshs_status[record.hs_status] || 'pending',
  };
}

function BookModal({ doctors, initialDoctor, onClose, onBooked }) {
  const [doctorId, setDoctorId] = useState(initialDoctor ? String(initialDoctor.id) : '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [slots, setSlots] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsMsg, setSlotsMsg] = useState('Select a doctor and date to see available slots');
  const [loading, setLoading] = useState(false);

  const selectedDoctor = doctors.find(d => String(d.id) === String(doctorId));

  useEffect(() => {
    if (!doctorId || !date) {
      setSlots(null);
      setSlotsMsg('Select a doctor and date to see available slots');
      return;
    }
    setTime('');
    setSlotsLoading(true);
    setSlots(null);
    fetchSlots(doctorId, selectedDoctor?.userId, date)
      .then((data) => {
        if (!data.slots || data.slots.length === 0) {
          setSlots([]);
          setSlotsMsg(data.message ? `No availability — this doctor is not available on ${data.day || 'this day'}.` : 'No slots available for this date.');
        } else {
          setSlots(data.slots);
          setSlotsMsg(`${data.available} slot${data.available !== 1 ? 's' : ''} available on ${data.day} — click to select`);
        }
      })
      .catch(() => { setSlots([]); setSlotsMsg('Could not load slots. Please try again.'); })
      .finally(() => setSlotsLoading(false));
  }, [doctorId, date]);

  const { user } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    if (!doctorId) return alert('Please select a doctor');
    if (!date) return alert('Please select a date');
    if (!time) return alert('Please select a time slot');
    setLoading(true);
    try {
      const result = await Hs_appointmentsService.create({
        hs_appointment1: reason || `Appointment with Dr. ${selectedDoctor.name}`,
        'hs_Patient@odata.bind': `/hs_users(${user.id})`,
        'hs_Doctor@odata.bind': `/hs_users(${selectedDoctor.userId})`,
        hs_appointmentdate: date,
        hs_appointmenttime: new Date(`1970-01-01T${time}:00`).toISOString(),
        hs_reason: reason || undefined,
        hs_status: STATUS_CODES.pending,
      });
      if (!result.success) throw result.error || new Error('Failed to book appointment');
      onBooked();
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to book appointment');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3><i className="fas fa-calendar-plus" /> Book Appointment</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {selectedDoctor && (
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 16px', marginBottom: 14, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, color: 'var(--primary)' }}>Dr. {selectedDoctor.name}</div>
                <div style={{ fontSize: 12, color: 'var(--primary-light)' }}>{selectedDoctor.specialization || 'General Practice'}</div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Select Doctor *</label>
              <select className="form-control" value={doctorId} onChange={e => setDoctorId(e.target.value)} required>
                <option value="">Choose a doctor...</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>Dr. {d.name} — {d.specialization || 'General Practice'} ({d.hospital || 'N/A'})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-control" min={new Date().toISOString().split('T')[0]}
                value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Available Time Slots *</label>
              <div style={{ minHeight: 56, border: '1.5px solid var(--border)', borderRadius: 9, padding: 12, background: '#FAFCFF' }}>
                {slotsLoading ? (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                    <i className="fas fa-spinner fa-spin" /> Loading available slots...
                  </div>
                ) : slots && slots.length > 0 ? (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      {slots.map(s => (
                        <button type="button" key={s.time} className={`slot-btn${time === s.time ? ' selected' : ''}`}
                          disabled={!s.available} title={!s.available ? 'Already booked' : ''}
                          onClick={() => setTime(s.time)}>
                          {s.time}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      <i className="fas fa-check-circle" style={{ color: '#16A34A' }} /> {slotsMsg}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                    <i className={`fas ${slots && slots.length === 0 ? 'fa-calendar-times' : 'fa-info-circle'}`} style={slots && slots.length === 0 ? { color: 'var(--danger)' } : {}} /> {slotsMsg}
                  </div>
                )}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Reason / Symptoms</label>
              <textarea className="form-control" rows={3} placeholder="Brief description of your concern..."
                value={reason} onChange={e => setReason(e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Booking...' : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PatientAppointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [bookDoctor, setBookDoctor] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = () => {
    Hs_appointmentsService.getAll({ filter: `_hs_patient_value eq ${user.id}`, orderBy: ['hs_appointmentdate desc'] })
      .then(result => setAppointments((result.data || []).map(toAppointment)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    Hs_doctorsService.getAll().then(result => setDoctors((result.data || []).map(toDoctor)));
  }, []);

  const cancel = async (id) => {
    if (!confirm('Cancel this appointment?')) return;
    await Hs_appointmentsService.update(id, { hs_status: STATUS_CODES.cancelled });
    load();
  };

  const doctorByUserId = Object.fromEntries(doctors.map(d => [d.userId, d]));

  const openBooking = (doctor = null) => {
    setBookDoctor(doctor);
    setShowModal(true);
  };

  const today = new Date().toISOString().split('T')[0];
  const filtered = appointments.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'upcoming') return ['pending', 'confirmed'].includes(a.status) && new Date(a.appointmentDate).toISOString().split('T')[0] >= today;
    if (filter === 'completed') return a.status === 'completed';
    return a.status === filter;
  });

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h2 style={{ margin: 0 }}><i className="fas fa-calendar-check" style={{ color: 'var(--primary-light)' }} /> Doctor Appointments</h2>
          <div className="text-muted text-sm">Book, view and manage your consultations</div>
        </div>
        <button className="btn btn-primary" onClick={() => openBooking()}>
          <i className="fas fa-plus" /> Book Appointment
        </button>
      </div>

      {/* Available Specialists */}
      <div className="mb-4">
        <h6 style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 14 }}>Available Specialists</h6>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {doctors.map(d => (
            <div className="doctor-card" key={d.id} onClick={() => openBooking(d)}>
              <div className="doc-avatar"><i className="fas fa-user-md" /></div>
              <div className="doc-info">
                <div className="doc-name">Dr. {d.name}</div>
                <div className="doc-spec">{d.specialization || 'General Practice'}</div>
                <div className="doc-meta">
                  <span className="star-rating">{'★'.repeat(Math.round(Number(d.rating) || 0))}</span>{' '}
                  <strong>{d.rating}</strong>
                </div>
                <div className="doc-meta">
                  <i className="fas fa-hospital" style={{ fontSize: 11 }} /> {d.hospital || 'N/A'}
                </div>
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-sm btn-primary" onClick={e => { e.stopPropagation(); openBooking(d); }}>
                    <i className="fas fa-calendar-plus" /> Book
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!doctors.length && <div className="text-muted text-sm">No doctors available.</div>}
        </div>
      </div>

      {/* Appointments table */}
      <div className="card">
        <div className="flex-between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, color: 'var(--primary)' }}><i className="fas fa-list" /> All Appointments</span>
          <div className="flex gap-2">
            {['all', 'upcoming', 'completed'].map(s => (
              <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Doctor</th><th>Specialization</th><th>Date & Time</th><th>Reason</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map(a => {
                const doc = doctorByUserId[a.doctorUserId];
                return (
                <tr key={a.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>
                        <i className="fas fa-user-md" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>Dr. {doc?.name || a.doctor_name || 'Unknown'}</div>
                        <div className="text-muted text-sm">{doc?.hospital || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td>{doc?.specialization || 'General Practice'}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{new Date(a.appointmentDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    <div className="text-muted text-sm">{new Date(a.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                  </td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.reason || '—'}</td>
                  <td>{statusBadge(a.status)}</td>
                  <td>
                    {['pending', 'confirmed'].includes(a.status) && new Date(a.appointmentDate).toISOString().split('T')[0] >= today ? (
                      <button className="btn btn-sm btn-danger" onClick={() => cancel(a.id)}><i className="fas fa-times" /> Cancel</button>
                    ) : <span className="text-muted text-sm">—</span>}
                  </td>
                </tr>
              );}) : (
                <tr><td colSpan={6} className="empty-state">No appointments found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <BookModal doctors={doctors} initialDoctor={bookDoctor} onClose={() => setShowModal(false)} onBooked={load} />
      )}
    </div>
  );
}
