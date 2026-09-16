import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AuthSession } from '../server/src/models/index.js';

const sessionService = fs.readFileSync(new URL('../server/src/services/serverSession.js', import.meta.url), 'utf8');
const spa = fs.readFileSync(new URL('../server/src/middleware/spa.js', import.meta.url), 'utf8');
const csrf = fs.readFileSync(new URL('../server/src/middleware/csrf.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../src/app/services/api.ts', import.meta.url), 'utf8');
const authContext = fs.readFileSync(new URL('../src/app/context/AuthContext.tsx', import.meta.url), 'utf8');
const realtime = fs.readFileSync(new URL('../src/app/context/RealtimeContext.tsx', import.meta.url), 'utf8');
const socket = fs.readFileSync(new URL('../server/src/services/socket.js', import.meta.url), 'utf8');
const authRoutes = fs.readFileSync(new URL('../server/src/routes/authRoutes.js', import.meta.url), 'utf8');

test('persistent auth sessions store only digests with rolling, absolute and TTL expiry', () => {
  const paths = AuthSession.schema.paths;
  assert.equal(paths.tokenHash.options.select, false);
  assert.equal(paths.previousTokenHash.options.select, false);
  assert.ok(paths.expiresAt);
  assert.ok(paths.absoluteExpiresAt);
  assert.ok(AuthSession.schema.indexes().some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0));
  assert.match(sessionService, /SESSION_ROTATION_GRACE_SECONDS/);
  assert.match(sessionService, /absoluteExpiresAt/);
  assert.match(sessionService, /findOneAndUpdate/);
});

test('production HTML prehydrates a safe session without caching personalized markup', () => {
  assert.match(spa, /secureasset-session-bootstrap/);
  assert.match(spa, /resolveServerSession/);
  assert.match(spa, /sessionBootstrap/);
  assert.match(spa, /Cache-Control/);
  assert.match(spa, /no-store/);
});

test('cookie sessions use CSRF protection and never require browser-persisted JWTs', () => {
  assert.match(csrf, /x-secureasset-csrf/);
  assert.match(csrf, /timingSafeEqual/);
  assert.match(api, /BroadcastChannel/);
  assert.match(api, /credentials: 'include'/);
  assert.doesNotMatch(api, /localStorage\.(getItem|setItem)\(['"]sa_(token|user)['"]/);
  assert.match(authContext, /getInitialSession/);
  assert.match(authContext, /renewSession/);
  assert.doesNotMatch(authContext, /Restoring your secure session/);
});

test('notifications and presence authenticate from the same revocable cookie session', () => {
  assert.match(socket, /resolveSessionToken/);
  assert.match(socket, /presence.*io\.of\('\/presence'\)/s);
  assert.match(socket, /isServerSessionActive/);
  assert.match(realtime, /withCredentials: true/);
  assert.match(realtime, /\/presence/);
  assert.match(realtime, /token \? \{ auth: \{ token \} \}/);
});

test('administrators can list and revoke persistent sessions', () => {
  assert.match(authRoutes, /\/admin\/sessions/);
  assert.match(authRoutes, /authorize\('admin'\)/);
  assert.match(authRoutes, /\/admin\/users\/\:userId\/sessions\/revoke/);
});
