import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modulePage = readFileSync(new URL('../src/app/pages/app/ModulePage.tsx', import.meta.url), 'utf8');
const utilityPage = readFileSync(new URL('../src/app/pages/app/UtilityPage.tsx', import.meta.url), 'utf8');

test('tenant profile is routed to the profile dashboard before generic configured modules', () => {
  const profileRoute = modulePage.indexOf("if (module === 'profile') return renderLazy(<UtilityPage />);");
  const configuredFallback = modulePage.indexOf('if (configuredModule) return renderLazy(<ResourcePage />);');

  assert.ok(profileRoute >= 0, 'Profile must have a dedicated system route.');
  assert.ok(configuredFallback > profileRoute, 'Profile must resolve before the generic configured-module fallback.');
  assert.match(modulePage, /const alwaysAllowed = \['profile', 'security', 'search', 'messages', 'notifications'\]/);
  assert.match(utilityPage, /if \(module === 'profile'\)/);
  assert.match(utilityPage, /data-secureasset-profile-static-dashboard="mobile-premium-v158"/);
  assert.match(utilityPage, /Edit profile/);
  assert.match(utilityPage, /await updateMe\(/);
  assert.match(utilityPage, /await uploadProfileAvatar\(file\)/);
});
