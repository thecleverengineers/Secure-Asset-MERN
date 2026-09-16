import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { resolveServerSession, sessionBootstrap } from '../services/serverSession.js';
import { hydrateTenantCapabilities } from './auth.js';

const RESERVED_PREFIXES = ['/api', '/socket.io', '/site-assets', '/uploads', '/assets', '/fonts'];
const FILE_EXTENSION = /\.[a-z0-9]{1,12}$/i;

export function isSpaNavigationRequest(req) {
  if (!['GET', 'HEAD'].includes(req.method)) return false;
  const requestPath = req.path || '/';
  if (RESERVED_PREFIXES.some((prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`))) return false;
  if (FILE_EXTENSION.test(requestPath.split('/').pop() || '')) return false;
  return Boolean(req.accepts('html'));
}

export function mountProductionSpa(app, distDirectory) {
  const indexFile = path.join(distDirectory, 'index.html');
  if (!fs.existsSync(indexFile)) return false;
  const releaseFile = path.resolve('RELEASE_ID');
  const releaseId = fs.existsSync(releaseFile) ? fs.readFileSync(releaseFile, 'utf8').trim().slice(0, 120) : '';
  const markHtmlResponse = (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    // HTML contains release-specific chunk names. Keep the direct origin from
    // retaining an older shell after PM2 has activated a new release.
    res.setHeader('X-Accel-Expires', '0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Vary', 'Cookie');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (releaseId) res.setHeader('X-SecureAsset-Frontend-Release', releaseId);
  };

  app.use(express.static(distDirectory, {
    index: false,
    etag: true,
    fallthrough: true,
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`) || filePath.includes(`${path.sep}fonts${path.sep}`)) {
        // Hashed Vite assets and versioned self-hosted fonts can be retained
        // for a year. HTML remains explicitly uncached below.
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (path.basename(filePath).toLowerCase() === 'index.html') {
        // The HTML entry point contains release-specific chunk names. It must
        // never be cached like a fingerprinted JavaScript or CSS asset.
        markHtmlResponse(res);
      }
    },
  }));

  app.get('/{*splat}', (req, res, next) => {
    if (!isSpaNavigationRequest(req)) return next();
    markHtmlResponse(res);
    return (async () => {
      // The application shell is personalized only at the HTML boundary.
      // Fingerprinted JS/CSS remains immutable-cacheable, while this response
      // is private and carries no bearer or refresh credential.
      let bootstrap = { authenticated: false, user: null };
      const session = await resolveServerSession(req, res, { renew: true, allowLegacy: true });
      if (session?.user) {
        const user = await hydrateTenantCapabilities(session.user);
        bootstrap = sessionBootstrap({ ...session, user });
      }
      const serialized = JSON.stringify(bootstrap)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
      const payload = `<script id="secureasset-session-bootstrap" type="application/json">${serialized}</script>`;
      // dist is an atomic symlink. Read it for each HTML navigation instead of
      // capturing the template at boot so a valid in-process release cannot
      // ever advertise a chunk from a previous frontend build.
      const indexTemplate = fs.readFileSync(indexFile, 'utf8');
      const html = indexTemplate.includes('</head>')
        ? indexTemplate.replace('</head>', `${payload}</head>`)
        : `${payload}${indexTemplate}`;
      return res.type('html').send(html);
    })().catch(next);
  });
  return true;
}
