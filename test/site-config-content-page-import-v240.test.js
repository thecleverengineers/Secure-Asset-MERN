import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const controller = readFileSync(new URL('../server/src/controllers/siteController.js', import.meta.url), 'utf8');

test('public site config imports ContentPage used by footer page lookup', () => {
  assert.match(controller, /SiteEnquiry, ContentPage,/);
  assert.match(controller, /ContentPage\.find\(/);
});
