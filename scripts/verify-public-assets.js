import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { headerValue, requestBytes, transportExitCode } from './lib/http-probe.js';

const argumentsList = process.argv.slice(2);
const requestedUrl = argumentsList.find((value) => !value.startsWith('--'));
const connectHost = String(argumentsList.find((value) => value.startsWith('--connect-host=')) || '').replace('--connect-host=', '').trim();
const insecureTls = argumentsList.includes('--insecure-tls');
const baseUrl = String(requestedUrl || process.env.PUBLIC_APP_URL || '').replace(/\/+$/, '');
if (!/^https?:\/\//i.test(baseUrl)) {
  console.error('Usage: node scripts/verify-public-assets.js https://your-domain.example [--connect-host=127.0.0.1] [--insecure-tls]');
  // Exit code 2 is reserved for a real transport failure so deployment never
  // mistakes an invalid configured URL for an optional hairpin/DNS warning.
  process.exit(1);
}

const dist = path.resolve('dist');
const indexPath = path.join(dist, 'index.html');
const indexHtml = await fs.readFile(indexPath, 'utf8');
const indexReferences = [...indexHtml.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map((match) => match[1]);
const releaseToken = crypto.createHash('sha256').update(indexHtml).digest('hex').slice(0, 16);
const releaseFile = path.resolve('RELEASE_ID');
const expectedReleaseId = await fs.readFile(releaseFile, 'utf8').then((value) => value.trim().slice(0, 120)).catch(() => '');
const probeToken = `${releaseToken}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

function probeUrl(pathname) {
  const separator = pathname.includes('?') ? '&' : '?';
  return `${baseUrl}${pathname}${separator}__secureasset_release=${encodeURIComponent(probeToken)}`;
}

function responseDiagnostics(response) {
  const names = ['x-secureasset-frontend-release', 'cache-control', 'etag', 'server'];
  return names.map((name) => `${name}=${headerValue(response.headers, name) || '<missing>'}`).join(', ');
}

async function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function fetchBytes(url, options = {}) {
  const response = await requestBytes(url, {
    headers: {
      Accept: '*/*',
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
      ...(expectedReleaseId ? { 'X-SecureAsset-Release': expectedReleaseId } : {}),
      ...(options.headers || {}),
    },
    connectHost,
    insecureTls,
  });
  return { response, contentType: headerValue(response.headers, 'content-type'), bytes: response.bytes };
}

try {
  const page = await fetchBytes(probeUrl('/login'), { headers: { Accept: 'text/html' } });
  if (page.response.status < 200 || page.response.status >= 300 || !page.contentType.includes('text/html')) {
    throw new Error(`/login did not return HTML (${page.response.status}, ${page.contentType || 'no content-type'})`);
  }
  const publicHtml = page.bytes.toString('utf8');
  if (!publicHtml.includes('<div id="root"></div>')) throw new Error('/login did not return the SecureAsset React entry page');
  const servedReleaseId = headerValue(page.response.headers, 'x-secureasset-frontend-release');
  if (expectedReleaseId && servedReleaseId && servedReleaseId !== expectedReleaseId) {
    throw new Error(`/login is serving release ${servedReleaseId}, expected ${expectedReleaseId} (${responseDiagnostics(page.response)})`);
  }
  for (const reference of indexReferences) {
    if (!publicHtml.includes(reference)) {
      throw new Error(`/login is serving a stale index page that does not reference ${reference} (${responseDiagnostics(page.response)})`);
    }
  }

  const assetDirectory = path.join(dist, 'assets');
  const assetNames = (await fs.readdir(assetDirectory)).filter((name) => /\.(?:js|css)$/i.test(name)).sort();
  if (!assetNames.length) throw new Error('No production JavaScript or CSS assets were found in dist/assets');

  for (const name of assetNames) {
    const local = await fs.readFile(path.join(assetDirectory, name));
    const remote = await fetchBytes(probeUrl(`/assets/${encodeURIComponent(name)}`));
    if (remote.response.status < 200 || remote.response.status >= 300) throw new Error(`/assets/${name} returned HTTP ${remote.response.status}`);
    if (remote.contentType.includes('text/html')) throw new Error(`/assets/${name} returned the React HTML page instead of the asset`);
    if (name.endsWith('.js') && !/(?:javascript|ecmascript)/i.test(remote.contentType)) {
      throw new Error(`/assets/${name} returned an unexpected content type: ${remote.contentType || 'none'}`);
    }
    if (name.endsWith('.css') && !/text\/css/i.test(remote.contentType)) {
      throw new Error(`/assets/${name} returned an unexpected content type: ${remote.contentType || 'none'}`);
    }
    const [localHash, remoteHash] = await Promise.all([sha256(local), sha256(remote.bytes)]);
    if (localHash !== remoteHash) throw new Error(`/assets/${name} does not match the current production build`);
  }

  console.log(`Public frontend assets passed: ${baseUrl} (${assetNames.length} files, current index and chunks verified).`);
} catch (error) {
  console.error(`Public frontend assets failed for ${baseUrl}: ${error.message}`);
  process.exit(transportExitCode(error));
}
