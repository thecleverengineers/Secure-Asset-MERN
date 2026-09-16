import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const model = readFileSync(new URL('../server/src/models/index.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../server/src/controllers/authController.js', import.meta.url), 'utf8');
const webauthn = readFileSync(new URL('../server/src/services/webauthn.js', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../server/src/routes/authRoutes.js', import.meta.url), 'utf8');
const driveRoutes = readFileSync(new URL('../server/src/routes/driveRoutes.js', import.meta.url), 'utf8');
const middleware = readFileSync(new URL('../server/src/middleware/auth.js', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../server/src/utils/tokens.js', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/app/services/api.ts', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/app/components/layout/AppShell.tsx', import.meta.url), 'utf8');
const security = readFileSync(new URL('../src/app/pages/app/SecurityPage.tsx', import.meta.url), 'utf8');
const vault = readFileSync(new URL('../src/app/pages/app/DocumentVaultPage.tsx', import.meta.url), 'utf8');

test('device unlock stores public credentials and short-lived challenges only', () => {
  assert.match(model, /DeviceCredentialSchema/);
  assert.match(model, /deviceUnlock: \{ type: DeviceUnlockSchema/);
  assert.match(model, /registrationChallengeExpiresAt/);
  assert.match(model, /authenticationChallengeExpiresAt/);
  assert.match(controller, /verifyWebAuthnRegistration/);
  assert.match(controller, /verifyWebAuthnAuthentication/);
  assert.match(webauthn, /requireUserVerification: true/);
  assert.match(controller, /publicKey: Buffer\.from\(credential\.publicKey\)\.toString\('base64url'\)/);
  assert.match(controller, /signDeviceUnlockToken\(user, stored\.id\)/);
  assert.match(tokens, /type: 'device_unlock'/);
  assert.match(controller, /user\.deviceUnlock = \{ enabled: false, credentials: \[\] \}/);
  assert.match(controller, /registered vault devices were signed out/);
});

test('security actions are authenticated and contact changes require password plus OTP', () => {
  for (const path of [
    "'/device-unlock/setup/options'",
    "'/device-unlock/setup/verify'",
    "'/device-unlock/authentication/options'",
    "'/device-unlock/authentication/verify'",
    "'/contact-change/request'",
    "'/contact-change/verify'",
  ]) assert.match(routes, new RegExp(`router\\.(?:post|delete)\\(${path.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}, authenticate`));
  assert.match(controller, /currentPassword/);
  assert.match(controller, /pendingContactChange/);
  assert.match(controller, /validateStoredOtp/);
});

test('profile menu exposes Security and the mobile vault gates data behind device verification', () => {
  assert.match(shell, /navigate\('\/app\/security'\)/);
  assert.match(security, /Set up mobile unlock/);
  assert.match(security, /Reset device unlock/);
  assert.match(security, /openContact\('phone'\)/);
  assert.match(security, /openContact\('email'\)/);
  assert.match(vault, /getSecurityOverview/);
  assert.match(vault, /beginDeviceUnlockAuthentication/);
  assert.match(vault, /navigator\.credentials\.get/);
  assert.match(vault, /deviceUnlockSupported/);
  assert.match(driveRoutes, /router\.use\(authenticate, requireDeviceUnlock(?:, vaultSecurityHeaders)?\)/);
  assert.match(middleware, /Device unlock is required before accessing the mobile Document Vault/);
  assert.match(api, /X-SecureAsset-Device-Unlock/);
  assert.match(api, /function driveRequestHeaders/);
  assert.match(api, /fetchDriveFileBlob[\s\S]*fetchAuthenticatedBlob/);
  assert.match(api, /uploadDriveFile[\s\S]*driveRequestHeaders/);
  assert.match(vault, /VAULT_IDLE_TIMEOUT_MS/);
  assert.match(vault, /clearDeviceUnlockToken/);
  assert.match(driveRoutes, /vaultSecurityHeaders/);
});
