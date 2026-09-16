# SecureAsset Node.js 24.18 Production Hotfix

This release targets Node.js `>=24.18.0 <25` and repairs the production failures reported during seeding and Document Vault migration.

## Fixed

- `FieldData.measurements` is a subdocument array with `type`, `label`, `value`, `unit`, `angle`, and `notes` fields.
- All collections now declare at most one compound text index.
- Legacy per-field text indexes are detected and safely consolidated.
- Index creation is idempotent and preserves matching indexes even when their names differ.
- Conflicting unique and TTL indexes are never dropped automatically.
- Production seed is blocked unless `ALLOW_DESTRUCTIVE_SEED=YES` is explicitly provided.
- `setup-unix.sh` detects production and redirects to the safe deployment script.
- Node.js versions below 24.18.0 and Node.js 25+ are rejected before npm installation.
- S3 supports static credentials, temporary credentials, custom endpoints, and the AWS default credential chain.
- S3 write/delete access is tested before migrations or PM2 startup.
- ClamAV is installed by the deploy script on Debian/Ubuntu when enabled and is tested with an actual scan.
- PM2 waits for the HTTP listener and MongoDB before completing a reload.
- Health checks return HTTP 503 when MongoDB is unavailable.
- Local file paths are traversal-protected and storage directories use restrictive permissions.
- Production environment values are parsed and validated centrally.

## Existing server repair

```bash
cd /www/secureasset
unzip -o secureasset-node24-hotfix-patch.zip
chmod +x deploy.sh setup-unix.sh scripts/deploy-production.sh
```

Do not run `npm run seed` again on an existing database.

Before full deployment, choose one storage configuration:

### Persistent local VPS storage

```bash
sed -i 's/^STORAGE_DRIVER=.*/STORAGE_DRIVER=local/' .env
```

### S3 storage

Keep `STORAGE_DRIVER=s3` and configure either:

- `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`, or
- an IAM instance/task role or another AWS SDK default credential provider.

Then run:

```bash
bash deploy.sh
```

## Repair only the database indexes

```bash
npm ci --include=dev
npm run schema:check
npm run db:repair-indexes
npm run migrate:document-vault
npm run db:indexes
```

## Production security notes

- Rotate JWT secrets that have been pasted into chat or logs.
- Do not rotate `VAULT_ENCRYPTION_KEY` after local encrypted files exist unless you run a controlled key migration.
- MongoDB authentication is strongly recommended even when the database is bound to localhost.
- Blank SMTP values disable email delivery but do not prevent startup.
