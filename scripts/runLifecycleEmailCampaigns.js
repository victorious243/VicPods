require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const { runLifecycleEmailCampaigns } = require('../services/email/liveLifecycleEmailService');

function parseArgs(argv) {
  const options = {
    campaigns: ['all'],
    userEmail: '',
    dryRun: false,
  };

  argv.forEach((arg) => {
    if (arg === '--dry-run') {
      options.dryRun = true;
      return;
    }

    if (arg.startsWith('--campaign=')) {
      options.campaigns = arg.slice('--campaign='.length).split(',').map((item) => item.trim()).filter(Boolean);
      return;
    }

    if (arg.startsWith('--user=')) {
      options.userEmail = arg.slice('--user='.length).trim();
    }
  });

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  await connectDatabase(process.env.MONGO_URI);
  const result = await runLifecycleEmailCampaigns(options);

  result.results.forEach((item) => {
    // eslint-disable-next-line no-console
    console.log(`${item.campaign}\t${item.email}\t${item.sent ? 'sent' : 'skipped'}\t${item.reason}`);
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    usersProcessed: result.usersProcessed,
    summary: result.summary,
    dryRun: options.dryRun,
  }, null, 2));
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
