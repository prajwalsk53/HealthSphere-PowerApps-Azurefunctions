const { app } = require('@azure/functions');
const mailer = require('../lib/mailer');

app.http('emailConfig', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'bridge/email/config',
  handler: async () => {
    return {
      jsonBody: {
        appName: 'HealthSphere',
        systemEmail: mailer.MAIL_ADMIN,
        smtpHost: mailer.MAIL_HOST,
        smtpPort: mailer.MAIL_PORT,
        mailFrom: mailer.MAIL_FROM,
      },
    };
  },
});
