import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Hs_prescriptionsService } from '../../generated/services/Hs_prescriptionsService';
import { Hs_prescriptionshs_status } from '../../generated/models/Hs_prescriptionsModel';
import { Hs_prescriptionordersService } from '../../generated/services/Hs_prescriptionordersService';
import { Hs_prescriptionordershs_status, Hs_prescriptionordershs_deliverymethod } from '../../generated/models/Hs_prescriptionordersModel';
import { Hs_doctorsService } from '../../generated/services/Hs_doctorsService';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const ORDER_STATUS_CONFIG = {
  pending:    { color: '#F59E0B', bg: '#FEF3C7', icon: 'fa-clock',          label: 'Pending Approval' },
  approved:   { color: '#1565C0', bg: '#DBEAFE', icon: 'fa-check-circle',   label: 'Approved' },
  preparing:  { color: '#0891B2', bg: '#E0F2FE', icon: 'fa-mortar-pestle',  label: 'Being Prepared' },
  dispatched: { color: '#7C3AED', bg: '#EDE9FE', icon: 'fa-truck',          label: 'Dispatched' },
  delivered:  { color: '#16A34A', bg: '#DCFCE7', icon: 'fa-check-double',   label: 'Delivered / Ready' },
  rejected:   { color: '#DC2626', bg: '#FEE2E2', icon: 'fa-times-circle',   label: 'Not Approved' },
  cancelled:  { color: '#6B7280', bg: '#F3F4F6', icon: 'fa-ban',            label: 'Cancelled' },
};

const ORDER_STATUS_CODES = Object.fromEntries(Object.entries(Hs_prescriptionordershs_status).map(([code, label]) => [label, Number(code)]));
const DELIVERY_METHOD_CODES = Object.fromEntries(Object.entries(Hs_prescriptionordershs_deliverymethod).map(([code, label]) => [label, Number(code)]));

function toPrescription(r, ordersByPrescriptionId, doctorByUserId) {
  const orders = (ordersByPrescriptionId[r.hs_prescriptionid] || []);
  const activeOrder = orders.find(o => !['delivered', 'rejected', 'cancelled'].includes(Hs_prescriptionordershs_status[o.hs_status]));
  const lastOrder = orders[0];
  const activeStatus = activeOrder ? Hs_prescriptionordershs_status[activeOrder.hs_status] : null;
  const doc = doctorByUserId[r._hs_doctor_value];
  return {
    id: r.hs_prescriptionid,
    doctorUserId: r._hs_doctor_value,
    medication_name: r.hs_medicationname,
    dosage: r.hs_dosage,
    frequency: r.hs_frequency,
    duration: r.hs_duration,
    instructions: r.hs_instructions,
    start_date: r.hs_startdate,
    end_date: r.hs_enddate,
    is_active: r.hs_status == null || Hs_prescriptionshs_status[r.hs_status] === 'active',
    doc_name: r.hs_doctorname,
    specialization: doc?.hs_specialization,
    hospital_name: doc?.hs_hospital,
    active_order_id: activeOrder?.hs_prescriptionorderid || null,
    order_status: activeStatus,
    status_config: activeStatus ? (ORDER_STATUS_CONFIG[activeStatus] || ORDER_STATUS_CONFIG.pending) : null,
    pharmacy_name: lastOrder?.hs_pharmacyname || null,
    last_doctor_notes: lastOrder?.hs_doctornotes || null,
  };
}

function toOrder(r, prescriptionById) {
  const presc = prescriptionById[r._hs_prescription_value];
  const statusKey = Hs_prescriptionordershs_status[r.hs_status] || 'pending';
  return {
    id: r.hs_prescriptionorderid,
    medication_name: presc?.hs_medicationname || r.hs_prescriptionname,
    dosage: presc?.hs_dosage,
    frequency: presc?.hs_frequency,
    doc_name: r.hs_doctorname,
    delivery_method: Hs_prescriptionordershs_deliverymethod[r.hs_deliverymethod] || 'collection',
    status: statusKey,
    status_config: ORDER_STATUS_CONFIG[statusKey] || ORDER_STATUS_CONFIG.pending,
    pharmacy_name: r.hs_pharmacyname,
    doctor_notes: r.hs_doctornotes,
    ordered_at: r.createdon,
    updated_at: r.modifiedon,
  };
}

const TL_STEPS = [
  { label: 'Ordered', icon: 'fa-pills' },
  { label: 'Approved', icon: 'fa-check' },
  { label: 'Preparing', icon: 'fa-mortar-pestle' },
  { label: 'Dispatched', icon: 'fa-truck' },
  { label: 'Delivered', icon: 'fa-check-double' },
];
const STEP_INDEX = { pending: 0, approved: 1, preparing: 2, dispatched: 3, delivered: 4, rejected: -1, cancelled: -1 };

const HOW_IT_WORKS = [
  ['1', 'fa-pills', 'Find your medication', 'Your active prescriptions are listed below'],
  ['2', 'fa-mouse-pointer', 'Click Order', 'Choose collection or home delivery'],
  ['3', 'fa-user-md', 'Doctor approves', 'Your GP reviews and approves within 24h'],
  ['4', 'fa-truck', 'Track delivery', 'Get real-time status updates'],
];

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatusPill({ sc }) {
  if (!sc) return null;
  return (
    <div className="status-pill" style={{ background: sc.bg, color: sc.color }}>
      <i className={`fas ${sc.icon}`}></i> {sc.label}
    </div>
  );
}

function Timeline({ status }) {
  const curStep = STEP_INDEX[status] ?? 0;
  if (curStep < 0) return null;
  return (
    <div className="timeline">
      {TL_STEPS.map((s, i) => {
        const done = i < curStep;
        const current = i === curStep;
        const dotColor = done || current ? '#1565C0' : '#E2E8F0';
        const lineColor = done ? '#1565C0' : '#E2E8F0';
        return (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', flex: i > 0 ? 1 : 'initial' }}>
            {i > 0 && <div className="tl-line" style={{ background: lineColor }}></div>}
            <div className="tl-step">
              <div className="tl-dot" style={{
                background: done || current ? '#1565C0' : '#fff',
                borderColor: dotColor,
                color: done || current ? '#fff' : '#9CA3AF',
              }}>
                <i className={`fas ${s.icon}`} style={{ fontSize: 10 }}></i>
              </div>
              <div className="tl-label" style={{ color: current ? '#1565C0' : (done ? '#374151' : '#9CA3AF') }}>{s.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PaymentStep({ rx, form, onPaid, onBack }) {
  const { user } = useAuth();
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const pay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setError('');

    const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(form.clientSecret, {
      payment_method: { card: elements.getElement(CardElement) },
    });

    if (confirmError) {
      setError(confirmError.message);
      setProcessing(false);
      return;
    }

    try {
      await Hs_prescriptionordersService.create({
        'hs_Prescription@odata.bind': `/hs_prescriptions(${rx.id})`,
        'hs_Patient@odata.bind': `/hs_users(${user.id})`,
        'hs_Doctor@odata.bind': rx.doctorUserId ? `/hs_users(${rx.doctorUserId})` : undefined,
        hs_deliverymethod: form.deliveryMethod === 'delivery' ? DELIVERY_METHOD_CODES.delivery : DELIVERY_METHOD_CODES.collection,
        hs_deliveryaddress: form.deliveryAddress || undefined,
        hs_patientnotes: form.patientNotes || undefined,
        hs_paymentintentid: paymentIntent.id,
        hs_status: ORDER_STATUS_CODES.pending,
      });
      onPaid();
    } catch (err) {
      setError(err.message || 'Failed to place order');
      setProcessing(false);
    }
  };

  return (
    <div>
      <div className="rx-fee-box">
        <div className="rx-fee-label">NHS Prescription Fee</div>
        <div className="rx-fee-amount">£9.90</div>
        <div className="rx-fee-note">Standard NHS prescription charge</div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="form-label"><i className="fas fa-credit-card" style={{ color: 'var(--primary-light)' }}></i> Card Details</label>
        <div className="rx-card-element">
          <CardElement options={{ style: { base: { fontFamily: "'Inter', sans-serif", fontSize: '14px', color: '#1e3a5f', '::placeholder': { color: '#94a3b8' } } } }} />
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6, minHeight: 18 }}>{error}</div>}
      </div>
      <div className="rx-secure-note">
        <i className="fas fa-shield-alt"></i> Secured by Stripe. Your card details never touch our servers.
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={pay} disabled={processing || !stripe}>
          {processing ? <><i className="fas fa-spinner fa-spin"></i> Processing...</> : <><i className="fas fa-lock"></i> Pay £9.90 & Order</>}
        </button>
        <button className="btn btn-outline" onClick={onBack} disabled={processing}>Back</button>
      </div>
    </div>
  );
}

function OrderModal({ rx, onClose, onSuccess }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [deliveryMethod, setDeliveryMethod] = useState('collection');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [patientNotes, setPatientNotes] = useState('');
  const [clientSecret, setClientSecret] = useState(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [error, setError] = useState('');

  const proceed = async () => {
    setLoadingIntent(true);
    setError('');
    try {
      const { data } = await api.post('/bridge/prescriptions/payment-intent', { patient_id: user.id });
      setClientSecret(data.client_secret);
      setStep(2);
    } catch {
      setError('Failed to load payment. Please try again.');
    } finally {
      setLoadingIntent(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header rx-modal-header">
          <div>
            <h3 style={{ color: '#fff' }}><i className="fas fa-shopping-cart"></i> Order Prescription</h3>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{rx.medication_name} — {rx.dosage}</div>
          </div>
          <button className="modal-close" style={{ color: '#fff' }} onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {step === 1 && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Collection or Delivery?</label>
                <div className="rx-method-grid">
                  <label className={`rx-method-option ${deliveryMethod === 'collection' ? 'active-collection' : ''}`} onClick={() => setDeliveryMethod('collection')}>
                    <i className="fas fa-store" style={{ fontSize: 20, color: '#1565C0', display: 'block', marginBottom: 6 }}></i>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Collect from pharmacy</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ready in 1–2 working days</div>
                  </label>
                  <label className={`rx-method-option ${deliveryMethod === 'delivery' ? 'active-delivery' : ''}`} onClick={() => setDeliveryMethod('delivery')}>
                    <i className="fas fa-truck" style={{ fontSize: 20, color: '#7C3AED', display: 'block', marginBottom: 6 }}></i>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Home delivery</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>3–5 working days</div>
                  </label>
                </div>
              </div>

              {deliveryMethod === 'delivery' && (
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Delivery Address</label>
                  <textarea className="form-control" rows={2} placeholder="Enter full delivery address..."
                    value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label className="form-label">Notes for your doctor (optional)</label>
                <textarea className="form-control" rows={2} placeholder="e.g. I've run out early, need urgent refill..."
                  value={patientNotes} onChange={e => setPatientNotes(e.target.value)} />
              </div>

              <div className="rx-info-box">
                <i className="fas fa-info-circle" style={{ color: 'var(--primary-light)' }}></i>
                Your doctor will review this request within <strong>24 hours</strong>. You'll get a notification when it's approved.
              </div>

              {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={proceed} disabled={loadingIntent}>
                  {loadingIntent ? <><i className="fas fa-spinner fa-spin"></i> Loading...</> : <><i className="fas fa-credit-card"></i> Proceed to Payment</>}
                </button>
                <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              </div>
            </>
          )}

          {step === 2 && clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentStep
                rx={rx}
                form={{ deliveryMethod, deliveryAddress, patientNotes, clientSecret }}
                onPaid={onSuccess}
                onBack={() => setStep(1)}
              />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Prescriptions() {
  const { user } = useAuth();
  const [tab, setTab] = useState('prescriptions');
  const [prescriptions, setPrescriptions] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderModalRx, setOrderModalRx] = useState(null);
  const [toast, setToast] = useState('');

  const load = () => {
    Promise.all([
      Hs_prescriptionsService.getAll({ filter: `_hs_patient_value eq ${user.id}` }),
      Hs_prescriptionordersService.getAll({ filter: `_hs_patient_value eq ${user.id}` }),
      Hs_doctorsService.getAll(),
    ]).then(([rx, orders, docs]) => {
      const prescriptionById = Object.fromEntries((rx.data || []).map(p => [p.hs_prescriptionid, p]));
      const doctorByUserId = Object.fromEntries((docs.data || []).map(d => [d._hs_user_value, d]));
      const ordersByPrescriptionId = {};
      (orders.data || []).forEach(o => { (ordersByPrescriptionId[o._hs_prescription_value] ||= []).push(o); });
      setPrescriptions((rx.data || []).map(r => toPrescription(r, ordersByPrescriptionId, doctorByUserId)));
      setOrderHistory(
        (orders.data || [])
          .slice()
          .sort((a, b) => new Date(b.createdon) - new Date(a.createdon))
          .slice(0, 20)
          .map(o => toOrder(o, prescriptionById))
      );
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const cancelOrder = async (orderId) => {
    if (!confirm('Cancel this prescription order?')) return;
    try {
      await Hs_prescriptionordersService.update(orderId, { hs_status: ORDER_STATUS_CODES.cancelled });
      showToast('Order cancelled');
      load();
    } catch (err) {
      showToast(err.message || 'Failed to cancel order');
    }
  };

  const handleOrderSuccess = () => {
    setOrderModalRx(null);
    showToast('Order placed and payment confirmed!');
    load();
  };

  const pendingOrders = orderHistory.filter(o => ['pending', 'approved', 'preparing', 'dispatched'].includes(o.status)).length;

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      {toast && <div className="rx-toast">{toast}</div>}

      <div className="record-tabs">
        <button className={`record-tab ${tab === 'prescriptions' ? 'active' : ''}`} onClick={() => setTab('prescriptions')}>
          <i className="fas fa-pills"></i> My Prescriptions
        </button>
        <button className={`record-tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
          <i className="fas fa-box"></i> Order History
          {pendingOrders > 0 && <span className="unread-badge">{pendingOrders}</span>}
        </button>
      </div>

      {tab === 'prescriptions' && (
        <>
          <div className="rx-how-it-works">
            {HOW_IT_WORKS.map(([n, ic, t, d]) => (
              <div key={n} className="rx-how-item">
                <div className="rx-how-num">{n}</div>
                <div>
                  <div className="rx-how-title">{t}</div>
                  <div className="rx-how-desc">{d}</div>
                </div>
              </div>
            ))}
          </div>

          {!prescriptions.length && (
            <div className="empty-state" style={{ padding: '60px 20px' }}>
              <div className="empty-icon">💊</div>
              <p>No prescriptions found. Your doctor will add prescriptions after your appointment.</p>
              <Link to="/patient/appointments" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>Book an Appointment</Link>
            </div>
          )}

          {prescriptions.map(rx => {
            const hasActiveOrder = !!rx.active_order_id;
            return (
              <div key={rx.id} className={`rx-card ${!rx.is_active ? 'inactive' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                  <div className="rx-icon" style={{ background: rx.is_active ? 'linear-gradient(135deg,#1565C0,#7C3AED)' : '#e5e7eb' }}>💊</div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary)' }}>{rx.medication_name}</span>
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary-light)' }}>{rx.dosage}</span>
                      {!rx.is_active && <span className="rx-ended-badge">ENDED</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                      <i className="fas fa-clock"></i> {rx.frequency}
                      {rx.duration && <> &nbsp;·&nbsp; <i className="fas fa-calendar"></i> {rx.duration}</>}
                      {rx.instructions && <> &nbsp;·&nbsp; <i className="fas fa-info-circle"></i> {rx.instructions}</>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      <i className="fas fa-user-md"></i> {rx.doc_name ? `Dr. ${rx.doc_name}` : 'Unassigned'}
                      {rx.hospital_name && <> &nbsp;·&nbsp; {rx.hospital_name}</>}
                    </div>
                    {(rx.start_date || rx.end_date) && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        {rx.start_date ? formatDate(rx.start_date) : ''} → {rx.end_date ? formatDate(rx.end_date) : 'Ongoing'}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {hasActiveOrder && rx.status_config ? (
                      <>
                        <div style={{ marginBottom: 8 }}><StatusPill sc={rx.status_config} /></div>
                        {rx.order_status === 'pending' && (
                          <button className="rx-cancel-btn" onClick={() => cancelOrder(rx.active_order_id)}>Cancel Order</button>
                        )}
                      </>
                    ) : rx.is_active ? (
                      <button className="rx-order-btn" onClick={() => setOrderModalRx(rx)}>
                        <i className="fas fa-shopping-cart"></i> Order / Renew
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Prescription ended</span>
                    )}
                  </div>
                </div>

                {hasActiveOrder && rx.status_config && (
                  <>
                    <Timeline status={rx.order_status} />
                    {rx.pharmacy_name && (
                      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}><i className="fas fa-store"></i> {rx.pharmacy_name}</div>
                    )}
                    {rx.last_doctor_notes && (
                      <div className="rx-doctor-note"><i className="fas fa-comment-medical" style={{ color: 'var(--primary-light)' }}></i> Dr. note: {rx.last_doctor_notes}</div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </>
      )}

      {tab === 'orders' && (
        <div className="card">
          <div className="card-header"><h3><i className="fas fa-history"></i> Order History</h3></div>
          {!orderHistory.length ? (
            <div className="empty-state"><div className="empty-icon">📦</div><p>No orders yet. Go to My Prescriptions to place an order.</p></div>
          ) : (
            <table className="table">
              <thead><tr><th>Medication</th><th>Doctor</th><th>Method</th><th>Status</th><th>Pharmacy</th><th>Ordered</th><th>Updated</th></tr></thead>
              <tbody>
                {orderHistory.map(o => (
                  <>
                    <tr key={o.id}>
                      <td><strong>{o.medication_name}</strong><br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.dosage} · {o.frequency}</span></td>
                      <td>Dr. {o.doc_name}</td>
                      <td style={{ textTransform: 'capitalize' }}>{o.delivery_method}</td>
                      <td><StatusPill sc={o.status_config} /></td>
                      <td>{o.pharmacy_name || '—'}</td>
                      <td>{timeAgo(o.ordered_at)}</td>
                      <td>{timeAgo(o.updated_at)}</td>
                    </tr>
                    {o.doctor_notes && (
                      <tr key={`${o.id}-notes`}>
                        <td colSpan={7} className="rx-doctor-note" style={{ margin: 0 }}>
                          <i className="fas fa-comment-medical" style={{ color: 'var(--primary-light)' }}></i> Doctor note: {o.doctor_notes}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {orderModalRx && (
        <OrderModal rx={orderModalRx} onClose={() => setOrderModalRx(null)} onSuccess={handleOrderSuccess} />
      )}
    </div>
  );
}
