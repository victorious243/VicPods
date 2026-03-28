function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function getBaseDomain() {
  try {
    const parsed = new URL(String(process.env.APP_URL || '').trim());
    return String(parsed.hostname || '').replace(/^www\./i, '').trim().toLowerCase();
  } catch (_error) {
    return '';
  }
}

function deriveEmail(localPart, baseDomain) {
  if (!baseDomain) {
    return '';
  }

  return `${String(localPart || '').trim().toLowerCase()}@${baseDomain}`;
}

function splitAddress(value) {
  return String(value || '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
}

function getLegalProfile() {
  const baseDomain = getBaseDomain();
  const controllerName = String(process.env.LEGAL_ENTITY_NAME || '').trim() || 'VicPods';
  const tradingName = String(process.env.LEGAL_TRADING_NAME || '').trim() || 'VicPods';
  const controllerCountry = String(process.env.LEGAL_COUNTRY || '').trim() || 'Ireland';
  const controllerAddressLines = splitAddress(process.env.LEGAL_ADDRESS);
  const privacyEmail = normalizeEmail(process.env.PRIVACY_CONTACT_EMAIL) || deriveEmail('privacy', baseDomain);
  const supportEmail = normalizeEmail(process.env.SUPPORT_CONTACT_EMAIL) || deriveEmail('hello', baseDomain);
  const legalEmail = normalizeEmail(process.env.LEGAL_CONTACT_EMAIL) || deriveEmail('legal', baseDomain) || privacyEmail;
  const controllerIdentity = controllerName === tradingName
    ? controllerName
    : `${controllerName} trading as ${tradingName}`;

  return {
    controllerName,
    tradingName,
    controllerIdentity,
    controllerCountry,
    controllerAddressLines,
    privacyEmail,
    supportEmail,
    legalEmail,
    supportPath: '/help',
    dataRightsPath: '/data-rights',
    isConfigured: Boolean(String(process.env.LEGAL_ENTITY_NAME || '').trim() && privacyEmail),
  };
}

module.exports = {
  getLegalProfile,
};
