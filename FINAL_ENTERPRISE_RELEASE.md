# SecureAsset Enterprise Production 6.0.0

This release targets the following production stack:

- Node.js 24.18.0
- npm 11.16.0
- MongoDB 8.0.26
- Ubuntu 22.04 x86_64
- PM2 7
- Nginx reverse proxy with optional Let's Encrypt SSL

## Enterprise modules

All operational records are MongoDB-backed and permission-scoped. The system includes Tenant, Landlord Mode, Surveyor Mode, Admin and Manager workflows; flexible property hierarchy; tenant KYC; applications and interviews; facilities; visits; rent and utility billing; subscriptions; promotions; surveyor marketplace and projects; encrypted Document Vault; legal records; real-time messaging and notifications; CMS/SEO/homepage administration; reporting; audit logs; integrations; and background automation workers.

Code-defined values are limited to safe bootstrap defaults, UI field definitions and migration fallbacks. Site identity, SEO, authentication content, navigation, content pages, carousel slides, homepage sections, plans, property types, regional area units and integration configuration are stored in MongoDB and editable by Admin.

## Security additions in 6.0.0

- TOTP authenticator two-factor authentication
- Single-use backup codes stored only as hashes
- Encrypted TOTP secrets
- Rotating refresh-cookie sessions with stable session IDs
- Device/session listing and revocation
- Strong-password change and reset workflows
- Dedicated reset-password route
- Database-controlled registration, password-login and OTP-login policies
- Legacy upload compatibility routed through encrypted Vault/S3 storage
- Legacy upload migration
- Sensitive real-time channels broadcast invalidations rather than private records
- Payment states activated only by authorised verification paths

## Database migrations

Production deployment runs these idempotent migrations:

1. Tenant/Landlord account migration
2. Surveyor subscription migration
3. Document Vault migration
4. Legacy public-upload migration into Vault/S3
5. Advanced rental migration
6. Enterprise platform/module/authentication migration
7. Index conflict repair and declared index creation

The enterprise migration invalidates only old refresh sessions that do not contain secure session IDs; users sign in again after the upgrade.

## Build certification

Validated with Node.js 24.18.0 and npm 11.16.0:

- 71 Mongoose model contracts
- 60 MongoDB resource contracts
- 67 database-driven module records
- 33 enterprise cross-layer contracts
- 20 automated regression tests
- strict TypeScript compilation
- server ESLint with zero warnings
- JavaScript syntax checks
- Bash syntax checks
- Vite production build: 12,353 modules
- clean npm ci from the packaged public-registry lockfile
- npm production audit: 0 vulnerabilities

External service connectivity is checked on the target server by `npm run services:check` and the one-click deploy script. This includes MongoDB, S3/local Vault storage, ClamAV and SMTP when configured.
