import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Hs_doctorsService } from '../../generated/services/Hs_doctorsService';
import { Hs_doctorschedule1sService } from '../../generated/services/Hs_doctorschedule1sService';
import { Hs_appointmentsService } from '../../generated/services/Hs_appointmentsService';
import { Hs_appointmentshs_status } from '../../generated/models/Hs_appointmentsModel';
import { Hs_usersService } from '../../generated/services/Hs_usersService';

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const WEEKDAY_ORDER = [1,2,3,4,5,6,0]; // Mon..Sun
const STATUS_COLORS = { pending: 'warning', confirmed: 'info', arrived: 'purple', waiting: 'warning', completed: 'success', cancelled: 'danger', late: 'danger', no_show: 'gray' };

const toMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const fmtDate = (d) => d.toISOString().slice(0, 10);

const getMonday = (date) => {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export default function Schedule() {
  const { user } = useAuth();
  const [tab, setTab] = useState('availability');
  const [schedule, setSchedule] = useState(DAY_NAMES.map((_, i) => ({ day_of_week: i, start_time: '09:00', end_time: '17:00', is_available: i >= 1 && i <= 5 })));
  const [slotDuration, setSlotDuration] = useState(30);
  const [doctorProfileId, setDoctorProfileId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [week, setWeek] = useState(0);
  const [weekData, setWeekData] = useState({});
  const [weekLoading, setWeekLoading] = useState(false);

  useEffect(() => {
    Hs_doctorsService.getAll({ filter: `_hs_user_value eq ${user.id}` }).then(docResult => {
      const doc = docResult.data?.[0];
      if (!doc) return;
      setDoctorProfileId(doc.hs_doctorid);
      return Hs_doctorschedule1sService.getAll({ filter: `_hs_doctor_value eq ${doc.hs_doctorid}` }).then(r => {
        const rows = r.data || [];
        if (rows.length) {
          const map = {};
          rows.forEach(s => { map[s.hs_dayofweek] = s; });
          setSchedule(DAY_NAMES.map((_, i) => map[i]
            ? { day_of_week: i, start_time: map[i].hs_starttime, end_time: map[i].hs_endtime, is_available: !!map[i].hs_isavailable }
            : { day_of_week: i, start_time: '09:00', end_time: '17:00', is_available: false }));
          const withDuration = rows.find(s => s.hs_slotduration);
          if (withDuration) setSlotDuration(withDuration.hs_slotduration);
        }
      });
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== 'weekly') return;
    setWeekLoading(true);
    const monday = getMonday(new Date());
    monday.setDate(monday.getDate() + week * 7);
    const days = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
    Hs_appointmentsService.getAll({
      filter: `_hs_doctor_value eq ${user.id} and hs_appointmentdate ge ${fmtDate(days[0])} and hs_appointmentdate le ${fmtDate(days[4])}`,
    })
      .then(async (r) => {
        const rows = r.data || [];
        const patientIds = [...new Set(rows.map(a => a._hs_patient_value).filter(Boolean))];
        let patientNameById = {};
        if (patientIds.length) {
          const usersResult = await Hs_usersService.getAll({ filter: patientIds.map(id => `hs_userid eq ${id}`).join(' or ') });
          patientNameById = Object.fromEntries((usersResult.data || []).map(u => [u.hs_userid, u.hs_fullname]));
        }
        const byDate = {};
        rows.forEach(a => {
          const key = (a.hs_appointmentdate || '').slice(0, 10);
          (byDate[key] = byDate[key] || []).push({
            id: a.hs_appointmentid,
            appointmentTime: a.hs_appointmenttime,
            patient_name: patientNameById[a._hs_patient_value] || a.hs_patientname,
            reason: a.hs_reason,
            status: Hs_appointmentshs_status[a.hs_status] || 'pending',
          });
        });
        setWeekData({ days, byDate });
      })
      .finally(() => setWeekLoading(false));
  }, [tab, week]);

  const update = (day, field, value) => {
    setSchedule(prev => prev.map(s => s.day_of_week === day ? { ...s, [field]: value } : s));
  };

  const save = async () => {
    if (!doctorProfileId) { setMsg('Doctor profile not found'); return; }
    setSaving(true);
    try {
      const duration = Math.min(60, Math.max(15, +slotDuration || 30));
      const existing = await Hs_doctorschedule1sService.getAll({ filter: `_hs_doctor_value eq ${doctorProfileId}` });
      await Promise.all((existing.data || []).map(r => Hs_doctorschedule1sService.delete(r.hs_doctorschedule1id)));
      const toCreate = schedule.filter(s => s.is_available && s.start_time && s.end_time && s.start_time < s.end_time);
      await Promise.all(toCreate.map(s => Hs_doctorschedule1sService.create({
        'hs_Doctor@odata.bind': `/hs_doctors(${doctorProfileId})`,
        hs_dayofweek: s.day_of_week,
        hs_starttime: s.start_time,
        hs_endtime: s.end_time,
        hs_isavailable: true,
        hs_slotduration: duration,
      })));
      setMsg('Availability saved. Patients can now book slots based on your schedule.');
      setTimeout(() => setMsg(null), 4000);
    } catch { setMsg('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="record-tabs">
        <button className={`record-tab ${tab === 'availability' ? 'active' : ''}`} onClick={() => setTab('availability')}>Availability Settings</button>
        <button className={`record-tab ${tab === 'weekly' ? 'active' : ''}`} onClick={() => setTab('weekly')}>Weekly View</button>
      </div>

      {tab === 'availability' && (
        <div className="grid grid-2 gap-4">
          <div className="card">
            <div className="card-header">
              <h3><i className="fas fa-calendar-check" /> Weekly Availability</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>Patients will only see slots you mark as available</p>
            </div>
            <div className="card-body">
              {msg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{msg}</div>}

              <div className="form-group">
                <label className="form-label">Appointment Slot Duration</label>
                <select className="form-control" value={slotDuration} onChange={e => setSlotDuration(+e.target.value)}>
                  <option value={15}>15 min</option>
                  <option value={20}>20 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hour</option>
                </select>
              </div>

              {WEEKDAY_ORDER.map(dow => {
                const s = schedule.find(x => x.day_of_week === dow);
                const minutes = toMinutes(s.end_time) - toMinutes(s.start_time);
                const slotCount = s.is_available && minutes > 0 ? Math.floor(minutes / slotDuration) : 0;
                return (
                  <div key={dow} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22, flexShrink: 0 }}>
                      <input type="checkbox" checked={s.is_available} onChange={e => update(dow, 'is_available', e.target.checked)}
                        style={{ opacity: 0, width: '100%', height: '100%', margin: 0, position: 'absolute', cursor: 'pointer', zIndex: 1 }} />
                      <span style={{
                        position: 'absolute', inset: 0, borderRadius: 22,
                        background: s.is_available ? 'var(--success)' : 'var(--border)', transition: '.2s',
                      }}>
                        <span style={{
                          position: 'absolute', top: 2, left: s.is_available ? 20 : 2, width: 18, height: 18,
                          background: '#fff', borderRadius: '50%', transition: '.2s',
                        }} />
                      </span>
                    </label>
                    <div style={{ width: 90, fontWeight: 600 }}>{DAY_NAMES[dow]}</div>
                    <input type="time" className="form-control" value={s.start_time || ''} disabled={!s.is_available}
                      style={{ width: 120, opacity: s.is_available ? 1 : 0.5, pointerEvents: s.is_available ? 'auto' : 'none' }}
                      onChange={e => update(dow, 'start_time', e.target.value)} />
                    <span style={{ color: 'var(--text-muted)' }}>to</span>
                    <input type="time" className="form-control" value={s.end_time || ''} disabled={!s.is_available}
                      style={{ width: 120, opacity: s.is_available ? 1 : 0.5, pointerEvents: s.is_available ? 'auto' : 'none' }}
                      onChange={e => update(dow, 'end_time', e.target.value)} />
                    <span className="badge badge-info" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>{slotCount} slots</span>
                  </div>
                );
              })}

              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save Availability'}
              </button>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Changes take effect immediately for new bookings</p>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3><i className="fas fa-eye" /> What Patients See</h3></div>
            <div className="card-body">
              {WEEKDAY_ORDER.filter(dow => {
                const s = schedule.find(x => x.day_of_week === dow);
                return s.is_available && s.start_time && s.end_time && s.start_time < s.end_time;
              }).map(dow => {
                const s = schedule.find(x => x.day_of_week === dow);
                const minutes = toMinutes(s.end_time) - toMinutes(s.start_time);
                const slotCount = Math.floor(minutes / slotDuration);
                return (
                  <div key={dow} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600 }}>{DAY_NAMES[dow]}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.start_time} – {s.end_time}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{slotCount} × {slotDuration}min slots</div>
                  </div>
                );
              })}
              {WEEKDAY_ORDER.every(dow => {
                const s = schedule.find(x => x.day_of_week === dow);
                return !(s.is_available && s.start_time && s.end_time && s.start_time < s.end_time);
              }) && <div className="empty-state">Set your availability to see a preview here</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'weekly' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button className="btn btn-outline btn-sm" onClick={() => setWeek(w => w - 1)}>&larr; Prev</button>
            <h3>
              {weekData.days ? `${weekData.days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekData.days[4].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
            </h3>
            <button className="btn btn-outline btn-sm" onClick={() => setWeek(w => w + 1)}>Next &rarr;</button>
          </div>
          <div className="card-body">
            {weekLoading ? <div className="loading"><div className="spinner" /></div> : (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                {weekData.days?.map(d => {
                  const dow = d.getDay();
                  const avail = schedule.find(s => s.day_of_week === dow);
                  const key = fmtDate(d);
                  const appts = weekData.byDate[key] || [];
                  const isToday = fmtDate(new Date()) === key;
                  return (
                    <div key={key} className="card" style={{ border: isToday ? '2px solid var(--primary-light)' : '1px solid var(--border)' }}>
                      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{d.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                        </div>
                        <span className="badge badge-gray">{appts.length}</span>
                      </div>
                      <div className="card-body" style={{ padding: 12 }}>
                        {avail?.is_available ? (
                          <div className="badge badge-info" style={{ marginBottom: 8, display: 'block', textAlign: 'center' }}>
                            Available {avail.start_time}–{avail.end_time}
                          </div>
                        ) : (
                          <div className="badge badge-danger" style={{ marginBottom: 8, display: 'block', textAlign: 'center' }}>
                            Not available
                          </div>
                        )}
                        {appts.length ? appts.map(a => (
                          <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                            <div style={{ fontWeight: 600 }}>{new Date(a.appointmentTime).toISOString().slice(11, 16)} — {a.patient_name}</div>
                            <div style={{ color: 'var(--text-muted)' }}>{a.reason || 'General'}</div>
                            <span className={`badge badge-${STATUS_COLORS[a.status] || 'gray'}`} style={{ marginTop: 4 }}>{a.status}</span>
                          </div>
                        )) : <div className="empty-state" style={{ padding: 12, fontSize: 12 }}>No appointments</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
