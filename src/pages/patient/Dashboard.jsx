import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Line, Bar, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, RadialLinearScale, Tooltip, Legend, Filler,
} from 'chart.js';
import { useAuth } from '../../context/AuthContext';
import { Hs_healthmetricsService } from '../../generated/services/Hs_healthmetricsService';
import { Hs_appointmentsService } from '../../generated/services/Hs_appointmentsService';
import { Hs_appointmentshs_status } from '../../generated/models/Hs_appointmentsModel';
import { Hs_doctorsService } from '../../generated/services/Hs_doctorsService';
import { Hs_prescriptionsService } from '../../generated/services/Hs_prescriptionsService';
import { Hs_prescriptionshs_status } from '../../generated/models/Hs_prescriptionsModel';
import { Hs_dietlogsService } from '../../generated/services/Hs_dietlogsService';
import { Hs_waterlogsService } from '../../generated/services/Hs_waterlogsService';
import { Hs_allergiesService } from '../../generated/services/Hs_allergiesService';
import { Hs_allergieshs_severity } from '../../generated/models/Hs_allergiesModel';
import { Hs_usersService } from '../../generated/services/Hs_usersService';
import { Hs_usershs_userrole } from '../../generated/models/Hs_usersModel';
import { calculateHealthScore, generateInsights, avg } from '../../lib/healthAnalytics';
import {
  totalPoints, dateKey, calculateStreak, calculateBadges,
  calculateAchievements, calculateChallenges, waterPoints,
} from '../../lib/gamification';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, RadialLinearScale, Tooltip, Legend, Filler);

const APPT_STATUS_CODES = Object.fromEntries(Object.entries(Hs_appointmentshs_status).map(([c, l]) => [l, Number(c)]));
const PRES_STATUS_CODES = Object.fromEntries(Object.entries(Hs_prescriptionshs_status).map(([c, l]) => [l, Number(c)]));
const SEVERITY_CODES = Object.fromEntries(Object.entries(Hs_allergieshs_severity).map(([c, l]) => [l, Number(c)]));
const ROLE_CODES = Object.fromEntries(Object.entries(Hs_usershs_userrole).map(([c, l]) => [l, Number(c)]));

function toMetric(r) {
  return {
    systolic: r.hs_systolic, diastolic: r.hs_diastolic, heartRate: r.hs_heartrate,
    oxygenSaturation: r.hs_oxygensaturation, sleepHours: r.hs_sleephours, steps: r.hs_steps,
    stressLevel: r.hs_stresslevel, recordedAt: r.hs_recordedat,
  };
}

function toApptDashboard(r, doctorByUserId) {
  const doc = doctorByUserId[r._hs_doctor_value];
  return {
    id: r.hs_appointmentid,
    doctor_name: doc?.hs_username || r.hs_doctorname,
    specialization: doc?.hs_specialization,
    appointmentDate: r.hs_appointmentdate,
    appointmentTime: r.hs_appointmenttime,
    status: Hs_appointmentshs_status[r.hs_status] || 'pending',
  };
}

function toMedication(r) {
  return { id: r.hs_prescriptionid, medicationName: r.hs_medicationname, dosage: r.hs_dosage, frequency: r.hs_frequency };
}

const FALLBACK = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  hr: [72, 74, 78, 70, 76, 73, 74],
  bpSys: [120, 118, 122, 116, 124, 119, 118],
  bpDia: [78, 76, 79, 74, 81, 77, 76],
  steps: [8200, 7495, 5100, 9200, 6300, 10500, 4800],
  lastWeekSteps: [8200, 8500, 6200, 9000, 7100, 9800, 5200],
};

function pctChange(newV, oldV) {
  if (!oldV) return null;
  const pct = Math.round(((newV - oldV) / oldV) * 1000) / 10;
  return { pct: Math.abs(pct), up: pct >= 0 };
}

function ChangePill({ change }) {
  if (!change) return null;
  return <span style={{ color: change.up ? '#16A34A' : '#DC2626', fontSize: 11, fontWeight: 700 }}>{change.up ? '↑' : '↓'} {change.pct}%</span>;
}

function Sparkline({ data, color }) {
  if (!data?.length) return null;
  return (
    <div style={{ height: 36, marginTop: 6 }}>
      <Line
        data={{ labels: data.map((_, i) => i), datasets: [{ data, borderColor: color, borderWidth: 1.5, fill: false, tension: 0.4, pointRadius: 0 }] }}
        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }}
      />
    </div>
  );
}

function ScoreGauge({ score, color }) {
  const size = 120, stroke = 10, r = (size - stroke) / 2, c = 2 * Math.PI * r, arcLen = c * 0.75;
  const filled = arcLen * (Math.min(100, score) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(135deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth={stroke}
        strokeDasharray={`${arcLen} ${c - arcLen}`} strokeLinecap="round" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fff" strokeWidth={stroke}
        strokeDasharray={`${filled} ${c - filled}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 1.2s ease' }} />
    </svg>
  );
}

const insightStyle = (type) => ({
  critical: { c: '#DC2626', bg: '#FEE2E2', sbg: 'rgba(220,38,38,.07)' },
  warning: { c: '#D97706', bg: '#FEF3C7', sbg: 'rgba(217,119,6,.06)' },
  info: { c: '#0891B2', bg: '#CFFAFE', sbg: 'rgba(8,145,178,.06)' },
  positive: { c: '#16A34A', bg: '#DCFCE7', sbg: 'rgba(22,163,74,.06)' },
}[type] || { c: '#5E7A99', bg: '#F1F5F9', sbg: 'rgba(94,122,153,.05)' });

const statusBadge = (s) => {
  const map = { pending: 'warning', confirmed: 'info', completed: 'success', cancelled: 'danger', arrived: 'purple' };
  return <span className={`badge badge-${map[s] || 'gray'}`}>{s}</span>;
};

export default function PatientDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('gamification');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const todayKey = dateKey(today);
    const todayStr = today.toISOString().slice(0, 10);
    const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().slice(0, 10);

    const [metricsRes, apptRes, presRes, dietRes, waterRes, allergyRes, doctorsRes, usersRes] = await Promise.all([
      Hs_healthmetricsService.getAll({ filter: `_hs_user_value eq ${user.id}`, orderBy: ['hs_recordedat desc'], top: 60 }),
      Hs_appointmentsService.getAll({
        filter: `_hs_patient_value eq ${user.id} and (hs_status eq ${APPT_STATUS_CODES.confirmed} or hs_status eq ${APPT_STATUS_CODES.pending}) and hs_appointmentdate ge ${todayStr}`,
        orderBy: ['hs_appointmentdate asc'], top: 3,
      }),
      Hs_prescriptionsService.getAll({ filter: `_hs_patient_value eq ${user.id} and hs_status eq ${PRES_STATUS_CODES.active}`, orderBy: ['createdon desc'], top: 4 }),
      Hs_dietlogsService.getAll({ filter: `_hs_user_value eq ${user.id} and hs_logdate ge ${fourteenDaysAgoStr}` }),
      Hs_waterlogsService.getAll({ filter: `_hs_user_value eq ${user.id} and hs_logdate ge ${fourteenDaysAgoStr}` }),
      Hs_allergiesService.getAll({ filter: `_hs_patient_value eq ${user.id} and hs_severity eq ${SEVERITY_CODES.severe}` }),
      Hs_doctorsService.getAll(),
      Hs_usersService.getAll({ filter: `hs_userrole eq ${ROLE_CODES.patient}` }),
    ]);

    const allMetrics = (metricsRes.data || []).map(toMetric);
    const dietLogs14 = (dietRes.data || []).map(r => ({ logDate: r.hs_logdate, calories: r.hs_calories, carbs: r.hs_carbs, fat: r.hs_fat, fiber: r.hs_fiber }));
    const waterLogs14 = (waterRes.data || []).map(r => ({ logDate: r.hs_logdate, glasses: r.hs_glasses }));
    const severeAllergies = (allergyRes.data || []).length;
    const doctorByUserId = Object.fromEntries((doctorsRes.data || []).map(d => [d._hs_user_value, d]));

    const weekMetrics = allMetrics.filter(m => new Date(m.recordedAt) >= sevenDaysAgo);
    const twoWeekMetrics = allMetrics.filter(m => new Date(m.recordedAt) >= fourteenDaysAgo);
    const lastWeekMetrics = allMetrics.filter(m => new Date(m.recordedAt) >= fourteenDaysAgo && new Date(m.recordedAt) < sevenDaysAgo);
    const latest = allMetrics[0] || null;
    const isToday = latest && dateKey(latest.recordedAt) === todayKey;

    const dietByDate = {};
    for (const d of dietLogs14) {
      const k = dateKey(d.logDate);
      if (!dietByDate[k]) dietByDate[k] = { cal: 0, carbs: 0, fat: 0, fiber: 0 };
      dietByDate[k].cal += d.calories || 0;
      dietByDate[k].carbs += Number(d.carbs || 0);
      dietByDate[k].fat += Number(d.fat || 0);
      dietByDate[k].fiber += Number(d.fiber || 0);
    }
    const dietDays7 = Object.entries(dietByDate).filter(([k]) => k >= dateKey(sevenDaysAgo)).map(([, v]) => v);
    const todayCal = dietByDate[todayKey]?.cal || 0;

    const waterByDate = {};
    for (const w of waterLogs14) waterByDate[dateKey(w.logDate)] = w.glasses;
    const waterGlasses = waterByDate[todayKey] || 0;
    const waterValues7 = waterLogs14.filter(w => dateKey(w.logDate) >= dateKey(sevenDaysAgo)).map(w => w.glasses);
    const waterAvg = waterValues7.length ? waterValues7.reduce((a, b) => a + b, 0) / waterValues7.length : null;

    const thisWeekAvg = {
      steps: avg(weekMetrics.map(m => m.steps)),
      sleep: avg(weekMetrics.map(m => m.sleepHours)),
      bp: avg(weekMetrics.map(m => m.systolic)),
    };
    const lastWeekAvg = {
      steps: avg(lastWeekMetrics.map(m => m.steps)),
      sleep: avg(lastWeekMetrics.map(m => m.sleepHours)),
      bp: avg(lastWeekMetrics.map(m => m.systolic)),
    };

    const healthScore = calculateHealthScore(weekMetrics);
    const insights = generateInsights({ metrics: twoWeekMetrics, dietDays: dietDays7, waterAvg, severeAllergies });

    const dietDateCount = Object.keys(dietByDate).length;
    const dietDateCountWeek = Object.keys(dietByDate).filter(k => k >= dateKey(sevenDaysAgo)).length;
    const myTotalPoints = totalPoints({ healthMetrics: allMetrics, dietDateCount, waterLogs: waterLogs14 });

    const todayStepPts = isToday ? Math.min(100, Math.round((latest.steps || 0) / 10000 * 100)) : 0;
    let todayHealthPts = 0;
    if (isToday) {
      if (latest.heartRate) todayHealthPts += 27;
      if (latest.systolic) todayHealthPts += 27;
      if (latest.sleepHours) todayHealthPts += 26;
    }
    const todayDietPts = todayCal > 0 ? 80 : 0;
    const todayWaterPts = waterPoints(waterGlasses);
    const todayTotalPts = todayStepPts + todayHealthPts + todayDietPts + todayWaterPts;

    const streakDates = [...new Set(allMetrics.map(m => dateKey(m.recordedAt)))];
    const streak = calculateStreak(streakDates);

    const badges = calculateBadges({
      healthMetrics: allMetrics, dietDateCount, waterLogs: waterLogs14,
      streak, streakDateCount: streakDates.length, totalPts: myTotalPoints,
    });
    const achievements = calculateAchievements({ healthMetrics: allMetrics, dietLogs: dietLogs14 });
    const challenges = calculateChallenges({ weekMetrics, dietDateCountWeek });

    const stepsGoal = 8000;
    const latestSteps = latest?.steps || 0;
    const healthItems = (latest?.heartRate ? 1 : 0) + (latest?.systolic ? 1 : 0) + (latest?.sleepHours ? 1 : 0);
    const stepsPct = Math.min(100, Math.round(latestSteps / stepsGoal * 100));
    const calPct = Math.min(100, todayCal > 0 ? Math.round(todayCal / 2000 * 100) : 0);
    const waterPct = Math.min(100, Math.round(waterGlasses / 8 * 100));
    const dataLabel = isToday ? 'Today' : (latest ? `Last: ${new Date(latest.recordedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` : 'No data');

    // Leaderboard
    const patients = (usersRes.data || []).map(p => ({ id: p.hs_userid, name: p.hs_fullname }));
    const patientIds = patients.map(p => p.id);
    let allPatientMetrics = [], allPatientDiet = [], allPatientWater = [];
    if (patientIds.length) {
      const idsClause = `(${patientIds.map(id => `_hs_user_value eq ${id}`).join(' or ')})`;
      [allPatientMetrics, allPatientDiet, allPatientWater] = (await Promise.all([
        Hs_healthmetricsService.getAll({ filter: idsClause }),
        Hs_dietlogsService.getAll({ filter: idsClause }),
        Hs_waterlogsService.getAll({ filter: idsClause }),
      ])).map(r => r.data || []);
    }

    const leaderboard = patients.map(p => {
      const myMetrics = allPatientMetrics.filter(m => m._hs_user_value === p.id).map(toMetric);
      const myDietDates = new Set(allPatientDiet.filter(d => d._hs_user_value === p.id).map(d => dateKey(d.hs_logdate)));
      const myWater = allPatientWater.filter(w => w._hs_user_value === p.id).map(w => ({ glasses: w.hs_glasses }));
      const pts = totalPoints({ healthMetrics: myMetrics, dietDateCount: myDietDates.size, waterLogs: myWater });
      return { id: p.id, name: p.name, pts };
    }).sort((a, b) => b.pts - a.pts);

    const userRank = (leaderboard.findIndex(p => p.id === user.id) + 1) || 1;
    const totalPatients = patients.length;
    const rankPct = totalPatients > 1 ? Math.max(1, Math.round((userRank / totalPatients) * 100)) : 1;

    const chartMetrics = [...weekMetrics].reverse();
    const week = {
      labels: chartMetrics.map(m => new Date(m.recordedAt).toLocaleDateString('en-GB', { weekday: 'short' })),
      hr: chartMetrics.map(m => m.heartRate),
      bpSys: chartMetrics.map(m => m.systolic),
      bpDia: chartMetrics.map(m => m.diastolic),
      steps: chartMetrics.map(m => m.steps),
    };

    const appts = (apptRes.data || []).map(r => toApptDashboard(r, doctorByUserId));
    const medications = (presRes.data || []).map(toMedication);

    setData({
      today: { metric: latest, isToday, cal: todayCal, water: waterGlasses },
      week,
      thisWeekAvg, lastWeekAvg,
      healthScore,
      insights,
      appointments: appts,
      medications,
      gamification: {
        totalPoints: myTotalPoints,
        todayTotalPts,
        streak,
        leaderboard: leaderboard.slice(0, 5),
        userRank, totalPatients, rankPct,
        badges, badgeCount: badges.length,
        achievements,
        challenges,
        progress: {
          stepsGoal, latestSteps, stepsPct, healthItems, calPct, waterPct, dataLabel,
          todayCal, waterGlasses,
          todayStepPts, todayHealthPts, todayDietPts, todayWaterPts,
        },
      },
    });
    setLoading(false);
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!data) return null;

  const { today, week, thisWeekAvg, lastWeekAvg, healthScore, insights, appointments, medications, gamification: g } = data;
  const latest = today.metric;

  const labels = week.labels?.length ? week.labels : FALLBACK.labels;
  const hrData = week.hr?.length ? week.hr.map(v => v ?? 0) : FALLBACK.hr;
  const bpSysData = week.bpSys?.length ? week.bpSys.map(v => v ?? 0) : FALLBACK.bpSys;
  const bpDiaData = week.bpDia?.length ? week.bpDia.map(v => v ?? 0) : FALLBACK.bpDia;
  const stepsData = week.steps?.length ? week.steps.map(v => v ?? 0) : FALLBACK.steps;
  const lastWeekStepsData = labels.map(() => Math.round(lastWeekAvg?.steps || 7400));

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  })();

  const progressRows = [
    { ico: '🏃', lbl: 'Activity / Steps', sub: `${(g.progress.latestSteps || 0).toLocaleString()} / ${g.progress.stepsGoal.toLocaleString()} steps`, pct: g.progress.stepsPct, c1: '#16A34A', c2: '#4ADE80', pts: g.progress.todayStepPts },
    { ico: '❤️', lbl: 'Health Data', sub: `${g.progress.healthItems}/3 vitals logged`, pct: Math.round(g.progress.healthItems / 3 * 100), c1: '#DC2626', c2: '#F87171', pts: g.progress.todayHealthPts },
    { ico: '🥗', lbl: 'Nutrition & Diet', sub: `${Math.round(g.progress.todayCal).toLocaleString()} / 2,000 kcal`, pct: g.progress.calPct, c1: '#D97706', c2: '#FCD34D', pts: g.progress.todayDietPts },
    { ico: '💧', lbl: 'Hydration', sub: `${g.progress.waterGlasses} / 8 glasses today`, pct: g.progress.waterPct, c1: '#0891B2', c2: '#38BDF8', pts: g.progress.todayWaterPts },
  ];

  const earnRows = [
    { ico: '👣', lbl: 'Walking / Steps', desc: 'Up to 100 pts per day', col: '#16A34A', bg: '#DCFCE7' },
    { ico: '❤️', lbl: 'Health Data Tracking', desc: 'Up to 80 pts per day', col: '#DC2626', bg: '#FEE2E2' },
    { ico: '🥗', lbl: 'Nutrition & Diet', desc: 'Up to 80 pts per day', col: '#D97706', bg: '#FEF3C7' },
    { ico: '💧', lbl: 'Hydration', desc: 'Up to 40 pts per day', col: '#0891B2', bg: '#CFFAFE' },
    { ico: '🏆', lbl: 'Achievements & Badges', desc: 'Bonus points', col: '#B45309', bg: '#FEF3C7' },
  ];

  const helpRows = [
    { col: '#16A34A', txt: 'Motivates patients to stay active and consistent' },
    { col: '#1565C0', txt: 'Builds healthy habits through fun challenges' },
    { col: '#D97706', txt: 'Rewards good behaviour with points and badges' },
    { col: '#7C3AED', txt: 'Encourages friendly competition and engagement' },
    { col: '#0891B2', txt: 'Tracks progress visually to celebrate milestones' },
  ];

  const ideaRows = [
    { ico: '📅', txt: 'Daily / Weekly / Monthly Challenges' },
    { ico: '🎉', txt: 'Seasonal events (New Year Fitness, etc.)' },
    { ico: '🎯', txt: 'Personal best milestones' },
    { ico: '🎁', txt: 'Redeem points for rewards & discounts' },
    { ico: '👨‍👩‍👧', txt: 'Family & friend challenges' },
    { ico: '📊', txt: 'Weekly progress email digest' },
  ];

  const pointsSystem = [
    { ico: '🏃', pts: '100', unit: 'pts/day', lbl: 'Steps' },
    { ico: '❤️', pts: '80', unit: 'pts/day', lbl: 'Health' },
    { ico: '🥗', pts: '80', unit: 'pts/day', lbl: 'Diet' },
    { ico: '💧', pts: '40', unit: 'pts/day', lbl: 'Water' },
  ];

  const quickLinks = [
    { ico: '📁', label: 'Documents', href: '/patient/documents', color: '#1565C0', bg: '#DBEAFE' },
    { ico: '📅', label: 'Book Appt', href: '/patient/appointments', color: '#16A34A', bg: '#DCFCE7' },
    { ico: '🥗', label: 'Diet Log', href: '/patient/diet', color: '#D97706', bg: '#FEF3C7' },
    { ico: '📈', label: 'Insights', href: '/patient/health-insights', color: '#DC2626', bg: '#FEE2E2' },
    { ico: '💬', label: 'Messages', href: '/patient/messages', color: '#0891B2', bg: '#CFFAFE' },
    { ico: '👤', label: 'Profile', href: '/patient/profile', color: '#7C3AED', bg: '#EDE9FE' },
  ];

  const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>
        Good {greeting}, {user?.name?.split(' ')[0]} 👋
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
        {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} &middot; NHS: {user?.nhsId || '—'}
      </p>

      {/* Tab nav */}
      <div className="dash-tabs">
        <button className={`dash-tab${tab === 'gamification' ? ' active' : ''}`} onClick={() => setTab('gamification')}>🏆 Gamification</button>
        <button className={`dash-tab${tab === 'health' ? ' active' : ''}`} onClick={() => setTab('health')}>❤️ Health Dashboard</button>
      </div>

      {/* ══════════════════ TAB 1: GAMIFICATION ══════════════════ */}
      {tab === 'gamification' && (
        <div>
          {/* Stat cards */}
          <div className="dash-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
            <div className="gam-stat" style={{ background: 'linear-gradient(135deg,#B45309,#D97706)' }}>
              <div className="gam-stat-icon">⭐</div>
              <div>
                <div className="gam-stat-lbl">Total Points</div>
                <div className="gam-stat-val">{g.totalPoints.toLocaleString()}</div>
                <div className="gam-stat-sub">+{g.todayTotalPts} today</div>
              </div>
            </div>
            <div className="gam-stat" style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)' }}>
              <div className="gam-stat-icon">🔥</div>
              <div>
                <div className="gam-stat-lbl">Current Streak</div>
                <div className="gam-stat-val">{g.streak} <span style={{ fontSize: 16 }}>days</span></div>
                <div className="gam-stat-sub">{g.streak > 0 ? 'Keep it up!' : 'Log today to start!'}</div>
              </div>
            </div>
            <div className="gam-stat" style={{ background: 'linear-gradient(135deg,#16A34A,#22C55E)' }}>
              <div className="gam-stat-icon">🏆</div>
              <div>
                <div className="gam-stat-lbl">Rank</div>
                <div className="gam-stat-val">Top {g.rankPct}%</div>
                <div className="gam-stat-sub">#{g.userRank} of {g.totalPatients} patients</div>
              </div>
            </div>
            <div className="gam-stat" style={{ background: 'linear-gradient(135deg,#1565C0,#4285F4)' }}>
              <div className="gam-stat-icon">🛡️</div>
              <div>
                <div className="gam-stat-lbl">Badges</div>
                <div className="gam-stat-val">{g.badgeCount}</div>
                <div className="gam-stat-sub">Badges earned</div>
              </div>
            </div>
          </div>

          {/* Leaderboard | Progress | Achievements */}
          <div className="dash-grid-leaderboard" style={{ display: 'grid', gridTemplateColumns: '280px 1fr 280px', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="card-header">
                <h3><i className="fas fa-trophy" /> Leaderboard</h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>All time</span>
              </div>
              <div className="card-body" style={{ padding: '8px 10px' }}>
                {g.leaderboard.map((row, i) => {
                  const isMe = row.id === user.id;
                  const rank = i + 1;
                  const rBg = rankColors[i] || '#E5E7EB';
                  const rTxt = rank <= 3 ? '#fff' : '#374151';
                  const parts = (row.name || '').split(' ');
                  const name = isMe ? `You (${parts[0]})` : `${parts[0]} ${(parts[1] || '').charAt(0)}.`;
                  const initials = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
                  return (
                    <div key={row.id} className={`lb-row${isMe ? ' me' : ''}`}>
                      <div className="lb-rank" style={{ background: rBg, color: rTxt }}>{rank}</div>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-light), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{initials.toUpperCase()}</div>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: isMe ? 800 : 600, color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: isMe ? '#1565C0' : 'var(--primary)', whiteSpace: 'nowrap' }}>{row.pts.toLocaleString()}<span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-muted)' }}> pts</span></div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3><i className="fas fa-chart-bar" /> Progress</h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.progress.dataLabel} &nbsp;&middot;&nbsp; <strong style={{ color: 'var(--primary-light)' }}>{g.todayTotalPts} pts</strong></span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {progressRows.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${p.c1}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{p.ico}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 12.5 }}>{p.lbl}</span>
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 6 }}>{p.sub}</span>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: p.c1 }}>{p.pct}%</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: p.c1, marginLeft: 4 }}>+{p.pts}pts</span>
                        </div>
                      </div>
                      <div className="gam-prog-bar"><div className="gam-prog-fill" style={{ width: `${p.pct}%`, background: `linear-gradient(90deg,${p.c1},${p.c2})` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3><i className="fas fa-medal" /> Achievements</h3></div>
              <div className="card-body" style={{ padding: 0 }}>
                {g.achievements.length ? g.achievements.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{a.e}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{a.n}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.desc}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(a.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                    </div>
                    <span style={{ background: a.bg, color: a.col, padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 800, flexShrink: 0 }}>+{a.pts}</span>
                  </div>
                )) : (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Log health data to earn achievements!</div>
                )}
              </div>
            </div>
          </div>

          {/* Badges */}
          {g.badges.length > 0 && (
            <div className="card mb-4">
              <div className="card-header">
                <h3>🛡️ Your Badges</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.badgeCount} earned</span>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 12 }}>
                  {g.badges.map((b, i) => (
                    <div className="badge-hex" key={i}>
                      <div className="badge-icon" style={{ background: b.bg }}>{b.e}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 700 }}>{b.n}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>{b.d}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Challenges + How to Earn Points */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginBottom: 16 }} className="dash-grid-3">
            <div className="card">
              <div className="card-header">
                <h3><i className="fas fa-fire" /> Active Challenges</h3>
                <span style={{ fontSize: 11, background: '#FEF3C7', color: '#B45309', padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>This Week</span>
              </div>
              <div className="card-body">
                {[
                  { ico: '🏃', bg: '#DCFCE7', title: '7-Day Step Challenge', desc: 'Walk 8,000 steps daily', reward: '+300 pts', rbg: '#DCFCE7', rcol: '#16A34A', val: g.challenges.ch1, max: 7, c1: '#16A34A', c2: '#4ADE80' },
                  { ico: '❤️', bg: '#FEE2E2', title: 'Heart Health Challenge', desc: 'Log heart rate 5 days this week', reward: '+200 pts', rbg: '#FEE2E2', rcol: '#DC2626', val: g.challenges.ch2, max: 5, c1: '#DC2626', c2: '#F87171' },
                  { ico: '🥗', bg: '#FEF3C7', title: 'Healthy Eating Challenge', desc: 'Log meals for 6 days this week', reward: '+250 pts', rbg: '#FEF3C7', rcol: '#D97706', val: g.challenges.ch3, max: 6, c1: '#D97706', c2: '#FCD34D' },
                ].map((c, i) => (
                  <div className="challenge-card" key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{c.ico}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{c.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.desc}</div>
                      </div>
                      <span style={{ background: c.rbg, color: c.rcol, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{c.reward}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
                      <span>{c.val}/{c.max} days completed</span><span>{Math.round(c.val / c.max * 100)}%</span>
                    </div>
                    <div className="gam-prog-bar"><div className="gam-prog-fill" style={{ width: `${Math.round(c.val / c.max * 100)}%`, background: `linear-gradient(90deg,${c.c1},${c.c2})` }} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3>💡 How to Earn Points</h3></div>
              <div className="card-body" style={{ padding: 0 }}>
                {earnRows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: r.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{r.ico}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{r.lbl}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom 4-col */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 240px', gap: 16 }} className="dash-grid-3">
            <div className="card">
              <div className="card-header"><h3>💡 How Gamification Helps</h3></div>
              <div className="card-body" style={{ paddingTop: 10 }}>
                {helpRows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 9 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: r.col, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <i className="fas fa-check" style={{ fontSize: 9, color: '#fff' }} />
                    </div>
                    <span style={{ fontSize: 12, lineHeight: 1.5 }}>{r.txt}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3>⭐ Points System</h3></div>
              <div className="card-body" style={{ paddingTop: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
                  {pointsSystem.map((p, i) => (
                    <div key={i} style={{ textAlign: 'center', background: '#F8FAFF', borderRadius: 10, padding: '10px 6px' }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{p.ico}</div>
                      <div style={{ fontSize: 16, fontWeight: 900 }}>{p.pts}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>{p.unit}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{p.lbl}</div>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'center', background: '#FEF9C3', borderRadius: 8, padding: 8, fontSize: 11, color: '#B45309', fontWeight: 700 }}>
                  🏆 Bonus pts for badges & streaks!
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3>🚀 Ideas to Grow</h3></div>
              <div className="card-body" style={{ paddingTop: 10 }}>
                {ideaRows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>{r.ico}</span>
                    <span style={{ fontSize: 11.5, lineHeight: 1.4 }}>{r.txt}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ background: 'linear-gradient(160deg,#1A1060,#2C5FBF)', border: 'none' }}>
              <div className="card-body" style={{ textAlign: 'center', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🎁</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Rewards Store</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', lineHeight: 1.5, marginBottom: 16 }}>Redeem your points for exciting rewards &amp; vouchers!</div>
                <div style={{ background: 'rgba(255,255,255,.12)', borderRadius: 8, padding: '8px 12px', marginBottom: 16, width: '100%' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginBottom: 2 }}>Your balance</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#FFD700' }}>{g.totalPoints.toLocaleString()} pts</div>
                </div>
                <button style={{ background: '#FFD700', color: '#1A1060', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 12, fontWeight: 800, cursor: 'pointer', width: '100%' }}>
                  Explore Rewards →
                </button>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 10 }}>Coming soon</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB 2: HEALTH DASHBOARD ══════════════════ */}
      {tab === 'health' && (
        <div>
          {/* Score + KPI stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, marginBottom: 20 }} className="dash-grid-leaderboard">
            <div className="score-gauge-card" style={{ background: healthScore.gradient }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, opacity: 0.7, marginBottom: 4, fontWeight: 700, position: 'relative', zIndex: 1 }}>Health Risk Score</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, position: 'relative', zIndex: 1 }}>
                <ScoreGauge score={healthScore.score} />
                <div>
                  <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1 }}>{healthScore.score}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.9 }}>{healthScore.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>out of 100</div>
                </div>
              </div>
              {(healthScore.breakdown || []).slice(0, 3).map((b, i) => (
                <div key={i} style={{ marginBottom: 5, position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.8, marginBottom: 2 }}>
                    <span>{b.label}</span><span>{b.score}/{b.max}</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,.2)', borderRadius: 3, height: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((b.score / b.max) * 100)}%`, background: '#fff', height: '100%', borderRadius: 3, transition: 'width 1s' }} />
                  </div>
                </div>
              ))}
              <Link to="/patient/health-insights" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, background: 'rgba(255,255,255,.15)', color: '#fff', padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: 'none', position: 'relative', zIndex: 1 }}>
                Full Analysis <i className="fas fa-arrow-right" />
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }} className="dash-grid-3">
              <div className="kpi-card kpi-blue">
                <div className="kpi-icon"><i className="fas fa-heartbeat" /></div>
                <div className="kpi-label">Heart Rate</div>
                <div className="kpi-value">{latest?.heartRate ?? 74}</div>
                <div className="kpi-sub">bpm &nbsp; <ChangePill change={hrData.length > 1 ? pctChange(hrData[hrData.length - 1], hrData[0]) : null} /></div>
                <Sparkline data={hrData} color="#1565C0" />
              </div>
              <div className="kpi-card kpi-teal">
                <div className="kpi-icon"><i className="fas fa-tint" /></div>
                <div className="kpi-label">Blood Pressure</div>
                <div className="kpi-value" style={{ fontSize: 18 }}>{latest ? `${latest.systolic}/${latest.diastolic}` : '118/76'}</div>
                <div className="kpi-sub">mmHg &nbsp; <ChangePill change={pctChange(thisWeekAvg.bp, lastWeekAvg.bp)} /></div>
                <Sparkline data={bpSysData} color="#00B4D8" />
              </div>
              <div className="kpi-card kpi-green">
                <div className="kpi-icon"><i className="fas fa-walking" /></div>
                <div className="kpi-label">Steps Today</div>
                <div className="kpi-value">{(latest?.steps ?? 7495).toLocaleString()}</div>
                <div className="kpi-sub"><ChangePill change={pctChange(thisWeekAvg.steps, lastWeekAvg.steps)} /> vs last week</div>
                <Sparkline data={stepsData} color="#16A34A" />
              </div>
              <div className="kpi-card kpi-warning">
                <div className="kpi-icon"><i className="fas fa-fire" /></div>
                <div className="kpi-label">Calories Today</div>
                <div className="kpi-value">{Math.round(today.cal) || 856}</div>
                <div className="kpi-sub">of 2,000 kcal goal</div>
              </div>
              <div className="kpi-card kpi-purple">
                <div className="kpi-icon"><i className="fas fa-moon" /></div>
                <div className="kpi-label">Sleep</div>
                <div className="kpi-value">{latest?.sleepHours ?? 7.8}h</div>
                <div className="kpi-sub"><ChangePill change={pctChange(thisWeekAvg.sleep, lastWeekAvg.sleep)} /> vs last week</div>
              </div>
              <div className="kpi-card kpi-teal">
                <div className="kpi-icon" style={{ color: '#0891B2' }}><i className="fas fa-tint" /></div>
                <div className="kpi-label">Hydration</div>
                <div className="kpi-value">{today.water}<span style={{ fontSize: 14, fontWeight: 400 }}>/8</span></div>
                <div className="kpi-sub">
                  glasses today
                  <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                    {Array.from({ length: 8 }, (_, i) => (
                      <div key={i} className="water-dot" style={{ background: i < today.water ? '#0891B2' : '#E2E8F0' }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Insights */}
          {insights?.length > 0 && (
            <div className="card mb-4" style={{ borderLeft: `4px solid ${insights[0].type === 'critical' ? '#DC2626' : insights[0].type === 'warning' ? '#D97706' : '#1565C0'}` }}>
              <div className="card-header">
                <h3><i className="fas fa-brain" /> Smart Health Insights</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, background: '#DBEAFE', color: '#1565C0', padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}><i className="fas fa-magic" /> AI-Powered</span>
                  <Link to="/patient/health-insights" style={{ fontSize: 12, color: 'var(--primary-light)' }}>Full Analysis →</Link>
                </div>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 10 }}>
                  {insights.slice(0, 4).map((ins, i) => {
                    const st = insightStyle(ins.type);
                    return (
                      <div className="insight-mini" key={i} style={{ background: st.sbg, borderColor: st.c }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: st.c, fontSize: 14 }}>
                          <i className={`fas ${ins.icon}`} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{ins.title}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{ins.message.slice(0, 90)}...</div>
                          {ins.actionLabel && (
                            <Link to={ins.actionHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5, fontSize: 11, fontWeight: 700, color: st.c, textDecoration: 'none' }}>
                              {ins.actionLabel} <i className="fas fa-arrow-right" style={{ fontSize: 9 }} />
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Charts + Appointments */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: 20, marginBottom: 20 }} className="dash-grid-leaderboard">
            <div className="card">
              <div className="card-header">
                <h3><i className="fas fa-heartbeat" /> Blood Pressure Trend</h3>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>This Week</div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{Math.round(thisWeekAvg.bp || 118)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>mmHg avg systolic</div>
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Last Week</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-muted)' }}>{Math.round(lastWeekAvg.bp || 120)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>mmHg avg systolic</div>
                  </div>
                </div>
                <div style={{ height: 180 }}>
                  <Line
                    data={{
                      labels,
                      datasets: [
                        { label: 'Systolic', data: bpSysData, borderColor: '#1565C0', backgroundColor: 'rgba(21,101,192,.08)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#1565C0' },
                        { label: 'Diastolic', data: bpDiaData, borderColor: '#00B4D8', backgroundColor: 'rgba(0,180,216,.06)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#00B4D8' },
                      ],
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }, scales: { y: { min: 60, max: 160, grid: { color: '#EFF6FF' } }, x: { grid: { display: false } } } }}
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3><i className="fas fa-chart-line" /> Health Overview</h3>
                <Link to="/patient/health-insights" style={{ fontSize: 12, color: 'var(--primary-light)' }}>Full Analysis →</Link>
              </div>
              <div className="card-body" style={{ height: 260 }}>
                <Radar
                  data={{
                    labels: ['Diet', 'Exercise', 'Sleep', 'Hydration', 'Mental', 'Vitals'],
                    datasets: [
                      { label: 'This Week', data: [g.progress.calPct || 75, g.progress.stepsPct || 82, Math.round((healthScore.breakdown?.find(b => b.label === 'Sleep Quality')?.score || 16) / 20 * 100), Math.min(Math.round((today.water / 8) * 100), 100), 92, healthScore.score], backgroundColor: 'rgba(21,101,192,.15)', borderColor: '#1565C0', borderWidth: 2, pointBackgroundColor: '#1565C0', pointRadius: 4 },
                      { label: 'Last Week', data: [68, 75, 76, 60, 88, 78], backgroundColor: 'rgba(0,180,216,.08)', borderColor: '#00B4D8', borderWidth: 1.5, pointBackgroundColor: '#00B4D8', pointRadius: 3, borderDash: [5, 5] },
                    ],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: '#EFF6FF' }, pointLabels: { font: { size: 11, weight: '600' }, color: '#0A1F44' } } }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }}
                />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3><i className="fas fa-calendar-check" /> Upcoming</h3>
                <Link to="/patient/appointments" style={{ fontSize: 12, color: 'var(--primary-light)' }}>View all →</Link>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {appointments?.length ? appointments.map(a => (
                  <div key={a.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-light), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, flexShrink: 0 }}><i className="fas fa-user-md" /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>Dr. {a.doctor_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--primary-light)' }}>{a.specialization || 'General Practice'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          <i className="fas fa-calendar" /> {new Date(a.appointmentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} &middot; {new Date(a.appointmentTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {statusBadge(a.status)}
                    </div>
                  </div>
                )) : (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <i className="fas fa-calendar-times" style={{ fontSize: 28, opacity: 0.3 }} />
                    <p style={{ fontSize: 13, marginTop: 8 }}>No upcoming appointments.</p>
                    <Link to="/patient/appointments" className="btn btn-primary btn-sm" style={{ marginTop: 8, display: 'inline-flex' }}>Book Now</Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }} className="dash-grid-leaderboard">
            <div className="card">
              <div className="card-header"><h3><i className="fas fa-walking" /> Steps — This vs Last Week</h3></div>
              <div className="card-body" style={{ height: 200 }}>
                <Bar
                  data={{
                    labels,
                    datasets: [
                      { label: 'This week', data: stepsData, backgroundColor: '#1565C0', borderRadius: 5, borderSkipped: false },
                      { label: 'Last week', data: lastWeekStepsData, backgroundColor: 'rgba(21,101,192,.2)', borderRadius: 5, borderSkipped: false },
                    ],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#EFF6FF' }, ticks: { callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v } } } }}
                />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3><i className="fas fa-pills" /> Active Medications</h3>
                <Link to="/patient/prescriptions" style={{ fontSize: 12, color: 'var(--primary-light)' }}>View all →</Link>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {medications?.length ? medications.map(m => (
                  <div key={m.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>💊</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{m.medicationName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.dosage} &middot; {m.frequency}</div>
                    </div>
                    <span style={{ background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>Active</span>
                  </div>
                )) : (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No active medications</div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3><i className="fas fa-th" /> Quick Access</h3></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {quickLinks.map((q, i) => (
                    <Link to={q.href} className="quick-link" key={i}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = q.color; e.currentTarget.style.background = q.bg; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = '#fff'; }}>
                      <div className="quick-link-icon" style={{ background: q.bg, color: q.color }}>{q.ico}</div>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{q.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
