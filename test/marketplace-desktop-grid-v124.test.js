import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const marketplace = readFileSync(new URL('../src/app/pages/MarketplacePage.tsx', import.meta.url), 'utf8');

test('desktop marketplace presents fixed-width property cards in slider rails', () => {
  assert.match(marketplace, /const DESKTOP_MARKETPLACE_CARD_WIDTH = 286/);
  assert.match(marketplace, /function DesktopMarketplaceRail/);
  assert.match(marketplace, /scrollBy\(\{ left: direction \* \(DESKTOP_MARKETPLACE_CARD_WIDTH \+ 18\) \* 2, behavior: 'smooth' \}\)/);
  assert.match(marketplace, /gap: '18px'/);
  assert.match(marketplace, /width: compact \? 226 : DESKTOP_MARKETPLACE_CARD_WIDTH/);
  assert.match(marketplace, /minWidth: compact \? 226 : DESKTOP_MARKETPLACE_CARD_WIDTH/);
  assert.match(marketplace, /flex: compact \? '0 0 226px' : '0 0 286px'/);
});

test('marketplace property images have a 16px radius', () => {
  assert.match(marketplace, /<Box sx=\{\{ height: compact \? 172[\s\S]*?borderRadius: '16px' \}\}>/);
  assert.match(marketplace, /style=\{\{ objectFit: 'cover', borderRadius: '16px' \}\}/);
});
