import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const home = readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');

test('desktop home retains an arrow-slide featured property rail', () => {
  assert.match(home, /function DesktopPropertyRail\(/);
  assert.match(home, /title="Featured properties"/);
  assert.match(home, /ArrowBackRounded/);
  assert.match(home, /ArrowForwardRounded/);
  assert.match(home, /scrollBy\(\{ left: direction \* \(DESKTOP_PROPERTY_CARD_WIDTH \+ 18\) \* 2, behavior: 'smooth' \}\)/);
});

test('desktop property rail cards never shrink to fit the viewport', () => {
  assert.match(home, /const DESKTOP_PROPERTY_CARD_WIDTH = 286/);
  assert.match(home, /flex: `0 0 \$\{DESKTOP_PROPERTY_CARD_WIDTH\}px`/);
  assert.match(home, /minWidth: DESKTOP_PROPERTY_CARD_WIDTH/);
  assert.match(home, /sizes="286px"/);
  assert.match(home, /borderRadius: '16px'/);
});
