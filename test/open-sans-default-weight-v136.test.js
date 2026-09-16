import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fonts = readFileSync(new URL('../src/styles/fonts.css', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');
const marketplace = readFileSync(new URL('../src/app/pages/MarketplacePage.tsx', import.meta.url), 'utf8');

const propertyTitleTag = (source) => {
  const start = source.indexOf('<Typography className="open-sans-property-title"');
  return source.slice(start, source.indexOf('</Typography>', start));
};

test('the shared Open Sans property-title class leaves weight to the component default', () => {
  const start = fonts.indexOf('.open-sans-property-title');
  const propertyTitleClass = fonts.slice(start, fonts.indexOf('}', start));
  assert.match(propertyTitleClass, /font-family: "Open Sans", Arial, sans-serif;/);
  assert.doesNotMatch(propertyTitleClass, /font-weight:/);
});

test('Home and Marketplace property title declarations do not force weight 350', () => {
  const desktopHomeCard = home.slice(home.indexOf('function DesktopPropertyRailCard'), home.indexOf('\nfunction DesktopPropertyRail('));
  const mobileFeaturedProperties = home.slice(home.indexOf('function MobileFeaturedProperties'), home.indexOf('function MobileVerifiedSurveyors'));
  const marketplaceCard = marketplace.slice(marketplace.indexOf('function ListingCard'), marketplace.indexOf('function DesktopMarketplaceRail'));
  for (const source of [desktopHomeCard, mobileFeaturedProperties, marketplaceCard]) {
    const title = propertyTitleTag(source);
    assert.match(title, /fontFamily: '"Open Sans", Arial, sans-serif'/);
    assert.doesNotMatch(title, /fontWeight:/);
  }
});
