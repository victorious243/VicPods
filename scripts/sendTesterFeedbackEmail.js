require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const User = require('../models/User');
const { TrialInvite } = require('../models/TrialInvite');
const {
  buildTesterFeedbackEmail,
  sendTesterFeedbackEmail,
} = require('../services/email/testerFeedbackEmailService');

function getArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function getFirstName(value) {
  const name = String(value || '').trim();
  if (!name) {
    return '';
  }

  return name.split(/\s+/).filter(Boolean)[0] || name;
}

function addRecipient(recipientMap, { email, name, source }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return;
  }

  const current = recipientMap.get(normalizedEmail);
  const resolvedName = getFirstName(name) || normalizedEmail.split('@')[0];

  if (!current) {
    recipientMap.set(normalizedEmail, {
      email: normalizedEmail,
      name: resolvedName,
      sources: source ? [source] : [],
    });
    return;
  }

  if ((!current.name || current.name === current.email.split('@')[0]) && resolvedName) {
    current.name = resolvedName;
  }
  if (source && !current.sources.includes(source)) {
    current.sources.push(source);
  }
}

async function getTesterRecipients() {
  const mongoUri = String(process.env.MONGO_URI || '').trim();
  if (!mongoUri) {
    throw new Error('MONGO_URI is required to load tester recipients.');
  }

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
  });

  const recipientMap = new Map();
  const [testerUsers, trialInvites] = await Promise.all([
    User.find({
      $or: [
        { testerTrialInviteId: { $ne: null } },
        { testerTrialGrantedAt: { $ne: null } },
        { testerTrialCode: { $nin: ['', null] } },
      ],
    })
      .select('name email testerTrialCode testerTrialGrantedAt')
      .lean(),
    TrialInvite.find({
      lastInviteEmailSentTo: { $nin: ['', null] },
    })
      .select('name lastInviteEmailSentTo lastInviteEmailSentAt')
      .lean(),
  ]);

  testerUsers.forEach((user) => {
    addRecipient(recipientMap, {
      email: user.email,
      name: user.name,
      source: 'redeemed_tester_trial',
    });
  });

  trialInvites.forEach((invite) => {
    addRecipient(recipientMap, {
      email: invite.lastInviteEmailSentTo,
      name: invite.name,
      source: 'trial_invite_email_sent',
    });
  });

  return [...recipientMap.values()].sort((a, b) => a.email.localeCompare(b.email));
}

async function run() {
  const sendAllTesters = process.argv.includes('--all-testers');
  const to = normalizeEmail(getArg('to') || process.env.TESTER_FEEDBACK_TO);
  const name = getArg('name') || process.env.TESTER_FEEDBACK_NAME || 'there';
  const dryRun = process.argv.includes('--dry-run');

  if (sendAllTesters) {
    const recipients = await getTesterRecipients();

    if (!recipients.length) {
      // eslint-disable-next-line no-console
      console.log('No tester recipients found.');
      return;
    }

    if (dryRun) {
      // eslint-disable-next-line no-console
      console.log(`Tester feedback recipients (${recipients.length}):`);
      recipients.forEach((recipient) => {
        // eslint-disable-next-line no-console
        console.log(`- ${recipient.name} <${recipient.email}> (${recipient.sources.join(', ')})`);
      });
      return;
    }

    let deliveredCount = 0;
    for (const recipient of recipients) {
      const result = await sendTesterFeedbackEmail({
        to: recipient.email,
        name: recipient.name,
        appUrl: process.env.APP_URL || 'http://localhost:3000',
      });

      if (result?.delivered) {
        deliveredCount += 1;
      }

      // eslint-disable-next-line no-console
      console.log(`${recipient.email}: delivered=${result?.delivered ? 'yes' : 'no'} devFallback=${result?.devFallback ? 'yes' : 'no'}`);
    }

    // eslint-disable-next-line no-console
    console.log(`Tester feedback email complete. Delivered ${deliveredCount}/${recipients.length}.`);
    return;
  }

  if (!to) {
    throw new Error('Recipient email is required. Use --to=email@example.com, TESTER_FEEDBACK_TO, or --all-testers.');
  }

  if (dryRun) {
    const email = buildTesterFeedbackEmail({
      name,
      appUrl: process.env.APP_URL || 'http://localhost:3000',
    });
    // eslint-disable-next-line no-console
    console.log(`Subject: ${email.subject}\n\n${email.text}`);
    return;
  }

  const result = await sendTesterFeedbackEmail({
    to,
    name,
    appUrl: process.env.APP_URL || 'http://localhost:3000',
  });

  // eslint-disable-next-line no-console
  console.log(`Tester feedback email processed for ${to}. Delivered: ${result.delivered ? 'yes' : 'no'}. Dev fallback: ${result.devFallback ? 'yes' : 'no'}.`);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`Tester feedback email failed: ${error.message}`);
  process.exit(1);
}).finally(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});
