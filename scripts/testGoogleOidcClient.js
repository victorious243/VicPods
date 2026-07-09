require('dotenv').config({ quiet: true });

const https = require('https');
const querystring = require('querystring');

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function getOptionalEnv(name) {
  return String(process.env[name] || '').trim();
}

function run() {
  const payloadFields = {
    code: 'vicpods_diagnostic_fake_code',
    client_id: requireEnv('GOOGLE_OIDC_CLIENT_ID'),
    redirect_uri: requireEnv('GOOGLE_OIDC_REDIRECT_URI'),
    grant_type: 'authorization_code',
  };
  const clientSecret = getOptionalEnv('GOOGLE_OIDC_CLIENT_SECRET');
  if (clientSecret) {
    payloadFields.client_secret = clientSecret;
  } else {
    payloadFields.code_verifier = 'vicpods-diagnostic-code-verifier-vicpods-diagnostic-code-verifier';
  }

  const payload = querystring.stringify(payloadFields);

  const request = https.request({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, (response) => {
    let body = '';
    response.on('data', (chunk) => {
      body += chunk;
    });
    response.on('end', () => {
      // eslint-disable-next-line no-console
      console.log(`client_auth=${clientSecret ? 'client_secret' : 'pkce_public'}`);
      // eslint-disable-next-line no-console
      console.log(`status=${response.statusCode}`);
      // eslint-disable-next-line no-console
      console.log(body);
      process.exit(response.statusCode === 400 || response.statusCode === 401 ? 0 : 1);
    });
  });

  request.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error(`Google OIDC diagnostic failed: ${error.message}`);
    process.exit(1);
  });

  request.write(payload);
  request.end();
}

try {
  run();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(error.message);
  process.exit(1);
}
