import { useState } from 'react';
import bcrypt from 'bcryptjs';
import { Hs_usersService } from '../generated/services/Hs_usersService';
import { Hs_usershs_userrole, Hs_usershs_gender } from '../generated/models/Hs_usersModel';
import { Hs_doctorsService } from '../generated/services/Hs_doctorsService';
import { Hs_allergiesService } from '../generated/services/Hs_allergiesService';
import { Hs_allergieshs_severity } from '../generated/models/Hs_allergiesModel';
import { Hs_healthmetricsService } from '../generated/services/Hs_healthmetricsService';
import { Hs_appointmentsService } from '../generated/services/Hs_appointmentsService';
import { Hs_appointmentshs_status, Hs_appointmentshs_type } from '../generated/models/Hs_appointmentsModel';
import { Hs_prescriptionsService } from '../generated/services/Hs_prescriptionsService';
import { Hs_prescriptionshs_status } from '../generated/models/Hs_prescriptionsModel';
import { Hs_notificationsService } from '../generated/services/Hs_notificationsService';
import { Hs_notificationshs_type } from '../generated/models/Hs_notificationsModel';
import { Hs_fooddatabasesService } from '../generated/services/Hs_fooddatabasesService';
import { Hs_fooddatabaseshs_healthrating } from '../generated/models/Hs_fooddatabasesModel';
import { Hs_geneticdisease1sService } from '../generated/services/Hs_geneticdisease1sService';

const ROLE_CODES = Object.fromEntries(Object.entries(Hs_usershs_userrole).map(([c, l]) => [l, Number(c)]));
const GENDER_CODES = Object.fromEntries(Object.entries(Hs_usershs_gender).map(([c, l]) => [l, Number(c)]));
const ALLERGY_SEVERITY_CODES = Object.fromEntries(Object.entries(Hs_allergieshs_severity).map(([c, l]) => [l, Number(c)]));
const APPT_STATUS_CODES = Object.fromEntries(Object.entries(Hs_appointmentshs_status).map(([c, l]) => [l, Number(c)]));
const APPT_TYPE_CODES = Object.fromEntries(Object.entries(Hs_appointmentshs_type).map(([c, l]) => [l, Number(c)]));
const PRES_STATUS_CODES = Object.fromEntries(Object.entries(Hs_prescriptionshs_status).map(([c, l]) => [l, Number(c)]));
const NOTIF_TYPE_CODES = Object.fromEntries(Object.entries(Hs_notificationshs_type).map(([c, l]) => [l, Number(c)]));
const FOOD_RATING_CODES = Object.fromEntries(Object.entries(Hs_fooddatabaseshs_healthrating).map(([c, l]) => [l, Number(c)]));

const DOCTOR_NAMES_BY_SPECIALIZATION = {
  'neurology': 'Dr. Amara Whitfield',
  'pediatrics': 'Dr. Liam Carter',
  'orthopedics': 'Dr. Priya Nair',
  'cardiology': 'Dr. Marcus Webb',
  'dermatology': 'Dr. Sofia Hendricks',
};
const FALLBACK_DOCTOR_NAME_POOL = ['Dr. Elena Kowalski', 'Dr. Theo Bramwell', 'Dr. Naomi Osei', 'Dr. Felix Ardern', 'Dr. Grace Okafor'];

function nameForSpecialization(specialization) {
  const key = (specialization || '').trim().toLowerCase();
  if (DOCTOR_NAMES_BY_SPECIALIZATION[key]) return DOCTOR_NAMES_BY_SPECIALIZATION[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACK_DOCTOR_NAME_POOL[hash % FALLBACK_DOCTOR_NAME_POOL.length];
}

async function findOrCreateUser(log, { name, email, role, nhsId, phone, dob, gender }) {
  const existing = await Hs_usersService.getAll({ filter: `hs_emailaddress eq '${email}'` });
  if (existing.data?.[0]) {
    log(`User ${email} already exists, reusing.`);
    return existing.data[0].hs_userid;
  }
  const hash = bcrypt.hashSync('password', 12);
  const created = await Hs_usersService.create({
    hs_fullname: name,
    hs_emailaddress: email,
    hs_passwordhash: hash,
    hs_userrole: ROLE_CODES[role],
    hs_accountstatus: 0,
    hs_nhsidentifier: nhsId,
    ...(phone ? { hs_phonenumber: phone } : {}),
    ...(dob ? { hs_dateofbirth: dob } : {}),
    ...(gender ? { hs_gender: GENDER_CODES[gender] } : {}),
  });
  log(`Created user ${email}.`);
  return created.data.hs_userid;
}

export default function DevSeed() {
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const append = (msg) => setLog((l) => [...l, msg]);

  async function run() {
    setRunning(true);
    setLog([]);
    try {
      append('Seeding demo accounts...');
      const patientId = await findOrCreateUser(append, { name: 'Emma Patel', email: 'emma.patel007@gmail.com', role: 'patient', nhsId: 'NHS123456', phone: '07700900001', dob: '1990-03-15', gender: 'female' });
      const doctorUserId = await findOrCreateUser(append, { name: 'Dr. Jessica Johns', email: 'jessica.johns@leicesterhospital.nhs.uk', role: 'doctor', nhsId: 'NHS789012', phone: '07700900002', dob: '1982-07-22', gender: 'female' });
      await findOrCreateUser(append, { name: 'System Admin', email: 'admin@healthsphere.info', role: 'admin', nhsId: 'NHS000001' });
      await findOrCreateUser(append, { name: 'W. Jayson', email: 'w.jayson@dhsc.gov.uk', role: 'government', nhsId: 'NHS000002' });
      await findOrCreateUser(append, { name: 'Medical Team', email: 'medteam@healthsphere.nhs.uk', role: 'pharmacy', nhsId: 'NHS000003' });

      append('Checking doctor profile...');
      const existingDoctor = await Hs_doctorsService.getAll({ filter: `_hs_user_value eq ${doctorUserId}` });
      if (!existingDoctor.data?.[0]) {
        await Hs_doctorsService.create({
          hs_doctor1: 'Dr. Jessica Johns',
          'hs_User@odata.bind': `/hs_users(${doctorUserId})`,
          hs_specialization: 'General Practice',
          hs_hospital: 'St Thomas Hospital',
          hs_hcpcnumber: 'GP12345',
          hs_hcpcverified: true,
          hs_rating: 4.8,
          hs_bio: 'Experienced GP with 15 years of practice.',
        });
        append('Created doctor profile.');
      } else {
        append('Doctor profile already exists, skipping.');
      }

      append('Checking for doctor profiles without a linked login account...');
      const allDoctors = await Hs_doctorsService.getAll();
      const orphanDoctors = (allDoctors.data || []).filter(d => !d._hs_user_value);
      for (const d of orphanDoctors) {
        const specialization = d.hs_specialization || '';
        const looksLikeSpecializationName = (d.hs_doctor1 || '').trim().toLowerCase() === specialization.trim().toLowerCase();
        const displayName = looksLikeSpecializationName || !d.hs_doctor1 ? nameForSpecialization(specialization) : d.hs_doctor1;
        const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
        const email = `${slug}@healthsphere.nhs.uk`;
        const newUserId = await findOrCreateUser(append, { name: displayName, email, role: 'doctor', nhsId: `NHS${String(900000 + Math.floor(Math.random() * 99999))}` });
        await Hs_doctorsService.update(d.hs_doctorid, { 'hs_User@odata.bind': `/hs_users(${newUserId})`, hs_doctor1: displayName });
        append(`Linked login account to doctor "${displayName}".`);
      }
      if (!orphanDoctors.length) append('All doctor profiles already have linked accounts.');

      append('Checking for doctors still using their specialization as a placeholder name...');
      const allDoctorsAfter = await Hs_doctorsService.getAll();
      let renamedCount = 0;
      for (const d of allDoctorsAfter.data || []) {
        const specialization = d.hs_specialization || '';
        const currentName = (d.hs_doctor1 || '').trim().toLowerCase();
        const specLower = specialization.trim().toLowerCase();
        const looksLikePlaceholder = currentName === specLower || currentName === `dr. ${specLower}`;
        if (looksLikePlaceholder && d._hs_user_value) {
          const curatedName = nameForSpecialization(specialization);
          await Hs_usersService.update(d._hs_user_value, { hs_fullname: curatedName });
          await Hs_doctorsService.update(d.hs_doctorid, { hs_doctor1: curatedName });
          append(`Renamed placeholder doctor "${currentName}" to "${curatedName}".`);
          renamedCount++;
        }
      }
      if (!renamedCount) append('No placeholder doctor names found.');

      append('Checking patient allergies/health metrics/appointments/prescriptions/notifications...');
      const existingAllergies = await Hs_allergiesService.getAll({ filter: `_hs_patient_value eq ${patientId}` });
      if (!existingAllergies.data?.length) {
        await Promise.all([
          Hs_allergiesService.create({ hs_allergen: 'Peanuts', hs_allergy_name: 'Peanuts', 'hs_Patient@odata.bind': `/hs_users(${patientId})`, hs_severity: ALLERGY_SEVERITY_CODES.severe, hs_allergytype: 'food', hs_is_active: true }),
          Hs_allergiesService.create({ hs_allergen: 'Shellfish', hs_allergy_name: 'Shellfish', 'hs_Patient@odata.bind': `/hs_users(${patientId})`, hs_severity: ALLERGY_SEVERITY_CODES.moderate, hs_allergytype: 'food', hs_is_active: true }),
        ]);
        append('Created allergies.');
      } else {
        append('Allergies already exist, skipping.');
      }

      const existingMetrics = await Hs_healthmetricsService.getAll({ filter: `_hs_user_value eq ${patientId}` });
      if (!existingMetrics.data?.length) {
        await Promise.all([
          Hs_healthmetricsService.create({ 'hs_uSER@odata.bind': `/hs_users(${patientId})`, hs_systolic: 118, hs_diastolic: 76, hs_heartrate: 68, hs_oxygensaturation: 98.5, hs_temperature: 36.6, hs_steps: 8543, hs_sleephours: 7.5, hs_weight: 62.0, hs_bmi: 22.4, hs_source: 'manual' }),
          Hs_healthmetricsService.create({ 'hs_uSER@odata.bind': `/hs_users(${patientId})`, hs_systolic: 122, hs_diastolic: 78, hs_heartrate: 72, hs_oxygensaturation: 98.0, hs_temperature: 36.7, hs_steps: 9200, hs_sleephours: 8.0, hs_weight: 62.2, hs_bmi: 22.5, hs_source: 'manual' }),
        ]);
        append('Created health metrics.');
      } else {
        append('Health metrics already exist, skipping.');
      }

      const existingAppts = await Hs_appointmentsService.getAll({ filter: `_hs_patient_value eq ${patientId}` });
      if (!existingAppts.data?.length) {
        const apptDate1 = new Date(); apptDate1.setDate(apptDate1.getDate() + 3);
        const apptDate2 = new Date(); apptDate2.setDate(apptDate2.getDate() + 7);
        const apptDate3 = new Date(); apptDate3.setDate(apptDate3.getDate() - 5);
        const fmt = (d) => d.toISOString().slice(0, 10);
        await Promise.all([
          Hs_appointmentsService.create({ hs_appointment1: 'Annual check-up', 'hs_Patient@odata.bind': `/hs_users(${patientId})`, 'hs_Doctor@odata.bind': `/hs_users(${doctorUserId})`, hs_appointmentdate: fmt(apptDate1), hs_appointmenttime: new Date('1970-01-01T10:00:00').toISOString(), hs_reason: 'Annual check-up', hs_type: APPT_TYPE_CODES.general, hs_status: APPT_STATUS_CODES.confirmed }),
          Hs_appointmentsService.create({ hs_appointment1: 'Blood pressure review', 'hs_Patient@odata.bind': `/hs_users(${patientId})`, 'hs_Doctor@odata.bind': `/hs_users(${doctorUserId})`, hs_appointmentdate: fmt(apptDate2), hs_appointmenttime: new Date('1970-01-01T14:30:00').toISOString(), hs_reason: 'Blood pressure review', hs_type: APPT_TYPE_CODES.follow_up, hs_status: APPT_STATUS_CODES.pending }),
          Hs_appointmentsService.create({ hs_appointment1: 'Flu symptoms', 'hs_Patient@odata.bind': `/hs_users(${patientId})`, 'hs_Doctor@odata.bind': `/hs_users(${doctorUserId})`, hs_appointmentdate: fmt(apptDate3), hs_appointmenttime: new Date('1970-01-01T09:00:00').toISOString(), hs_reason: 'Flu symptoms', hs_type: APPT_TYPE_CODES.general, hs_status: APPT_STATUS_CODES.completed }),
        ]);
        append('Created appointments.');
      } else {
        append('Appointments already exist, skipping.');
      }

      const existingPres = await Hs_prescriptionsService.getAll({ filter: `_hs_patient_value eq ${patientId}` });
      if (!existingPres.data?.length) {
        await Promise.all([
          Hs_prescriptionsService.create({ hs_medicationname: 'Lisinopril', 'hs_Patient@odata.bind': `/hs_users(${patientId})`, 'hs_Doctor@odata.bind': `/hs_users(${doctorUserId})`, hs_dosage: '10mg', hs_frequency: 'Once daily', hs_duration: '30 days', hs_status: PRES_STATUS_CODES.active }),
          Hs_prescriptionsService.create({ hs_medicationname: 'Atorvastatin', 'hs_Patient@odata.bind': `/hs_users(${patientId})`, 'hs_Doctor@odata.bind': `/hs_users(${doctorUserId})`, hs_dosage: '20mg', hs_frequency: 'Once at night', hs_duration: '90 days', hs_status: PRES_STATUS_CODES.active }),
        ]);
        append('Created prescriptions.');
      } else {
        append('Prescriptions already exist, skipping.');
      }

      const existingNotifs = await Hs_notificationsService.getAll({ filter: `_hs_user_value eq ${patientId}` });
      if (!existingNotifs.data?.length) {
        await Promise.all([
          Hs_notificationsService.create({ hs_title: 'Appointment Confirmed', hs_message: 'Your appointment with Dr. Jessica Johns has been confirmed.', hs_type: NOTIF_TYPE_CODES.appointment, 'hs_User@odata.bind': `/hs_users(${patientId})` }),
          Hs_notificationsService.create({ hs_title: 'Medication Reminder', hs_message: 'Time to take your Lisinopril 10mg.', hs_type: NOTIF_TYPE_CODES.medication, 'hs_User@odata.bind': `/hs_users(${patientId})` }),
          Hs_notificationsService.create({ hs_title: 'Welcome to HealthSphere', hs_message: 'Your account is active. Explore your dashboard!', hs_type: NOTIF_TYPE_CODES.system, 'hs_User@odata.bind': `/hs_users(${patientId})` }),
        ]);
        append('Created notifications.');
      } else {
        append('Notifications already exist, skipping.');
      }

      append('Checking reference data (food database / genetic diseases)...');
      const existingFood = await Hs_fooddatabasesService.getAll({ top: 1 });
      if (!existingFood.data?.length) {
        const foods = [
          { name: 'Apple', calories: 95, protein: 0.5, carbs: 25.0, fat: 0.3, fiber: 4.4, allergens: 'None', rating: 'excellent' },
          { name: 'Grilled Chicken', calories: 335, protein: 62.5, carbs: 0.0, fat: 7.2, fiber: 0.0, allergens: 'None', rating: 'excellent' },
          { name: 'Greek Yogurt', calories: 100, protein: 10.0, carbs: 6.0, fat: 0.7, fiber: 0.0, allergens: 'Milk', rating: 'excellent' },
          { name: 'Brown Rice', calories: 216, protein: 5.0, carbs: 45.0, fat: 1.8, fiber: 3.5, allergens: 'None', rating: 'good' },
          { name: 'Salmon Fillet', calories: 367, protein: 39.0, carbs: 0.0, fat: 22.0, fiber: 0.0, allergens: 'Fish', rating: 'excellent' },
          { name: 'Banana', calories: 105, protein: 1.3, carbs: 27.0, fat: 0.4, fiber: 3.1, allergens: 'None', rating: 'good' },
          { name: 'Oatmeal', calories: 158, protein: 6.0, carbs: 27.0, fat: 3.6, fiber: 4.0, allergens: 'Oats', rating: 'excellent' },
          { name: 'Mixed Nuts', calories: 173, protein: 5.0, carbs: 6.0, fat: 16.0, fiber: 2.0, allergens: 'Tree Nuts, Peanuts', rating: 'good' },
        ];
        await Promise.all(foods.map((f) => Hs_fooddatabasesService.create({
          hs_foodname: f.name, hs_name: f.name, hs_calories: f.calories, hs_protein: f.protein, hs_carbs: f.carbs, hs_fat: f.fat, hs_fiber: f.fiber, hs_allergens: f.allergens, hs_healthrating: FOOD_RATING_CODES[f.rating],
        })));
        append('Created food database entries.');
      } else {
        append('Food database already populated, skipping.');
      }

      const existingDiseases = await Hs_geneticdisease1sService.getAll({ top: 1 });
      if (!existingDiseases.data?.length) {
        const diseases = [
          { name: 'Familial Hypercholesterolaemia', inheritanceType: 'Autosomal Dominant', symptoms: 'High LDL cholesterol, chest pain, xanthomas', foodTriggers: 'Saturated fats, trans fats', exerciseGuidance: 'Regular aerobic exercise 30 min/day', carePlan: 'Statins, dietary changes, regular monitoring' },
          { name: 'Type 2 Diabetes Predisposition', inheritanceType: 'Polygenic', symptoms: 'Insulin resistance, fatigue, frequent urination', foodTriggers: 'High glycemic index foods, sugary drinks', exerciseGuidance: 'Moderate intensity exercise, weight management', carePlan: 'Blood glucose monitoring, dietary management' },
          { name: 'Coeliac Disease', inheritanceType: 'HLA-linked', symptoms: 'Abdominal pain, diarrhoea, nutrient malabsorption', foodTriggers: 'Wheat, barley, rye', exerciseGuidance: 'All exercises safe on gluten-free diet', carePlan: 'Strict gluten-free diet, supplementation' },
        ];
        await Promise.all(diseases.map((d) => Hs_geneticdisease1sService.create({
          hs_geneticdisease1: d.name, hs_name: d.name, hs_inheritancetype: d.inheritanceType, hs_symptoms: d.symptoms, hs_foodtriggers: d.foodTriggers, hs_exerciseguidance: d.exerciseGuidance, hs_careplan: d.carePlan,
        })));
        append('Created genetic disease entries.');
      } else {
        append('Genetic diseases already populated, skipping.');
      }

      append('Done! Demo accounts (password: "password"): emma.patel007@gmail.com, doctor@healthsphere.com, admin@healthsphere.com, govt@healthsphere.com');
      setDone(true);
    } catch (err) {
      append(`ERROR: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '60px auto', padding: 24, fontFamily: 'monospace' }}>
      <h2>Dev: Seed Demo Data</h2>
      <p style={{ color: '#666' }}>One-time utility to populate empty Dataverse tables with the same demo data the old backend's seed.js used. Safe to run multiple times (skips entities that already exist).</p>
      <button onClick={run} disabled={running} style={{ padding: '10px 20px', fontSize: 14, cursor: running ? 'not-allowed' : 'pointer' }}>
        {running ? 'Seeding...' : done ? 'Run Again' : 'Run Seed'}
      </button>
      <pre style={{ marginTop: 16, background: '#111', color: '#0f0', padding: 12, borderRadius: 6, minHeight: 100, whiteSpace: 'pre-wrap' }}>
        {log.join('\n')}
      </pre>
    </div>
  );
}
