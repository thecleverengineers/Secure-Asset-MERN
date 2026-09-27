import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('login register and otp share one persistent auth route', () => {
  const routes = read('src/app/routes.tsx');
  assert.match(routes, /function AuthAccessPage\(\)/);
  assert.match(routes, /path: 'auth\/:authMode', Component: AuthAccessPage/);
  assert.doesNotMatch(routes, /path: 'auth\/login', Component: AuthLoginPage/);
  assert.doesNotMatch(routes, /path: 'auth\/register', Component: AuthRegisterPage/);
  assert.doesNotMatch(routes, /path: 'auth\/otp_login', Component: AuthOtpLoginPage/);
});

test('desktop auth card is top anchored to prevent form-height springing', () => {
  const css = read('src/styles/login-premium.css');
  assert.match(css, /align-items: flex-start;/);
  assert.match(css, /scrollbar-gutter: stable;/);
  assert.match(css, /contain: layout paint;/);
  assert.match(css, /contain: none;/);
});
