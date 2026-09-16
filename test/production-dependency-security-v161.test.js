import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const packageLock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('v161 pins the audited production dependency fixes in both manifests', () => {
  const expected = { morgan: '1.12.0', multer: '2.3.0', nodemailer: '10.0.1', qs: '6.16.0' };
  for (const [name, version] of Object.entries(expected)) {
    assert.equal(packageJson.dependencies[name], version, `${name} must be pinned to its fixed version`);
    assert.equal(packageLock.packages[`node_modules/${name}`]?.version, version, `${name} lock entry must match the audited fixed version`);
  }
});

test('multipart endpoints use bounded parser limits and return safe client errors', () => {
  const limits = read('server/src/middleware/uploadSecurity.js');
  const errorHandler = read('server/src/middleware/error.js');
  assert.match(limits, /fieldNameSize/);
  assert.match(limits, /headerPairs/);
  assert.match(limits, /parts: files \+ fields \+ 2/);
  for (const file of [
    'server/src/routes/authRoutes.js',
    'server/src/routes/uploadRoutes.js',
    'server/src/routes/driveRoutes.js',
    'server/src/routes/agreementRoutes.js',
    'server/src/routes/siteRoutes.js',
    'server/src/routes/googleMapsRoutes.js',
  ]) assert.match(read(file), /secureMultipartLimits/);
  assert.match(errorHandler, /err\.name === 'MulterError'/);
  assert.match(errorHandler, /Multipart request exceeds the permitted limits/);
});

test('mail delivery denies local/URL content resolution and production audit fails closed', () => {
  const mail = read('server/src/services/mail.js');
  const env = read('server/src/config/env.js');
  const audit = read('scripts/audit-production-dependencies.js');
  assert.match(mail, /disableFileAccess: true/);
  assert.match(mail, /disableUrlAccess: true/);
  assert.match(mail, /minVersion: 'TLSv1\.2'/);
  assert.match(env, /SMTP_REQUIRE_TLS/);
  assert.match(env, /SMTP_TLS_REJECT_UNAUTHORIZED/);
  assert.match(audit, /ALLOW_UNVERIFIED_DEPENDENCY_AUDIT/);
  assert.match(audit, /Refusing an unverified production deployment/);
});
