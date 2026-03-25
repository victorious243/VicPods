require('dotenv').config({ quiet: true });

const nodemailer = require('nodemailer');

function extractEmailAddress(value) {
  const normalized = String(value || '').trim();
  const match = normalized.match(/<([^>]+)>/);
  return String(match ? match[1] : normalized).trim().toLowerCase();
}

function isValidEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function usesPlaceholderEmailDomain(value) {
  const normalized = extractEmailAddress(value);
  const domain = normalized.split('@')[1] || '';
  return ['yourdomain.com', 'example.com', 'example.org', 'example.net'].includes(domain);
}

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function run() {
  const host = requireEnv('SMTP_HOST');
  const port = Number.parseInt(requireEnv('SMTP_PORT'), 10);
  const secure = String(process.env.SMTP_SECURE || 'false').trim().toLowerCase() === 'true';
  const user = requireEnv('SMTP_USER');
  const pass = requireEnv('SMTP_PASS');
  const from = requireEnv('SMTP_FROM');
  const to = requireEnv('EMAIL_TEST_TO');
  const fromAddress = extractEmailAddress(from);

  if (!Number.isInteger(port)) {
    throw new Error('SMTP_PORT must be a valid integer.');
  }

  if (!isValidEmailAddress(fromAddress)) {
    throw new Error('SMTP_FROM must contain a valid sender email address.');
  }

  if (usesPlaceholderEmailDomain(fromAddress)) {
    throw new Error('SMTP_FROM uses a placeholder domain. Replace it with a real sender address on a verified domain before testing delivery.');
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transport.verify();
  const info = await transport.sendMail({
    from,
    to,
    subject: 'VicPods SMTP test',
    text: `VicPods SMTP test succeeded at ${new Date().toISOString()}`,
  });

  // eslint-disable-next-line no-console
  console.log(`SMTP test email sent to ${to}. Message ID: ${info.messageId}`);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`SMTP test failed: ${error.message}`);
  process.exit(1);
});
