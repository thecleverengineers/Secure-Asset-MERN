# Enterprise Production Verify Order Hotfix

## Issue

Production deployment reached `npm run test` before the frontend production bundle was created. Two tests depend on the built SPA output:

- `test/auth-routing-deployment.test.js` reads `dist/index.html` and verifies every built chunk.
- `test/spa-routing.test.js` starts the production Express app and verifies browser reload routes such as `/login`, `/app/dashboard`, `/about`, and `/search` return the React entry point.

Because `npm run verify` previously ran `npm run test` before `npm run build`, clean production deployments without an existing `dist/index.html` failed with:

- `ENOENT: no such file or directory, open '/www/jo/dist/index.html'`
- `/login 404 !== 200`

## Fix

`package.json` verification scripts now build the frontend before running the test suite:

```bash
npm run runtime:check \
  && npm run schema:check \
  && npm run migration:check \
  && npm run feature:check \
  && npm run route:check \
  && npm run audit:enterprise \
  && npm run lint:server \
  && npm run build \
  && npm run test \
  && ./node_modules/.bin/tsc --noEmit \
  && node scripts/check-server-syntax.js
```

The same correction was applied to `verify:offline`.

## Enterprise Guard

`scripts/audit-enterprise-features.js` now checks that both `verify` and `verify:offline` run `npm run build` before `npm run test`, preventing this regression from returning.

## Expected Result

On a clean server deployment, the production build creates `dist/index.html` and `dist/assets/*` before the browser reload and asset-verifier tests run. This clears the failing deployment log while preserving the production behavior that missing API and asset routes still return proper 404 responses instead of being masked by the SPA fallback.
