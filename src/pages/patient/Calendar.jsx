import { useState, useEffect, useRef, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Hs_doctorsService } from '../../generated/services/Hs_doctorsService';
import { Hs_appointmentsService } from '../../generated/services/Hs_appointmentsService';
import { Hs_appointmentshs_status } from '../../generated/models/Hs_appointmentsModel';
import { toDoctor, fetchSlots, STATUS_CODES } from '../../lib/doctorSlots';

function toAppointment(record, doctorByUserId) {
  const doc = doctorByUserId[record._hs_doctor_value];
  return {
    id: record.hs_appointmentid,
    doctorUserId: record._hs_doctor_value,
    doctor_name: doc?.name || record.hs_doctorname,
    specialization: doc?.specialization,
    appointmentDate: record.hs_appointmentdate,
    appointmentTime: record.hs_appointmenttime,
    reason: record.hs_reason,
    status: Hs_appointmentshs_status[record.hs_status] || 'pending',
  };
}

function toCalendarEvent(record, doctorByUserId) {
  const doc = doctorByUserId[record._hs_doctor_value];
  const status = Hs_appointmentshs_status[record.hs_status] || 'pending';
  const dateStr = (record.hs_appointmentdate || '').slice(0, 10);
  const t = new Date(record.hs_appointmenttime);
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const color = STATUS_COLORS[status] || '#5E7A99';
  const rawName = doc?.name || record.hs_doctorname || '';
  const docName = /^dr\.?\s/i.test(rawName) ? rawName : `Dr. ${rawName}`;
  return {
    id: record.hs_appointmentid,
    title: docName,
    start: `${dateStr}T${hh}:${mm}:00`,
    backgroundColor: color,
    borderColor: color,
    extendedProps: {
      status,
      date: dateStr,
      time: `${hh}:${mm}`,
      reason: record.hs_reason,
      hospital: doc?.hospital,
      specialization: doc?.specialization,
    },
  };
}

const STATUS_COLORS = {
  confirmed: '#1565C0', pending: '#D97706', arrived: '#0891B2',
  waiting: '#7C3AED', completed: '#16A34A', cancelled: '#94A3B8',
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function formatDateLabel(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function MiniCalendar({ appointments, onSelectDate }) {
  const [miniDate, setMiniDate] = useState(new Date());
  const year = miniDate.getFullYear();
  const month = miniDate.getMonth();
  const today = new Date();

  const apptDates = useMemo(() => new Set(appointments.map(a => new Date(a.appointmentDate).toISOString().slice(0, 10))), [appointments]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <div className="card">
      <div className="flex-between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>
          <i className="fas fa-calendar" /> {MONTH_NAMES[month]} {year}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setMiniDate(new Date(year, month - 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 4 }}>‹</button>
          <button onClick={() => setMiniDate(new Date(year, month + 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 4 }}>›</button>
        </div>
      </div>
      <div style={{ padding: 10 }}>
        <table className="mini-cal">
          <thead><tr>{DAY_NAMES.map(d => <th key={d}>{d}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((d, ci) => {
                  if (!d) return <td key={ci}></td>;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
                  const hasAppt = apptDates.has(dateStr);
                  return (
                    <td key={ci}>
                      <span className={`day-num${isToday ? ' today' : ''}${hasAppt ? ' has-appt' : ''}`} onClick={() => onSelectDate(dateStr)}>{d}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventPopup({ event, pos, onClose, onCancel }) {
  if (!event) return null;
  const props = event.extendedProps;
  const color = STATUS_COLORS[props.status] || '#5E7A99';
  const canCancel = !['cancelled', 'completed'].includes(props.status);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2999 }} />
      <div className="event-popup" style={{ left: pos.x, top: pos.y }}>
        <div className="popup-header" style={{ background: color }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{event.title}</div>
              <div style={{ fontSize: 12, opacity: .75, marginTop: 2 }}>{props.specialization || ''}</div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 14 }}>&times;</button>
          </div>
        </div>
        <div className="popup-body">
          <div className="popup-row"><i className="fas fa-calendar" /><div>{formatDateLabel(props.date)}</div></div>
          <div className="popup-row"><i className="fas fa-clock" /><div>{props.time}</div></div>
          <div className="popup-row"><i className="fas fa-notes-medical" /><div>{props.reason || '—'}</div></div>
          <div className="popup-row"><i className="fas fa-hospital" /><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{props.hospital || '—'}</div></div>
          <div className="popup-row"><i className="fas fa-circle" style={{ fontSize: 8, color }} /><div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{props.status}</div></div>
        </div>
        <div className="popup-actions">
          {canCancel && (
            <button className="btn btn-sm btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={onCancel}>
              <i className="fas fa-times" /> Cancel
            </button>
          )}
          <button className="btn btn-sm btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}

function BookModal({ doctors, initialDate, onClose, onBooked }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [specFilter, setSpecFilter] = useState('');
  const [doctorId, setDoctorId] = useState(null);
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [slots, setSlots] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsMsg, setSlotsMsg] = useState('Select a date to see available slots');
  const [submitting, setSubmitting] = useState(false);

  const specs = useMemo(() => [...new Set(doctors.map(d => d.specialization).filter(Boolean))], [doctors]);
  const selectedDoctor = doctors.find(d => d.id === doctorId);

  const filteredDoctors = doctors.filter(d => {
    const q = search.toLowerCase();
    const matchesSearch = !q || d.name.toLowerCase().includes(q) || (d.specialization || '').toLowerCase().includes(q);
    const matchesSpec = !specFilter || d.specialization === specFilter;
    return matchesSearch && matchesSpec;
  });

  useEffect(() => {
    if (step !== 2 || !doctorId || !date) return;
    setTime('');
    setSlotsLoading(true);
    setSlots(null);
    fetchSlots(doctorId, selectedDoctor?.userId, date)
      .then((data) => {
        if (!data.slots || data.slots.length === 0) {
          setSlots([]);
          setSlotsMsg(data.message ? `Doctor is not available on ${data.day || 'this day'}.` : 'No slots available for this date.');
        } else {
          setSlots(data.slots);
          setSlotsMsg(`${data.available} slot${data.available !== 1 ? 's' : ''} available on ${data.day}`);
        }
      })
      .catch(() => { setSlots([]); setSlotsMsg('Could not load slots. Please try again.'); })
      .finally(() => setSlotsLoading(false));
  }, [step, doctorId, date]);

  const confirmBooking = async () => {
    setSubmitting(true);
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
      if (!result.success) throw result.error || new Error('Booking failed. Please try again.');
      onBooked();
      onClose();
    } catch (err) {
      alert(err.message || 'Booking failed. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div>
            <h3><i className="fas fa-calendar-plus" /> Book New Appointment</h3>
            {initialDate && <div style={{ fontSize: 12, opacity: .75, marginTop: 2 }}>Selected: {formatDateLabel(date)}</div>}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
            {['Select Doctor', 'Choose Time', 'Confirm'].map((label, i) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <div className="step-indicator" style={{ background: i + 1 <= step ? 'var(--primary-light)' : 'var(--border)', color: i + 1 <= step ? '#fff' : 'var(--text-muted)' }}>{i + 1}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>{label}</div>
                </div>
                {i < 2 && <div style={{ height: 2, flex: 1, background: 'var(--border)', margin: '0 -10px', marginBottom: 16 }} />}
              </div>
            ))}
          </div>

          {/* Step 1: Doctor */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginBottom: 12 }}>Choose a Specialist</div>
              <input type="text" className="form-control" placeholder="Search doctors..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 14 }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <button className={`spec-btn${!specFilter ? ' active' : ''}`} onClick={() => setSpecFilter('')}>All</button>
                {specs.map(s => (
                  <button key={s} className={`spec-btn${specFilter === s ? ' active' : ''}`} onClick={() => setSpecFilter(s)}>{s}</button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
                {filteredDoctors.map(d => (
                  <label className={`doc-option${doctorId === d.id ? ' selected' : ''}`} key={d.id} onClick={() => setDoctorId(d.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                        {d.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>Dr. {d.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--primary-light)' }}>{d.specialization || 'General Practice'}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: '#F59E0B' }}>{'★'.repeat(Math.round(Number(d.rating) || 0))}</span> {d.rating}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                      <i className="fas fa-hospital" style={{ width: 14 }} /> {d.hospital || 'N/A'}
                    </div>
                  </label>
                ))}
                {!filteredDoctors.length && <div className="text-muted text-sm">No doctors match your search.</div>}
              </div>
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <button className="btn btn-primary" disabled={!doctorId} onClick={() => setStep(2)}>
                  Next: Choose Time <i className="fas fa-arrow-right" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Date & Time */}
          {step === 2 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Appointment Date</label>
                  <input type="date" className="form-control" min={new Date().toISOString().split('T')[0]} value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Reason / Symptoms</label>
                  <input type="text" className="form-control" placeholder="e.g. Annual check-up" value={reason} onChange={e => setReason(e.target.value)} />
                </div>
              </div>

              <label className="form-label">Available Time Slots</label>
              {slotsLoading ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  <i className="fas fa-spinner fa-spin" /> Loading available slots...
                </div>
              ) : slots && slots.length > 0 ? (
                <div className="time-slot-grid">
                  {slots.map(s => (
                    <button type="button" key={s.time} className={`time-slot${time === s.time ? ' selected' : ''}`}
                      disabled={!s.available} title={!s.available ? 'Already booked' : ''}
                      onClick={() => setTime(s.time)}>
                      {s.time}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  <i className="fas fa-calendar-times" style={{ color: 'var(--danger)' }} /> {slotsMsg}
                </div>
              )}
              {slots && slots.length > 0 && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>{slotsMsg}</div>}

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(1)}>
                  <i className="fas fa-arrow-left" /> Back
                </button>
                <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} disabled={!time} onClick={() => setStep(3)}>
                  Review Booking <i className="fas fa-arrow-right" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div>
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text-muted)', marginBottom: 16 }}>Booking Summary</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>
                    <i className="fas fa-user-md" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>Dr. {selectedDoctor?.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--primary-light)' }}>{selectedDoctor?.specialization || 'General Practice'}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[['fa-calendar', 'Date', formatDateLabel(date)], ['fa-clock', 'Time', time], ['fa-notes-medical', 'Reason', reason || 'Not specified'], ['fa-shield-alt', 'Status', 'Will be Pending']].map(([icon, label, val]) => (
                    <div key={label} style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>
                        <i className={`fas ${icon}`} style={{ color: 'var(--primary-light)', marginRight: 4 }} />{label}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary)' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#EFF6FF', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 13, color: '#1E40AF' }}>
                <i className="fas fa-info-circle" />
                <span>You'll receive a confirmation notification immediately after booking.</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(2)}>
                  <i className="fas fa-arrow-left" /> Back
                </button>
                <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} disabled={submitting} onClick={confirmBooking}>
                  {submitting ? <><i className="fas fa-spinner fa-spin" /> Booking...</> : <><i className="fas fa-check" /> Confirm Appointment</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PatientCalendar() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [events, setEvents] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(null); // { event, pos }
  const [bookModal, setBookModal] = useState(null); // date string or null
  const calendarRef = useRef(null);

  const load = () => {
    Promise.all([
      Hs_appointmentsService.getAll({ filter: `_hs_patient_value eq ${user.id}` }),
      Hs_doctorsService.getAll(),
    ]).then(([apptsRes, docsRes]) => {
      const doctorByUserId = Object.fromEntries((docsRes.data || []).map(d => [d._hs_user_value, toDoctor(d)]));
      const rows = apptsRes.data || [];
      setAppointments(rows.map(r => toAppointment(r, doctorByUserId)));
      setEvents(rows.map(r => toCalendarEvent(r, doctorByUserId)));
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    Hs_doctorsService.getAll().then(r => setDoctors((r.data || []).map(toDoctor)));
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const stats = useMemo(() => ({
    total: appointments.length,
    today: appointments.filter(a => new Date(a.appointmentDate).toISOString().slice(0, 10) === today).length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
  }), [appointments]);

  const upcoming = useMemo(() => {
    return appointments
      .filter(a => a.status !== 'cancelled' && new Date(a.appointmentDate).toISOString().slice(0, 10) >= today)
      .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate))
      .slice(0, 5);
  }, [appointments]);

  const handleEventClick = (info) => {
    info.jsEvent.stopPropagation();
    const x = Math.min(info.jsEvent.clientX + 10, window.innerWidth - 340);
    const y = Math.min(Math.max(10, info.jsEvent.clientY - 20), window.innerHeight - 420);
    setPopup({ event: info.event, pos: { x, y } });
  };

  const handleEventDrop = async (info) => {
    const current = appointments.find(a => a.id === info.event.id);
    if (!current || ['cancelled', 'completed'].includes(current.status)) {
      info.revert();
      alert('Appointment cannot be rescheduled');
      return;
    }
    const newDate = info.event.startStr.split('T')[0];
    const newTime = (info.event.startStr.split('T')[1] || '09:00:00').slice(0, 5);
    try {
      await Hs_appointmentsService.update(info.event.id, {
        hs_appointmentdate: newDate,
        hs_appointmenttime: new Date(`1970-01-01T${newTime}:00`).toISOString(),
      });
      load();
    } catch (err) {
      info.revert();
      alert(err.message || 'Could not reschedule');
    }
  };

  const handleCancel = async () => {
    if (!popup) return;
    if (!confirm('Cancel this appointment?')) return;
    await Hs_appointmentsService.update(popup.event.id, { hs_status: STATUS_CODES.cancelled });
    setPopup(null);
    load();
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h2 style={{ margin: 0 }}><i className="fas fa-calendar-alt" style={{ color: 'var(--primary-light)' }} /> Appointment Calendar</h2>
          <div className="text-muted text-sm">{MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()} &middot; {stats.total} total appointments</div>
        </div>
        <div className="flex gap-2">
          <Link to="/patient/appointments" className="btn btn-outline"><i className="fas fa-list" /> List View</Link>
          <button className="btn btn-primary" onClick={() => setBookModal(new Date().toISOString().split('T')[0])}>
            <i className="fas fa-plus" /> New Appointment
          </button>
        </div>
      </div>

      <div className="cal-wrap">
        {/* Sidebar */}
        <div className="cal-sidebar">
          <div className="cal-kpis">
            {[
              ['Total', 'fa-calendar', stats.total, '#1565C0', '#DBEAFE'],
              ['Today', 'fa-clock', stats.today, '#0891B2', '#CFFAFE'],
              ['Done', 'fa-check-circle', stats.completed, '#16A34A', '#DCFCE7'],
              ['Cancelled', 'fa-times', stats.cancelled, '#DC2626', '#FEE2E2'],
            ].map(([label, icon, val, color, bg]) => (
              <div className="cal-kpi" key={label}>
                <div className="cal-kpi-icon" style={{ background: bg, color }}><i className={`fas ${icon}`} /></div>
                <div className="cal-kpi-val">{val}</div>
                <div className="cal-kpi-label">{label}</div>
              </div>
            ))}
          </div>

          <MiniCalendar appointments={appointments} onSelectDate={(d) => calendarRef.current?.getApi().gotoDate(d)} />

          <div className="card">
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text-muted)', marginBottom: 10 }}>Status Legend</div>
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span className="legend-dot" style={{ background: color }} />
                  <span style={{ fontSize: 12, textTransform: 'capitalize', fontWeight: 500 }}>{status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ flex: 1 }}>
            <div className="flex-between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}><i className="fas fa-stethoscope" /> Upcoming</span>
              <Link to="/patient/appointments" style={{ fontSize: 11, color: 'var(--primary-light)' }}>See all →</Link>
            </div>
            <div>
              {upcoming.length ? upcoming.map(a => {
                const dot = STATUS_COLORS[a.status] || '#5E7A99';
                return (
                  <div key={a.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: dot, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, flexShrink: 0 }}>
                      <i className="fas fa-user-md" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--primary)' }}>Dr. {a.doctor_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.specialization || ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>{new Date(a.appointmentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(a.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                    </div>
                  </div>
                );
              }) : (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  <i className="fas fa-calendar-check" style={{ fontSize: 24, opacity: .3 }} />
                  <p style={{ marginTop: 8 }}>No upcoming appointments</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main calendar */}
        <div className="card cal-main">
          <div className="cal-main-body">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth' }}
              height="auto"
              nowIndicator
              navLinks
              editable
              selectable
              dayMaxEvents={3}
              events={events}
              eventClick={handleEventClick}
              dateClick={(info) => setBookModal(info.dateStr)}
              eventDrop={handleEventDrop}
              eventResize={(info) => info.revert()}
            />
          </div>
        </div>
      </div>

      {popup && <EventPopup event={popup.event} pos={popup.pos} onClose={() => setPopup(null)} onCancel={handleCancel} />}
      {bookModal && <BookModal doctors={doctors} initialDate={bookModal} onClose={() => setBookModal(null)} onBooked={load} />}
    </div>
  );
}
