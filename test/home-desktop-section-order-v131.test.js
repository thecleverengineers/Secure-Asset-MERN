import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const home = readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');
const desktopHome = home.slice(home.indexOf('export function Home()'), home.indexOf('const mobileCoreFeatures'));

test('desktop Home begins with the configured carousel', () => {
  assert.match(home, /function DesktopHomeCarousel\(/);
  assert.match(desktopHome, /<DesktopHomeCarousel slides=\{data\.carousel \|\| \[\]\}/);
  assert.match(home, /className="sa-desktop-home-carousel"/);
  assert.match(home, /carouselSlides\.length < 2/);
});

test('desktop Home places the requested sections in order', () => {
  const carousel = desktopHome.indexOf('<DesktopHomeCarousel');
  const coreFeatures = desktopHome.indexOf('<DynamicSections sections={coreFeatureSections} />');
  const featuredProperties = desktopHome.indexOf('<DesktopPropertyRail title="Featured properties"');
  const verifiedSurveyors = desktopHome.indexOf('<DynamicSections sections={surveyorSections} />');
  const remainingSections = desktopHome.indexOf('<DynamicSections sections={trailingHomeSections} />');

  assert.ok(carousel >= 0);
  assert.ok(carousel < coreFeatures);
  assert.ok(coreFeatures < featuredProperties);
  assert.ok(featuredProperties < verifiedSurveyors);
  assert.ok(verifiedSurveyors < remainingSections);
});
