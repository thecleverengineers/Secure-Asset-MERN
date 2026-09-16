import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const loginPage = readFileSync(new URL('../src/app/pages/LoginPage.tsx', import.meta.url), 'utf8');
const resetPasswordPage = readFileSync(new URL('../src/app/pages/ResetPasswordPage.tsx', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../src/app/routes.tsx', import.meta.url), 'utf8');

test('sign-in and OTP submit actions use the premium blue auth treatment', () => {
  assert.match(loginPage, /className="sa-submit-button"/);
  assert.match(loginPage, /const appHeaderColor = settings\.design\?\.colors\?\.navigation \|\| '#0B5270';/);
  assert.match(loginPage, /bgcolor: appHeaderColor/);
  assert.match(loginPage, /'&:hover': \{ bgcolor: appHeaderColor, filter: 'brightness\(\.9\)' \}/);
  assert.match(loginPage, /'&\.Mui-disabled': \{ bgcolor: 'rgba\(11,82,112,\.48\)'/);
});

test('Account Access actions are anchor-style links, not button controls', () => {
  assert.match(loginPage, /Link as MuiLink/);
  assert.match(loginPage, /const href = item === 'login' \? '\/login' : `\/login\?mode=\$\{item\}`;/);
  assert.match(loginPage, /<MuiLink[\s\S]*href=\{href\}[\s\S]*onClick=\{\(event\) => \{ event\.preventDefault\(\); changeMode\(item\); \}\}/);
  assert.match(loginPage, /color: selected \? '#0B6E96' : '#18282D'/);
  assert.match(loginPage, /'&:hover': \{ color: '#0B6E96' \}/);
  assert.doesNotMatch(loginPage, /authNavigationModes\.map\(\(item\) => <Button/);
});

test('authentication mode links support direct OTP and registration URLs while recovery uses the dedicated reset route', () => {
  assert.match(loginPage, /const requestedAuthMode = requestedMode === 'register' && modes\.includes\('register'\)/);
  assert.match(loginPage, /modes\.includes\(requestedMode as Mode\) \? requestedMode as Mode : null/);
  assert.match(loginPage, /const \[mode, setMode\] = useState<Mode>\(\(\) => requestedAuthMode \|\| modes\[0\] \|\| 'login'\)/);
  assert.match(loginPage, /data-secureasset-forgot-password-link="dedicated-reset-v160" href="\/reset-password"/);
  assert.match(loginPage, /if \(requestedMode === 'forgot'\) navigate\('\/reset-password', \{ replace: true \}\)/);
  assert.match(resetPasswordPage, /forgotPassword\(identifier\)/);
  assert.match(resetPasswordPage, /resetPassword\(identifier, otp, password\)/);
  assert.match(resetPasswordPage, /window\.setTimeout\(\(\) => navigate\('\/login\?reset=success', \{ replace: true \}\), 1800\)/);
  assert.match(routes, /\{ path: 'reset-password', Component: ResetPasswordPage \}/);
});
