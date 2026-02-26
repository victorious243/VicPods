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

function run() {
  const payload = querystring.stringify({
    code: 'vicpods_diagnostic_fake_code',
    client_id: requireEnv('GOOGLE_OIDC_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_OIDC_CLIENT_SECRET'),
    redirect_uri: requireEnv('GOOGLE_OIDC_REDIRECT_URI'),
    grant_type: 'authorization_code',
  });

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
      console.log(`status=${response.statusCode}`);
      // eslint-disable-next-line no-console
      console.log(body);
      process.exit(response.statusCode === 400 ? 0 : 1);
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
