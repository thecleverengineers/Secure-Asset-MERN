import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { TenantKyc, TenantProfile } from '../server/src/models/index.js';
import { buildLegacyTenantKycInsert, buildLegacyTenantProfileInsert, demoRentalDataEnabled } from './lib/migration-safety.js';

const errors = [];
const id = new mongoose.Types.ObjectId();
const profile = new TenantProfile(buildLegacyTenantProfileInsert(id));
const profileError = profile.validateSync();
if (profileError) errors.push(`TenantProfile migration payload is invalid: ${profileError.message}`);

const kyc = new TenantKyc(buildLegacyTenantKycInsert(id));
const kycError = kyc.validateSync();
if (kycError) errors.push(`TenantKyc migration payload is invalid: ${kycError.message}`);
for (const field of ['governmentId', 'addressProof', 'profilePhoto', 'selfie', 'employmentProof']) {
  if (kyc[field] !== undefined) errors.push(`TenantKyc migration must not fabricate ${field} references.`);
}
if (demoRentalDataEnabled(undefined)) errors.push('Demo rental data must be disabled by default.');

const migrationFiles = fs.readdirSync(path.resolve('scripts')).filter((name) => name.startsWith('migrate-') && name.endsWith('.js'));
const forbidden = [/'vault-document-id'/, /profilePhoto\s*:\s*[^,}\n]*\|\|\s*''/];
for (const filename of migrationFiles) {
  const source = fs.readFileSync(path.join('scripts', filename), 'utf8');
  for (const pattern of forbidden) if (pattern.test(source)) errors.push(`${filename} contains unsafe migration placeholder ${pattern}.`);
}

if (errors.length) {
  console.error('Migration contract validation failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log(`Migration contracts passed for ${migrationFiles.length} migration scripts.`);
