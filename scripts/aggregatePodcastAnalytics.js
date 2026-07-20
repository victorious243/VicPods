require('dotenv').config({ quiet: true });

const { connectDatabase } = require('../config/database');
const { aggregateDailyAnalytics } = require('../services/analytics/podcastAnalyticsService');

async function main() {
  await connectDatabase(process.env.MONGO_URI);

  const daysArg = process.argv.find((arg) => arg.startsWith('--days='));
  const days = Number.parseInt(daysArg ? daysArg.split('=')[1] : '3', 10);
  const safeDays = Number.isInteger(days) && days > 0 ? days : 3;
  const from = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const rows = await aggregateDailyAnalytics({ from, to: new Date() });

  // eslint-disable-next-line no-console
  console.log('Aggregated ' + rows.length + ' podcast analytics daily rows.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
