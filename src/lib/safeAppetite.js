import { Hs_allergiesService } from '../generated/services/Hs_allergiesService';
import { Hs_allergieshs_severity } from '../generated/models/Hs_allergiesModel';
import { Hs_foodintolerancesService } from '../generated/services/Hs_foodintolerancesService';
import { Hs_foodintoleranceshs_severity } from '../generated/models/Hs_foodintolerancesModel';
import { Hs_dietpreferencesService } from '../generated/services/Hs_dietpreferencesService';
import { Hs_ingredientdislikesService } from '../generated/services/Hs_ingredientdislikesService';
import { Hs_ingredientscansService } from '../generated/services/Hs_ingredientscansService';
import { Hs_ingredientscanshs_esult } from '../generated/models/Hs_ingredientscansModel';

const SEVERITY_CODES = Object.fromEntries(Object.entries(Hs_allergieshs_severity).map(([c, l]) => [l, Number(c)]));
const INTOL_SEVERITY_CODES = Object.fromEntries(Object.entries(Hs_foodintoleranceshs_severity).map(([c, l]) => [l, Number(c)]));
const RESULT_CODES = Object.fromEntries(Object.entries(Hs_ingredientscanshs_esult).map(([c, l]) => [l, Number(c)]));

// ── Ported from the Express backend's rule-based ingredient scan ──
// (the backend also tries Gemini AI first when a server-side API key is configured;
// that part requires a bridge and is intentionally not replicated here)
const SAFE_APPETITE_SYNONYMS = {
  peanuts: ['peanut', 'groundnut', 'arachis'],
  'tree nuts': ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'brazil nut', 'pine nut'],
  milk: ['milk', 'dairy', 'lactose', 'casein', 'whey', 'cream', 'cheese', 'butter', 'ghee'],
  'milk/dairy': ['milk', 'dairy', 'lactose', 'casein', 'whey', 'cream', 'cheese', 'butter', 'ghee'],
  eggs: ['egg', 'albumin', 'meringue', 'mayonnaise'],
  wheat: ['wheat', 'gluten', 'flour', 'semolina', 'spelt', 'durum'],
  'wheat/gluten': ['wheat', 'gluten', 'flour', 'semolina', 'spelt', 'durum'],
  soy: ['soy', 'soya', 'tofu', 'miso', 'tempeh', 'edamame'],
  fish: ['fish', 'cod', 'salmon', 'tuna', 'anchov', 'sardine'],
  shellfish: ['shrimp', 'crab', 'lobster', 'prawn', 'scallop', 'clam', 'oyster', 'mussel', 'squid'],
  sesame: ['sesame', 'tahini'],
  mustard: ['mustard'],
  celery: ['celery'],
  lupin: ['lupin'],
  molluscs: ['mollusc', 'snail', 'octopus', 'clam', 'mussel', 'oyster'],
  sulphites: ['sulphite', 'sulfite', 'so2'],
};

function fallbackSafeAppetiteScan(ingredientText, profile) {
  const lower = ingredientText.toLowerCase();
  const alerts = [];
  let overall = 'safe';

  for (const a of profile.allergies) {
    const key = a.allergen.toLowerCase();
    const syns = SAFE_APPETITE_SYNONYMS[key] || [key];
    const matches = syns.filter(s => lower.includes(s));
    if (matches.length) {
      alerts.push({ ingredient: matches[0], reason: `Contains ${a.allergen} - you have a ${a.severity} allergy`, type: 'DANGER', matches });
      overall = 'danger';
    }
  }
  for (const i of profile.intolerances) {
    const key = i.intolerance.toLowerCase();
    const syns = SAFE_APPETITE_SYNONYMS[key] || [key];
    const matches = syns.filter(s => lower.includes(s));
    if (matches.length) {
      alerts.push({ ingredient: matches[0], reason: `Contains ${i.intolerance} - you have a ${i.severity} intolerance`, type: 'CAUTION', matches });
      if (overall === 'safe') overall = 'caution';
    }
  }
  for (const d of profile.dislikes) {
    if (lower.includes(d.toLowerCase())) {
      alerts.push({ ingredient: d, reason: `Contains an ingredient you dislike: ${d}`, type: 'INFO', matches: [d] });
    }
  }

  const summary = alerts.length
    ? `Found ${alerts.length} item(s) of concern based on your safety profile.`
    : 'No known allergens, intolerances, or disliked ingredients detected.';
  const tip = overall === 'danger'
    ? 'Avoid this product and check with the manufacturer for full allergen information.'
    : overall === 'caution'
    ? 'Proceed with caution and check the full ingredient label before consuming.'
    : 'This looks safe based on your profile, but always double-check labels for cross-contamination warnings.';

  return { overall, alerts, summary, tip, safe_highlights: [] };
}

export async function loadProfile(userId) {
  const [allergiesRes, intolRes, dietRes, dislikeRes, scansRes] = await Promise.all([
    Hs_allergiesService.getAll({ filter: `_hs_patient_value eq ${userId} and hs_allergytype eq 'food' and hs_is_active eq true` }),
    Hs_foodintolerancesService.getAll({ filter: `_hs_user_value eq ${userId} and hs_isactive eq true` }),
    Hs_dietpreferencesService.getAll({ filter: `_hs_user_value eq ${userId} and hs_isactive eq true` }),
    Hs_ingredientdislikesService.getAll({ filter: `_hs_user_value eq ${userId} and hs_isactive eq true` }),
    Hs_ingredientscansService.getAll({ filter: `_hs_user_value eq ${userId}`, orderBy: ['createdon desc'], top: 10 }),
  ]);

  const allergies = (allergiesRes.data || []).map(a => ({ id: a.hs_allergyid, allergen: a.hs_allergen, severity: Hs_allergieshs_severity[a.hs_severity] }));
  const intolerances = (intolRes.data || []).map(i => ({ id: i.hs_foodintoleranceid, intolerance: i.hs_intolerance, severity: Hs_foodintoleranceshs_severity[i.hs_severity] }));
  const dietPrefs = (dietRes.data || []).map(d => ({ id: d.hs_dietpreferenceid, preference: d.hs_preference }));
  const dislikes = (dislikeRes.data || []).map(d => ({ id: d.hs_ingredientdislikeid, ingredient: d.hs_ingredient }));
  const scans = (scansRes.data || []).map(s => ({
    id: s.hs_ingredientscanid,
    productName: s.hs_ingredientscan1,
    result: Hs_ingredientscanshs_esult[s.hs_esult] || 'safe',
    alerts: s.hs_lerts ? JSON.parse(s.hs_lerts) : [],
    aiSummary: s.hs_isummary,
    tip: s.hs_ip,
    createdAt: s.createdon,
  }));

  let profileScore = 0;
  if (allergies.length) profileScore += 35;
  if (intolerances.length) profileScore += 25;
  if (dietPrefs.length) profileScore += 25;
  if (dislikes.length) profileScore += 15;
  profileScore = Math.min(profileScore, 100);

  return { allergies, intolerances, dietPrefs, dislikes, scans, profileScore };
}

export async function savePreferences(userId, { allergies = [], intolerances = [], diet_prefs = [], dislikes = [] }) {
  const [existingAllergiesRes, existingIntolRes, existingDietRes, existingDislikeRes] = await Promise.all([
    Hs_allergiesService.getAll({ filter: `_hs_patient_value eq ${userId} and hs_allergytype eq 'food'` }),
    Hs_foodintolerancesService.getAll({ filter: `_hs_user_value eq ${userId}` }),
    Hs_dietpreferencesService.getAll({ filter: `_hs_user_value eq ${userId}` }),
    Hs_ingredientdislikesService.getAll({ filter: `_hs_user_value eq ${userId}` }),
  ]);

  await Promise.all([
    ...(existingAllergiesRes.data || []).map(a => Hs_allergiesService.delete(a.hs_allergyid)),
    ...(existingIntolRes.data || []).map(i => Hs_foodintolerancesService.delete(i.hs_foodintoleranceid)),
    ...(existingDietRes.data || []).map(d => Hs_dietpreferencesService.delete(d.hs_dietpreferenceid)),
    ...(existingDislikeRes.data || []).map(d => Hs_ingredientdislikesService.delete(d.hs_ingredientdislikeid)),
  ]);

  await Promise.all([
    ...allergies.filter(a => a?.allergen).map(a => Hs_allergiesService.create({
      'hs_Patient@odata.bind': `/hs_users(${userId})`,
      hs_allergen: a.allergen, hs_allergy_name: a.allergen,
      hs_severity: SEVERITY_CODES[a.severity || 'moderate'],
      hs_allergytype: 'food', hs_is_active: true,
    })),
    ...intolerances.filter(i => i?.name).map(i => Hs_foodintolerancesService.create({
      'hs_User@odata.bind': `/hs_users(${userId})`,
      hs_intolerance: i.name, hs_foodintolerancename: i.name,
      hs_severity: INTOL_SEVERITY_CODES[i.severity || 'moderate'], hs_isactive: true,
    })),
    ...diet_prefs.filter(Boolean).map(p => Hs_dietpreferencesService.create({
      'hs_User@odata.bind': `/hs_users(${userId})`,
      hs_preference: p, hs_dietpreferencename: p, hs_isactive: true,
    })),
    ...dislikes.filter(Boolean).map(d => Hs_ingredientdislikesService.create({
      'hs_User@odata.bind': `/hs_users(${userId})`,
      hs_ingredient: d, hs_ingredientdislikename: d, hs_isactive: true,
    })),
  ]);
}

export async function scanIngredients(userId, productName, ingredients) {
  if (!ingredients || !ingredients.trim()) throw new Error('Ingredients are required');
  const profile = await loadProfile(userId);
  const scanProfile = {
    allergies: profile.allergies.map(a => ({ allergen: a.allergen, severity: a.severity })),
    intolerances: profile.intolerances.map(i => ({ intolerance: i.intolerance, severity: i.severity })),
    dietPrefs: profile.dietPrefs.map(d => d.preference),
    dislikes: profile.dislikes.map(d => d.ingredient),
  };
  const result = fallbackSafeAppetiteScan(ingredients, scanProfile);
  const scanResultEnum = result.overall === 'danger' ? 'danger' : result.overall === 'caution' ? 'warning' : 'safe';

  const created = await Hs_ingredientscansService.create({
    'hs_User@odata.bind': `/hs_users(${userId})`,
    hs_ingredientscan1: productName || 'Unknown Product',
    hs_ngredients: ingredients,
    hs_esult: RESULT_CODES[scanResultEnum],
    hs_lerts: JSON.stringify(result.alerts || []),
    hs_isummary: result.summary || undefined,
    hs_ip: result.tip || undefined,
  });

  const scan_result = {
    id: created.data?.hs_ingredientscanid,
    productName: productName || 'Unknown Product',
    result: scanResultEnum,
    alerts: result.alerts || [],
    aiSummary: result.summary,
    tip: result.tip,
    createdAt: new Date().toISOString(),
  };

  return { result, scan_result };
}

export async function deleteScan(scanId) {
  await Hs_ingredientscansService.delete(scanId);
}
