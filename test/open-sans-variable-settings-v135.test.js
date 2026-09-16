import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fonts = readFileSync(new URL('../src/styles/fonts.css', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');
const marketplace = readFileSync(new URL('../src/app/pages/MarketplacePage.tsx', import.meta.url), 'utf8');

test('Open Sans uses local delivery without a fixed property-title weight', () => {
  assert.match(fonts, /\.open-sans-property-title \{[\s\S]*font-family: "Open Sans", Arial, sans-serif;[\s\S]*font-optical-sizing: auto;[\s\S]*font-style: normal;[\s\S]*font-variation-settings: "wdth" 100;/);
  assert.doesNotMatch(fonts, /\.open-sans-property-title\s*\{[^}]*font-weight:/);
  assert.doesNotMatch(fonts, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test('every visible Home and Marketplace property-title surface uses the shared Open Sans class', () => {
  const desktopHomeCard = home.slice(home.indexOf('function DesktopPropertyRailCard'), home.indexOf('\nfunction DesktopPropertyRail('));
  const mobileFeaturedProperties = home.slice(home.indexOf('function MobileFeaturedProperties'), home.indexOf('function MobileVerifiedSurveyors'));
  const marketplaceCard = marketplace.slice(marketplace.indexOf('function ListingCard'), marketplace.indexOf('function DesktopMarketplaceRail'));
  for (const source of [desktopHomeCard, mobileFeaturedProperties, marketplaceCard]) {
    assert.match(source, /className="open-sans-property-title"/);
    assert.match(source, /fontVariationSettings: '"wdth" 100'/);
    assert.doesNotMatch(source, /fontWeight:\s*350/);
  }
});
