import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { useAuth } from '../../context/AuthContext';
import { Hs_appointmentsService } from '../../generated/services/Hs_appointmentsService';
import { Hs_appointmentshs_status } from '../../generated/models/Hs_appointmentsModel';
import { Hs_medicalrecordsService } from '../../generated/services/Hs_medicalrecordsService';
import { Hs_medicalrecordshs_status } from '../../generated/models/Hs_medicalrecordsModel';
import { Hs_messagesService } from '../../generated/services/Hs_messagesService';
import { Hs_healthmetricsService } from '../../generated/services/Hs_healthmetricsService';
import { Hs_allergiesService } from '../../generated/services/Hs_allergiesService';
import { Hs_allergieshs_severity } from '../../generated/models/Hs_allergiesModel';
import { Hs_usersService } from '../../generated/services/Hs_usersService';
import { calculateHealthScore } from '../../lib/healthAnalytics';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const APPT_STATUS_CODES = Object.fromEntries(Object.entries(Hs_appointmentshs_status).map(([c, l]) => [l, Number(c)]));
const MEDREC_STATUS_CODES = Object.fromEntries(Object.entries(Hs_medicalrecordshs_status).map(([c, l]) => [l, Number(c)]));
const SEVERITY_CODES = Object.fromEntries(Object.entries(Hs_allergieshs_severity).map(([c, l]) => [l, Number(c)]));

function toMetric(r) {
  return {
    userId: r._hs_user_value,
    systolic: r.hs_systolic, diastolic: r.hs_diastolic, heartRate: r.hs_heartrate,
    oxygenSaturation: r.hs_oxygensaturation, sleepHours: r.hs_sleephours, steps: r.hs_steps,
    stressLevel: r.hs_stresslevel, recordedAt: r.hs_recordedat,
  };
}

const statusColors = { pending: 'warning', confirmed: 'info', arrived: 'purple', waiting: 'warning', completed: 'success', cancelled: 'danger', late: 'danger' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ADMIT_LIST = [
  ['Jens Brincker', 'Dr. Kenny Josh', '27/05/2016', 'Influenza', 101, '#E91E8C'],
  ['Mark Hay', 'Dr. Mark', '26/05/2017', 'Cholera', 105, '#FF6B35'],
  ['Anthony Davie', 'Dr. Cinnabar', '21/05/2016', 'Amoebiasis', 106, '#8B5CF6'],
  ['David Perry', 'Dr. Felix', '20/04/2016', 'Jaundice', 105, '#F59E0B'],
  ['Anthony Davie', 'Dr. Beryl', '24/05/2016', 'Leptospirosis', 102, '#EF4444'],
  ['Alan Gilchrist', 'Dr. Joshep', '22/05/2016', 'Hepatitis', 103, '#0891B2'],
  ['Mark Hay', 'Dr. Jayesh', '18/06/2016', 'Typhoid', 107, '#DC2626'],
];
const DISEASES = [
  ['Hypertension', '#EF4444'], ['Diabetes', '#F59E0B'], ['Asthma', '#0891B2'], ['Arthritis', '#8B5CF6'],
  ['Obesity', '#16A34A'], ['Anaemia', '#E91E8C'], ['Migraine', '#FF6B35'], ['Thyroid', '#6366F1'],
  ['Cholesterol', '#D97706'], ['COPD', '#DC2626'], ['Eczema', '#0891B2'], ['Hypertension', '#EF4444'],
];
const ADMIT_STATUSES = ['Admitted', 'Under Treatment', 'Recovery', 'Monitoring', 'Discharged'];
const ADMIT_STATUS_COLORS = ['#00D26A', '#F59E0B', '#60A5FA', '#8B5CF6', '#90AFC5'];

const LAB_DEMO = [
  ['HbA1c', '6.4%', 'elevated'],
  ['LDL Cholesterol', '128 mg/dL', 'elevated'],
  ['Vitamin D', '18 ng/mL', 'low'],
  ['Fasting Glucose', '132 mg/dL', 'elevated'],
  ['TSH', '5.2 mIU/L', 'elevated'],
];
const LAB_COLORS = { elevated: '#D97706', low: '#0891B2', normal: '#16A34A' };

const MED_DEMO = [
  ['Amlodipine', '5 mg', 'Once daily (morning)'],
  ['Atorvastatin', '10 mg', 'Once daily (night)'],
  ['Losartan', '25 mg', 'Once daily (night)'],
];

function fmtTime(t) {
  if (!t) return '';
  return t.slice(11, 16);
}

function fmtDate(d) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function StatusBadge({ status }) {
  return <span className={`badge badge-${statusColors[status] || 'gray'}`}>{status}</span>;
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('hosp');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [modalTab, setModalTab] = useState('vitals');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const id = user.id;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const year = new Date().getFullYear();

    const [allApptsRes, medRecordsRes, msgsRes] = await Promise.all([
      Hs_appointmentsService.getAll({ filter: `_hs_doctor_value eq ${id}` }),
      Hs_medicalrecordsService.getAll({ filter: `_hs_doctor_value eq ${id} and hs_status eq ${MEDREC_STATUS_CODES.critical}`, orderBy: ['createdon desc'] }),
      Hs_messagesService.getAll({ filter: `_hs_receiver_value eq ${id} and hs_sread eq false and hs_semergency eq true`, orderBy: ['createdon desc'], top: 3 }),
    ]);
    const allAppts = allApptsRes.data || [];

    const patientGroupsMap = {};
    for (const a of allAppts) {
      const pid = a._hs_patient_value;
      if (!pid) continue;
      if (!patientGroupsMap[pid] || new Date(a.hs_appointmentdate) > new Date(patientGroupsMap[pid])) {
        patientGroupsMap[pid] = a.hs_appointmentdate;
      }
    }
    const patientGroups = Object.entries(patientGroupsMap).map(([patientId, maxDate]) => ({ patientId, maxDate }));
    const topPatientGroups = [...patientGroups].sort((a, b) => new Date(b.maxDate) - new Date(a.maxDate)).slice(0, 20);
    const topPatientIds = topPatientGroups.map(g => g.patientId);

    const todaysApptsRaw = allAppts.filter(a => {
      const d = new Date(a.hs_appointmentdate);
      return d >= today && d < tomorrow;
    });
    const todayPatientIds = [...new Set(todaysApptsRaw.map(a => a._hs_patient_value))];
    const allMetricPatientIds = [...new Set([...todayPatientIds, ...topPatientIds])];

    let metricsRes = { data: [] }, allergiesRes = { data: [] }, patientsInfoRes = { data: [] };
    if (allMetricPatientIds.length) {
      const userClause = `(${allMetricPatientIds.map(pid => `_hs_user_value eq ${pid}`).join(' or ')})`;
      const patientClause = `(${allMetricPatientIds.map(pid => `_hs_patient_value eq ${pid}`).join(' or ')})`;
      const idClause = `(${allMetricPatientIds.map(pid => `hs_userid eq ${pid}`).join(' or ')})`;
      [metricsRes, allergiesRes, patientsInfoRes] = await Promise.all([
        Hs_healthmetricsService.getAll({ filter: userClause, orderBy: ['hs_recordedat desc'] }),
        Hs_allergiesService.getAll({ filter: `${patientClause} and hs_is_active eq true and hs_severity eq ${SEVERITY_CODES.severe}` }),
        Hs_usersService.getAll({ filter: idClause }),
      ]);
    }

    const latestByUser = {};
    const weekMetricsByUser = {};
    for (const m of (metricsRes.data || []).map(toMetric)) {
      if (!latestByUser[m.userId]) latestByUser[m.userId] = m;
      if (new Date(m.recordedAt) >= sevenDaysAgo) (weekMetricsByUser[m.userId] ||= []).push(m);
    }
    const allergyByUser = {};
    for (const a of (allergiesRes.data || [])) (allergyByUser[a._hs_patient_value] ||= []).push(a.hs_allergen);
    const patientInfoMap = {};
    for (const p of (patientsInfoRes.data || [])) patientInfoMap[p.hs_userid] = { name: p.hs_fullname, nhsId: p.hs_nhsidentifier };

    const appointments = todaysApptsRaw.map(a => {
      const vit = latestByUser[a._hs_patient_value] || {};
      const bpSys = vit.systolic ?? null;
      const bpDia = vit.diastolic ?? null;
      const hr = vit.heartRate ?? null;
      const spo2 = vit.oxygenSaturation != null ? Number(vit.oxygenSaturation) : null;
      const stress = vit.stressLevel ?? null;
      const severeAllergies = (allergyByUser[a._hs_patient_value] || []).join(', ');
      const status = Hs_appointmentshs_status[a.hs_status] || 'pending';

      let riskScore = 0;
      const riskFlags = [];
      if (bpSys != null && bpSys >= 140) { riskFlags.push('High BP'); riskScore += 30; }
      else if (bpSys != null && bpSys >= 130) { riskFlags.push('Elevated BP'); riskScore += 15; }
      if (hr != null && hr > 100) { riskFlags.push('Tachycardia'); riskScore += 25; }
      if (spo2 != null && spo2 < 93) { riskFlags.push('⚠️ Low SpO₂'); riskScore += 40; }
      if (severeAllergies) { riskFlags.push('Severe Allergy'); riskScore += 20; }
      if (stress != null && stress > 70) { riskFlags.push('High Stress'); riskScore += 10; }
      if (status === 'late') riskScore += 5;

      const riskLevel = riskScore >= 50 ? 'critical' : riskScore >= 25 ? 'warning' : 'low';
      const patientInfo = patientInfoMap[a._hs_patient_value] || {};

      return {
        id: a.hs_appointmentid,
        patient_id: a._hs_patient_value,
        patient_name: a.hs_patientname || patientInfo.name,
        nhs_id: patientInfo.nhsId,
        appointmentTime: a.hs_appointmenttime,
        appointmentDate: a.hs_appointmentdate,
        reason: a.hs_reason,
        status,
        bp_sys: bpSys, bp_dia: bpDia, heart_rate: hr, spo2,
        severe_allergies: severeAllergies,
        risk_score: riskScore, risk_flags: riskFlags, risk_level: riskLevel,
      };
    }).sort((a, b) => new Date(a.appointmentTime) - new Date(b.appointmentTime));

    const priorityQueue = appointments.filter(a => a.risk_score >= 25).sort((a, b) => b.risk_score - a.risk_score);
    const criticalPts = appointments.filter(a => a.risk_level === 'critical').length;

    const allPatients = topPatientGroups.map(g => {
      const p = patientInfoMap[g.patientId] || {};
      const hs = calculateHealthScore(weekMetricsByUser[g.patientId] || []);
      return {
        id: g.patientId,
        name: p.name,
        nhs_id: p.nhsId,
        last_visit: g.maxDate,
        health_score: hs.score,
        score_category: hs.category,
        score_color: hs.color,
      };
    }).sort((a, b) => a.health_score - b.health_score);

    const monthlyData = Array.from({ length: 12 }, (_, m) => allAppts.filter(a => {
      const d = new Date(a.hs_appointmentdate);
      return d.getFullYear() === year && d.getMonth() === m;
    }).length);

    const medRecords = medRecordsRes.data || [];
    const pendingLabs = medRecords.length;
    const criticalLabs = medRecords.slice(0, 3).map(l => ({ id: l.hs_medicalrecordid, testType: l.hs_testtype, patient_name: l.hs_patientname || patientInfoMap[l._hs_patient_value]?.name }));
    const emergencyMsgs = (msgsRes.data || []).map(m => ({ id: m.hs_messageid, sender_name: m.hs_sendername, content: m.hs_ontent }));

    setData({
      totalToday: appointments.length,
      pendingLabs, criticalPts,
      todaysAppts: appointments,
      priorityQueue, emergencyMsgs, criticalLabs, allPatients, monthlyData,
    });
    setLoading(false);
  }

  const updateStatus = async (id, status) => {
    await Hs_appointmentsService.update(id, { hs_status: APPT_STATUS_CODES[status] });
    await load();
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const {
    totalToday = 0, pendingLabs = 0, criticalPts = 0,
    todaysAppts = [], priorityQueue = [], emergencyMsgs = [], criticalLabs = [],
    allPatients = [], monthlyData = Array(12).fill(0),
  } = data || {};

  const openChart = (p) => {
    setModal({
      name: p.patient_name || p.name,
      nhsId: p.nhs_id,
      allergies: p.severe_allergies || '',
      bp: p.bp_sys ? `${p.bp_sys}/${p.bp_dia}` : '—',
      hr: p.heart_rate ?? '—',
      spo2: p.spo2 ?? '—',
    });
    setModalTab('vitals');
  };

  const q = search.trim().toLowerCase();
  const matches = (...parts) => !q || parts.some(p => String(p ?? '').toLowerCase().includes(q));

  const visiblePatients = allPatients.filter(p => matches(p.name, p.nhs_id));
  const visibleAdmits = allPatients.filter((p, i) => matches(p.name, p.nhs_id) || matches(DISEASES[i % DISEASES.length][0]));
  const visibleStaticAdmits = ADMIT_LIST.filter(r => matches(r[0], r[1], r[3]));

  const riskCounts = {
    poor: allPatients.filter(p => p.score_category === 'poor').length,
    fair: allPatients.filter(p => p.score_category === 'fair').length,
    good: allPatients.filter(p => p.score_category === 'good').length,
    excellent: allPatients.filter(p => p.score_category === 'excellent').length,
  };

  return (
    <div>
      <style>{`
        .risk-badge { padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.3px; }
        .risk-critical { background:#FEE2E2;color:#991B1B; }
        .risk-warning  { background:#FEF3C7;color:#92400E; }
        .risk-low      { background:#DCFCE7;color:#166534; }
        .patient-row-risk { border-left:3px solid transparent; }
        .patient-row-risk.critical { border-color:#DC2626;background:#FEF2F2; }
        .patient-row-risk.warning  { border-color:#D97706;background:#FFFBEB; }

        .dash-tabs { display:flex; gap:4px; }
        .dash-tab { padding:10px 24px; border:none; border-radius:8px 8px 0 0; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; transition:all .2s; }
        .dash-tab.active { background:#0D2137; color:#fff; }
        .dash-tab:not(.active) { background:#e2e8f0; color:#5E7A99; }
        .dash-tab:not(.active):hover { background:#cbd5e1; }

        .hosp-section { background:#0D2137; padding:20px; border-radius:0 0 12px 12px; }
        .hosp-kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:20px; }
        .hosp-kpi { background:#1A3552; border-radius:12px; padding:18px 20px; color:#fff; }
        .hosp-kpi-label { font-size:12px; color:#90AFC5; font-weight:600; margin-bottom:6px; }
        .hosp-kpi-value { font-size:30px; font-weight:900; color:#00D26A; line-height:1; margin-bottom:4px; }
        .hosp-kpi-bar { height:4px; border-radius:2px; margin-top:10px; }
        .hosp-chart-grid { display:grid; grid-template-columns:1.2fr 1fr 1fr 1fr; gap:16px; margin-bottom:20px; }
        .hosp-chart-card { background:#1A3552; border-radius:12px; padding:16px 18px; color:#fff; }
        .hosp-chart-title { font-size:13px; font-weight:700; color:#fff; margin-bottom:2px; }
        .hosp-chart-sub { font-size:11px; color:#90AFC5; margin-bottom:12px; }
        .hosp-chart-badge { font-size:11px; font-weight:700; padding:2px 8px; border-radius:4px; float:right; }
        .hosp-stat-row { display:flex; gap:16px; margin-bottom:10px; }
        .hosp-stat { font-size:13px; font-weight:700; color:#00D26A; }
        .hosp-stat span { font-size:11px; color:#90AFC5; display:block; font-weight:400; }
        .hosp-table-card { background:#1A3552; border-radius:12px; padding:0; overflow:hidden; color:#fff; }
        .hosp-table-header { padding:14px 20px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #243E5C; }
        .hosp-table-header h4 { margin:0; font-size:14px; font-weight:700; color:#fff; }
        .hosp-tbl { width:100%; border-collapse:collapse; font-size:13px; }
        .hosp-tbl th { padding:10px 16px; background:#0D2137; color:#90AFC5; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; text-align:left; }
        .hosp-tbl td { padding:10px 16px; border-bottom:1px solid #1E3650; color:#dde6f0; }
        .hosp-tbl tr:last-child td { border:none; }
        .hosp-tbl tr:hover td { background:#1E3650; }
        .dis-badge { padding:2px 8px; border-radius:4px; font-size:10px; font-weight:700; color:#fff; }

        .vital-item { background:#F8FAFC; border-radius:8px; padding:12px; text-align:center; }
        .vital-icon { font-size:22px; }
        .vital-value { font-size:20px; font-weight:800; color:var(--primary); }
        .vital-unit { font-size:11px; color:var(--text-muted); }
        .vital-label { font-size:11px; color:var(--text-muted); margin-top:2px; }
      `}</style>

      {/* Tab switcher + search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, flexWrap: 'wrap', gap: 10 }}>
        <div className="dash-tabs">
          <button className={`dash-tab${tab === 'hosp' ? ' active' : ''}`} onClick={() => setTab('hosp')}>🏥 Hospital Overview</button>
          <button className={`dash-tab${tab === 'my' ? ' active' : ''}`} onClick={() => setTab('my')}>👨‍⚕️ My Dashboard</button>
        </div>
        <input
          type="text" placeholder="Search by name, NHS ID..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-control" style={{ width: 240, fontSize: 13 }}
        />
      </div>

      {tab === 'hosp' && (
        <div className="hosp-section">
          {/* KPI Cards */}
          <div className="hosp-kpi-grid">
            <div className="hosp-kpi">
              <div className="hosp-kpi-label">New Patients</div>
              <div className="hosp-kpi-value">125</div>
              <div style={{ fontSize: 11, color: '#00D26A', fontWeight: 700 }}>+25% vs last month</div>
              <div className="hosp-kpi-bar" style={{ background: 'linear-gradient(90deg,#E91E8C,#E91E8C 70%,#1A3552 70%)' }} />
            </div>
            <div className="hosp-kpi">
              <div className="hosp-kpi-label">OPD Patients</div>
              <div className="hosp-kpi-value">218</div>
              <div style={{ fontSize: 11, color: '#00D26A', fontWeight: 700 }}>+12% vs last month</div>
              <div className="hosp-kpi-bar" style={{ background: 'linear-gradient(90deg,#FF6B35,#FF6B35 85%,#1A3552 85%)' }} />
            </div>
            <div className="hosp-kpi">
              <div className="hosp-kpi-label">Today's Operations</div>
              <div className="hosp-kpi-value" style={{ color: '#F59E0B' }}>25</div>
              <div style={{ fontSize: 11, color: '#90AFC5', fontWeight: 700 }}>3 in progress</div>
              <div className="hosp-kpi-bar" style={{ background: 'linear-gradient(90deg,#16A34A,#16A34A 40%,#1A3552 40%)' }} />
            </div>
            <div className="hosp-kpi">
              <div className="hosp-kpi-label">Visitors</div>
              <div className="hosp-kpi-value" style={{ color: '#60A5FA' }}>2,479</div>
              <div style={{ fontSize: 11, color: '#90AFC5', fontWeight: 700 }}>Family &amp; outpatients</div>
              <div className="hosp-kpi-bar" style={{ background: 'linear-gradient(90deg,#8B5CF6,#8B5CF6 92%,#1A3552 92%)' }} />
            </div>
          </div>

          {/* Survey + 3 trend charts */}
          <div className="hosp-chart-grid">
            <div className="hosp-chart-card">
              <div className="hosp-chart-title" style={{ marginBottom: 12 }}>Hospital Survey</div>
              <div style={{ height: 180 }}>
                <Line
                  data={{
                    labels: MONTHS,
                    datasets: [
                      { label: 'Admissions', data: [38, 42, 35, 48, 52, 60, 55, 48, 42, 38, 45, 50], borderColor: '#8B5CF6', tension: .4, fill: false, borderWidth: 2, pointRadius: 0 },
                      { label: 'Discharges', data: [32, 36, 30, 42, 46, 52, 50, 44, 38, 34, 40, 44], borderColor: '#00D26A', tension: .4, fill: false, borderWidth: 2, pointRadius: 0 },
                      { label: 'Operations', data: [20, 25, 18, 28, 30, 35, 32, 28, 22, 20, 24, 28], borderColor: '#60A5FA', tension: .4, fill: false, borderWidth: 2, pointRadius: 0 },
                    ],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#90AFC5', font: { size: 10 }, boxWidth: 10 } } },
                    scales: { x: { ticks: { color: '#90AFC5', font: { size: 9 } }, grid: { color: '#1E3650' } }, y: { ticks: { color: '#90AFC5', font: { size: 9 } }, grid: { color: '#1E3650' } } },
                  }}
                />
              </div>
            </div>

            <div className="hosp-chart-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div className="hosp-chart-title">New Patient</div>
                <span className="hosp-chart-badge" style={{ background: '#1a4a1a', color: '#00D26A' }}>▲25% High</span>
              </div>
              <div className="hosp-chart-sub">Growth trends</div>
              <div className="hosp-stat-row">
                <div className="hosp-stat">35.80%<span>Overall</span></div>
                <div className="hosp-stat">45.20%<span>Monthly</span></div>
                <div className="hosp-stat">5.50%<span>Daily</span></div>
              </div>
              <div style={{ height: 120 }}>
                <Line
                  data={{
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
                    datasets: [
                      { data: [40, 55, 45, 70, 80, 68, 85], borderColor: '#00D26A', backgroundColor: 'rgba(0,210,106,.15)', fill: true, tension: .4, pointRadius: 0, borderWidth: 2 },
                      { data: [25, 35, 30, 45, 55, 48, 60], borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,.1)', fill: true, tension: .4, pointRadius: 0, borderWidth: 2 },
                    ],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { ticks: { color: '#90AFC5', font: { size: 8 } }, grid: { color: '#1E3650' } }, y: { ticks: { color: '#90AFC5', font: { size: 8 } }, grid: { color: '#1E3650' } } },
                  }}
                />
              </div>
            </div>

            <div className="hosp-chart-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div className="hosp-chart-title">Heart Surgeries</div>
                <span className="hosp-chart-badge" style={{ background: '#4a1a1a', color: '#FF6B6B' }}>▼30% Low</span>
              </div>
              <div className="hosp-chart-sub">Monthly procedures</div>
              <div className="hosp-stat-row">
                <div className="hosp-stat">20.60%<span>Overall</span></div>
                <div className="hosp-stat">55.30%<span>Monthly</span></div>
                <div className="hosp-stat">4.90%<span>Daily</span></div>
              </div>
              <div style={{ height: 120 }}>
                <Bar
                  data={{
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [
                      { label: 'Emergency', data: [13, 11, 15, 8, 22, 14], backgroundColor: '#FF6B35', borderRadius: 2 },
                      { label: 'Scheduled', data: [44, 25, 55, 41, 67, 43], backgroundColor: '#0891B2', borderRadius: 2 },
                      { label: 'Elective', data: [17, 16, 20, 13, 21, 27], backgroundColor: '#F59E0B', borderRadius: 2 },
                    ],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { stacked: true, ticks: { color: '#90AFC5', font: { size: 8 } }, grid: { display: false } }, y: { stacked: true, ticks: { color: '#90AFC5', font: { size: 8 } }, grid: { color: '#1E3650' } } },
                  }}
                />
              </div>
            </div>

            <div className="hosp-chart-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div className="hosp-chart-title">Medical Treatment</div>
                <span className="hosp-chart-badge" style={{ background: '#1a3a1a', color: '#00D26A' }}>▲20% High</span>
              </div>
              <div className="hosp-chart-sub">Treatment efficiency</div>
              <div className="hosp-stat-row">
                <div className="hosp-stat">38.40%<span>Overall</span></div>
                <div className="hosp-stat">52.49%<span>Monthly</span></div>
                <div className="hosp-stat">4.70%<span>Daily</span></div>
              </div>
              <div style={{ height: 120 }}>
                <Line
                  data={{
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
                    datasets: [
                      { data: [85, 78, 90, 88, 95, 82, 98, 92], borderColor: '#00D26A', borderWidth: 2, borderDash: [4, 4], pointRadius: 3, pointBackgroundColor: '#00D26A', tension: 0, fill: false },
                      { data: [60, 65, 55, 70, 68, 72, 65, 78], borderColor: '#F59E0B', borderWidth: 2, borderDash: [4, 4], pointRadius: 3, pointBackgroundColor: '#F59E0B', tension: 0, fill: false },
                      { data: [40, 45, 38, 50, 48, 55, 42, 52], borderColor: '#8B5CF6', borderWidth: 2, borderDash: [4, 4], pointRadius: 3, pointBackgroundColor: '#8B5CF6', tension: 0, fill: false },
                    ],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { ticks: { color: '#90AFC5', font: { size: 8 } }, grid: { color: '#1E3650' } }, y: { ticks: { color: '#90AFC5', font: { size: 8 } }, grid: { color: '#1E3650' } } },
                  }}
                />
              </div>
            </div>
          </div>

          {/* Admit Patient List */}
          <div className="hosp-table-card">
            <div className="hosp-table-header">
              <h4>📋 Admit Patient List</h4>
              <span style={{ fontSize: 12, color: '#90AFC5' }}>{allPatients.length + 7} total admissions today</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="hosp-tbl">
                <thead>
                  <tr><th>No</th><th>Name</th><th>Assigned Doctor</th><th>Date of Admit</th><th>Diseases</th><th>Room No</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {visibleAdmits.map((p, i) => {
                    const realIndex = allPatients.indexOf(p);
                    const d = DISEASES[realIndex % DISEASES.length];
                    const room = 100 + (realIndex * 3 + 1);
                    const si = realIndex % 5;
                    return (
                      <tr key={`p-${p.id}`}>
                        <td style={{ color: '#90AFC5', fontWeight: 700 }}>{realIndex + 1}</td>
                        <td style={{ fontWeight: 700 }}>{p.name}</td>
                        <td>You</td>
                        <td>{p.last_visit ? new Date(p.last_visit).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}</td>
                        <td><span className="dis-badge" style={{ background: d[1] }}>{d[0]}</span></td>
                        <td style={{ fontWeight: 700 }}>{room}</td>
                        <td><span style={{ color: ADMIT_STATUS_COLORS[si], fontWeight: 700, fontSize: 11 }}>{ADMIT_STATUSES[si]}</span></td>
                      </tr>
                    );
                  })}
                  {visibleStaticAdmits.map((row, i) => (
                    <tr key={`s-${i}`}>
                      <td style={{ color: '#90AFC5', fontWeight: 700 }}>{allPatients.length + i + 1}</td>
                      <td style={{ fontWeight: 700 }}>{row[0]}</td>
                      <td>{row[1]}</td>
                      <td>{row[2]}</td>
                      <td><span className="dis-badge" style={{ background: row[5] }}>{row[3]}</span></td>
                      <td style={{ fontWeight: 700 }}>{row[4]}</td>
                      <td><span style={{ color: '#F59E0B', fontWeight: 700, fontSize: 11 }}>Under Treatment</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'my' && (
        <div>
          {/* KPI Header Row */}
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
            <div className="stat-card" style={{ background: '#eff6ff' }}>
              <div className="stat-icon" style={{ background: '#dbeafe' }}>👥</div>
              <div className="stat-info">
                <div className="stat-label">Patients Today</div>
                <div className="stat-value">{totalToday}</div>
                <div className="stat-sub">{todaysAppts.filter(a => a.status === 'arrived').length} arrived · {todaysAppts.filter(a => a.status === 'waiting').length} waiting</div>
              </div>
            </div>
            <div className="stat-card" style={{ background: '#fef2f2' }}>
              <div className="stat-icon" style={{ background: '#fee2e2' }}>🚨</div>
              <div className="stat-info">
                <div className="stat-label">High Risk Patients</div>
                <div className="stat-value">{criticalPts}</div>
                <div className="stat-sub">Require priority care</div>
              </div>
            </div>
            <div className="stat-card" style={{ background: '#f0fdfa' }}>
              <div className="stat-icon" style={{ background: '#ccfbf1' }}>📅</div>
              <div className="stat-info">
                <div className="stat-label">Schedule</div>
                <div className="stat-value" style={{ fontSize: 16 }}>09:00–17:00</div>
                <div className="stat-sub">3 slots available</div>
              </div>
            </div>
            <div className="stat-card" style={{ background: '#fffbeb' }}>
              <div className="stat-icon" style={{ background: '#fef3c7' }}>🧪</div>
              <div className="stat-info">
                <div className="stat-label">Critical Labs</div>
                <div className="stat-value">{pendingLabs}</div>
                <div className="stat-sub">Require review</div>
              </div>
            </div>
            <div className="stat-card" style={{ background: '#fef2f2' }}>
              <div className="stat-icon" style={{ background: '#fee2e2' }}>💬</div>
              <div className="stat-info">
                <div className="stat-label">Emergency Messages</div>
                <div className="stat-value">{emergencyMsgs.length}</div>
                <div className="stat-sub"><Link to="/doctor/messages" style={{ color: 'var(--primary-light)', fontSize: 12 }}>Open inbox →</Link></div>
              </div>
            </div>
          </div>

          {/* Priority Patient Queue */}
          {priorityQueue.length > 0 && (
            <div className="card mb-4" style={{ borderLeft: '4px solid #DC2626' }}>
              <div className="card-header">
                <h3><i className="fas fa-sort-amount-up" style={{ color: '#DC2626' }} /> Priority Patient Queue</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: '#FEE2E2', color: '#DC2626', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{priorityQueue.length} at-risk patients</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sorted by risk score</span>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Patient</th><th>Risk Score</th><th>Risk Flags</th><th>Vitals</th><th>Time</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {priorityQueue.map(pq => (
                      <tr key={pq.id} className={`patient-row-risk ${pq.risk_level}`}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: pq.risk_level === 'critical' ? '#DC2626' : '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>
                              {pq.patient_name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{pq.patient_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{pq.nhs_id}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: pq.risk_level === 'critical' ? '#FEE2E2' : '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: pq.risk_level === 'critical' ? '#DC2626' : '#D97706' }}>
                              {pq.risk_score}
                            </div>
                            <span className={`risk-badge risk-${pq.risk_level}`}>{pq.risk_level.charAt(0).toUpperCase() + pq.risk_level.slice(1)}</span>
                          </div>
                        </td>
                        <td>
                          {pq.risk_flags.map((flag, i) => (
                            <span key={i} style={{ background: flag.includes('⚠️') ? '#FEE2E2' : '#FEF3C7', color: flag.includes('⚠️') ? '#991B1B' : '#92400E', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, marginRight: 4, display: 'inline-block', marginBottom: 2 }}>{flag}</span>
                          ))}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          <div><strong>BP:</strong> {pq.bp_sys ? `${pq.bp_sys}/${pq.bp_dia}` : '—'}</div>
                          <div><strong>HR:</strong> {pq.heart_rate ?? '—'} bpm</div>
                          <div><strong>SpO₂:</strong> {pq.spo2 ?? '—'}%</div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{fmtTime(pq.appointmentTime)}</td>
                        <td><StatusBadge status={pq.status} /></td>
                        <td>
                          <button className="btn btn-sm btn-danger" onClick={() => openChart(pq)}>
                            <i className="fas fa-chart-area" /> Open Chart
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 280px', gap: 20, marginBottom: 20 }}>
            {/* Today's Schedule */}
            <div className="card">
              <div className="card-header"><h3><i className="fas fa-calendar-day" /> Today's Schedule</h3></div>
              <div>
                {todaysAppts.length === 0 && (
                  <div className="empty-state"><div className="empty-icon">📅</div><p>No appointments today.</p></div>
                )}
                {todaysAppts.map(a => (
                  <div key={a.id} style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10,
                    background: a.risk_level === 'critical' ? '#FEF2F2' : a.risk_level === 'warning' ? '#FFFBEB' : 'transparent',
                  }}>
                    <div style={{ minWidth: 44, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{fmtTime(a.appointmentTime)}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary)' }}>{a.patient_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.reason || 'General'}</div>
                      {a.risk_flags?.length > 0 && (
                        <div style={{ marginTop: 3 }}>
                          {a.risk_flags.slice(0, 2).map((f, i) => (
                            <span key={i} style={{ fontSize: 9, background: '#FEE2E2', color: '#DC2626', padding: '1px 5px', borderRadius: 3, fontWeight: 700, marginRight: 3 }}>{f}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <StatusBadge status={a.status} />
                      <button className="btn btn-sm btn-outline" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => openChart(a)}>Open chart</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Patient health scores */}
            <div className="card">
              <div className="card-header">
                <h3><i className="fas fa-list-ol" /> All Patients — Health Score</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lowest score = most at risk</span>
              </div>
              <div>
                {visiblePatients.map(pt => (
                  <div key={pt.id} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: pt.score_color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                      {pt.health_score}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>{pt.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>NHS: {pt.nhs_id} · Last: {fmtDate(pt.last_visit)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ width: 80, background: 'var(--bg)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${pt.health_score}%`, background: pt.score_color, height: '100%', borderRadius: 4 }} />
                      </div>
                      <div style={{ fontSize: 10, color: pt.score_color, fontWeight: 700, marginTop: 2, textTransform: 'capitalize' }}>{pt.score_category}</div>
                    </div>
                  </div>
                ))}
                {!visiblePatients.length && (
                  <div className="empty-state"><div className="empty-icon">👥</div><p>No patients yet.</p></div>
                )}
              </div>
            </div>

            {/* Alerts & Emergency */}
            <div className="card">
              <div className="card-header"><h3><i className="fas fa-bell" /> Alerts</h3></div>
              <div>
                {emergencyMsgs.length > 0 && (
                  <div style={{ padding: '10px 16px', background: '#FEF2F2', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>🚨 Emergency Messages</div>
                    {emergencyMsgs.map(em => (
                      <div key={em.id} style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{em.sender_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>"{em.content?.slice(0, 50)}..."</div>
                      </div>
                    ))}
                    <Link to="/doctor/messages" className="btn btn-sm btn-danger" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}><i className="fas fa-reply" /> Respond Now</Link>
                  </div>
                )}

                {criticalLabs.map(lab => (
                  <div key={lab.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary)' }}>{lab.testType}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lab.patient_name}</div>
                    </div>
                    <span className="badge badge-danger">Critical</span>
                  </div>
                ))}

                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary)' }}>Prescription refills due</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>2 patients need renewal this week</div>
                </div>

                <Link to="/doctor/alerts" style={{ display: 'block', padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--primary-light)' }}>View all tasks →</Link>
              </div>
            </div>
          </div>

          {/* Monthly chart row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            <div className="card">
              <div className="card-header"><h3><i className="fas fa-chart-bar" /> Appointments (Monthly)</h3></div>
              <div style={{ height: 220, padding: 12 }}>
                <Bar
                  data={{ labels: MONTHS, datasets: [{ label: 'Appointments', data: monthlyData, backgroundColor: '#1565C0', borderRadius: 5, borderSkipped: false }] }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#EFF6FF' } } } }}
                />
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3><i className="fas fa-chart-pie" /> Patient Risk Distribution</h3></div>
              <div style={{ height: 220, padding: 12 }}>
                <Doughnut
                  data={{
                    labels: ['Poor (High Risk)', 'Fair', 'Good', 'Excellent'],
                    datasets: [{ data: [riskCounts.poor, riskCounts.fair, riskCounts.good, riskCounts.excellent], backgroundColor: ['#DC2626', '#D97706', '#1565C0', '#16A34A'], borderWidth: 2, borderColor: '#fff' }],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } } } }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient Chart Modal */}
      {modal && (
        <div style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 2000, alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-md)' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: 'var(--primary)', color: '#fff', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, borderRadius: '16px 16px 0 0' }}>
              <div>
                <h5 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}><i className="fas fa-notes-medical" /> Patient Chart</h5>
                <div style={{ fontSize: 12, opacity: .7 }}>{modal.name} · NHS: {modal.nhsId}</div>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>&times;</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', gap: 4, background: '#F8FAFC', borderRadius: 8, padding: 4, marginBottom: 20, width: 'fit-content' }}>
                {['vitals', 'labs', 'medications', 'notes'].map(t => (
                  <button key={t} onClick={() => setModalTab(t)} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: modalTab === t ? 'var(--primary-light)' : 'transparent', color: modalTab === t ? '#fff' : 'var(--text-muted)', textTransform: 'capitalize' }}>{t}</button>
                ))}
              </div>

              {modalTab === 'vitals' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                    <div className="vital-item"><div className="vital-icon">❤️</div><div className="vital-value">{modal.bp}</div><div className="vital-unit">mmHg</div><div className="vital-label">Blood Pressure</div></div>
                    <div className="vital-item"><div className="vital-icon">💓</div><div className="vital-value">{modal.hr}</div><div className="vital-unit">bpm</div><div className="vital-label">Heart Rate</div></div>
                    <div className="vital-item"><div className="vital-icon">🫁</div><div className="vital-value">{modal.spo2}</div><div className="vital-unit">%</div><div className="vital-label">SpO₂</div></div>
                  </div>
                  {modal.allergies && (
                    <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#991B1B' }}>
                      <strong><i className="fas fa-exclamation-triangle" /> Severe Allergy:</strong> {modal.allergies}
                    </div>
                  )}
                  <div style={{ height: 140 }}>
                    <Line
                      data={{ labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], datasets: [{ data: [72, 74, 78, 70, 76, 73, 74], borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,.1)', fill: true, tension: .4, pointRadius: 3 }] }}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { min: 55, max: 110, grid: { color: '#EFF6FF' } } } }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>7-day heart rate trend</p>
                </div>
              )}

              {modalTab === 'labs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {LAB_DEMO.map(([name, val, status]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, borderLeft: `3px solid ${LAB_COLORS[status] || '#5E7A99'}` }}>
                      <div><div style={{ fontWeight: 600, color: 'var(--primary)' }}>{name}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{status.charAt(0).toUpperCase() + status.slice(1)}</div></div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: LAB_COLORS[status] || '#5E7A99' }}>{val}</div>
                    </div>
                  ))}
                </div>
              )}

              {modalTab === 'medications' && (
                <div>
                  {MED_DEMO.map(([name, dose, freq]) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>💊</span>
                        <div><div style={{ fontWeight: 700, color: 'var(--primary)' }}>{name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{freq}</div></div>
                      </div>
                      <strong style={{ fontSize: 15, color: 'var(--primary-light)' }}>{dose}</strong>
                    </div>
                  ))}
                </div>
              )}

              {modalTab === 'notes' && (
                <div>
                  <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 14, fontSize: 13, color: 'var(--text)', lineHeight: 1.7, marginBottom: 14 }}>
                    Patient reports occasional headaches; advised salt reduction and hydration. BP readings stabilising within target range. Patient compliant with diet restrictions.
                  </div>
                  <textarea className="form-control" rows={3} placeholder="Add clinical observation..." />
                  <button type="button" className="btn btn-sm btn-primary" style={{ marginTop: 10 }}><i className="fas fa-save" /> Save Note</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
