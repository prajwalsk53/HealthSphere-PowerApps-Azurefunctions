const { app } = require('@azure/functions');

const PRESCRIPTION_FEE_PENCE = 990; // £9.90 NHS prescription charge

app.http('paymentIntent', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'bridge/prescriptions/payment-intent',
  handler: async (request) => {
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const body = await request.json();
      const patientId = body?.patient_id;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: PRESCRIPTION_FEE_PENCE,
        currency: 'gbp',
        automatic_payment_methods: { enabled: true },
        metadata: { patient_id: String(patientId || ''), type: 'prescription' },
      });
      return { jsonBody: { client_secret: paymentIntent.client_secret } };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
