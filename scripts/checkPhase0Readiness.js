#!/usr/bin/env node

require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const { validateEnvironment } = require('../config/envValidation');

const ROOT = path.resolve(__dirname, '..');

const REQUIRED_PATHS = [
  'app.js',
  'bin/www',
  'config/database.js',
  'config/envValidation.js',
  'models/User.js',
  'models/Series.js',
  'models/Theme.js',
  'models/Episode.js',
  'models/PodcastShow.js',
  'models/AudioAsset.js',
  'routes/index.js',
  'routes/studio.js',
  'routes/kitchen.js',
  'routes/pantry.js',
  'routes/publish.js',
  'controllers/publicPodcastController.js',
  'controllers/publishController.js',
  'services/publish/publishService.js',
  'services/publish/rssFeedService.js',
  'services/publish/audioStorageService.js',
  'views/studio/index.ejs',
  'views/kitchen/index.ejs',
  'views/pantry/index.ejs',
  'views/publish/shows.ejs',
  'views/publish/episode.ejs',
];

const REQUIRED_PACKAGE_SCRIPTS = [
  'start',
  'test',
  'test:smoke',
  'phase0:check',
  'seed:phase0',
  'seed:admin',
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function checkPathList() {
  return REQUIRED_PATHS
    .filter((relativePath) => !exists(relativePath))
    .map((relativePath) => 'Missing required project path: ' + relativePath);
}

function checkPackageScripts() {
  const packageJson = readJson('package.json');
  const scripts = packageJson.scripts || {};

  return REQUIRED_PACKAGE_SCRIPTS
    .filter((scriptName) => !scripts[scriptName])
    .map((scriptName) => 'Missing package script: ' + scriptName);
}

function checkUploadDirectories() {
  const warnings = [];
  const uploadRoot = path.join(ROOT, 'public', 'uploads');
  const audioRoot = path.join(uploadRoot, 'audio');

  if (!fs.existsSync(uploadRoot)) {
    warnings.push('public/uploads does not exist yet; it will be created by audio upload or seed scripts.');
  }

  if (!fs.existsSync(audioRoot)) {
    warnings.push('public/uploads/audio does not exist yet; it will be created by audio upload or seed scripts.');
  }

  return warnings;
}

function checkGitignoredUploads() {
  const gitignorePath = path.join(ROOT, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    return ['.gitignore is missing; uploaded media should not be committed.'];
  }

  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  if (!/public\/uploads/.test(gitignore)) {
    return ['public/uploads is not gitignored; uploaded audio/artwork can accidentally enter git.'];
  }

  return [];
}

function main() {
  const errors = [];
  const warnings = [];
  const isProduction = process.env.NODE_ENV === 'production';
  const envValidation = validateEnvironment({ isProduction });

  errors.push(...envValidation.errors.map((message) => 'Environment: ' + message));
  warnings.push(...envValidation.warnings.map((message) => 'Environment: ' + message));
  errors.push(...checkPathList());
  errors.push(...checkPackageScripts());
  warnings.push(...checkUploadDirectories());
  warnings.push(...checkGitignoredUploads());

  if (warnings.length) {
    console.log('Phase 0 readiness warnings:');
    warnings.forEach((warning) => console.log('- ' + warning));
    console.log('');
  }

  if (errors.length) {
    console.error('Phase 0 readiness failed:');
    errors.forEach((error) => console.error('- ' + error));
    process.exit(1);
  }

  console.log('Phase 0 readiness passed.');
}

main();
