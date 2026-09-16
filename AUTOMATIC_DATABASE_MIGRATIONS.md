# Automatic database migrations

SecureAsset now performs database compatibility validation and required schema/data migrations automatically before the API or any PM2 worker starts.

## Automatic sequence

1. MongoDB connectivity and MongoDB 8+ compatibility check
2. Tenant/landlord migration
3. Surveyor subscription migration
4. Document Vault migration
5. Advanced rental migration
6. Production index creation

The equivalent manual commands remain available for diagnostics, but normal deployments and restarts do not require them.

## Safety controls

- A MongoDB-backed distributed lock prevents the API and PM2 workers from running the suite simultaneously.
- A SHA-256 fingerprint is generated from the migration files. A completed fingerprint is not rerun on ordinary restarts.
- Changed migration code creates a new fingerprint and runs automatically during the next deployment/startup.
- The lock has a heartbeat and stale-lock expiry so an interrupted deployment can recover.
- Any failed migration stops application startup. The failure and current step are recorded in the `system_migrations` collection.
- All included migrations are designed to be idempotent.

## Configuration

```env
AUTO_DB_MIGRATIONS=true
AUTO_DB_MIGRATION_LOCK_TTL_MS=1200000
AUTO_DB_MIGRATION_WAIT_MS=1800000
AUTO_DB_MIGRATION_POLL_MS=3000
```

Keep `AUTO_DB_MIGRATIONS=true` in production. Set it to `false` only for controlled maintenance where the database has already been prepared separately.

## Force a rerun

For recovery or diagnostics only:

```bash
npm run db:auto-migrate:force
```

A forced run still uses the distributed lock.
