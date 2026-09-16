#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

const [vhostPath, domain, includePattern] = process.argv.slice(2);
if (!vhostPath || !domain || !includePattern) {
  fail('Usage: node scripts/ensure-aapanel-vhost-include.js <vhost-file> <domain> <include-pattern>');
}
if (!fs.existsSync(vhostPath)) fail(`aaPanel vhost does not exist: ${vhostPath}`);

const original = fs.readFileSync(vhostPath, 'utf8');
if (original.includes(includePattern)) {
  console.log(`aaPanel vhost already includes ${includePattern}`);
  process.exit(0);
}

function matchingBrace(text, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
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
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
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

const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const domainPattern = new RegExp(`\\bserver_name\\s+[^;]*\\b${escapedDomain}\\b[^;]*;`, 'i');
const serverPattern = /\bserver\s*\{/g;
const candidates = [];
let match;
while ((match = serverPattern.exec(original)) !== null) {
  const openIndex = original.indexOf('{', match.index);
  const closeIndex = matchingBrace(original, openIndex);
  if (closeIndex < 0) fail(`Unable to parse server block in ${vhostPath}`);
  const block = original.slice(match.index, closeIndex + 1);
  if (!domainPattern.test(block)) continue;

  let score = 0;
  if (/\blisten\s+[^;]*443\b/i.test(block)) score += 100;
  if (/\bssl\b/i.test(block)) score += 40;
  if (/\broot\s+[^;]+;/i.test(block)) score += 25;
  if (/\blocation\s+[=~^*\s]*\//i.test(block)) score += 20;
  if (/\breturn\s+30[1278]\b/i.test(block) && !/\broot\s+[^;]+;/i.test(block)) score -= 100;
  candidates.push({ openIndex, closeIndex, block, score });
}

if (candidates.length === 0) {
  fail(`No server block for ${domain} was found in ${vhostPath}`);
}

candidates.sort((a, b) => b.score - a.score);
const selected = candidates[0];
if (selected.score < 0 && candidates.length > 1) {
  fail(`Only redirect-only server blocks were found for ${domain} in ${vhostPath}`);
}

const lineStart = original.lastIndexOf('\n', selected.closeIndex) + 1;
const closingIndent = original.slice(lineStart, selected.closeIndex).match(/^\s*/)?.[0] ?? '';
const directiveIndent = `${closingIndent}    `;
const managedBlock = [
  '',
  `${directiveIndent}# SecureAsset managed aaPanel proxy include`,
  `${directiveIndent}include ${includePattern};`,
].join('\n');

const updated = `${original.slice(0, selected.closeIndex)}${managedBlock}\n${closingIndent}${original.slice(selected.closeIndex)}`;
const temporary = `${vhostPath}.secureasset-tmp-${process.pid}`;
fs.writeFileSync(temporary, updated, { mode: fs.statSync(vhostPath).mode });
fs.renameSync(temporary, vhostPath);
console.log(`Inserted SecureAsset include into ${path.resolve(vhostPath)} for ${domain}`);
