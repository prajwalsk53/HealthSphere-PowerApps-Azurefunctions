import { Hs_doctorschedule1sService } from '../generated/services/Hs_doctorschedule1sService';
import { Hs_appointmentsService } from '../generated/services/Hs_appointmentsService';
import { Hs_appointmentshs_status } from '../generated/models/Hs_appointmentsModel';

export const STATUS_CODES = Object.fromEntries(Object.entries(Hs_appointmentshs_status).map(([code, label]) => [label, Number(code)]));

const DEFAULT_SLOT_MINUTES = 30;
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 17;

export function toDoctor(record) {
  const rawName = record.hs_doctor1 || record.hs_username || record.hs_specialization || 'Doctor';
  return {
    id: record.hs_doctorid,
    userId: record._hs_user_value,
    name: rawName.replace(/^dr\.?\s+/i, ''),
    specialization: record.hs_specialization,
    hospital: record.hs_hospital,
    rating: record.hs_rating,
  };
}

function parseHHMM(value) {
  if (!value) return 0;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  const d = new Date(value);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export async function fetchSlots(doctorProfileId, doctorUserId, date) {
  const dow = new Date(`${date}T00:00:00`).getDay();
  const scheduleResult = await Hs_doctorschedule1sService.getAll({ filter: `_hs_doctor_value eq ${doctorProfileId}` });
  const rows = scheduleResult.data || [];
  const daySchedule = rows.find(s => s.hs_dayofweek === dow);

  let startMin, endMin, slotMinutes = DEFAULT_SLOT_MINUTES;
  if (rows.length) {
    if (!daySchedule || !daySchedule.hs_isavailable) {
      return { slots: [], message: 'Doctor is not available on this day' };
    }
    startMin = parseHHMM(daySchedule.hs_starttime);
    endMin = parseHHMM(daySchedule.hs_endtime);
    if (daySchedule.hs_slotduration) slotMinutes = daySchedule.hs_slotduration;
  } else {
    if (dow === 0 || dow === 6) {
      return { slots: [], message: 'Doctor is not available on this day' };
    }
    startMin = DEFAULT_START_HOUR * 60;
    endMin = DEFAULT_END_HOUR * 60;
  }

  const allSlots = [];
  for (let m = startMin; m < endMin; m += slotMinutes) {
    const h = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    allSlots.push(`${h}:${mm}`);
  }

  const apptResult = await Hs_appointmentsService.getAll({
    filter: `_hs_doctor_value eq ${doctorUserId} and hs_appointmentdate eq ${date} and hs_status ne ${STATUS_CODES.cancelled}`,
  });
  const toBookedKey = (label) => {
    const d = new Date(`1970-01-01T${label}:00`);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  };
  const bookedKeys = new Set((apptResult.data || []).map(a => {
    const t = new Date(a.hs_appointmenttime);
    return t.getUTCHours() * 60 + t.getUTCMinutes();
  }));

  const slots = allSlots.map(time => ({ time, available: !bookedKeys.has(toBookedKey(time)) }));
  const dayName = new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
  return { slots, day: dayName, available: slots.filter(s => s.available).length };
}
