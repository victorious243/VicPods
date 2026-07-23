const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { buildAbsoluteUrl } = require('../seo/siteSeoService');
const { AppError } = require('../../utils/errors');
const {
  OBJECT_STORAGE_PREFIX,
  buildObjectStorageKey,
  buildObjectUrl,
  deleteObject,
  fetchObjectBuffer,
  normalizeObjectKey,
  objectStorageEnabled,
  putObjectBuffer,
} = require('./objectStorageService');

const AUDIO_ROOT = path.join(process.cwd(), 'public', 'uploads', 'audio');
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_OBJECT_AUDIO_BYTES = Number.parseInt(process.env.MAX_OBJECT_AUDIO_BYTES || String(MAX_AUDIO_BYTES), 10);
const ALLOWED_AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3']);

function cleanFilename(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

function normalizeStorageKey(storageKey) {
  return String(storageKey || '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/');
}

function buildPublicAudioPath(storageKey) {
  const normalized = normalizeStorageKey(storageKey);
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  if (normalized.startsWith(OBJECT_STORAGE_PREFIX)) {
    return buildObjectUrl(normalized);
  }
  return normalized ? `/${normalized}` : '';
}

function buildPublicAudioUrl(assetOrStorageKey, baseUrl) {
  const storageKey = typeof assetOrStorageKey === 'string'
    ? assetOrStorageKey
    : assetOrStorageKey?.storageKey;
  const publicPath = buildPublicAudioPath(storageKey);
  if (/^https?:\/\//i.test(publicPath)) {
    return publicPath;
  }
  return publicPath ? buildAbsoluteUrl(publicPath, baseUrl) : '';
}

function buildStoredAudioAbsolutePath(storageKey) {
  const normalized = normalizeStorageKey(storageKey);

  if (normalized.startsWith(OBJECT_STORAGE_PREFIX)) {
    throw new AppError('Object audio assets do not have a local filesystem path.', 400);
  }

  if (/^https?:\/\//i.test(normalized)) {
    throw new AppError('Remote audio assets do not have a local filesystem path.', 400);
  }

  if (!normalized.startsWith('uploads/audio/')) {
    throw new AppError('Audio storage key must stay inside uploads/audio.', 400);
  }

  return path.join(process.cwd(), 'public', normalized);
}

function parseAudioDataUrl(audioDataUrl) {
  const match = String(audioDataUrl || '').match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new AppError('Invalid audio upload payload.', 400);
  }

  return {
    mimeType: match[1].toLowerCase(),
    base64Payload: match[2],
  };
}

async function storeEpisodeAudioFile({
  userId,
  episodeId,
  originalFilename,
  mimeType,
  audioDataUrl,
}) {
  const parsedPayload = parseAudioDataUrl(audioDataUrl);
  const normalizedMimeType = String(mimeType || parsedPayload.mimeType || '').toLowerCase();

  if (!ALLOWED_AUDIO_TYPES.has(normalizedMimeType) && !ALLOWED_AUDIO_TYPES.has(parsedPayload.mimeType)) {
    throw new AppError('Only MP3 uploads are supported right now.', 400);
  }

  const buffer = Buffer.from(parsedPayload.base64Payload, 'base64');

  if (!buffer.length) {
    throw new AppError('Uploaded audio file is empty.', 400);
  }

  const maxAudioBytes = objectStorageEnabled() ? MAX_OBJECT_AUDIO_BYTES : MAX_AUDIO_BYTES;
  if (buffer.byteLength > maxAudioBytes) {
    throw new AppError('MP3 uploads are limited to ' + Math.round(maxAudioBytes / (1024 * 1024)) + ' MB for this hosting plan.', 400);
  }

  const safeBaseName = cleanFilename(originalFilename).replace(/\.mp3$/i, '') || 'episode-audio';
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeBaseName}.mp3`;
  const objectKey = path.posix.join('audio', String(userId), String(episodeId), fileName);

  if (objectStorageEnabled()) {
    const storedObject = await putObjectBuffer({
      key: objectKey,
      buffer,
      contentType: 'audio/mpeg',
    });

    return {
      storageProvider: storedObject.storageProvider,
      storageKey: storedObject.storageKey,
      mimeType: 'audio/mpeg',
      byteSize: buffer.byteLength,
      originalFilename: cleanFilename(originalFilename) || fileName,
      processedAt: new Date(),
    };
  }

  const folderPath = path.join(AUDIO_ROOT, String(userId), String(episodeId));
  const absolutePath = path.join(folderPath, fileName);
  const storageKey = path.posix.join('uploads', 'audio', String(userId), String(episodeId), fileName);

  await fs.mkdir(folderPath, { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return {
    storageProvider: 'local_public',
    storageKey,
    mimeType: 'audio/mpeg',
    byteSize: buffer.byteLength,
    originalFilename: cleanFilename(originalFilename) || fileName,
    processedAt: new Date(),
  };
}

async function removeStoredAudioFile(storageKey) {
  const normalized = normalizeStorageKey(storageKey);

  if (normalized.startsWith(OBJECT_STORAGE_PREFIX)) {
    await deleteObject(normalizeObjectKey(normalized));
    return;
  }

  if (!normalized.startsWith('uploads/audio/')) {
    return;
  }

  const absolutePath = buildStoredAudioAbsolutePath(normalized);

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function readStoredAudioBuffer(storageKey) {
  const normalized = normalizeStorageKey(storageKey);

  if (normalized.startsWith(OBJECT_STORAGE_PREFIX)) {
    return fetchObjectBuffer(normalizeObjectKey(normalized));
  }

  return fs.readFile(buildStoredAudioAbsolutePath(normalized));
}

module.exports = {
  MAX_AUDIO_BYTES,
  MAX_OBJECT_AUDIO_BYTES,
  buildStoredAudioAbsolutePath,
  buildPublicAudioPath,
  buildPublicAudioUrl,
  readStoredAudioBuffer,
  removeStoredAudioFile,
  storeEpisodeAudioFile,
};
