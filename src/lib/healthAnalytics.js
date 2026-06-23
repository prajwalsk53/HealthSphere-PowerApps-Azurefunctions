// HealthSphere — Health Risk Score & AI Insights Engine (ported from the Express backend)

export function avg(values) {
  const v = values.filter(x => x !== null && x !== undefined && !isNaN(x)).map(Number);
  if (!v.length) return 0;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function num(x) {
  return x === null || x === undefined ? null : Number(x);
}

function scoreColor(cat) {
  return { excellent: '#16A34A', good: '#1565C0', fair: '#D97706', poor: '#DC2626' }[cat] || '#5E7A99';
}

function scoreGradient(cat) {
  return {
    excellent: 'linear-gradient(135deg,#166534,#16A34A)',
    good: 'linear-gradient(135deg,#0A1F44,#1565C0)',
    fair: 'linear-gradient(135deg,#92400E,#D97706)',
    poor: 'linear-gradient(135deg,#7F1D1D,#DC2626)',
  }[cat] || 'linear-gradient(135deg,#1E293B,#5E7A99)';
}

function defaultScore() {
  return {
    score: 0, category: 'fair', label: 'No Data', color: '#5E7A99', gradient: scoreGradient(),
    breakdown: [], avgBp: '—', avgHr: '—', avgSpo2: '—', avgSleep: '—', avgSteps: '—',
  };
}

export function calculateHealthScore(weekMetrics) {
  if (!weekMetrics || !weekMetrics.length) return defaultScore();

  const avgBpSys = Math.round(avg(weekMetrics.map(m => num(m.systolic))));
  const avgBpDia = Math.round(avg(weekMetrics.map(m => num(m.diastolic))));
  const avgHr = Math.round(avg(weekMetrics.map(m => num(m.heartRate))));
  const avgSpo2 = Math.round(avg(weekMetrics.map(m => num(m.oxygenSaturation))) * 10) / 10;
  const avgSleep = Math.round(avg(weekMetrics.map(m => num(m.sleepHours))) * 10) / 10;
  const avgSteps = Math.round(avg(weekMetrics.map(m => num(m.steps))));

  let bpScore;
  if (avgBpSys < 120 && avgBpDia < 80) bpScore = 25;
  else if (avgBpSys < 130 && avgBpDia < 85) bpScore = 20;
  else if (avgBpSys < 140 && avgBpDia < 90) bpScore = 13;
  else if (avgBpSys < 160 && avgBpDia < 100) bpScore = 7;
  else bpScore = 2;

  let hrScore;
  if (avgHr >= 60 && avgHr <= 75) hrScore = 20;
  else if (avgHr >= 55 && avgHr <= 85) hrScore = 15;
  else if (avgHr >= 50 && avgHr <= 100) hrScore = 10;
  else hrScore = 4;

  let spo2Score;
  if (avgSpo2 >= 98) spo2Score = 15;
  else if (avgSpo2 >= 95) spo2Score = 12;
  else if (avgSpo2 >= 92) spo2Score = 7;
  else if (avgSpo2 >= 88) spo2Score = 3;
  else spo2Score = 0;

  let sleepScore;
  if (avgSleep >= 7 && avgSleep <= 9) sleepScore = 16;
  else if (avgSleep >= 6 && avgSleep <= 10) sleepScore = 10;
  else if (avgSleep >= 5) sleepScore = 5;
  else sleepScore = 1;

  let activityScore;
  if (avgSteps >= 10000) activityScore = 20;
  else if (avgSteps >= 7500) activityScore = 16;
  else if (avgSteps >= 5000) activityScore = 11;
  else if (avgSteps >= 2500) activityScore = 6;
  else activityScore = 2;

  const total = Math.min(100, Math.max(0, bpScore + hrScore + spo2Score + sleepScore + activityScore));

  let category;
  if (total >= 80) category = 'excellent';
  else if (total >= 60) category = 'good';
  else if (total >= 40) category = 'fair';
  else category = 'poor';

  return {
    score: total,
    category,
    label: category.charAt(0).toUpperCase() + category.slice(1),
    color: scoreColor(category),
    gradient: scoreGradient(category),
    avgBp: `${avgBpSys}/${avgBpDia}`,
    avgHr, avgSpo2, avgSleep, avgSteps,
    breakdown: [
      { label: 'Blood Pressure', score: bpScore, max: 25, icon: 'fa-tint', color: '#1565C0' },
      { label: 'Heart Rate', score: hrScore, max: 20, icon: 'fa-heartbeat', color: '#DC2626' },
      { label: 'Blood Oxygen', score: spo2Score, max: 15, icon: 'fa-lungs', color: '#0891B2' },
      { label: 'Sleep Quality', score: sleepScore, max: 20, icon: 'fa-moon', color: '#7C3AED' },
      { label: 'Activity', score: activityScore, max: 20, icon: 'fa-walking', color: '#16A34A' },
    ],
  };
}

function insight(type, category, title, message, actionLabel, actionHref, icon) {
  return { type, category, title, message, actionLabel, actionHref, icon };
}

export function insightStyle(type) {
  return {
    critical: ['#DC2626', '#FEE2E2', 'rgba(220,38,38,.12)'],
    warning: ['#D97706', '#FEF3C7', 'rgba(217,119,6,.1)'],
    info: ['#0891B2', '#CFFAFE', 'rgba(8,145,178,.1)'],
    positive: ['#16A34A', '#DCFCE7', 'rgba(22,163,74,.1)'],
  }[type] || ['#5E7A99', '#F1F5F9', 'rgba(94,122,153,.08)'];
}

export function generateInsights({ metrics, dietDays, waterAvg, severeAllergies }) {
  const insights = [];

  if (!metrics || !metrics.length) {
    return [insight('info', 'Data', 'Connect your HealthSphere Band',
      'Link your wearable device to start receiving personalised health insights.',
      'Connect Device', '/patient/health-insights', 'fa-watch')];
  }

  const latest = metrics[0];
  const week1 = metrics.slice(0, 7);
  const week2 = metrics.slice(7, 14);

  const avgSys1 = Math.round(avg(week1.map(m => num(m.systolic))));
  const avgSys2 = !week2.length ? avgSys1 : Math.round(avg(week2.map(m => num(m.systolic))));
  const avgHr1 = Math.round(avg(week1.map(m => num(m.heartRate))));
  const avgHr2 = !week2.length ? avgHr1 : Math.round(avg(week2.map(m => num(m.heartRate))));
  const avgSleep = avg(week1.map(m => num(m.sleepHours)));
  const avgSteps = avg(week1.map(m => num(m.steps)));
  const avgSpo2 = avg(week1.map(m => num(m.oxygenSaturation)));
  const avgStress = avg(week1.map(m => num(m.stressLevel)));
  const bpTrend = avgSys1 - avgSys2;
  const hrTrend = avgHr1 - avgHr2;

  if (avgSys1 >= 140) {
    insights.push(insight('critical', 'Blood Pressure', '⚠️ Blood Pressure Critically High',
      `Your average systolic BP is ${avgSys1} mmHg over the past 7 days — significantly above the safe threshold of 120 mmHg. This requires immediate medical attention.`,
      'Book Appointment', '/patient/appointments', 'fa-heartbeat'));
  } else if (avgSys1 >= 130) {
    insights.push(insight('warning', 'Blood Pressure', 'Blood Pressure Elevated This Week',
      `Average BP ${avgSys1} mmHg — above the recommended 120 mmHg. Reduce sodium intake, stay hydrated, and avoid high-stress activities.`,
      'View BP Trend', '/patient/health-insights', 'fa-tint'));
  } else if (bpTrend > 8) {
    insights.push(insight('warning', 'Blood Pressure', 'Blood Pressure Rising This Week',
      `BP increased by ${Math.round(bpTrend)} mmHg compared to last week. Monitor carefully and reduce salt consumption.`,
      'View Trend', '/patient/health-insights', 'fa-chart-line'));
  } else if (avgSys1 < 120 && avgSys1 > 0) {
    insights.push(insight('positive', 'Blood Pressure', 'Excellent Blood Pressure Control',
      `Your average BP of ${avgSys1} mmHg is within optimal range. Keep up your current lifestyle habits.`,
      null, null, 'fa-check-circle'));
  }

  if ((latest.heartRate || 0) > 100) {
    insights.push(insight('warning', 'Heart Rate', 'Resting Heart Rate Elevated',
      `Today's resting HR is ${latest.heartRate} bpm — above 100 bpm threshold. Avoid caffeine, ensure adequate sleep, and track over the next 24 hours.`,
      'View HR Chart', '/patient/health-insights', 'fa-heartbeat'));
  } else if (hrTrend > 10) {
    insights.push(insight('warning', 'Heart Rate', 'Heart Rate Trending Up',
      `Your heart rate has increased by ${Math.round(hrTrend)} bpm this week. This could indicate increased stress or reduced fitness.`,
      'View Heart Rate', '/patient/health-insights', 'fa-heartbeat'));
  } else if (avgHr1 >= 60 && avgHr1 <= 72) {
    insights.push(insight('positive', 'Heart Rate', 'Heart Rate in Athletic Range',
      `Your average resting HR of ${Math.round(avgHr1)} bpm shows excellent cardiovascular fitness. Well done!`,
      null, null, 'fa-heart'));
  }

  const lowSleepDays = week1.filter(m => Number(m.sleepHours || 0) < 6.0).length;
  if (avgSleep > 0 && avgSleep < 6.0) {
    insights.push(insight('critical', 'Sleep', 'Severe Sleep Deficit Detected',
      `You are averaging only ${avgSleep.toFixed(1)}h of sleep — well below the recommended 7–9 hours. Chronic sleep deprivation raises hypertension risk by 35%.`,
      'View Sleep Data', '/patient/health-insights', 'fa-moon'));
  } else if (lowSleepDays >= 3) {
    insights.push(insight('warning', 'Sleep', `Poor Sleep on ${lowSleepDays} of 7 Days`,
      `You slept less than 6 hours on ${lowSleepDays} nights this week. Try to maintain a consistent bedtime and limit screen time after 9pm.`,
      'Sleep Tips', '/patient/health-insights', 'fa-moon'));
  } else if (avgSleep >= 7.5) {
    insights.push(insight('positive', 'Sleep', 'Sleep Quality is Great',
      `You averaged ${avgSleep.toFixed(1)}h of sleep this week — within the optimal 7–9 hour range. Quality rest is key to recovery.`,
      null, null, 'fa-moon'));
  }

  const sedentaryDays = week1.filter(m => Number(m.steps || 0) < 3000).length;
  if (avgSteps > 0 && avgSteps < 3000) {
    insights.push(insight('critical', 'Activity', 'Very Low Activity Level',
      `Average daily steps: ${Math.round(avgSteps).toLocaleString()}. Sedentary behaviour is strongly linked to cardiovascular disease and diabetes.`,
      'Start Exercise Plan', '/patient/health-insights', 'fa-walking'));
  } else if (sedentaryDays >= 2) {
    insights.push(insight('warning', 'Activity', `Sedentary on ${sedentaryDays} Days This Week`,
      `You had fewer than 3,000 steps on ${sedentaryDays} days. Even a 10-minute walk can reduce health risks significantly.`,
      'View Activity', '/patient/health-insights', 'fa-running'));
  } else if (avgSteps >= 10000) {
    insights.push(insight('positive', 'Activity', 'Step Goal Achieved — Great Work!',
      `You averaged ${Math.round(avgSteps).toLocaleString()} steps/day this week, exceeding the 10,000 step goal. Your cardiovascular health is benefiting.`,
      null, null, 'fa-medal'));
  }

  if (avgSpo2 > 0 && avgSpo2 < 93) {
    insights.push(insight('critical', 'Oxygen', '⚠️ Blood Oxygen Level Critical',
      `SpO₂ averaging ${avgSpo2.toFixed(1)}% — below 95% threshold. This can indicate respiratory problems. Consult a doctor immediately.`,
      'Emergency Contact', '/patient/messages', 'fa-lungs'));
  } else if (avgSpo2 > 0 && avgSpo2 < 96) {
    insights.push(insight('warning', 'Oxygen', 'Blood Oxygen Slightly Low',
      `SpO₂ at ${avgSpo2.toFixed(1)}%. Normal range is 95–100%. Deep breathing exercises and improved ventilation may help.`,
      'View Details', '/patient/health-insights', 'fa-wind'));
  }

  if (avgStress > 65) {
    insights.push(insight('warning', 'Mental Health', 'High Stress Levels Detected',
      `Your average stress score is ${Math.round(avgStress)}/100 this week. Chronic stress elevates cortisol, disrupts sleep, and raises BP. Consider mindfulness.`,
      'Track Mental Health', '/patient/health-insights', 'fa-brain'));
  }

  if (dietDays && dietDays.length) {
    const avgCal = avg(dietDays.map(d => d.cal));
    const avgFiber = avg(dietDays.map(d => d.fiber));
    if (avgCal > 2800) {
      insights.push(insight('warning', 'Diet', 'Calorie Intake Above Target',
        `You averaged ${Math.round(avgCal)} kcal/day this week — above the 2,500 kcal recommended limit. Focus on portion control.`,
        'View Diet', '/patient/diet', 'fa-utensils'));
    }
    if (avgFiber < 10) {
      insights.push(insight('warning', 'Diet', 'Low Fibre Intake Detected',
        'Your fibre intake is below recommended levels. Add more vegetables, legumes, and whole grains to support digestive and heart health.',
        'Log Meals', '/patient/diet', 'fa-leaf'));
    }
  }

  if (waterAvg !== null && waterAvg < 5) {
    insights.push(insight('warning', 'Hydration', 'Low Water Intake This Week',
      `You averaged only ${waterAvg.toFixed(1)} glasses/day — below the 8 glass target. Dehydration elevates BP and impairs kidney function.`,
      'Log Water', '/patient/diet', 'fa-tint'));
  }

  if (severeAllergies > 0) {
    insights.push(insight('info', 'Safety', 'Severe Allergy on Record',
      `You have ${severeAllergies} severe allergy/allergies on file. Ensure your emergency contacts and doctor are aware.`,
      'View Allergies', '/patient/medical-records', 'fa-exclamation-triangle'));
  }

  const allGoodDays = week1.filter(m => Number(m.sleepHours || 0) >= 7 && Number(m.steps || 0) >= 7500 && Number(m.heartRate || 0) <= 85).length;
  if (allGoodDays >= 5) {
    insights.push(insight('positive', 'Overall', 'Outstanding Health Week! 🎉',
      `You had ${allGoodDays} healthy days in a row — great sleep, good activity levels, and stable vitals. Keep the momentum going!`,
      null, null, 'fa-star'));
  }

  const order = { critical: 0, warning: 1, info: 2, positive: 3 };
  insights.sort((a, b) => (order[a.type] ?? 4) - (order[b.type] ?? 4));

  return insights.slice(0, 8);
}
