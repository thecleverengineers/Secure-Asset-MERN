import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('notifications use the compact reference-panel treatment without losing notification actions', () => {
  const page = read('src/app/pages/app/NotificationCenterPage.tsx');

  assert.match(page, /data-secureasset-notification-center="reference-panel-v160"/);
  assert.match(page, /data-secureasset-notification-tabs="for-you-archived-v160"/);
  assert.match(page, />For you</);
  assert.match(page, /label="Archived"/);
  assert.match(page, /data-secureasset-notification-mark-all="functional-v160"/);
  assert.match(page, /Mark all as read/);
  assert.match(page, /data-secureasset-notification-list="compact-reference-cards-v160"/);
  assert.match(page, /data-secureasset-notification-card="actionable-v160"/);
  assert.match(page, /maxWidth: 790/);
  assert.match(page, /getNotifications\(\{ limit: 100/);
  assert.match(page, /await markAllNotificationsRead\(\)/);
  assert.match(page, /await markNotificationRead\(id\)/);
  assert.match(page, /await deleteNotification\(id\)/);
  assert.match(page, /await updateNotificationPreferences\(preferences\)/);
  assert.match(page, /<ProfessionalDialog open=\{preferencesOpen\}/);
  assert.match(page, /function internalActionPath/);
  assert.match(page, /path\.startsWith\('\/'\) && !path\.startsWith\('\/\/'\)/);
  assert.doesNotMatch(page, /CompactPageToolbar/);
});

test('the singular notification address redirects to the canonical notifications route', () => {
  const routes = read('src/app/routes.tsx');
  const singularRoute = routes.indexOf(`{ path: 'notification', element: <Navigate to="/app/notifications" replace /> }`);
  const moduleRoute = routes.indexOf("{ path: ':module', Component: ModulePage }");

  assert.ok(singularRoute >= 0);
  assert.ok(moduleRoute > singularRoute, 'The singular alias must resolve before the generic module route.');
});
