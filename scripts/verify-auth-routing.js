import process from 'node:process';
import { headerValue, requestBytes, transportExitCode } from './lib/http-probe.js';

const argumentsList = process.argv.slice(2);
const requestedUrl = argumentsList.find((value) => !value.startsWith('--'));
const connectHost = String(argumentsList.find((value) => value.startsWith('--connect-host=')) || '').replace('--connect-host=', '').trim();
const insecureTls = argumentsList.includes('--insecure-tls');
const baseUrl = String(requestedUrl || `http://127.0.0.1:${process.env.PORT || 5000}`).replace(/\/+$/, '');
if (!/^https?:\/\//i.test(baseUrl)) {
  console.error('Usage: node scripts/verify-auth-routing.js https://your-domain.example [--connect-host=127.0.0.1] [--insecure-tls]');
  // Exit code 2 is reserved for a real transport failure so deployment never
  // mistakes an invalid configured URL for an optional hairpin/DNS warning.
  process.exit(1);
}

async function readPayload(response) {
  const contentType = headerValue(response.headers, 'content-type');
  const text = response.bytes.toString('utf8');
  let payload = text;
  if (contentType.includes('application/json')) {
    try { payload = JSON.parse(text); } catch { throw new Error(`${response.url} declared JSON but returned invalid JSON`); }
  }
  return { contentType, payload, text };
}

async function checkHealth() {
  const response = await requestBytes(`${baseUrl}/api/health/ready`, { headers: { Accept: 'application/json' }, connectHost, insecureTls });
  const { contentType, payload } = await readPayload(response);
  if (response.status < 200 || response.status >= 300 || !contentType.includes('application/json') || payload?.service !== 'secureasset-api') {
    throw new Error(`Health route is not reaching SecureAsset API (${response.status}, ${contentType || 'no content-type'})`);
  }
}

async function checkAuthRoute(path) {
  const response = await requestBytes(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: '{}',
    connectHost,
    insecureTls,
  });
  const { contentType, payload, text } = await readPayload(response);
  if ([301, 302, 307, 308].includes(response.status)) throw new Error(`${path} redirected instead of reaching the API`);
  if ([404, 405, 502, 503, 504].includes(response.status)) throw new Error(`${path} returned HTTP ${response.status}`);
  // aaPanel/WAF rate limiting can answer public API probes before the request
  // reaches Node. A 429 still proves this is an API route, not the SPA shell.
  if (response.status === 429) return;
  if (!contentType.includes('application/json')) {
    const preview = String(text || '').replace(/\s+/g, ' ').slice(0, 120);
    throw new Error(`${path} returned ${contentType || 'non-JSON'} instead of API JSON${preview ? `: ${preview}` : ''}`);
  }
  if (response.status < 400 || response.status >= 500 || payload?.success !== false) {
    throw new Error(`${path} did not return the expected validation response (${response.status})`);
  }
}

try {
  await checkHealth();
  await checkAuthRoute('/api/v1/auth/login');
  await checkAuthRoute('/api/v1/auth/register');
  console.log(`Authentication routing passed: ${baseUrl}`);
} catch (error) {
  console.error(`Authentication routing failed for ${baseUrl}: ${error.message}`);
  process.exit(transportExitCode(error));
}
