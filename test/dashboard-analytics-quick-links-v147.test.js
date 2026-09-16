import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('dashboard keeps a white heading, responsive analytics, and centered quick-link cards', () => {
  const dashboard = read('src/app/pages/app/RoleDashboardPage.tsx');
  const header = read('src/app/components/layout/PageHeader.tsx');

  assert.doesNotMatch(dashboard, /Document Vault/);
  assert.match(dashboard, /variant="plain"/);
  assert.match(header, /variant\?: 'navigation' \| 'plain'/);
  assert.match(header, /background: plain \? 'background\.paper'/);
  assert.ok((dashboard.match(/size=\{\{ xs: 6, md: 3 \}\}/g) || []).length >= 8, 'analytics and quick-link grids must use two cards on mobile and four on desktop');
  assert.match(dashboard, /function DashboardQuickLinks/);
  assert.match(dashboard, /type DashboardQuickLink = readonly \[label: string, description: string, path: string, icon: any\]/);
  assert.match(dashboard, /const tenantQuickLinks: readonly DashboardQuickLink\[\]/);
  assert.match(dashboard, /const quickLinks: readonly DashboardQuickLink\[\]/);
  assert.match(dashboard, /<Stack alignItems="center" textAlign="center"/);
  assert.match(dashboard, /<Grid size=\{\{ xs: 6, md: 3 \}\} key=\{path\}><QuickLinkCard/);
  assert.match(dashboard, /minHeight: \{ xs: 148, md: 164 \}/);
  assert.match(dashboard, /tone=\{index\}/);
});
