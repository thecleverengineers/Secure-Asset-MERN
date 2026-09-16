# SecureAsset Enterprise Production 6.0.0

## Current release

`2026-07-02-admin-ux-location-v11` adds property selection to approvals, responsive professional dialog controls, administrator-managed sidebar sections and ordering, avatar file uploads, and cached worldwide country → state/province → city selectors. See `ADMIN_UX_LOCATION_V11.md`.

Production release for Node.js 24.18.0, npm 11.16.0, MongoDB 8.0.26 and Ubuntu 22.04. See `FINAL_ENTERPRISE_RELEASE.md` and `ONE_CLICK_ENTERPRISE_DEPLOY.md`.

## Exact production certification

This release is validated for **Node.js 24.18.0**, **npm 11.16.0** and targets **MongoDB 8.0.26** on Ubuntu 22.04 x86_64. See [NODE24_MONGO8_CERTIFICATION.md](NODE24_MONGO8_CERTIFICATION.md) and [VALIDATION_EXACT_STACK.md](VALIDATION_EXACT_STACK.md).

## Node.js 24.18 production hotfix

This package requires Node.js `>=24.18.0 <25`. It includes compound MongoDB text indexes, automatic legacy index repair, schema regression checks, S3/IAM preflight, ClamAV preflight, production-safe seeding, MongoDB-aware health checks, and PM2 ready signalling. See `NODE24_PRODUCTION_HOTFIX.md` before upgrading an existing installation.


A database-driven **React + TypeScript + Node.js + Express + MongoDB** platform for property rentals, tenant operations, landlord subscriptions, professional surveyors and secure document management. It runs without Docker and includes a verified Vite build plus PM2 deployment configuration.

## Same-account model

Every normal registration creates a **Tenant account**. The same account may independently activate:

- **Landlord Mode** through a Landlord Subscription
- **Surveyor Mode** through a Surveyor Subscription
- Both capabilities at the same time

Admin and Manager remain operational roles. Landlord and Surveyor are account capabilities rather than duplicate users.

## Main systems

- Database-controlled site title, logos, colours, SEO and homepage carousel
- Runtime Admin CMS for route SEO, homepage sections, property types, regional area units and plans
- Rent, Sale and Lease marketplace
- Property → Building → Floor → Apartment/Room/Bed hierarchy
- Dynamic property forms based on MongoDB property-type configuration
- Room-wise and area-wise galleries
- Tenant profiles, KYC, occupants, applications, interviews and site visits
- Tenancy, monthly rent, meter-based utilities, receipts and reminders
- Landlord structural subscription limits and promotions
- Surveyor plans, verification, marketplace, jobs, quotations, projects, reports and teams
- Universal Document Vault and Legal Records system
- Notifications, messaging, analytics and audit logs

See [ADVANCED_RENTAL_SYSTEM.md](ADVANCED_RENTAL_SYSTEM.md), [SURVEYOR_SUBSCRIPTION.md](SURVEYOR_SUBSCRIPTION.md) and [DOCUMENT_VAULT.md](DOCUMENT_VAULT.md).

## Requirements

- Node.js 24.18.x
- npm 11.16.x
- MongoDB Community Server or MongoDB Atlas
- Persistent disk or S3-compatible object storage
- Nginx or another TLS reverse proxy for production

## Local development

```bash
npm run setup:local
npm install
npm run db:check
npm run seed
npm run migrate:document-vault
npm run migrate:advanced-rental
npm run db:indexes
npm run dev
```

Windows PowerShell users can use `npm.cmd` if `npm.ps1` is blocked.

## Existing database upgrade

Back up MongoDB first, then run:

```bash
npm ci
npm run db:check
npm run migrate:tenant-landlord
npm run migrate:surveyor-subscription
npm run migrate:document-vault
npm run migrate:advanced-rental
npm run db:indexes
npm run build
```

Do not run the demo seed against an existing production database.

## PM2 production

```bash
npm run pm2:start
npm run pm2:status
npm run pm2:save
npx pm2 startup
```

The PM2 ecosystem contains:

- `secureasset` — Express API, Socket.IO and built React application
- `secureasset-rental-automation` — monthly invoices, overdue processing and reminders
- `secureasset-vault-retention` — Trash and legal-retention cleanup

See [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md).

## Important scripts

```text
npm run dev                         Development API + Vite client
npm run build                       Verified production build
npm run check                       Build + server syntax validation
npm run db:check                    Test MongoDB connectivity
npm run db:indexes                  Create declared production indexes
npm run migrate:advanced-rental     CMS, hierarchy and rental-system migration
npm run rent:automation              Run rental automation immediately
npm run vault:purge                 Run Document Vault retention immediately
npm run pm2:start                   Build and start all PM2 processes
npm run pm2:reload                  Rebuild and graceful reload
```

## Demo accounts

All seeded accounts use `Demo@123`.

| Account | Email |
|---|---|
| Admin | `admin@secureasset.in` |
| Manager | `manager@secureasset.in` |
| Tenant/Landlord | `tenant@secureasset.in` |
| Tenant/Surveyor | `surveyor@secureasset.in` |

Never use demo credentials in production.

## Production integration boundaries

The application build and PM2 configuration are deployable, but the package is not connected to your live MongoDB, domain, email, SMS, WhatsApp, payment gateway or Google Maps account. Production subscription/payment activation must use verified Razorpay/Stripe webhook processing. Configure provider credentials in `.env` before launch.

## One-click production deployment

For an existing installation with a configured `.env`:

```bash
sudo bash deploy.sh
```

For a new server, pass the public URL and MongoDB connection in the same command. See `ONE_CLICK_DEPLOY.md` for Nginx, SSL, fresh-database and update examples.
## Automatic database migration

Production startup and every PM2 process now pass through a locked automatic migration gate. MongoDB compatibility, tenant/landlord, surveyor subscription, Document Vault, advanced rental migrations, and production indexes are applied without manually running individual npm commands. See `AUTOMATIC_DATABASE_MIGRATIONS.md`.

## Property workflow v9

The Properties module now uses a dedicated four-step add/edit wizard with mapped specifications, location, utilities, amenities, legal details, Vault-backed media, contact information and nearby facilities. See `PROPERTY_WORKFLOW_V9.md`.

## Overall Features & Functions

A complete module-wise feature and function summary is included in:

- `OVERALL_FEATURES_AND_FUNCTIONS.md`
- `docs/OVERALL_FEATURES_AND_FUNCTIONS.md`


## Latest production verification hotfix

- `ENTERPRISE_PRODUCTION_VERIFY_ORDER_HOTFIX.md` — ensures frontend build runs before SPA/asset tests during production verification.
