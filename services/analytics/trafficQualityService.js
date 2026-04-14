const LOCAL_IP_ADDRESSES = new Set([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  'localhost',
]);

const BOT_USER_AGENT_REGEX = /(bot\b|crawler|spider|curl\/|wget\/|python-requests|python-urllib|httpclient|go-http-client|axios\/|node-fetch|headlesschrome|phantomjs|applebot|bingbot|googlebot|slurp|duckduckbot|baiduspider|yandexbot|semrushbot|ahrefsbot|facebookexternalhit|meta-externalagent|zgrab|shodan-pull|visionheight\.com\/scan|cortex-xpanse|palo alto networks)/i;

function normalizeIpAddress(value) {
  return String(value || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
}

function normalizeUserAgent(value) {
  return String(value || '').trim();
}

function isLocalTraffic(ipAddress) {
  return LOCAL_IP_ADDRESSES.has(normalizeIpAddress(ipAddress));
}

function isBotTraffic(userAgent) {
  return BOT_USER_AGENT_REGEX.test(normalizeUserAgent(userAgent));
}

function extractTrafficSignals(req) {
  return {
    ipAddress: normalizeIpAddress(req?.get?.('x-forwarded-for') || req?.get?.('x-real-ip') || req?.ip || ''),
    userAgent: normalizeUserAgent(req?.get?.('user-agent') || ''),
  };
}

function isTrackableHumanTraffic(input) {
  const traffic = input && input.ipAddress !== undefined && input.userAgent !== undefined
    ? input
    : extractTrafficSignals(input);

  return !isLocalTraffic(traffic.ipAddress) && !isBotTraffic(traffic.userAgent);
}

function buildHumanActivityMatch(baseMatch = {}) {
  return {
    $and: [
      baseMatch,
      {
        $nor: [
          { ipAddress: { $in: Array.from(LOCAL_IP_ADDRESSES) } },
          { userAgent: BOT_USER_AGENT_REGEX },
        ],
      },
    ],
  };
}

module.exports = {
  BOT_USER_AGENT_REGEX,
  buildHumanActivityMatch,
  extractTrafficSignals,
  isBotTraffic,
  isLocalTraffic,
  isTrackableHumanTraffic,
};
