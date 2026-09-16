# SecureAsset Production Certification

## Validated target stack

- Node.js: **24.18.0**
- npm: **11.16.0**
- MongoDB target: **8.0.26 Community Server**
- Operating system target: Ubuntu 22.04 x86_64
- Runtime process manager: PM2
- Frontend build: Vite + React + TypeScript
- Backend: Express + Mongoose

## What is implemented

The project includes one MongoDB-backed platform for Tenant, Landlord Mode, Surveyor Mode, Manager and Administrator workflows. The implementation includes database-backed public site content, SEO/CMS, property hierarchy, room and bed inventory, subscription limits, marketplace publishing, KYC, applications, interviews, property visits, tenancies, rent and utility automation, facilities, survey jobs and projects, payments, reports, notifications, audit logs and the encrypted Document Vault.

The application currently registers **65 Mongoose models** and **55 permission-scoped resource modules**. Resource contracts are checked automatically against model paths, roles, writable fields, search fields and population paths.

## Defects fixed during exact-stack certification

- Corrected structured Mongoose arrays that had been interpreted as primitive string arrays when child records contained a field named `type`.
- Consolidated independent text indexes into one named compound text index per MongoDB collection.
- Added safe legacy-index repair that preserves unrelated unique and TTL indexes.
- Made migrations idempotent and safe to rerun.
- Removed client-side subscription and invoice self-approval paths.
- Added idempotent payment lifecycle handling.
- Added linked facility-booking invoices and payment-state synchronization.
- Prevented paid facilities from being approved before payment verification.
- Added schedule, capacity, collision, notice-period and advance-window validation for facility bookings.
- Corrected regular Tenant dashboard scoping so system-wide totals are not exposed.
- Added Surveyor Mode dashboard scoping for same-account subscribed users.
- Corrected public-property location serialization so exact coordinates and sensitive records are not exposed unless explicitly permitted.
- Corrected browser local-date/time conversion before API submission.
- Replaced predictable temporary upload names with cryptographically random UUID names.
- Added lazy route loading and production code splitting.
- Added runtime checks for Node.js 24.18+ and npm 11.16+ within their supported major release lines.
- Added S3/default AWS credential-chain preflight, local encrypted-storage preflight, ClamAV preflight and SMTP preflight.
- Added MongoDB 8 compatibility/version checking and PM2 readiness-aware reloads.

## Automated checks

The following project checks pass under Node.js 24.18.0 and npm 11.16.0:

```bash
npm run runtime:check
npm run schema:check
npm run feature:check
npm run lint:server
npm run test
npm run build
tsc --noEmit
node scripts/check-server-syntax.js
npm run audit:production
npm ls --all
```

Current automated results:

- 65 Mongoose models validated.
- 55 resource contracts validated.
- 13 regression/security tests passed.
- 12,318 frontend modules transformed in the production build.
- Production build output verified.
- 0 high or critical production dependency advisories; the current production audit reports 0 vulnerabilities.
- Pasted production secrets are not included in the project package.

## Live-server certification

Run this after placing the final project and production `.env` on the actual server:

```bash
npm ci --include=dev
npm run runtime:check
npm run deploy:validate
npm run db:check
npm run services:check
npm run db:repair-indexes
npm run migrate:tenant-landlord
npm run migrate:surveyor-subscription
npm run migrate:document-vault
npm run migrate:advanced-rental
npm run db:repair-indexes
npm run db:indexes
npm run verify
npm run audit:production
```

Or run the full production certification command:

```bash
npm run certify:production
```

`certify:production` intentionally fails when MongoDB, S3/local storage, ClamAV or configured SMTP cannot pass their real service preflight.

## Existing database warning

Do **not** run `npm run seed` on an existing production database. The seed is destructive and now requires:

```bash
ALLOW_DESTRUCTIVE_SEED=YES npm run seed
```

Use migrations for an existing database.

## Required environment decisions

### Storage

When `STORAGE_DRIVER=s3`, either configure valid static credentials or attach a working AWS IAM role/default AWS credential provider. An S3 bucket name by itself is not sufficient.

For one persistent VPS, encrypted local storage is supported:

```env
STORAGE_DRIVER=local
VAULT_STORAGE_DIR=/var/lib/secureasset/vault
VAULT_TEMP_DIR=/var/lib/secureasset/tmp
VAULT_ENCRYPTION_KEY=<at-least-64-random-characters>
```

### ClamAV

When `CLAMAV_ENABLED=true`, `clamdscan` and `clamav-daemon` must be installed and healthy. Deployment verifies a real test scan before PM2 starts.

### Email

When SMTP is empty, email OTP, password-reset delivery and email notifications cannot be delivered. The API will not pretend they were sent in production.

### MongoDB security

The previously shown MongoDB server had access control disabled. Keep MongoDB bound to localhost until authentication is enabled. Use a dedicated least-privilege database user in the production URI.

### Secret rotation

JWT and vault values pasted into a conversation should be considered disclosed. Rotate JWT access and refresh secrets before going live. Do not rotate an encryption key after local encrypted files exist unless a controlled key migration is performed.

## Deployment

For an existing installation:

```bash
cd /www/secureasset
bash deploy.sh
```

The deployment installs exact dependencies, validates the environment and services, backs up MongoDB when tools are available, repairs indexes, runs idempotent migrations, builds the frontend, reloads PM2 and waits for `/api/health` to report a connected database.
