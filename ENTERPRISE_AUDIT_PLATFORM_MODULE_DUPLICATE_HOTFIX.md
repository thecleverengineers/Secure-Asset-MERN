# Enterprise Audit Platform Module Duplicate Hotfix

## Issue

Production deployment reached `npm run audit:enterprise` and failed with duplicate `DEFAULT_PLATFORM_MODULES` entries such as:

- `app:property-sales`
- `app:subscriptions`
- `app:landlord-plans`
- `app:surveyor-plans`
- `app:site-settings`
- `app:home-carousel`
- `app:area-units`

The previous RBAC/sidebar implementation merged raw modules and RBAC modules, then appended admin workspace override modules a second time. The audit script correctly detected duplicate `scope:key` records before the build step.

## Fix

`server/src/services/platformDefaults.js` now merges admin workspace override modules through the same `mergePlatformModules()` path used by raw and RBAC modules.

This keeps:

- one canonical `scope:key` record per module,
- combined access rules,
- existing RBAC metadata,
- admin workspace labels, paths, icons, sections and sort order.

## Regression Test

`test/role-sidebar-permissions.test.js` now includes a regression test that validates `DEFAULT_PLATFORM_MODULES.length === unique(scope:key).size`.

## Server Verification

After deploying this ZIP, rerun:

```bash
npm run audit:enterprise
npm run verify
```

Expected result for this blocker:

```text
Enterprise audit passed
```
