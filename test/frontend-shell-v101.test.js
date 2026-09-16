import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('authenticated shell removes page breadcrumbs while preserving functional folder navigation', () => {
  const shell = read('src/app/components/layout/AppShell.tsx');
  const designStudio = read('src/app/pages/app/DesignStudioPage.tsx');

  assert.doesNotMatch(shell, /Breadcrumbs|sa-route-padding/);
  assert.doesNotMatch(designStudio, /Breadcrumbs|breadcrumb/i);
  assert.match(shell, /className="sa-app-content" sx=\{\{ pt:/);
  assert.match(read('src/app/pages/app/DocumentVaultPage.tsx'), /getDriveBreadcrumbs/);
});

test('workspace cards use full-width flat surfaces with border-led hierarchy', () => {
  const styles = read('src/styles/globals.css');
  const app = read('src/app/App.tsx');
  assert.match(styles, /\.sa-surface-card\s*\{[\s\S]*width: 100%;/);
  assert.match(styles, /\.MuiCard-root,\n\.MuiCard-root:hover,[\s\S]*box-shadow: none !important/);
  assert.match(app, /const cardShadow = 'none'/);
  assert.match(read('src/app/pages/app/RoleDashboardPage.tsx'), /transition: 'border-color \.18s ease'/);
});
