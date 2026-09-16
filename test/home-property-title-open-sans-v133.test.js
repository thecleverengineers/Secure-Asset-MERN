import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const home = readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');
const marketplace = readFileSync(new URL('../src/app/pages/MarketplacePage.tsx', import.meta.url), 'utf8');
const fonts = readFileSync(new URL('../src/styles/fonts.css', import.meta.url), 'utf8');
const desktopHomeCardStart = home.indexOf('function DesktopPropertyRailCard');
const desktopHomeCard = home.slice(desktopHomeCardStart, home.indexOf('\nfunction DesktopPropertyRail(', desktopHomeCardStart));
const mobileFeaturedProperties = home.slice(home.indexOf('function MobileFeaturedProperties'), home.indexOf('function MobileVerifiedSurveyors'));
const desktopHome = home.slice(home.indexOf('export function Home()'), home.indexOf('const mobileCoreFeatures'));
const marketplaceCard = marketplace.slice(marketplace.indexOf('function ListingCard'), marketplace.indexOf('function DesktopMarketplaceRail'));

test('Open Sans property titles use local stylesheet delivery without a forced weight', () => {
  assert.match(fonts, /\.open-sans-property-title \{/);
  assert.match(fonts, /font-family: "Open Sans", Arial, sans-serif;/);
  assert.match(fonts, /font-optical-sizing: auto;/);
  assert.match(fonts, /font-variation-settings: "wdth" 100;/);
  assert.doesNotMatch(fonts, /\.open-sans-property-title\s*\{[^}]*font-weight:/);
  assert.doesNotMatch(fonts, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test('Home featured property titles use Open Sans without a fixed weight', () => {
  assert.match(desktopHomeCard, /className="open-sans-property-title"/);
  assert.match(desktopHomeCard, /fontFamily: '"Open Sans", Arial, sans-serif', fontOpticalSizing: 'auto', fontSize: 14, fontStyle: 'normal'/);
  assert.match(mobileFeaturedProperties, /className="open-sans-property-title"/);
  assert.match(mobileFeaturedProperties, /fontFamily: '"Open Sans", Arial, sans-serif', fontOpticalSizing: 'auto', fontSize: 11\.5, fontStyle: 'normal'/);
  assert.doesNotMatch(desktopHomeCard, /fontWeight:\s*350/);
  assert.doesNotMatch(mobileFeaturedProperties, /fontWeight:\s*350/);
});

test('Marketplace property titles use Open Sans without a fixed weight', () => {
  assert.match(marketplaceCard, /className="open-sans-property-title"/);
  assert.match(marketplaceCard, /fontFamily: '"Open Sans", Arial, sans-serif', fontOpticalSizing: 'auto', fontStyle: 'normal'/);
  assert.doesNotMatch(marketplaceCard, /fontWeight:\s*350/);
});

test('Home keeps only the featured property rail', () => {
  assert.match(desktopHome, /<DesktopPropertyRail title="Featured properties"/);
  assert.doesNotMatch(desktopHome, /<DesktopPropertyRail title="Verified properties"/);
  assert.doesNotMatch(desktopHome, /<DesktopPropertyRail title="All available properties"/);
  assert.doesNotMatch(desktopHome, /home-desktop-verified-properties/);
});
