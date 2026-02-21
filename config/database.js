const mongoose = require('mongoose');

async function connectDatabase(mongoUri) {
  if (!mongoUri) {
    throw new Error('MONGO_URI is missing. Add it to your .env file.');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri);
}

module.exports = {
  connectDatabase,
};
