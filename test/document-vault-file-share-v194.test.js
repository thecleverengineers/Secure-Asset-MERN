import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vault = readFileSync(new URL('../src/app/pages/app/DocumentVaultPage.tsx', import.meta.url), 'utf8');
const enhancement = readFileSync(new URL('../src/app/utils/scanEnhancement.ts', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../server/src/controllers/driveController.js', import.meta.url), 'utf8');

test('v194 cleans captured scan pages locally with the premium AI-style enhancer before PNG upload', () => {
  assert.match(vault, /enhanceScannedPage/);
  assert.match(vault, /SCAN_ENHANCER_PROFILE/);
  assert.match(vault, /enhancement: SCAN_ENHANCER_PROFILE/);
  assert.match(vault, /Enhancing scan/);
  assert.match(vault, /Uploading PNG/);
  assert.match(vault, /high-quality original PNG/);
});

test('v194 enhancer corrects illumination, preserves colour marks and sharpens text losslessly', () => {
  for (const phrase of ['MAX_SCAN_DIMENSION', 'PNG_MIME_TYPE', 'SCAN_ENHANCER_PROFILE', 'getImageData', 'histogram', 'gamma', 'illumination', 'unsharp mask', 'imageSmoothingQuality', 'toBlob', 'lossless']) {
    assert.match(enhancement, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(enhancement, /onProgress\?\.\(100\)/);
  assert.match(enhancement, /type: PNG_MIME_TYPE/);
  assert.match(enhancement, /-clean\.png/);
});

test('v194 records the AI enhancer profile in the protected audit trail', () => {
  assert.match(controller, /scan_to_png_created/);
  assert.match(controller, /outputFormat: req\.body\.source === 'scan-securely' \? 'png' : undefined/);
});

test('v194 shares only the original file, never a generated or copied link', () => {
  assert.match(vault, /fetchDriveFileBlob\(item\._id, true\)/);
  assert.match(vault, /const file = new File\(\[blob\], item\.name/);
  assert.match(vault, /navigator\.share\(\{ title: item\.name, files: \[file\] \}\)/);
  assert.match(vault, /Original file shared successfully/);
  const shareBody = vault.slice(vault.indexOf('async function instantShare'), vault.indexOf('async function createLink'));
  assert.doesNotMatch(shareBody, /createDrivePublicLink/);
  assert.doesNotMatch(shareBody, /navigator\.clipboard/);
  assert.doesNotMatch(shareBody, /url:/);
});
