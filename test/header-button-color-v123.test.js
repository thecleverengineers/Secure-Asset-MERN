import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
const pageHeader = readFileSync(new URL('../src/app/components/layout/PageHeader.tsx', import.meta.url), 'utf8');
const frontLayout = readFileSync(new URL('../src/app/components/FrontLayout.tsx', import.meta.url), 'utf8');
const publicPages = readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');
const securityPage = readFileSync(new URL('../src/app/pages/app/SecurityPage.tsx', import.meta.url), 'utf8');
const documentVault = readFileSync(new URL('../src/app/pages/app/DocumentVaultPage.tsx', import.meta.url), 'utf8');

test('filled white-text buttons use the configured application-header color', () => {
  assert.match(app, /const headerFilledButtonStyles = \{/);
  assert.ok(app.includes("backgroundColor: `${colors.navigation} !important`"));
  assert.ok(app.includes("color: '#FFFFFF !important'"));
  assert.ok(app.includes("'&.MuiButton-contained:not(.sa-light-button)"));
  for (const token of ['primary', 'secondary', 'submit', 'edit', 'accept', 'danger']) {
    assert.ok(app.includes(`&.sa-${token}-button:not(.MuiButton-outlined):not(.sa-light-button)`), `missing ${token} button treatment`);
  }
  assert.doesNotMatch(app, /sa-outlined-button:not\(\.MuiButton-outlined\)/);
});

test('intentional light buttons remain readable on dark surfaces', () => {
  assert.ok(pageHeader.includes('sa-light-button.MuiButton-contained'));
  assert.ok(frontLayout.includes('className="sa-light-button"'));
  assert.ok(publicPages.includes('className="sa-light-button"'));
  assert.ok(securityPage.includes('className="sa-light-button"'));
  assert.ok(documentVault.includes('className="sa-light-button"'));
});
