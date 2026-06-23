import { useState, useEffect, useCallback } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, PointElement, LineElement, ArcElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Hs_usersService } from '../../generated/services/Hs_usersService';
import { Hs_usershs_userrole, Hs_usershs_accountstatus } from '../../generated/models/Hs_usersModel';
import { Hs_appointmentsService } from '../../generated/services/Hs_appointmentsService';
import { Hs_appointmentshs_status } from '../../generated/models/Hs_appointmentsModel';
import { Hs_prescriptionsService } from '../../generated/services/Hs_prescriptionsService';
import { Hs_prescriptionshs_status } from '../../generated/models/Hs_prescriptionsModel';
import { Hs_medicalrecordsService } from '../../generated/services/Hs_medicalrecordsService';
import { Hs_medicalrecordshs_status } from '../../generated/models/Hs_medicalrecordsModel';
import { Hs_messagesService } from '../../generated/services/Hs_messagesService';
import { Hs_documentsService } from '../../generated/services/Hs_documentsService';
import { Hs_doctorsService } from '../../generated/services/Hs_doctorsService';
import { Hs_accesslogsService } from '../../generated/services/Hs_accesslogsService';

const ROLE_CODES = Object.fromEntries(Object.entries(Hs_usershs_userrole).map(([c, l]) => [l, Number(c)]));
const STATUS_CODES = Object.fromEntries(Object.entries(Hs_usershs_accountstatus).map(([c, l]) => [l, Number(c)]));
const PRES_STATUS_CODES = Object.fromEntries(Object.entries(Hs_prescriptionshs_status).map(([c, l]) => [l, Number(c)]));
const MEDREC_STATUS_CODES = Object.fromEntries(Object.entries(Hs_medicalrecordshs_status).map(([c, l]) => [l, Number(c)]));

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RANK_COLORS = ['#1565C0', '#16A34A', '#D97706', '#7C3AED', '#0891B2'];
const DONUT_COLORS = ['#1565C0', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#0891B2'];

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
};

function actionColor(action = '') {
  const u = action.toUpperCase();
  if (/LOGIN|AUTH/.test(u)) return '#16A34A';
  if (/DELETE|SUSPEND/.test(u)) return '#DC2626';
  return '#1565C0';
}

const KPI_CARDS = [
  { key: 'totalPatients',      label: 'Total Patients',        icon: 'fa-users',         color: '#1565C0', bg: '#EFF6FF', sub: k => `Active users` },
  { key: 'totalDoctors',       label: 'Doctors',               icon: 'fa-user-md',       color: '#16A34A', bg: '#F0FDF4', sub: k => `All verified` },
  { key: 'totalAppts',         label: 'Appointments',          icon: 'fa-calendar-check', color: '#0891B2', bg: '#ECFEFF', sub: (k, s) => `${s.apptThisMonth} this month` },
  { key: 'activePrescriptions',label: 'Active Prescriptions',  icon: 'fa-pills',         color: '#D97706', bg: '#FFFBEB', sub: k => `Currently active` },
  { key: 'criticalCases',      label: 'Critical Cases',        icon: 'fa-flask',         color: '#DC2626', bg: '#FEF2F2', sub: k => `Require review` },
  { key: 'totalMessages',      label: 'Total Messages',        icon: 'fa-comment',       color: '#7C3AED', bg: '#F5F3FF', sub: k => `Platform-wide` },
  { key: 'totalDocuments',     label: 'Documents',             icon: 'fa-file-medical',  color: '#1565C0', bg: '#EFF6FF', sub: k => `Uploaded` },
];

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const year = now.getFullYear();
    const monthStart = new Date(year, now.getMonth(), 1);
    const monthEnd = new Date(year, now.getMonth() + 1, 1);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [usersRes, apptsRes, presRes, medRecsRes, msgsRes, docsRes, doctorsRes, logsRes] = await Promise.all([
      Hs_usersService.getAll(),
      Hs_appointmentsService.getAll(),
      Hs_prescriptionsService.getAll(),
      Hs_medicalrecordsService.getAll(),
      Hs_messagesService.getAll(),
      Hs_documentsService.getAll(),
      Hs_doctorsService.getAll(),
      Hs_accesslogsService.getAll({ orderBy: ['createdon desc'], top: 10 }),
    ]);

    const users = usersRes.data || [];
    const appts = apptsRes.data || [];
    const pres = presRes.data || [];
    const medRecs = medRecsRes.data || [];

    const totalPatients = users.filter(u => u.hs_userrole === ROLE_CODES.patient).length;
    const totalDoctors = users.filter(u => u.hs_userrole === ROLE_CODES.doctor && u.hs_accountstatus === STATUS_CODES.active).length;
    const totalAppts = appts.length;
    const apptThisMonth = appts.filter(a => {
      const d = new Date(a.hs_appointmentdate);
      return d >= monthStart && d < monthEnd;
    }).length;
    const activePrescriptions = pres.filter(p => p.hs_status === PRES_STATUS_CODES.active).length;
    const criticalCases = medRecs.filter(m => m.hs_status === MEDREC_STATUS_CODES.critical).length;
    const totalMessages = (msgsRes.data || []).length;
    const totalDocuments = (docsRes.data || []).length;

    const statusDist = {};
    for (const a of appts) {
      const label = Hs_appointmentshs_status[a.hs_status] || 'pending';
      statusDist[label] = (statusDist[label] || 0) + 1;
    }
    const recordDist = {};
    for (const m of medRecs) {
      const label = Hs_medicalrecordshs_status[m.hs_status] || 'pending';
      recordDist[label] = (recordDist[label] || 0) + 1;
    }
    const roleDist = {};
    for (const u of users) {
      const label = Hs_usershs_userrole[u.hs_userrole];
      if (label) roleDist[label] = (roleDist[label] || 0) + 1;
    }
    const medCounts = {};
    for (const p of pres) {
      if (!p.hs_medicationname) continue;
      medCounts[p.hs_medicationname] = (medCounts[p.hs_medicationname] || 0) + 1;
    }
    const medDist = Object.fromEntries(Object.entries(medCounts).sort((a, b) => b[1] - a[1]).slice(0, 6));

    const regByMonth = Array.from({ length: 12 }, (_, i) =>
      users.filter(u => u.hs_userrole === ROLE_CODES.patient && new Date(u.createdon).getFullYear() === year && new Date(u.createdon).getMonth() === i).length
    );
    const apptByMonth = Array.from({ length: 12 }, (_, i) =>
      appts.filter(a => new Date(a.hs_appointmentdate).getFullYear() === year && new Date(a.hs_appointmentdate).getMonth() === i).length
    );

    const dailyLabels = [];
    const dailyUsers = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      dailyLabels.push(d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit' }));
      dailyUsers.push(users.filter(u => {
        const ud = new Date(u.createdon);
        return ud.getDate() === d.getDate() && ud.getMonth() === d.getMonth() && ud.getFullYear() === d.getFullYear();
      }).length);
    }

    const doctorProfileByUserId = Object.fromEntries((doctorsRes.data || []).map(d => [d._hs_user_value, d]));
    const apptCountByDoctor = {};
    for (const a of appts) {
      if (!a._hs_doctor_value) continue;
      apptCountByDoctor[a._hs_doctor_value] = (apptCountByDoctor[a._hs_doctor_value] || 0) + 1;
    }
    const topDoctors = users
      .filter(u => u.hs_userrole === ROLE_CODES.doctor && u.hs_accountstatus === STATUS_CODES.active)
      .map(u => {
        const profile = doctorProfileByUserId[u.hs_userid] || {};
        return {
          name: u.hs_fullname,
          specialization: profile.hs_specialization,
          hospital: profile.hs_hospital,
          rating: parseFloat(profile.hs_rating) || 0,
          total_appointments: apptCountByDoctor[u.hs_userid] || 0,
        };
      })
      .sort((a, b) => b.total_appointments - a.total_appointments)
      .slice(0, 5);

    const logsRaw = logsRes.data || [];
    const logUserIds = [...new Set(logsRaw.map(l => l._hs_user_value).filter(Boolean))];
    const userById = Object.fromEntries(users.map(u => [u.hs_userid, u]));
    const recentActivity = logsRaw.map(l => {
      const u = userById[l._hs_user_value];
      return {
        user_name: u?.hs_fullname || 'Unknown',
        role: u ? Hs_usershs_userrole[u.hs_userrole] : '',
        action: l.hs_ction,
        ip_address: l.hs_paddress,
        created_at: l.createdon,
      };
    });

    setData({
      stats: { totalPatients, totalDoctors, totalAppts, apptThisMonth, activePrescriptions, criticalCases, totalMessages, totalDocuments },
      regByMonth, apptByMonth,
      statusDist, recordDist, roleDist, medDist,
      topDoctors, dailyLabels, dailyUsers, recentActivity,
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const s = data.stats || {};

  /* ── Chart data ── */
  const growthChart = {
    labels: MONTHS,
    datasets: [
      { label: 'New Patients', data: data.regByMonth, borderColor: '#1565C0', backgroundColor: 'rgba(21,101,192,0.08)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#1565C0' },
      { label: 'Appointments', data: data.apptByMonth, borderColor: '#16A34A', backgroundColor: 'rgba(22,163,74,0.06)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#16A34A' },
    ],
  };

  const roleDist = data.roleDist || {};
  const roleChart = {
    labels: Object.keys(roleDist).map(r => r.charAt(0).toUpperCase() + r.slice(1)),
    datasets: [{ data: Object.values(roleDist), backgroundColor: DONUT_COLORS, borderWidth: 2, borderColor: '#fff' }],
  };

  const statusDist = data.statusDist || {};
  const statusChart = {
    labels: Object.keys(statusDist).map(r => r.charAt(0).toUpperCase() + r.slice(1)),
    datasets: [{ data: Object.values(statusDist), backgroundColor: DONUT_COLORS, borderWidth: 2, borderColor: '#fff' }],
  };

  const recordDist = data.recordDist || {};
  const labChart = {
    labels: Object.keys(recordDist).map(r => r.charAt(0).toUpperCase() + r.slice(1)),
    datasets: [{ data: Object.values(recordDist), backgroundColor: ['#16A34A', '#D97706', '#DC2626', '#0891B2', '#7C3AED'], borderWidth: 2, borderColor: '#fff' }],
  };

  const dailyChart = {
    labels: data.dailyLabels,
    datasets: [{ label: 'New Users', data: data.dailyUsers, backgroundColor: '#1565C0', borderRadius: 6, borderSkipped: false }],
  };

  const medDist = data.medDist || {};
  const medsChart = {
    labels: Object.keys(medDist),
    datasets: [{ label: 'Prescriptions', data: Object.values(medDist), backgroundColor: DONUT_COLORS, borderRadius: 6, borderSkipped: false }],
  };

  const donutOpts = {
    responsive: true, maintainAspectRatio: false, cutout: '58%',
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 8 } } },
  };

  const maxAppts = Math.max(...(data.topDoctors || []).map(d => d.total_appointments), 1);

  return (
    <div>
      {/* Header actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
            <i className="fas fa-chart-bar" style={{ color: '#1565C0', marginRight: 8 }}></i>System Analytics
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Real-time HealthSphere platform statistics &middot; {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={load}><i className="fas fa-sync"></i> Refresh</button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', marginBottom: 24 }}>
        {KPI_CARDS.map(({ key, label, icon, color, bg, sub }) => (
          <div key={key} className="stat-card">
            <div className="stat-icon" style={{ background: bg, color }}>
              <i className={`fas ${icon}`}></i>
            </div>
            <div className="stat-info">
              <div className="stat-value">{(s[key] ?? 0).toLocaleString()}</div>
              <div className="stat-label">{label}</div>
              <div className="stat-change" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{sub(key, s)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Row 1: Growth trends + Role distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-chart-line" style={{ marginRight: 6, color: '#1565C0' }}></i>Growth Trends ({new Date().getFullYear()})</h3>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 3, background: '#1565C0', borderRadius: 2, display: 'inline-block' }}></span>New Patients
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 3, background: '#16A34A', borderRadius: 2, display: 'inline-block' }}></span>Appointments
              </span>
            </div>
          </div>
          <div className="card-body" style={{ height: 260 }}>
            <Line data={growthChart} options={{ ...CHART_OPTS, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#EFF6FF' }, min: 0 } } }} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-users-cog" style={{ marginRight: 6, color: '#1565C0' }}></i>User Role Distribution</h3>
          </div>
          <div className="card-body" style={{ height: 260 }}>
            <Doughnut data={roleChart} options={donutOpts} />
          </div>
        </div>
      </div>

      {/* Row 2: 3 donuts/bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><h3><i className="fas fa-calendar" style={{ marginRight: 6, color: '#1565C0' }}></i>Appointment Status</h3></div>
          <div className="card-body" style={{ height: 240 }}>
            {Object.keys(statusDist).length ? <Doughnut data={statusChart} options={donutOpts} /> : <div className="empty-state">No data</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3><i className="fas fa-flask" style={{ marginRight: 6, color: '#1565C0' }}></i>Lab Results Distribution</h3></div>
          <div className="card-body" style={{ height: 240 }}>
            {Object.keys(recordDist).length ? <Doughnut data={labChart} options={donutOpts} /> : <div className="empty-state">No data</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3><i className="fas fa-user-plus" style={{ marginRight: 6, color: '#1565C0' }}></i>New Users (7 Days)</h3></div>
          <div className="card-body" style={{ height: 240 }}>
            <Bar data={dailyChart} options={{ ...CHART_OPTS, scales: { x: { grid: { display: false } }, y: { grid: { color: '#EFF6FF' }, min: 0, ticks: { stepSize: 1 } } } }} />
          </div>
        </div>
      </div>

      {/* Row 3: Top doctors + Medications */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Top Doctors */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-medal" style={{ marginRight: 6, color: '#D97706' }}></i>Top Doctors by Appointments</h3>
          </div>
          <div style={{ padding: 0 }}>
            {data.topDoctors?.length ? data.topDoctors.map((doc, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < data.topDoctors.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: RANK_COLORS[i], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doc.specialization}{doc.hospital ? ` · ${doc.hospital}` : ''}</div>
                </div>
                <div style={{ textAlign: 'right', marginRight: 12 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>{doc.total_appointments}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>appts</div>
                </div>
                <div style={{ width: 70 }}>
                  <div style={{ background: 'var(--bg)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((doc.total_appointments / maxAppts) * 100)}%`, background: RANK_COLORS[i], height: '100%', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#F59E0B', marginTop: 2 }}>{'★'.repeat(Math.round(doc.rating))} {doc.rating?.toFixed(1)}</div>
                </div>
              </div>
            )) : <div className="empty-state" style={{ padding: 24 }}>No doctor data</div>}
          </div>
        </div>

        {/* Most Prescribed Medications */}
        <div className="card">
          <div className="card-header"><h3><i className="fas fa-pills" style={{ marginRight: 6, color: '#7C3AED' }}></i>Most Prescribed Medications</h3></div>
          <div className="card-body" style={{ height: 300 }}>
            {Object.keys(medDist).length
              ? <Bar data={medsChart} options={{ ...CHART_OPTS, indexAxis: 'y', scales: { x: { grid: { color: '#EFF6FF' } }, y: { grid: { display: false } } } }} />
              : <div className="empty-state">No prescription data</div>}
          </div>
        </div>
      </div>

      {/* Recent System Activity */}
      <div className="card">
        <div className="card-header">
          <h3><i className="fas fa-history" style={{ marginRight: 6, color: '#1565C0' }}></i>Recent System Activity</h3>
          <span className="badge badge-gray">{data.recentActivity?.length || 0} recent</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>User</th><th>Role</th><th>Action</th><th>IP Address</th><th>Time</th></tr>
            </thead>
            <tbody>
              {data.recentActivity?.length ? data.recentActivity.map((act, i) => {
                const c = actionColor(act.action);
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{act.user_name}</td>
                    <td><span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{act.role}</span></td>
                    <td>
                      <code style={{ background: `${c}18`, color: c, padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{act.action}</code>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{act.ip_address || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(act.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={5}><div className="empty-state">No recent activity</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
