const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const AudioAsset = require('../models/AudioAsset');
const { validateEnvironment } = require('../config/envValidation');
const {
  OBJECT_STORAGE_PREFIX,
  buildObjectStorageKey,
  buildObjectUrl,
  buildSignedObjectRequest,
  normalizeObjectKey,
} = require('../services/publish/objectStorageService');
const {
  buildPublicAudioPath,
  buildPublicAudioUrl,
  MAX_OBJECT_AUDIO_BYTES,
} = require('../services/publish/audioStorageService');

const objectConfig = {
  endpoint: 'https://account.r2.cloudflarestorage.com',
  bucket: 'vicpods-audio',
  region: 'auto',
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key',
  publicBaseUrl: 'https://audio.vicpods.example',
};

test('Phase 10 object storage helpers produce stable private keys and public URLs', () => {
  const originalEnv = { ...process.env };

  try {
    process.env.OBJECT_STORAGE_PUBLIC_BASE_URL = 'https://audio.vicpods.example';
    const storageKey = buildObjectStorageKey('/audio/user-1/episode-1/final.mp3');

    assert.equal(storageKey, `${OBJECT_STORAGE_PREFIX}audio/user-1/episode-1/final.mp3`);
    assert.equal(normalizeObjectKey(storageKey), 'audio/user-1/episode-1/final.mp3');
    assert.equal(
      buildObjectUrl(storageKey, objectConfig),
      'https://audio.vicpods.example/audio/user-1/episode-1/final.mp3'
    );
    assert.equal(
      buildPublicAudioPath(storageKey),
      'https://audio.vicpods.example/audio/user-1/episode-1/final.mp3'
    );
    assert.equal(
      buildPublicAudioUrl(storageKey, 'https://app.vicpods.example'),
      'https://audio.vicpods.example/audio/user-1/episode-1/final.mp3'
    );
  } finally {
    process.env = originalEnv;
  }
});

test('Phase 10 object storage signing creates S3-compatible requests', () => {
  const request = buildSignedObjectRequest({
    method: 'PUT',
    key: 'audio/user-1/episode-1/final.mp3',
    contentType: 'audio/mpeg',
    body: Buffer.from('mp3'),
    now: new Date('2026-07-23T12:00:00.000Z'),
    config: objectConfig,
  });

  assert.equal(request.url, 'https://account.r2.cloudflarestorage.com/vicpods-audio/audio/user-1/episode-1/final.mp3');
  assert.equal(request.headers['Content-Type'], 'audio/mpeg');
  assert.equal(request.headers['x-amz-date'], '20260723T120000Z');
  assert.ok(request.headers.Authorization.includes('AWS4-HMAC-SHA256 Credential=test-access-key/20260723/auto/s3/aws4_request'));
  assert.ok(request.headers.Authorization.includes('SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date'));
});

test('Phase 10 production env validation protects object storage configuration', () => {
  const originalEnv = { ...process.env };

  try {
    process.env = {
      NODE_ENV: 'production',
      MONGO_URI: 'mongodb://localhost:27017/vicpods',
      SESSION_SECRET: 'x'.repeat(40),
      APP_URL: 'https://app.vicpods.example',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
      SMTP_FROM: 'VicPods <hello@vicpods.example>',
      AUDIO_STORAGE_DRIVER: 'r2',
    };

    const result = validateEnvironment({ isProduction: true });

    assert.ok(result.errors.includes('Object audio storage is enabled but missing: OBJECT_STORAGE_ENDPOINT, OBJECT_STORAGE_BUCKET, OBJECT_STORAGE_ACCESS_KEY_ID, OBJECT_STORAGE_SECRET_ACCESS_KEY.'));
  } finally {
    process.env = originalEnv;
  }
});

test('Phase 10 schemas expose object storage audio support', () => {
  assert.ok(AudioAsset.schema.paths.storageProvider.enumValues.includes('object_storage'));
  assert.equal(MAX_OBJECT_AUDIO_BYTES, 50 * 1024 * 1024);
});

test.after(async () => {
  await mongoose.disconnect().catch(() => {});
});
