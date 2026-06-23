// HealthSphere — Gamification Engine (points, streaks, badges, challenges) — ported from the Express backend

export function metricPoints(m) {
  let pts = Math.min(100, Math.round((Number(m.steps) || 0) / 10000 * 100));
  if (m.heartRate) pts += 27;
  if (m.systolic) pts += 27;
  if (m.sleepHours) pts += 26;
  return pts;
}

export function waterPoints(glasses) {
  return Math.min(40, Math.round((Number(glasses) || 0) / 8 * 40));
}

export function totalPoints({ healthMetrics, dietDateCount, waterLogs }) {
  const ptHm = healthMetrics.reduce((sum, m) => sum + metricPoints(m), 0);
  const ptDiet = (dietDateCount || 0) * 80;
  const ptWater = waterLogs.reduce((sum, w) => sum + waterPoints(w.glasses), 0);
  return ptHm + ptDiet + ptWater;
}

export function dateKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export function calculateStreak(dateStrings) {
  const dates = new Set(dateStrings);
  let streak = 0;
  let chk = new Date();
  const todayKey = chk.toISOString().slice(0, 10);

  if (dates.has(todayKey)) {
    while (dates.has(chk.toISOString().slice(0, 10))) {
      streak++;
      chk.setDate(chk.getDate() - 1);
    }
  } else {
    chk.setDate(chk.getDate() - 1);
    while (dates.has(chk.toISOString().slice(0, 10))) {
      streak++;
      chk.setDate(chk.getDate() - 1);
    }
  }
  return streak;
}

export function calculateBadges({ healthMetrics, dietDateCount, waterLogs, streak, streakDateCount, totalPts }) {
  const badges = [];

  if (healthMetrics.some(m => (Number(m.steps) || 0) >= 10000)) {
    badges.push({ e: '👟', n: 'Step Master', d: '10,000+ steps in a day', col: '#16A34A', bg: '#DCFCE7' });
  }
  if (healthMetrics.filter(m => Number(m.sleepHours) >= 7).length >= 5) {
    badges.push({ e: '🌙', n: 'Sleep Champion', d: '7+ hours for 5+ days', col: '#7C3AED', bg: '#EDE9FE' });
  }
  if (dietDateCount >= 3) {
    badges.push({ e: '🥗', n: 'Healthy Eater', d: 'Logged meals 3+ days', col: '#D97706', bg: '#FEF3C7' });
  }
  if (waterLogs.some(w => (Number(w.glasses) || 0) >= 8)) {
    badges.push({ e: '💧', n: 'Hydration Hero', d: '8 glasses in a day', col: '#0891B2', bg: '#CFFAFE' });
  }
  if (streak >= 7) {
    badges.push({ e: '🔥', n: 'Streak Master', d: '7-day health streak', col: '#DC2626', bg: '#FEE2E2' });
  }
  if (streakDateCount >= 10) {
    badges.push({ e: '📊', n: 'Data Tracker', d: '10+ days of health data', col: '#1565C0', bg: '#DBEAFE' });
  }
  if (totalPts >= 500) {
    badges.push({ e: '🏆', n: 'Goal Crusher', d: 'Earned 500+ lifetime points', col: '#B45309', bg: '#FEF3C7' });
  }
  if (streakDateCount >= 30) {
    badges.push({ e: '⭐', n: 'Health Hero', d: '30+ days of health data', col: '#F59E0B', bg: '#FFFBEB' });
  }

  return badges;
}

export function calculateAchievements({ healthMetrics, dietLogs }) {
  const achievements = [];

  const stepDay = healthMetrics.filter(m => (Number(m.steps) || 0) >= 10000)
    .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))[0];
  if (stepDay) {
    achievements.push({ e: '👟', n: 'Step Master', desc: 'Walked 10,000 steps in a day', pts: 100, date: stepDay.recordedAt, col: '#16A34A', bg: '#DCFCE7' });
  }

  const sleepDay = healthMetrics.filter(m => Number(m.sleepHours) >= 7)
    .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))[0];
  if (sleepDay) {
    achievements.push({ e: '🌙', n: 'Sleep Champion', desc: 'Slept 7+ hours', pts: 80, date: sleepDay.recordedAt, col: '#7C3AED', bg: '#EDE9FE' });
  }

  if (dietLogs.length) {
    const latestDiet = dietLogs.reduce((max, d) => new Date(d.logDate) > new Date(max.logDate) ? d : max, dietLogs[0]);
    achievements.push({ e: '🥗', n: 'Healthy Eater', desc: 'Logged a healthy meal', pts: 60, date: latestDiet.logDate, col: '#D97706', bg: '#FEF3C7' });
  }

  achievements.sort((a, b) => new Date(b.date) - new Date(a.date));
  return achievements.slice(0, 3);
}

export function calculateChallenges({ weekMetrics, dietDateCountWeek }) {
  const ch1 = Math.min(7, weekMetrics.filter(m => (Number(m.steps) || 0) >= 8000).length);
  const ch2 = Math.min(5, weekMetrics.filter(m => (Number(m.heartRate) || 0) > 0).length);
  const ch3 = Math.min(6, dietDateCountWeek || 0);
  return { ch1, ch2, ch3 };
}
