import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const home = readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');
const marketplace = readFileSync(new URL('../src/app/pages/MarketplacePage.tsx', import.meta.url), 'utf8');
const fonts = readFileSync(new URL('../src/styles/fonts.css', import.meta.url), 'utf8');
const desktopHomeStart = home.indexOf('function DesktopPropertyRailCard');
const desktopHomeCard = home.slice(desktopHomeStart, home.indexOf('\nfunction DesktopPropertyRail(', desktopHomeStart));
const mobileFeaturedProperties = home.slice(home.indexOf('function MobileFeaturedProperties'), home.indexOf('function MobileVerifiedSurveyors'));
const marketplaceCard = marketplace.slice(marketplace.indexOf('function ListingCard'), marketplace.indexOf('function DesktopMarketplaceRail'));

test('legacy v132 title check remains compatible with local Open Sans delivery', () => {
  assert.match(fonts, /font-family: "Open Sans", Arial, sans-serif;/);
  assert.doesNotMatch(fonts, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test('legacy v132 title check accepts the current Open Sans default weight', () => {
  for (const source of [desktopHomeCard, mobileFeaturedProperties, marketplaceCard]) {
    assert.match(source, /className="open-sans-property-title"/);
    assert.doesNotMatch(source, /fontWeight:\s*350/);
  }
});
