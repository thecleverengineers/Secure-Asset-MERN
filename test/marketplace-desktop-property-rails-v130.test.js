import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const marketplace = readFileSync(new URL('../src/app/pages/MarketplacePage.tsx', import.meta.url), 'utf8');
const desktopRail = marketplace.slice(marketplace.indexOf('function DesktopMarketplaceRail'), marketplace.indexOf('function MobileListingRail'));

test('desktop marketplace exposes the three requested property rails', () => {
  assert.match(marketplace, /title="Featured properties"/);
  assert.match(marketplace, /title="Verified properties"/);
  assert.match(marketplace, /title="All available properties"/);
});

test('each desktop marketplace rail has its own arrow-controlled fixed-width scroller', () => {
  assert.match(desktopRail, /const railRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(desktopRail, /ArrowBackRounded/);
  assert.match(desktopRail, /ArrowForwardRounded/);
  assert.match(desktopRail, /scrollBy\(\{ left: direction \* \(DESKTOP_MARKETPLACE_CARD_WIDTH \+ 18\) \* 2, behavior: 'smooth' \}\)/);
  assert.match(desktopRail, /overflowX: 'auto'/);
  assert.match(desktopRail, /scrollSnapType: 'x mandatory'/);
  assert.match(desktopRail, /flex: '0 0 286px'/);
  assert.match(desktopRail, /width: DESKTOP_MARKETPLACE_CARD_WIDTH/);
  assert.match(desktopRail, /minWidth: DESKTOP_MARKETPLACE_CARD_WIDTH/);
});
