#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

const [vhostPath, domain, rawPort] = process.argv.slice(2);
if (!vhostPath || !domain || !rawPort) {
  fail('Usage: node scripts/reconcile-aapanel-vhost.js <vhost-file> <domain> <port>');
}
if (!fs.existsSync(vhostPath)) fail(`aaPanel vhost does not exist: ${vhostPath}`);
const port = Number(rawPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) fail(`Invalid upstream port: ${rawPort}`);

const original = fs.readFileSync(vhostPath, 'utf8');

function matchingBrace(text, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;

  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '#') {
      lineComment = true;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function findServerBlocks(text) {
  const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const domainPattern = new RegExp(`\\bserver_name\\s+[^;]*\\b${escapedDomain}\\b[^;]*;`, 'i');
  const serverPattern = /\bserver\s*\{/g;
  const candidates = [];
  let match;
  while ((match = serverPattern.exec(text)) !== null) {
    const openIndex = text.indexOf('{', match.index);
    const closeIndex = matchingBrace(text, openIndex);
    if (closeIndex < 0) fail(`Unable to parse server block in ${vhostPath}`);
    const block = text.slice(match.index, closeIndex + 1);
    if (!domainPattern.test(block)) continue;

    let score = 0;
    if (/\blisten\s+[^;]*443\b/i.test(block)) score += 100;
    if (/\bssl\b/i.test(block)) score += 40;
    if (/\broot\s+[^;]+;/i.test(block)) score += 25;
    if (/\blocation\s+[=~^*\s]*\//i.test(block)) score += 20;
    if (/\breturn\s+30[1278]\b/i.test(block) && !/\broot\s+[^;]+;/i.test(block)) score -= 100;
    candidates.push({ startIndex: match.index, openIndex, closeIndex, block, score });
  }
  return candidates.sort((a, b) => b.score - a.score);
}

function scanTopLevelLocations(text, serverOpenIndex, serverCloseIndex) {
  const locations = [];
  let index = serverOpenIndex + 1;
  let depth = 1;
  let quote = null;
  let escaped = false;
  let lineComment = false;

  while (index < serverCloseIndex) {
    const char = text[index];
    const next = text[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      index += 1;
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      index += 1;
      continue;
    }
    if (char === '#') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      index += 1;
      continue;
    }
    if (char === '{') {
      depth += 1;
      index += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      index += 1;
      continue;
    }

    if (depth === 1 && text.startsWith('location', index)) {
      const before = index === 0 ? '' : text[index - 1];
      const after = text[index + 'location'.length] ?? '';
      if ((!before || /\s|[;{}]/.test(before)) && /\s/.test(after)) {
        const braceIndex = text.indexOf('{', index + 'location'.length);
        if (braceIndex < 0 || braceIndex >= serverCloseIndex) fail(`Malformed location block in ${vhostPath}`);
        const closeIndex = matchingBrace(text, braceIndex);
        if (closeIndex < 0 || closeIndex > serverCloseIndex) fail(`Unable to parse location block in ${vhostPath}`);
        const header = text.slice(index, braceIndex).replace(/\s+/g, ' ').trim();
        locations.push({ startIndex: index, openIndex: braceIndex, closeIndex, header });
        index = closeIndex + 1;
        continue;
      }
    }
    index += 1;
  }
  return locations;
}

const managedPaths = ['/api/', '/socket.io/', '/assets/', '/index.html', '/site-assets/', '/uploads/', '/'];
function isManagedLocation(header) {
  if (!header.startsWith('location ')) return false;
  return managedPaths.some((managedPath) => {
    const escaped = managedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(header);
  });
}

const candidates = findServerBlocks(original);
if (candidates.length === 0) fail(`No server block for ${domain} was found in ${vhostPath}`);
const selected = candidates[0];
if (selected.score < 0 && candidates.length > 1) fail(`Only redirect-only server blocks were found for ${domain} in ${vhostPath}`);

let updated = original;
const locations = scanTopLevelLocations(original, selected.openIndex, selected.closeIndex)
  .filter(({ header }) => isManagedLocation(header));

for (const location of [...locations].sort((a, b) => b.startIndex - a.startIndex)) {
  let start = location.startIndex;
  const lineStart = updated.lastIndexOf('\n', start - 1) + 1;
  if (/^\s*$/.test(updated.slice(lineStart, start))) start = lineStart;
  let end = location.closeIndex + 1;
  if (updated[end] === '\r') end += 1;
  if (updated[end] === '\n') end += 1;
  updated = `${updated.slice(0, start)}${updated.slice(end)}`;
}

// Preserve aaPanel extension includes because they may contain unrelated site
// configuration. The deployment script removes only the obsolete
// SecureAsset-owned extension file before validating Nginx.
updated = updated.replace(/^[ \t]*# (?:BEGIN|END) SecureAsset managed proxy locations[ \t]*\r?\n?/gm, '');
updated = updated.replace(/^[ \t]*# Browser routes must also come from the active Node release\. Leaving an\r?\n^[ \t]*# aaPanel try_files location here can serve an old index\.html while \/assets\/\r?\n^[ \t]*# points to the new release\.\r?\n?/gm, '');
updated = updated.replace(/\n(?:[ \t]*\n){2,}/g, '\n\n');

const reparsedCandidates = findServerBlocks(updated);
if (reparsedCandidates.length === 0) fail(`No server block for ${domain} remained after reconciliation`);
const target = reparsedCandidates[0];
const lineStart = updated.lastIndexOf('\n', target.closeIndex) + 1;
const closingIndent = updated.slice(lineStart, target.closeIndex).match(/^\s*/)?.[0] ?? '';
const indent = `${closingIndent}    `;
const block = `${indent}# BEGIN SecureAsset managed proxy locations\n${indent}location ^~ /api/ {\n${indent}    proxy_pass http://127.0.0.1:${port};\n${indent}    proxy_http_version 1.1;\n${indent}    proxy_set_header Host $host;\n${indent}    proxy_set_header X-Real-IP $remote_addr;\n${indent}    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n${indent}    proxy_set_header X-Forwarded-Proto $scheme;\n${indent}    proxy_set_header X-Request-ID $request_id;\n${indent}    proxy_connect_timeout 15s;\n${indent}    proxy_read_timeout 300s;\n${indent}    proxy_send_timeout 300s;\n${indent}    add_header X-SecureAsset-Proxy api always;\n${indent}}\n\n${indent}location /socket.io/ {\n${indent}    proxy_pass http://127.0.0.1:${port};\n${indent}    proxy_http_version 1.1;\n${indent}    proxy_set_header Upgrade $http_upgrade;\n${indent}    proxy_set_header Connection "upgrade";\n${indent}    proxy_set_header Host $host;\n${indent}    proxy_set_header X-Real-IP $remote_addr;\n${indent}    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n${indent}    proxy_set_header X-Forwarded-Proto $scheme;\n${indent}    proxy_read_timeout 3600s;\n${indent}}\n\n${indent}location ^~ /assets/ {\n${indent}    proxy_pass http://127.0.0.1:${port};\n${indent}    proxy_http_version 1.1;\n${indent}    proxy_set_header Host $host;\n${indent}    proxy_set_header X-Forwarded-Proto $scheme;\n${indent}    proxy_intercept_errors off;\n${indent}    expires 1y;\n${indent}    add_header Cache-Control "public, max-age=31536000, immutable" always;\n${indent}    add_header X-SecureAsset-Proxy assets always;\n${indent}}\n\n${indent}location = /index.html {\n${indent}    proxy_pass http://127.0.0.1:${port};\n${indent}    proxy_http_version 1.1;\n${indent}    proxy_set_header Host $host;\n${indent}    proxy_set_header X-Forwarded-Proto $scheme;\n${indent}    expires -1;\n${indent}    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;\n${indent}}\n\n${indent}location ^~ /site-assets/ {\n${indent}    proxy_pass http://127.0.0.1:${port};\n${indent}    proxy_set_header Host $host;\n${indent}    proxy_set_header X-Real-IP $remote_addr;\n${indent}    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n${indent}    proxy_set_header X-Forwarded-Proto $scheme;\n${indent}}\n\n${indent}location ^~ /uploads/ {\n${indent}    proxy_pass http://127.0.0.1:${port};\n${indent}    proxy_set_header Host $host;\n${indent}    proxy_set_header X-Real-IP $remote_addr;\n${indent}    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n${indent}    proxy_set_header X-Forwarded-Proto $scheme;\n${indent}}\n\n${indent}location / {\n${indent}    # Browser routes must also come from the active Node release.\n${indent}    # An aaPanel try_files location can serve a stale index.html.\n${indent}    proxy_pass http://127.0.0.1:${port};\n${indent}    proxy_http_version 1.1;\n${indent}    proxy_set_header Host $host;\n${indent}    proxy_set_header X-Real-IP $remote_addr;\n${indent}    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n${indent}    proxy_set_header X-Forwarded-Proto $scheme;\n${indent}    proxy_set_header X-Request-ID $request_id;\n${indent}    proxy_intercept_errors off;\n${indent}    proxy_cache off;\n${indent}    proxy_no_cache 1;\n${indent}    proxy_cache_bypass 1;\n${indent}    expires -1;\n${indent}    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;\n${indent}    add_header X-SecureAsset-Proxy app always;\n${indent}}\n${indent}# END SecureAsset managed proxy locations\n`;

// Browser HTML is release-specific. Apply the same cache-bypass policy to
// both /index.html and the catch-all browser-route proxy generated above.
const htmlCacheNeedle = `${indent}    expires -1;\n${indent}    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;`;
const htmlCachePolicy = `${indent}    proxy_cache off;\n${indent}    proxy_no_cache 1;\n${indent}    proxy_cache_bypass 1;\n${indent}    proxy_hide_header Cache-Control;\n${indent}    expires -1;\n${indent}    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;\n${indent}    add_header X-Accel-Expires "0" always;`;
const cacheBaseBlock = block
  .replaceAll(`${indent}    proxy_cache off;\n${indent}    proxy_no_cache 1;\n${indent}    proxy_cache_bypass 1;\n`, '');
const cacheSafeBlock = cacheBaseBlock.replaceAll(htmlCacheNeedle, htmlCachePolicy);
if (cacheSafeBlock === block) fail('Unable to apply the no-store browser-route policy to the generated SecureAsset vhost.');
const beforeClosingBrace = updated.slice(0, target.closeIndex).replace(/[ \t\r\n]+$/, '');
const finalContent = `${beforeClosingBrace}\n\n${cacheSafeBlock}${closingIndent}${updated.slice(target.closeIndex)}`;
const finalCandidates = findServerBlocks(finalContent);
const finalTarget = finalCandidates[0];
const finalLocations = scanTopLevelLocations(finalContent, finalTarget.openIndex, finalTarget.closeIndex);
for (const managedPath of managedPaths) {
  const matches = finalLocations.filter(({ header }) => {
    const escaped = managedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(header);
  });
  if (matches.length !== 1) fail(`Expected exactly one ${managedPath} location after reconciliation, found ${matches.length}`);
}

const temporary = `${vhostPath}.secureasset-tmp-${process.pid}`;
fs.writeFileSync(temporary, finalContent, { mode: fs.statSync(vhostPath).mode });
fs.renameSync(temporary, vhostPath);
console.log(`Reconciled SecureAsset proxy locations directly in ${path.resolve(vhostPath)} for ${domain}`);
console.log(`Removed ${locations.length} conflicting managed location block(s).`);
