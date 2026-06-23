const { app } = require('@azure/functions');
const mailer = require('../lib/mailer');

app.http('emailSend', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'bridge/email/send',
  handler: async (request) => {
    try {
      const body = await request.json();
      const { type = 'test', to } = body;
      const recipient = to || mailer.MAIL_ADMIN;
      let sent = false;

      switch (type) {
        case 'test': {
          const html = mailer.hsMailTemplate(
            'Test Email ✅',
            mailer.p('This is a <strong>test email</strong> from HealthSphere.')
            + mailer.success('✅ If you received this, your email configuration is working correctly!')
            + mailer.dataTable({ 'SMTP Host': `${mailer.MAIL_HOST}:${mailer.MAIL_PORT}`, From: mailer.MAIL_FROM, 'Sent at': new Date().toLocaleString('en-GB') }),
          );
          sent = await mailer.hsSendEmail(recipient, 'Admin', 'HealthSphere — Email Test', html);
          break;
        }
        case 'welcome':
          sent = await mailer.mailPatientWelcome(recipient, 'Test Patient', 'PT123456TEST');
          break;
        case 'approval_request':
          sent = await mailer.mailAdminNewApplication('Dr. Test User', recipient, 'doctor', 'DR123456', { HCPC: 'HCPC12345678', Specialization: 'Cardiology', Hospital: 'Test Hospital' });
          break;
        case 'approved':
          sent = await mailer.mailAccountApproved(recipient, 'Dr. Test User', 'doctor');
          break;
        case 'rejected':
          sent = await mailer.mailAccountRejected(recipient, 'Test User', 'doctor', 'HCPC number could not be verified.');
          break;
        case 'appointment':
          sent = await mailer.mailAppointmentPatient(recipient, 'Test Patient', 'Emma Hall', 'Monday, 15 May 2026', '09:30', 'BP Review', 'Leicester Royal Infirmary');
          break;
        case 'emergency':
          sent = await mailer.mailEmergencyAlert(recipient, 'Test Doctor', 'Test Patient', 'PT123456', 'I am experiencing severe chest pain and shortness of breath.');
          break;
        case 'prescription':
          sent = await mailer.mailPrescriptionIssued(recipient, 'Test Patient', 'Emma Hall', 'Amlodipine', '5mg', 'Once daily (Morning)', 'Take with water for blood pressure control');
          break;
        default:
          return { status: 400, jsonBody: { error: 'Unknown email type' } };
      }

      return { jsonBody: { success: sent, to: recipient } };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
