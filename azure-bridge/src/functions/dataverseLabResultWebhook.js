const { app } = require('@azure/functions');
const { dataverseGet } = require('../lib/dataverseClient');
const mailer = require('../lib/mailer');

const CRITICAL_STATUS_VALUES = ['critical', '123150003'];

// Dataverse serializes the registered plugin step's RemoteExecutionContext as JSON and POSTs
// it to this endpoint. The exact attribute layout depends on SDK/serializer version, so this
// reads defensively from a few known shapes instead of assuming one. The first real call should
// be inspected in Application Insights (see docs/DATAVERSE-WEBHOOK.md, "Capture the real payload")
// and this extractor adjusted to match exactly what your environment sends.
function extractPostImageAttributes(context) {
  const ctx = Array.isArray(context) ? context[0] : context;
  if (!ctx) return null;

  const images = ctx.PostEntityImages || ctx.postEntityImages || [];
  const imageEntries = Array.isArray(images) ? images : Object.entries(images).map(([key, value]) => ({ key, value }));
  const postImage = imageEntries.find((i) => (i.key || i.Key) === 'PostImage') || imageEntries[0];
  const entity = postImage?.value || postImage?.Value || postImage;
  if (!entity) return null;

  const rawAttrs = entity.Attributes || entity.attributes || [];
  const attrList = Array.isArray(rawAttrs) ? rawAttrs : Object.entries(rawAttrs).map(([key, value]) => ({ key, value }));

  const get = (name) => {
    const entry = attrList.find((a) => (a.key || a.Key) === name);
    const raw = entry?.value ?? entry?.Value;
    if (raw && typeof raw === 'object') return raw.Value ?? raw.value ?? raw.Id ?? raw.id ?? null;
    return raw ?? null;
  };

  return {
    status: get('hs_status'),
    patientId: get('_hs_patient_value') || get('hs_patient'),
    testType: get('hs_testtype'),
    result: get('hs_result'),
  };
}

app.http('dataverseLabResultWebhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'bridge/webhooks/lab-result-critical',
  handler: async (request) => {
    const key = request.headers.get('x-webhook-key');
    if (!key || key !== process.env.DATAVERSE_WEBHOOK_KEY) {
      return { status: 401, jsonBody: { error: 'Invalid webhook key' } };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    // Always log the raw payload — this is how you discover the real RemoteExecutionContext
    // shape for your SDK version on the first live call from Dataverse.
    console.log('Dataverse webhook raw payload:', JSON.stringify(body));

    try {
      const fields = extractPostImageAttributes(body);
      if (!fields) {
        return { status: 200, jsonBody: { handled: false, reason: 'No post-image found; logged raw payload' } };
      }

      if (!CRITICAL_STATUS_VALUES.includes(String(fields.status))) {
        return { status: 200, jsonBody: { handled: false, reason: `Status '${fields.status}' is not critical` } };
      }

      if (!fields.patientId) {
        return { status: 200, jsonBody: { handled: false, reason: 'No patient id in post-image' } };
      }

      const patient = await dataverseGet(`hs_users(${fields.patientId})?$select=hs_emailaddress,hs_fullname`);
      if (!patient?.hs_emailaddress) {
        return { status: 200, jsonBody: { handled: false, reason: 'Patient has no email on file' } };
      }

      const sent = await mailer.mailCriticalLabResult(
        patient.hs_emailaddress,
        patient.hs_fullname || 'Patient',
        fields.testType || 'Lab Test',
        fields.result || 'See your records',
      );

      return { status: 200, jsonBody: { handled: true, emailSent: sent } };
    } catch (err) {
      // Never throw back to Dataverse — a 4xx/5xx on a synchronous step rolls back the
      // user's save. Log and acknowledge instead; this is a notification side-effect, not
      // a validation rule.
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.error('Dataverse webhook processing failed:', detail);
      return { status: 200, jsonBody: { handled: false, error: err.message, detail } };
    }
  },
});
