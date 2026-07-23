const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { buildAbsoluteUrl } = require('../seo/siteSeoService');
const { AppError } = require('../../utils/errors');

const AUDIO_ROOT = path.join(process.cwd(), 'public', 'uploads', 'audio');
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
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

  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    throw new AppError('MP3 uploads are limited to 50 MB for this first hosted build.', 400);
  }

  const safeBaseName = cleanFilename(originalFilename).replace(/\.mp3$/i, '') || 'episode-audio';
  const folderPath = path.join(AUDIO_ROOT, String(userId), String(episodeId));
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeBaseName}.mp3`;
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

module.exports = {
  MAX_AUDIO_BYTES,
  buildStoredAudioAbsolutePath,
  buildPublicAudioPath,
  buildPublicAudioUrl,
  removeStoredAudioFile,
  storeEpisodeAudioFile,
};
