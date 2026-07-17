function buildRequestBaseUrl(req) {
  if (!req) {
    return '';
  }

  const forwardedProto = String(req.get('x-forwarded-proto') || '')
    .split(',')[0]
    .trim();
  const forwardedHost = String(req.get('x-forwarded-host') || '')
    .split(',')[0]
    .trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = forwardedHost || String(req.get('host') || '').trim();

  if (!host) {
    return '';
  }

  return `${protocol}://${host}`.replace(/\/+$/, '');
}

module.exports = {
  buildRequestBaseUrl,
};
