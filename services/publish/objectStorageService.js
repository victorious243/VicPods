const crypto = require('crypto');
const { AppError } = require('../../utils/errors');

const OBJECT_STORAGE_PREFIX = 'object-storage/';

function compact(value) {
  return String(value || '').trim();
}

function objectStorageEnabled() {
  const driver = compact(process.env.AUDIO_STORAGE_DRIVER).toLowerCase();
  return ['object', 'object_storage', 's3', 'r2'].includes(driver);
}

function encodePathSegment(value) {
  return encodeURIComponent(value).replace(/%2F/g, '/');
}

function normalizeObjectKey(key) {
  return compact(key)
    .replace(/^\/+/, '')
    .replace(/^object-storage\//, '')
    .replace(/\\/g, '/');
}

function buildObjectStorageKey(key) {
  return OBJECT_STORAGE_PREFIX + normalizeObjectKey(key);
}

function getObjectStorageConfig() {
  const endpoint = compact(process.env.OBJECT_STORAGE_ENDPOINT || process.env.S3_ENDPOINT || process.env.R2_ENDPOINT).replace(/\/+$/, '');
  const bucket = compact(process.env.OBJECT_STORAGE_BUCKET || process.env.S3_BUCKET || process.env.R2_BUCKET);
  const region = compact(process.env.OBJECT_STORAGE_REGION || process.env.AWS_REGION || 'auto') || 'auto';
  const accessKeyId = compact(process.env.OBJECT_STORAGE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = compact(process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY);
  const publicBaseUrl = compact(process.env.OBJECT_STORAGE_PUBLIC_BASE_URL || process.env.AUDIO_PUBLIC_BASE_URL).replace(/\/+$/, '');

  return {
    endpoint,
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  };
}

function validateObjectStorageConfig(config = getObjectStorageConfig()) {
  const missing = [];
  ['endpoint', 'bucket', 'accessKeyId', 'secretAccessKey'].forEach((key) => {
    if (!config[key]) {
      missing.push(key);
    }
  });

  if (missing.length) {
    throw new AppError('Object audio storage is missing: ' + missing.join(', ') + '.', 500);
  }

  try {
    // eslint-disable-next-line no-new
    new URL(config.endpoint);
  } catch (_error) {
    throw new AppError('OBJECT_STORAGE_ENDPOINT must be a valid URL.', 500);
  }

  return config;
}

function buildObjectUrl(key, config = getObjectStorageConfig()) {
  const normalizedKey = normalizeObjectKey(key);
  if (config.publicBaseUrl) {
    return config.publicBaseUrl + '/' + encodePathSegment(normalizedKey);
  }

  const endpoint = compact(config.endpoint).replace(/\/+$/, '');
  if (!endpoint || !config.bucket) {
    return '';
  }

  return endpoint + '/' + encodeURIComponent(config.bucket) + '/' + encodePathSegment(normalizedKey);
}

function hashHex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding);
}

function getSigningKey({ secretAccessKey, dateStamp, region }) {
  const kDate = hmac('AWS4' + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, region || 'auto');
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

function formatAmzDate(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function buildSignedObjectRequest({
  method,
  key,
  contentType = 'application/octet-stream',
  body = Buffer.alloc(0),
  now = new Date(),
  config = validateObjectStorageConfig(),
}) {
  const normalizedKey = normalizeObjectKey(key);
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hashHex(body);
  const endpointUrl = new URL(config.endpoint);
  const canonicalUri = '/' + encodeURIComponent(config.bucket) + '/' + encodePathSegment(normalizedKey);
  const url = endpointUrl.origin + canonicalUri;
  const host = endpointUrl.host;
  const canonicalHeaders = [
    'content-type:' + contentType,
    'host:' + host,
    'x-amz-content-sha256:' + payloadHash,
    'x-amz-date:' + amzDate,
  ].join('\n') + '\n';
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = [dateStamp, config.region || 'auto', 's3', 'aws4_request'].join('/');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hashHex(canonicalRequest),
  ].join('\n');
  const signature = hmac(getSigningKey({
    secretAccessKey: config.secretAccessKey,
    dateStamp,
    region: config.region,
  }), stringToSign, 'hex');

  return {
    url,
    body,
    headers: {
      Authorization: [
        'AWS4-HMAC-SHA256 Credential=' + config.accessKeyId + '/' + credentialScope,
        'SignedHeaders=' + signedHeaders,
        'Signature=' + signature,
      ].join(', '),
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
  };
}

async function putObjectBuffer({ key, buffer, contentType }) {
  const request = buildSignedObjectRequest({
    method: 'PUT',
    key,
    body: buffer,
    contentType,
  });
  const response = await fetch(request.url, {
    method: 'PUT',
    headers: request.headers,
    body: buffer,
  });

  if (!response.ok) {
    throw new AppError('Object audio upload failed with status ' + response.status + '.', 502);
  }

  return {
    storageProvider: 'object_storage',
    storageKey: buildObjectStorageKey(key),
    publicUrl: buildObjectUrl(key),
  };
}

async function deleteObject(key) {
  const request = buildSignedObjectRequest({
    method: 'DELETE',
    key,
    contentType: 'application/octet-stream',
  });
  const response = await fetch(request.url, {
    method: 'DELETE',
    headers: request.headers,
  });

  if (!response.ok && response.status !== 404) {
    throw new AppError('Object audio delete failed with status ' + response.status + '.', 502);
  }
}

async function fetchObjectBuffer(key) {
  const request = buildSignedObjectRequest({
    method: 'GET',
    key,
    contentType: 'application/octet-stream',
  });
  const response = await fetch(request.url, {
    method: 'GET',
    headers: request.headers,
  });

  if (!response.ok) {
    throw new AppError('Object audio read failed with status ' + response.status + '.', 502);
  }

  return Buffer.from(await response.arrayBuffer());
}

module.exports = {
  OBJECT_STORAGE_PREFIX,
  buildObjectStorageKey,
  buildObjectUrl,
  buildSignedObjectRequest,
  deleteObject,
  fetchObjectBuffer,
  getObjectStorageConfig,
  normalizeObjectKey,
  objectStorageEnabled,
  putObjectBuffer,
  validateObjectStorageConfig,
};
