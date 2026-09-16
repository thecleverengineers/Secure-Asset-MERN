# One-click Enterprise Deployment

## Upgrade an existing `/www/secureasset` installation

Upload the patch ZIP into `/www/secureasset` and run one command:

```bash
cd /www/secureasset && unzip -o secureasset-enterprise-oneclick-patch.zip && sudo bash enterprise-deploy.sh
```

The default mode is `upgrade`. Existing MongoDB data is preserved.

## Fresh installation

Extract the full ZIP to `/www/secureasset`, then run:

```bash
cd /www/secureasset && sudo DEPLOY_MODE=fresh CONFIRM_FRESH=YES bash enterprise-deploy.sh
```

Fresh mode resets and seeds application collections. Never use it against an existing production database.

## Current VPS using encrypted local storage

When no AWS credentials or IAM role is configured:

```bash
cd /www/secureasset && sudo STORAGE_DRIVER=local DEPLOY_MODE=upgrade bash enterprise-deploy.sh
```

The script preserves the existing `.env`, generates missing secrets, prepares `/var/lib/secureasset` directories, verifies MongoDB, runs backups and migrations, builds the frontend, starts PM2 and waits for `/api/health/ready`.

## Domain, Nginx and SSL

```bash
cd /www/secureasset && sudo \
  APP_URL=https://secureasset.in \
  DOMAIN=secureasset.in \
  STORAGE_DRIVER=local \
  CONFIGURE_NGINX=1 \
  ENABLE_SSL=1 \
  SSL_EMAIL=admin@secureasset.in \
  DEPLOY_MODE=upgrade \
  bash enterprise-deploy.sh
```

## S3 deployment

Either supply static credentials or attach a valid IAM role/default AWS credential provider:

```bash
sudo \
  STORAGE_DRIVER=s3 \
  S3_REGION=ap-south-1 \
  S3_BUCKET=secureasset-production \
  S3_ACCESS_KEY_ID='...' \
  S3_SECRET_ACCESS_KEY='...' \
  bash enterprise-deploy.sh
```

The deployment stops before migrations or PM2 reload if the bucket cannot pass write/read/delete verification.

## What the command performs

- Enforces Node.js 24.18.0+ within the Node 24 release line
- Enforces npm 11.16.0+
- Repairs old private-registry lockfile URLs
- Runs a clean `npm ci --include=dev`
- Verifies Mongoose and all schema contracts
- Validates production environment settings
- Checks MongoDB, Vault/S3, ClamAV and SMTP
- Creates a MongoDB backup when `mongodump` is available
- Repairs incompatible legacy indexes
- Runs all idempotent migrations
- Runs tests, lint, TypeScript and production build
- Runs npm security audit
- Starts/reloads API and workers under PM2
- Saves PM2 state and enables startup after reboot
- Optionally configures Nginx and Let's Encrypt
- Waits for the readiness endpoint before reporting success

## PM2 processes

- `secureasset`
- `secureasset-rental-automation`
- `secureasset-notification-delivery`
- `secureasset-vault-retention`
