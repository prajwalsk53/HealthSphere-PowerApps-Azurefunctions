import { useState, useEffect } from 'react';
import { Hs_prescriptionordersService } from '../../generated/services/Hs_prescriptionordersService';
import { Hs_prescriptionordershs_status, Hs_prescriptionordershs_deliverymethod } from '../../generated/models/Hs_prescriptionordersModel';
import { Hs_prescriptionsService } from '../../generated/services/Hs_prescriptionsService';
import { Hs_usersService } from '../../generated/services/Hs_usersService';

const ACTIVE_STATUSES_Q = ['approved', 'preparing', 'dispatched'];
const COMPLETED_STATUSES_Q = ['delivered', 'rejected', 'cancelled'];
const ACTION_MAP_Q = { preparing: 'preparing', dispatch: 'dispatched', deliver: 'delivered' };
const STATUS_CODES_Q = Object.fromEntries(Object.entries(Hs_prescriptionordershs_status).map(([c, l]) => [l, Number(c)]));

function toQueueOrder(r, userById, prescById) {
  const patient = userById[r._hs_patient_value];
  const doctor = userById[r._hs_doctor_value];
  const presc = prescById[r._hs_prescription_value];
  return {
    id: r.hs_prescriptionorderid,
    patient_name: patient?.hs_fullname || r.hs_patientname,
    nhs_id: patient?.hs_nhsidentifier,
    phone: patient?.hs_phonenumber,
    date_of_birth: patient?.hs_dateofbirth,
    doc_name: r.hs_doctorname || doctor?.hs_fullname,
    medication_name: presc?.hs_medicationname || r.hs_prescriptionname,
    dosage: presc?.hs_dosage,
    frequency: presc?.hs_frequency,
    instructions: presc?.hs_instructions,
    status: Hs_prescriptionordershs_status[r.hs_status] || 'approved',
    delivery_method: Hs_prescriptionordershs_deliverymethod[r.hs_deliverymethod] || 'collection',
    delivery_address: r.hs_deliveryaddress,
    pharmacy_name: r.hs_pharmacyname,
    patient_notes: r.hs_patientnotes,
    doctor_notes: r.hs_doctornotes,
    ordered_at: r.createdon,
  };
}

const STATUS_CONFIG = {
  approved:   { color: '#1565C0', bg: '#DBEAFE', icon: 'fa-check-circle',  label: 'Awaiting Preparation', next: 'preparing', nextLabel: 'Start Preparation', nextColor: '#0891B2' },
  preparing:  { color: '#0891B2', bg: '#E0F2FE', icon: 'fa-mortar-pestle', label: 'Being Prepared', next: 'dispatch', nextLabel: 'Mark Dispatched', nextColor: '#7C3AED' },
  dispatched: { color: '#7C3AED', bg: '#EDE9FE', icon: 'fa-truck',         label: 'Dispatched', next: 'deliver', nextLabel: 'Confirm Delivered', nextColor: '#16A34A' },
  delivered:  { color: '#16A34A', bg: '#DCFCE7', icon: 'fa-check-double',  label: 'Delivered', next: null },
  rejected:   { color: '#DC2626', bg: '#FEE2E2', icon: 'fa-times-circle',  label: 'Rejected', next: null },
  cancelled:  { color: '#6B7280', bg: '#F3F4F6', icon: 'fa-ban',           label: 'Cancelled', next: null },
};

const WORKFLOW_STEPS = [
  { color: '#F59E0B', icon: 'fa-clock',          title: '1. Doctor Approved', desc: 'Order is ready to prepare' },
  { color: '#0891B2', icon: 'fa-mortar-pestle',  title: '2. Start Preparation', desc: 'Dispense the medication' },
  { color: '#7C3AED', icon: 'fa-truck',          title: '3. Dispatch', desc: 'Send out for delivery or notify patient' },
  { color: '#16A34A', icon: 'fa-check-double',   title: '4. Delivered', desc: 'Mark as collected / delivered' },
];

const ACTION_TITLES = { preparing: 'Start Preparation', dispatch: 'Mark as Dispatched', deliver: 'Confirm Delivered' };

export default function MedicineQueue() {
  const [tab, setTab] = useState('active');
  const [orders, setOrders] = useState([]);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { orderId, action, patient, medication }
  const [pharmacy, setPharmacy] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    const statuses = tab === 'active' ? ACTIVE_STATUSES_Q : COMPLETED_STATUSES_Q;
    const statusClause = (codes) => `(${codes.map(s => `hs_status eq ${STATUS_CODES_Q[s]}`).join(' or ')})`;
    Promise.all([
      Hs_prescriptionordersService.getAll({ filter: statusClause(statuses), orderBy: ['createdon asc'] }),
      Hs_prescriptionordersService.getAll({ filter: statusClause(ACTIVE_STATUSES_Q) }),
    ]).then(async ([ordersRes, activeRes]) => {
      const rows = ordersRes.data || [];
      const patientIds = [...new Set(rows.map(r => r._hs_patient_value).filter(Boolean))];
      const doctorIds = [...new Set(rows.map(r => r._hs_doctor_value).filter(Boolean))];
      const userIds = [...new Set([...patientIds, ...doctorIds])];
      const prescriptionIds = [...new Set(rows.map(r => r._hs_prescription_value).filter(Boolean))];
      const [usersResult, prescResult] = await Promise.all([
        userIds.length ? Hs_usersService.getAll({ filter: userIds.map(id => `hs_userid eq ${id}`).join(' or ') }) : Promise.resolve({ data: [] }),
        prescriptionIds.length ? Hs_prescriptionsService.getAll({ filter: prescriptionIds.map(id => `hs_prescriptionid eq ${id}`).join(' or ') }) : Promise.resolve({ data: [] }),
      ]);
      const userById = Object.fromEntries((usersResult.data || []).map(u => [u.hs_userid, u]));
      const prescById = Object.fromEntries((prescResult.data || []).map(p => [p.hs_prescriptionid, p]));
      setOrders(rows.map(r => toQueueOrder(r, userById, prescById)));
      setActiveCount((activeRes.data || []).length);
    }).finally(() => setLoading(false));
  };

  useEffect(load, [tab]);

  const openModal = (o) => {
    const sc = STATUS_CONFIG[o.status];
    setModal({ orderId: o.id, action: sc.next, patient: o.patient_name, medication: o.medication_name });
    setPharmacy('');
    setNote('');
  };

  const submitUpdate = async () => {
    setSubmitting(true);
    try {
      const nextStatus = ACTION_MAP_Q[modal.action];
      await Hs_prescriptionordersService.update(modal.orderId, {
        hs_status: STATUS_CODES_Q[nextStatus],
        ...(note ? { hs_doctornotes: note } : {}),
        ...(pharmacy ? { hs_pharmacyname: pharmacy } : {}),
      });
      setModal(null);
      load();
    } catch (err) { alert(err.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <div>
      <div className="record-tabs">
        <button className={`record-tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
          <i className="fas fa-clock" /> Active Orders
          {activeCount > 0 && <span style={{ background: '#DC2626', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10, marginLeft: 6 }}>{activeCount}</span>}
        </button>
        <button className={`record-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          <i className="fas fa-history" /> Completed
        </button>
      </div>

      {tab === 'active' && (
        <div style={{ background: 'linear-gradient(135deg,#EFF6FF,#F0FDF4)', border: '1px solid #BFDBFE', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {WORKFLOW_STEPS.map(s => (
            <div key={s.title} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, background: s.color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fas ${s.icon}`} style={{ color: '#fff', fontSize: 14 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{s.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        !orders.length ? (
          <div className="empty-state">
            <div className="empty-icon">{tab === 'active' ? '✅' : '🕘'}</div>
            <p>{tab === 'active' ? 'No active orders — all caught up!' : 'No completed orders yet.'}</p>
          </div>
        ) : orders.map(o => {
          const sc = STATUS_CONFIG[o.status] || STATUS_CONFIG.approved;
          return (
            <div key={o.id} className="card" style={{ marginBottom: 14, borderLeft: `4px solid ${sc.color}` }}>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div className="user-avatar" style={{ width: 46, height: 46, fontSize: 17 }}>
                    {o.patient_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>{o.patient_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                      NHS: {o.nhs_id}
                      {o.phone && <> · {o.phone}</>}
                      {o.date_of_birth && <> · DOB: {new Date(o.date_of_birth).toLocaleDateString('en-GB')}</>}
                    </div>

                    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 16px', display: 'inline-block', minWidth: 240 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary)' }}>💊 {o.medication_name}</div>
                      <div style={{ fontSize: 13, color: 'var(--primary-light)', fontWeight: 600, marginTop: 2 }}>{o.dosage}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                        {o.frequency}{o.instructions ? ` · ${o.instructions}` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        Prescribed by Dr. {o.doc_name}
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      {o.delivery_method === 'delivery' ? (
                        <div style={{ fontSize: 12, color: '#7C3AED', fontWeight: 700 }}>
                          <i className="fas fa-truck" /> Home Delivery{o.delivery_address ? ` — ${o.delivery_address}` : ''}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: '#1565C0', fontWeight: 700 }}>
                          <i className="fas fa-store" /> Collection from pharmacy{o.pharmacy_name ? ` — ${o.pharmacy_name}` : ''}
                        </div>
                      )}
                    </div>

                    {o.patient_notes && (
                      <div style={{ marginTop: 8, background: '#FEF3C7', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#92400E' }}>
                        <i className="fas fa-comment" /> Patient note: {o.patient_notes}
                      </div>
                    )}
                    {o.doctor_notes && (
                      <div style={{ marginTop: 6, background: '#F4F8FF', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--primary)' }}>
                        <i className="fas fa-user-md" style={{ color: 'var(--primary-light)' }} /> Doctor note: {o.doctor_notes}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 160 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: sc.bg, color: sc.color, padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
                      <i className={`fas ${sc.icon}`} /> {sc.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{new Date(o.ordered_at).toLocaleString('en-GB')}</div>

                    {sc.next && (
                      <button onClick={() => openModal(o)}
                        style={{ background: sc.nextColor, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'block', width: '100%' }}>
                        <i className={`fas ${sc.icon}`} /> {sc.nextLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}

      {modal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>{ACTION_TITLES[modal.action] || 'Update Order'}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -8, marginBottom: 14 }}>{modal.patient} — {modal.medication}</p>
              <div className="form-group">
                <label className="form-label">Pharmacy / Collection Point</label>
                <input className="form-control" placeholder="e.g. Boots Pharmacy, High Street" value={pharmacy} onChange={e => setPharmacy(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Note to patient (optional)</label>
                <textarea className="form-control" rows={2} placeholder="e.g. Ready for collection from 2pm..." value={note} onChange={e => setNote(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitUpdate} disabled={submitting}>{submitting ? 'Updating...' : 'Confirm Update'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
