const bcrypt = require('bcrypt');
const User = require('../models/User');
const { AppError } = require('../utils/errors');

const SALT_ROUNDS = 12;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function registerUser({ name, email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (!name || !normalizedEmail || !password) {
    throw new AppError('Name, email, and password are required.', 400);
  }

  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters.', 400);
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
  });

  return user;
}

async function authenticateUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw new AppError('Email and password are required.', 400);
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Invalid email or password.', 401);
  }

  return user;
}

module.exports = {
  registerUser,
  authenticateUser,
};
