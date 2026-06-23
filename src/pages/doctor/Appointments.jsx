import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Hs_appointmentsService } from '../../generated/services/Hs_appointmentsService';
import { Hs_appointmentshs_status, Hs_appointmentshs_type } from '../../generated/models/Hs_appointmentsModel';
import { Hs_usersService } from '../../generated/services/Hs_usersService';

const STATUSES = ['pending','confirmed','arrived','waiting','completed','late','no_show','cancelled'];
const statusColors = { pending: 'warning', confirmed: 'info', arrived: 'purple', waiting: 'warning', completed: 'success', cancelled: 'danger', late: 'danger', no_show: 'gray' };
const STATUS_CODES = Object.fromEntries(Object.entries(Hs_appointmentshs_status).map(([code, label]) => [label, Number(code)]));

function toAppointment(record, patientNameById) {
  return {
    id: record.hs_appointmentid,
    patient_name: patientNameById[record._hs_patient_value] || record.hs_patientname,
    appointment_date: record.hs_appointmentdate,
    appointment_time: record.hs_appointmenttime,
    type: Hs_appointmentshs_type[record.hs_type],
    reason: record.hs_reason,
    status: Hs_appointmentshs_status[record.hs_status] || 'pending',
  };
}

export default function DoctorAppointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const load = () => {
    setLoading(true);
    const clauses = [`_hs_doctor_value eq ${user.id}`];
    if (filter !== 'all') clauses.push(`hs_status eq ${STATUS_CODES[filter]}`);
    if (dateFilter) clauses.push(`hs_appointmentdate eq ${dateFilter}`);
    Hs_appointmentsService.getAll({ filter: clauses.join(' and ') })
      .then(async (result) => {
        const rows = result.data || [];
        const patientIds = [...new Set(rows.map(r => r._hs_patient_value).filter(Boolean))];
        let patientNameById = {};
        if (patientIds.length) {
          const usersResult = await Hs_usersService.getAll({ filter: patientIds.map(id => `hs_userid eq ${id}`).join(' or ') });
          patientNameById = Object.fromEntries((usersResult.data || []).map(u => [u.hs_userid, u.hs_fullname]));
        }
        setAppointments(rows.map(r => toAppointment(r, patientNameById)));
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [filter, dateFilter]);

  const updateStatus = async (id, status) => {
    await Hs_appointmentsService.update(id, { hs_status: STATUS_CODES[status] });
    load();
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="flex-between mb-4">
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('all')}>All</button>
          {STATUSES.map(s => (
            <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(s)}>
              {s.replace('_',' ')}
            </button>
          ))}
        </div>
        <input type="date" className="form-control" style={{ width: 160 }} value={dateFilter}
          onChange={e => setDateFilter(e.target.value)} />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Patient</th><th>Date & Time</th><th>Type</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {appointments.length ? appointments.map(a => (
                <tr key={a.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                        {a.patient_name?.split(' ').map(n=>n[0]).join('').slice(0,2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{a.patient_name}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>{new Date(a.appointment_date).toLocaleDateString('en-GB')}</div>
                    <div className="text-muted text-sm">{new Date(a.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                  </td>
                  <td><span className="badge badge-gray">{a.type?.replace('_',' ')}</span></td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.reason || '—'}</td>
                  <td><span className={`badge badge-${statusColors[a.status] || 'gray'}`}>{a.status}</span></td>
                  <td>
                    <select className="form-control" style={{ padding: '4px 8px', fontSize: 12, width: 140 }}
                      value={a.status} onChange={e => updateStatus(a.id, e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                    </select>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6}><div className="empty-state">No appointments found</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
