// HealthSphere AI Assistant — rule-based fallback + drug context helpers (ported from PHP)
const axios = require('axios');

function buildSystemPrompt({ user, meds, allergies, metrics, docStr }) {
  const medList = meds.length ? meds.map(m => `${m.medicationName} ${m.dosage || ''}`.trim()).join(', ') : 'None recorded';
  const allergyList = allergies.length ? allergies.map(a => `${a.allergen} (${a.severity})`).join(', ') : 'None recorded';
  const bpStr = metrics ? `${metrics.systolic}/${metrics.diastolic} mmHg` : 'N/A';
  const hrStr = metrics ? `${metrics.heartRate} bpm` : 'N/A';
  const spo2Str = metrics ? `${metrics.oxygenSaturation}%` : 'N/A';
  const sleepStr = metrics ? `${metrics.sleepHours}h` : 'N/A';

  return `You are HealthSphere AI, a caring and knowledgeable medical assistant integrated into the NHS HealthSphere platform. You are speaking with ${user.name} (NHS ID: ${user.nhsId || 'N/A'}).

PATIENT MEDICAL CONTEXT:
- Blood Type: ${user.bloodType || 'N/A'}
- Active Medications: ${medList}
- Known Allergies: ${allergyList}
- Latest Blood Pressure: ${bpStr}
- Latest Heart Rate: ${hrStr}
- Blood Oxygen (SpO2): ${spo2Str}
- Recent Sleep: ${sleepStr}
- Assigned Doctor: ${docStr}

YOUR ROLE:
1. Answer general health and medical questions clearly and accurately using evidence-based information
2. Explain medical terms in simple, friendly language the patient can understand
3. Reference the patient's specific health data when relevant (e.g. "given your blood pressure readings...")
4. Gently highlight if something in their question relates to a known allergy or current medication
5. Suggest booking an appointment through HealthSphere when clinical assessment is needed
6. Provide practical NHS-aligned health advice (diet, exercise, sleep, hydration)
7. For medication questions, explain what a drug does but NEVER recommend dosage changes
8. If symptoms suggest an emergency (chest pain, difficulty breathing, stroke signs, severe bleeding), immediately and clearly instruct them to call 999 or visit A&E

STRICT BOUNDARIES — NEVER:
- Diagnose a medical condition
- Prescribe or recommend changing medications
- Replace the advice of their doctor
- Provide mental health crisis counselling (refer to NHS 111 or Samaritans: 116 123)

RESPONSE STYLE:
- Warm, clear, and concise — like a knowledgeable friend who happens to be a healthcare expert
- Use short paragraphs and bullet points for clarity
- Always end with a clear next step (e.g. "You can log this in your Diet Tracker", "Book an appointment with ${docStr}", "Track your BP in Health Insights")
- Add a brief disclaimer when giving health advice: "This is general information — always consult your doctor for personal medical advice."`;
}

const STOP_WORDS = ['what', 'that', 'this', 'have', 'with', 'from', 'your', 'about', 'blood', 'heart', 'health', 'medical', 'doctor', 'does', 'give', 'cause'];

function extractDrugName(message, meds) {
  const lower = message.toLowerCase();
  for (const med of meds) {
    if (lower.includes(med.medicationName.toLowerCase())) return med.medicationName;
  }
  const patterns = [
    /(?:about|tell me about|what is|explain|side effects? of|effects? of|recalls? (?:for|of)|interactions? (?:with|for|of)|information (?:on|about))\s+([a-z][a-z0-9-]{2,})/i,
    /([a-z][a-z0-9-]{3,})\s+(?:medication|drug|pill|tablet|medicine|dosage|overdose|side effects?)/i,
  ];
  for (const pattern of patterns) {
    const m = message.match(pattern);
    if (m) {
      const c = m[1].toLowerCase();
      if (!STOP_WORDS.includes(c) && c.length >= 4) return m[1];
    }
  }
  return null;
}

async function fetchFdaContext(drugName) {
  try {
    const enc = `"${drugName}"`;
    let { data } = await axios.get('https://api.fda.gov/drug/label.json', {
      params: { search: `(openfda.brand_name:${enc}+openfda.generic_name:${enc})`, limit: 1 }, timeout: 5000,
    }).catch(() => ({ data: {} }));

    if (!data.results?.length) {
      ({ data } = await axios.get('https://api.fda.gov/drug/label.json', {
        params: { search: drugName, limit: 1 }, timeout: 5000,
      }).catch(() => ({ data: {} })));
    }

    const r = data.results?.[0];
    if (!r) return '';

    const openfda = r.openfda || {};
    const lines = [`=== FDA DRUG DATABASE: ${drugName} ===`];
    if (openfda.brand_name?.[0]) lines.push(`Brand: ${openfda.brand_name[0]}`);
    if (openfda.generic_name?.[0]) lines.push(`Generic: ${openfda.generic_name[0]}`);

    const fields = {
      indications_and_usage: 'Indications',
      warnings: 'Warnings',
      adverse_reactions: 'Adverse Reactions',
      drug_interactions: 'Drug Interactions',
      contraindications: 'Contraindications',
      dosage_and_administration: 'Dosage',
    };
    for (const [key, label] of Object.entries(fields)) {
      if (r[key]?.length) {
        const text = r[key].join(' ').replace(/\s+/g, ' ');
        lines.push(`${label}: ${text.slice(0, 350)}${text.length > 350 ? '…' : ''}`);
      }
    }
    return lines.length > 1 ? lines.join('\n') : '';
  } catch {
    return '';
  }
}

// ── Rule-based fallback engine ──────────────────────────────────────
function getRuleBasedResponse(message, { user, meds, allergies, metrics, docStr }) {
  const q = message.toLowerCase();

  const emergency = ['chest pain', 'heart attack', "can't breathe", 'difficulty breathing', 'stroke', 'unconscious', 'not breathing', 'overdose', 'suicide', 'severe bleeding', 'choking'];
  if (emergency.some(kw => q.includes(kw))) {
    return "🚨 **This sounds like a medical emergency.**\n\n**Call 999 immediately** or go to your nearest A&E.\n\nDo not wait — emergency services can help right away.\n\n- **999** — Emergency ambulance\n- **Leicester Royal Infirmary A&E** — Infirmary Square, LE1 5WW (24/7)\n\n_If you are in immediate danger, please call 999 now._";
  }

  if (q.includes('blood pressure') || q.includes('bp') || q.includes('hypertension')) {
    const bp = metrics ? `${metrics.systolic}/${metrics.diastolic} mmHg` : 'not available';
    let status = '';
    if (metrics) {
      const sys = Number(metrics.systolic);
      status = sys < 120 ? '✅ Your latest reading is in the **optimal** range.' : (sys < 130 ? '🟡 Your latest reading is **slightly elevated**.' : '🔴 Your latest reading is **above normal range** — please discuss with your doctor.');
    }
    return `**Blood Pressure Guide**\n\nYour latest BP: **${bp}**\n${status}\n\n**What the numbers mean:**\n- ✅ Optimal: below 120/80\n- 🟡 Elevated: 120–129 systolic\n- 🔴 High (Stage 1): 130–139 / 80–89\n- 🚨 Crisis: above 180/120 → call 999\n\n**Lifestyle tips to manage BP:**\n- Reduce salt to under 6g per day\n- Exercise 30 minutes, 5 days a week\n- Limit alcohol and caffeine\n- Maintain a healthy weight\n- Manage stress with mindfulness\n\n⚠️ _This is general information — always consult ${docStr} for personal advice._\n\n📅 Track your readings in **Health Insights** to spot trends.`;
  }

  if (q.includes('heart rate') || q.includes('pulse') || q.includes('palpitation') || q.includes('heartbeat')) {
    const hr = metrics ? `${metrics.heartRate} bpm` : 'not available';
    return `**Heart Rate Information**\n\nYour latest reading: **${hr}**\n\n**Normal resting heart rate ranges:**\n- Adults: 60–100 bpm\n- Athletes: 40–60 bpm (normal)\n- Above 100 bpm at rest: **tachycardia** — worth discussing with your GP\n- Below 60 bpm at rest: **bradycardia** — usually fine if you're fit\n\n**Common causes of irregular heartbeat:**\n- Stress or anxiety\n- Caffeine or alcohol\n- Dehydration\n- Fever or illness\n- Certain medications\n\n⚠️ _If you feel chest pain, dizziness, or fainting with palpitations, call 999._\n\n📊 View your heart rate trend in **Health Insights → Heart Rate Panel**.`;
  }

  if (q.includes('medication') || q.includes('medicine') || q.includes('pill') || q.includes('tablet') || q.includes('prescription') || q.includes('drug')) {
    const medListStr = meds.length ? meds.map(m => m.medicationName).join(', ') : 'none currently recorded';
    for (const m of meds) {
      if (q.includes(m.medicationName.toLowerCase())) {
        return `**About ${m.medicationName} (${m.dosage || ''})**\n\nYou are currently prescribed **${m.medicationName} ${m.dosage || ''}**, taken **${m.frequency || 'as directed'}**.\n\n**General information:**\nThis medication has been prescribed by ${docStr} as part of your treatment plan.\n\n**Important reminders:**\n- Take it exactly as prescribed — do not skip doses\n- Do not stop suddenly without consulting your doctor\n- Report any side effects to ${docStr}\n- Check for interactions with new medications\n\n⚠️ _Never adjust your dosage without speaking to your doctor first._\n\n💊 View all your prescriptions in **Medical Records → Medications**.`;
      }
    }
    return `**Your Current Medications**\n\nCurrently prescribed: **${medListStr}**\n\n**General medication safety tips:**\n- Always take medications as prescribed\n- Never stop a medication suddenly without medical advice\n- Keep a list of all medications (including vitamins/supplements)\n- Check for interactions before taking new medicines\n- Report side effects to ${docStr}\n\n**If you have missed a dose:**\n- Take it as soon as you remember\n- If it's nearly time for your next dose, skip the missed one\n- Never double up doses\n\n⚠️ _Only ${docStr} can adjust your prescription._\n\n💊 View your prescriptions in **Medical Records → Medications**.`;
  }

  if (q.includes('allerg') || q.includes('reaction') || q.includes('intoleran')) {
    const allergyListStr = allergies.length ? allergies.map(a => `${a.allergen} (${a.severity})`).join(', ') : 'none recorded';
    return `**Your Allergy Information**\n\nRecorded allergies: **${allergyListStr}**\n\n**Signs of allergic reaction to watch for:**\n- Mild: rash, itching, watery eyes, runny nose\n- Moderate: swelling, hives, digestive issues\n- Severe (anaphylaxis 🚨): throat swelling, difficulty breathing, drop in BP\n\n**If you experience severe reaction:**\n- Use your EpiPen if you have one\n- Call 999 immediately\n- Lie flat with legs raised\n\n**Managing allergies:**\n- Carry your allergy information at all times\n- Always read food/medication labels\n- Inform healthcare providers before any treatment\n\n⚠️ _Always update your allergy record when a new reaction is discovered._\n\n📋 Manage your allergies in **Medical Records → Allergies**.`;
  }

  if (q.includes('sleep') || q.includes('insomnia') || q.includes('tired') || q.includes('fatigue') || q.includes('rest')) {
    const sleep = metrics?.sleepHours ? `${metrics.sleepHours}h` : 'not yet recorded';
    return `**Sleep Health Guidance**\n\nYour recent sleep: **${sleep}**\n\n**NHS recommended sleep:**\n- Adults: **7–9 hours** per night\n- Less than 6h consistently increases risk of hypertension, diabetes, and obesity\n\n**Tips for better sleep:**\n- Go to bed and wake at the **same time every day**\n- Avoid screens (phone, TV) **1 hour before bed**\n- Keep your bedroom **cool, dark, and quiet** (16–18°C ideal)\n- Avoid caffeine after **2pm**\n- Avoid large meals within **3 hours of bedtime**\n- Light exercise in the morning helps sleep quality\n\n**NHS treatments for insomnia:**\n- Cognitive Behavioural Therapy for Insomnia (CBT-I)\n- Referral through your GP\n- Sleep hygiene programmes\n\n⚠️ _If poor sleep is affecting your daily life, discuss it with ${docStr}._\n\n🌙 Track your sleep in **Health Insights → Sleep Analysis**.`;
  }

  if (q.includes('diet') || q.includes('eat') || q.includes('food') || q.includes('nutrition') || q.includes('calorie') || q.includes('weight') || q.includes('sodium') || q.includes('salt')) {
    return "**NHS Dietary Guidance**\n\n**Daily targets (NHS Eatwell Guide):**\n- 🌾 Starchy carbs: ~36% of diet (whole grain preferred)\n- 🥦 Fruit & veg: **5 portions** per day\n- 🥛 Dairy/alternatives: moderate amounts\n- 🐟 Protein: lean meat, fish (2x oily fish/week), legumes\n- 💧 Water: **6–8 glasses** per day\n- 🧂 Salt: **maximum 6g per day**\n- 🍬 Sugar: free sugars under 30g/day\n\n**Foods that help blood pressure (relevant for you):**\n- Potassium-rich: bananas, spinach, sweet potato\n- Omega-3: salmon, mackerel, walnuts\n- Low-sodium alternatives: herbs instead of salt\n\n**Foods to limit:**\n- Processed/packaged foods (high sodium)\n- Sugary drinks\n- Red meat (max 70g/day)\n- Saturated fats\n\n⚠️ _For a personalised meal plan, ask your doctor for a dietitian referral._\n\n🥗 Log your meals in **Diet Tracker** to monitor intake.";
  }

  if (q.includes('exercise') || q.includes('workout') || q.includes('physical activity') || q.includes('steps') || q.includes('walk') || q.includes('gym')) {
    const steps = metrics?.steps ? `${Number(metrics.steps).toLocaleString()} steps recorded today` : 'not yet recorded today';
    return `**Physical Activity Guidance**\n\nYour activity today: **${steps}**\n\n**NHS recommended weekly activity:**\n- **150 minutes** of moderate activity (brisk walking, cycling, swimming)\n- OR **75 minutes** of vigorous activity (running, aerobics)\n- **Strength exercises** at least **2 days/week**\n- Reduce sitting time — move every 30 minutes\n\n**Starting out (if inactive):**\n- Begin with 10-minute walks\n- Gradually increase duration and pace\n- Aim for 10,000 steps per day\n- NHS Couch to 5K app is excellent for beginners\n\n**Benefits of regular exercise:**\n- Reduces BP by up to 10 mmHg\n- Lowers diabetes risk by 50%\n- Improves sleep quality\n- Reduces anxiety and depression\n- Strengthens heart and lungs\n\n⚠️ _If you have heart conditions or joint problems, discuss an exercise plan with ${docStr} first._\n\n🏃 Track your activity in **Health Insights → Exercise Panel**.`;
  }

  if (q.includes('anxiet') || q.includes('depress') || q.includes('stress') || q.includes('mental health') || q.includes('worry') || q.includes('sad') || q.includes('lonely') || q.includes('panic')) {
    return "**Mental Health Support**\n\nThank you for sharing this. Mental health is just as important as physical health, and reaching out is a sign of strength.\n\n**Immediate support available 24/7:**\n- 📞 **Samaritans: 116 123** (free, anytime)\n- 📱 **NHS 111** — press option 2 for mental health\n- 💬 **Shout**: text SHOUT to 85258\n\n**Self-help strategies:**\n- **Breathing exercise**: breathe in for 4 counts, hold for 4, out for 6\n- **5-4-3-2-1 grounding**: name 5 things you see, 4 you hear, 3 you can touch...\n- **Physical activity** — even a 10-min walk reduces anxiety\n- Limit caffeine, alcohol, and news intake\n- Maintain a regular sleep and meal schedule\n\n**NHS talking therapies (free):**\n- Cognitive Behavioural Therapy (CBT)\n- Self-refer at: www.nhs.uk/mental-health/talking-therapies\n\n⚠️ _Please discuss persistent symptoms with your doctor — effective treatments are available._\n\n🧠 Log your mood in **Health Analysis → Mental & Emotional**.";
  }

  if (q.includes('headache') || q.includes('migraine')) {
    return `**Headache & Migraine Guidance**\n\n**Common headache types:**\n- **Tension headache**: pressure/tightness around head — most common, stress-related\n- **Migraine**: throbbing, often one-sided, with nausea/light sensitivity\n- **Cluster headache**: severe, around one eye, in clusters\n\n**Self-care for mild headaches:**\n- Stay hydrated (dehydration is a common trigger)\n- Rest in a quiet, dark room\n- Paracetamol or ibuprofen (if not allergic/contraindicated)\n- Cold or warm compress on forehead\n- Identify triggers: stress, screen time, caffeine, skipped meals\n\n**See a doctor if:**\n- Sudden, severe 'thunderclap' headache\n- Headache with fever, stiff neck, rash\n- Headache after head injury\n- Worsening headaches over days/weeks\n- Vision changes or confusion\n\n⚠️ _This is general information — consult ${docStr} for recurring or severe headaches._`;
  }

  if (q.includes('fever') || q.includes('temperature') || q.includes('high temp')) {
    return "**Fever Guidance**\n\n**Temperature thresholds:**\n- Normal: 36.1–37.2°C\n- Mild fever: 37.3–38°C\n- Fever: **above 38°C**\n- High fever: **above 39°C** → seek medical advice\n\n**Self-care for mild fever:**\n- Rest and drink plenty of fluids\n- Paracetamol or ibuprofen to reduce temperature\n- Light clothing, cool room\n- Monitor temperature every few hours\n\n**Call 999 or go to A&E if:**\n- Temperature above **40°C**\n- Seizures\n- Difficulty breathing\n- Severe headache with stiff neck and rash\n- Confusion or unresponsiveness\n\n**Call 111 if:**\n- Fever lasting more than **3 days**\n- You have a weakened immune system\n- Baby under 3 months with any fever\n\n⚠️ _Consult your doctor if fever is persistent or you have underlying conditions._";
  }

  if (q.includes('appointment') || q.includes('book') || q.includes('gp') || q.includes('doctor')) {
    return `**Booking an Appointment**\n\nYour assigned doctor: **${docStr}**\n\n**How to book through HealthSphere:**\n1. Go to **Appointments** in the sidebar\n2. Or use the **Calendar View** for available slots\n3. Select your doctor and preferred time\n4. Add your reason/symptoms\n5. Confirm — you'll get a notification instantly\n\n**When to book urgently:**\n- Symptoms getting worse\n- New or unusual symptoms\n- Medication running low (prescription renewal)\n- Follow-up after test results\n\n**When to call NHS 111 instead:**\n- Urgent but not emergency\n- Need advice outside GP hours\n- Unsure whether to go to A&E\n\n**When to call 999:**\n- Life-threatening emergency\n- Chest pain, stroke symptoms, severe injury\n\n📅 Book your appointment now → Appointments`;
  }

  if (q.includes('oxygen') || q.includes('spo2') || q.includes('breathing')) {
    const spo2 = metrics?.oxygenSaturation ? `${metrics.oxygenSaturation}%` : 'not recorded';
    return `**Blood Oxygen (SpO₂) Information**\n\nYour latest SpO₂: **${spo2}**\n\n**Normal ranges:**\n- ✅ Normal: **95–100%**\n- 🟡 Concern: **93–94%** — monitor closely\n- 🔴 Low: **below 93%** — seek medical attention\n- 🚨 Critical: **below 90%** — call 999\n\n**Causes of low SpO₂:**\n- Asthma or COPD\n- Pneumonia or chest infection\n- Anaemia\n- High altitude\n- Sleep apnoea (low during sleep)\n\n**Improving oxygen levels:**\n- Sit upright rather than lying flat\n- Practice deep breathing exercises\n- Stay active and exercise regularly\n- Quit smoking\n- Treat underlying respiratory conditions\n\n⚠️ _If you feel breathless at rest or SpO₂ drops below 93%, contact ${docStr} or call 111._`;
  }

  if (q.includes('diabetes') || q.includes('blood sugar') || q.includes('glucose') || q.includes('insulin')) {
    return `**Diabetes & Blood Sugar Information**\n\n**Normal blood glucose levels:**\n- Fasting: **4.0–5.9 mmol/L**\n- 2 hours after eating: **under 7.8 mmol/L**\n- HbA1c (3-month average): **under 48 mmol/mol (6.5%)**\n\n**Signs of high blood sugar (hyperglycaemia):**\n- Excessive thirst\n- Frequent urination\n- Fatigue and blurred vision\n- Slow-healing wounds\n\n**Signs of low blood sugar (hypoglycaemia):**\n- Shakiness, sweating, confusion\n- **Treat immediately**: 15–20g fast-acting sugar (glucose tablets, fruit juice, regular fizzy drink)\n\n**Diabetes management tips:**\n- Monitor blood glucose as advised\n- Consistent meal times and carbohydrate portions\n- Regular exercise (lowers blood sugar naturally)\n- Attend all diabetes review appointments\n\n⚠️ _Managing diabetes requires regular review with ${docStr}._\n\n📊 Track your health metrics in **Health Insights**.`;
  }

  if (q.includes('water') || q.includes('hydrat') || q.includes('drink')) {
    return "**Hydration Guide**\n\n**NHS recommended daily intake:**\n- **6–8 glasses** (1.5–2 litres) of fluid per day\n- More when exercising, in hot weather, or if unwell\n\n**Signs of dehydration:**\n- Dark yellow urine (aim for pale straw colour)\n- Dry mouth and lips\n- Headache and dizziness\n- Fatigue and poor concentration\n- Muscle cramps\n\n**Best hydration choices:**\n- ✅ Water (best)\n- ✅ Herbal teas, diluted juice\n- ✅ Low-fat milk\n- ⚠️ Tea/coffee — moderate (diuretic effect)\n- ❌ Sugary drinks and alcohol — dehydrating\n\n**Hydration affects your BP:**\nDehydration can raise blood pressure — especially relevant to your health profile.\n\n💧 Log your water intake in **Diet Tracker → Water Intake** — aim for 8 glasses per day.";
  }

  if (q.includes('hello') || q.includes('hi ') || q === 'hi' || q.includes('hey') || q.includes('good morning') || q.includes('good evening')) {
    const name = user.name.split(' ')[0];
    return `Hello ${name}! 👋 I'm HealthSphere AI, your personal health assistant.\n\nI can help you with:\n- 💊 Understanding your medications\n- 🩺 General health questions and symptoms\n- 📊 Interpreting your health metrics\n- 🥗 Diet and nutrition advice\n- 🏃 Exercise recommendations\n- 😴 Sleep and mental wellbeing tips\n- 📅 Booking appointments with ${docStr}\n\nWhat would you like to know today?`;
  }

  return `Thank you for your question, ${user.name.split(' ')[0]}.\n\nI want to make sure I give you the most accurate answer. To get a full response:\n\n**Options:**\n1. 📋 **Try rephrasing** — e.g. "What causes high blood pressure?" or "How do I improve my sleep?"\n2. 💬 **Ask about**: blood pressure, heart rate, medications, allergies, sleep, diet, exercise, mental health, or NHS services\n3. 📅 **Book an appointment** with ${docStr} for personalised advice\n4. 📞 **Call NHS 111** for urgent health advice (free, 24/7)\n\n⚠️ _I am a health information assistant — always consult your doctor for diagnosis and treatment._\n\nWhat else can I help you with?`;
}

module.exports = { buildSystemPrompt, extractDrugName, fetchFdaContext, getRuleBasedResponse };
