import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('public pricing provides landlord and surveyor subscription tabs', () => {
  const source = read('src/app/pages/PublicPages.tsx');
  assert.match(source, /Landlord Subscription plan/);
  assert.match(source, /Surveyors Subscription plan/);
  assert.match(source, /getSurveyorPlans/);
  assert.match(source, /public-surveyor-subscription-plans/);
  assert.match(source, /enabled: tab === 'surveyor'/);
  assert.match(source, /& \.MuiTab-root\.Mui-selected.*color: '#fff'/);
});

test('pricing cards keep their content inside a stable flex layout', () => {
  const source = read('src/app/pages/PublicPages.tsx');
  assert.match(source, /minHeight: \{ xs: 0, md: 560 \}/);
  assert.match(source, /display: 'flex',\s*\n\s*flexDirection: 'column'/);
  assert.match(source, /overflow: 'hidden'/);
  assert.match(source, /mt: 'auto'/);
  assert.match(source, /overflowWrap: 'anywhere'/);
  assert.match(source, /Plan includes/);
});
