const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { buildAbsoluteUrl } = require('../seo/siteSeoService');
const { AppError } = require('../../utils/errors');

const COVER_ROOT = path.join(process.cwd(), 'public', 'uploads', 'covers');
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ALLOWED_COVER_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function normalizeStorageKey(storageKey) {
  return String(storageKey || '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/');
}

function buildPublicCoverPath(storageKey) {
  const normalized = normalizeStorageKey(storageKey);
  return normalized ? '/' + normalized : '';
}

function buildPublicCoverUrl(storageKey, baseUrl) {
  const publicPath = buildPublicCoverPath(storageKey);
  return publicPath ? buildAbsoluteUrl(publicPath, baseUrl) : '';
}

function parseCoverDataUrl(coverDataUrl) {
  const match = String(coverDataUrl || '').match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new AppError('Invalid cover artwork upload payload.', 400);
  }

  return {
    mimeType: match[1].toLowerCase(),
    base64Payload: match[2],
  };
}

async function storeShowCoverFile({ userId, showId, coverDataUrl }) {
  const parsedPayload = parseCoverDataUrl(coverDataUrl);
  const extension = ALLOWED_COVER_TYPES.get(parsedPayload.mimeType);

  if (!extension) {
    throw new AppError('Cover artwork must be a JPG, PNG, or WebP image.', 400);
  }

  const buffer = Buffer.from(parsedPayload.base64Payload, 'base64');

  if (!buffer.length) {
    throw new AppError('Cover artwork file is empty.', 400);
  }

  if (buffer.byteLength > MAX_COVER_BYTES) {
    throw new AppError('Cover artwork uploads are limited to 5 MB.', 400);
  }

  const folderPath = path.join(COVER_ROOT, String(userId), String(showId));
  const fileName = Date.now() + '-' + crypto.randomBytes(6).toString('hex') + '.cover.' + extension;
  const absolutePath = path.join(folderPath, fileName);
  const storageKey = path.posix.join('uploads', 'covers', String(userId), String(showId), fileName);

  await fs.mkdir(folderPath, { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return {
    storageKey,
    publicPath: buildPublicCoverPath(storageKey),
  };
}

module.exports = {
  MAX_COVER_BYTES,
  buildPublicCoverPath,
  buildPublicCoverUrl,
  storeShowCoverFile,
};
