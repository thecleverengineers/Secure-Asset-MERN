# SecureAsset Production Resilience v5

This release fixes the advanced-rental migration failure caused by invalid placeholder values being cast into `TenantKyc` ObjectId fields.

## Production safeguards

- Synthetic tenant, KYC, occupant, room and reminder records are disabled by default.
- Demo operational data requires the explicit `SEED_DEMO_RENTAL_DATA=true` opt-in.
- Legacy empty and known placeholder TenantKyc references are repaired before migrations.
- Unknown invalid references stop deployment for manual review rather than being deleted.
- Migration payloads are schema-validated before the database backup and migration phase.
- Automatic migrations can resume already-completed migration steps after a failure.
- About and Contact content pages are created as active public pages when absent.
- Frontend builds are verified in a versioned directory and activated atomically.
- Lazy-loaded page chunks reload once after an application update and then show a controlled recovery screen instead of React Router's raw error page.

## Deployment

```bash
cd /
cd /www
sudo unzip -o secureasset2-production-resilience-v5.zip -d /www
cd /www/secureasset
cat RELEASE_ID
sudo bash deploy.sh
```

Expected release id: `2026-06-30-production-resilience-v5`.
