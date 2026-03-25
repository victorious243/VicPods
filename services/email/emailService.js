const nodemailer = require('nodemailer');

let cachedTransport = null;

function parseBool(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function getSmtpConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const portRaw = String(process.env.SMTP_PORT || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const secure = parseBool(process.env.SMTP_SECURE);
  const from = String(process.env.SMTP_FROM || '').trim();
  const port = Number.parseInt(portRaw, 10);

  return {
    host,
    port,
    user,
    pass,
    secure,
    from,
    isReady: Boolean(host && Number.isInteger(port) && user && pass && from),
  };
}

function getTransport() {
  if (cachedTransport) {
    return cachedTransport;
  }

  const config = getSmtpConfig();
  if (!config.isReady) {
    return null;
  }

  cachedTransport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return cachedTransport;
}

async function sendEmail({ to, subject, text, html, attachments }) {
  const isProduction = process.env.NODE_ENV === 'production';
  const config = getSmtpConfig();
  const transport = getTransport();

  if (!transport || !config.isReady) {
    if (isProduction) {
      throw new Error('SMTP is not configured for production email delivery.');
    }
    // eslint-disable-next-line no-console
    console.log(`[Email DEV Fallback] to=${to} subject="${subject}" (SMTP not configured; email not sent)`);
    return {
      delivered: false,
      devFallback: true,
    };
  }

  try {
    await transport.sendMail({
      from: config.from,
      to,
      subject,
      text,
      html,
      attachments,
    });
  } catch (error) {
    if (isProduction) {
      throw new Error(`SMTP delivery failed: ${error.message}`);
    }
    // eslint-disable-next-line no-console
    console.error(`Email delivery failed for ${to}: ${error.message}`);
    // eslint-disable-next-line no-console
    console.log(`[Email DEV Fallback] to=${to} subject="${subject}" (SMTP send failed; email not sent)`);
    return {
      delivered: false,
      devFallback: true,
    };
  }

  return {
    delivered: true,
    devFallback: false,
  };
}

module.exports = {
  sendEmail,
  getSmtpConfig,
};
