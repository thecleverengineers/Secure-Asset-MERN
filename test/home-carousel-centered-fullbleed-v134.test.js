import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const home = readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');
const desktopCarousel = home.slice(home.indexOf('function DesktopHomeCarousel'), home.indexOf('function DesktopPropertyRailCard'));
const mobileCarousel = home.slice(home.indexOf('function MobileHomeCarousel'), home.indexOf('function MobileCoreFeatures'));
const mobileHome = home.slice(home.indexOf('function MobileDiscoverHome'), home.indexOf('export function PublicPlans'));
const globals = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8');

test('desktop carousel keeps the image full-bleed and centers the content group', () => {
  assert.match(desktopCarousel, /className="sa-desktop-home-carousel"/);
  assert.match(desktopCarousel, /width: '100%', m: 0/);
  assert.match(desktopCarousel, /borderRadius: \{ md: '0 0 28px 28px', lg: '0 0 32px 32px' \}/);
  assert.match(desktopCarousel, /alignItems="center"/);
  assert.match(desktopCarousel, /textAlign: 'center'/);
  assert.match(desktopCarousel, /justifyContent: 'center'/);
  assert.doesNotMatch(desktopCarousel, /const textAlign =/);
});

test('mobile carousel is a rounded full-width image surface with centered content', () => {
  assert.match(mobileCarousel, /className="sa-mobile-home-carousel"/);
  assert.match(mobileCarousel, /width: '100%', m: 0/);
  assert.match(mobileCarousel, /borderRadius: '0 0 24px 24px'/);
  assert.match(mobileCarousel, /component="picture"/);
  assert.match(mobileCarousel, /media="\(max-width: 899px\)"/);
  assert.match(mobileCarousel, /srcSet=\{slide\.mobileImageUrl\}/);
  assert.match(mobileCarousel, /objectFit: 'cover'/);
  assert.match(mobileCarousel, /<UniversalSearchField placeholder="Start your search: property, area or city"/);
  assert.match(mobileCarousel, /alignItems="center"/);
  assert.match(mobileCarousel, /textAlign: 'center'/);
  assert.doesNotMatch(mobileCarousel, /mx: 1\.3/);
});

test('mobile Home no longer renders a separate padded search card after the carousel', () => {
  assert.doesNotMatch(mobileHome, /<Box sx=\{\{ px: 1\.3, pt: 1\.25 \}\}><UniversalSearchField compact/);
  assert.match(globals, /\.sa-mobile-core-features \{ text-align: center; \}/);
});
