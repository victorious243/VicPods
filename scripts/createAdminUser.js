require('dotenv').config({ quiet: true });

const bcrypt = require('bcrypt');
const { connectDatabase } = require('../config/database');
const User = require('../models/User');

const SALT_ROUNDS = 12;

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`${name} is required.`);
  }
  return String(value).trim();
}

async function run() {
  const mongoUri = requireEnv('MONGO_URI');
  const adminName = process.env.ADMIN_NAME?.trim() || 'VicPods Admin';
  const adminEmail = requireEnv('ADMIN_EMAIL').toLowerCase();
  const adminPassword = requireEnv('ADMIN_PASSWORD');

  if (adminPassword.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  }

  await connectDatabase(mongoUri);

  const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

  const user = await User.findOneAndUpdate(
    { email: adminEmail },
    {
      $set: {
        name: adminName,
        passwordHash,
        plan: 'premium',
        role: 'admin',
      },
      $setOnInsert: {
        aiDailyCount: 0,
        aiDailyResetDate: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  // eslint-disable-next-line no-console
  console.log(`Admin ready: ${user.email} (plan=${user.plan}, role=${user.role})`);

  process.exit(0);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`Failed to create admin user: ${error.message}`);
  process.exit(1);
});
