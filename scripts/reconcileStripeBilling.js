require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const { reconcileAllUsersBilling } = require('../services/stripe/billingReconciliation');

function parseEmailArg(argv) {
  const match = argv.find((value) => value.startsWith('--email='));
  return match ? match.slice('--email='.length).trim().toLowerCase() : '';
}

async function run() {
  await connectDatabase(process.env.MONGO_URI);

  const summary = await reconcileAllUsersBilling({
    onlyEmail: parseEmailArg(process.argv.slice(2)),
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  run()
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      try {
        await mongoose.disconnect();
      } catch (_error) {
        // no-op
      }
    });
}

module.exports = {
  run,
};
