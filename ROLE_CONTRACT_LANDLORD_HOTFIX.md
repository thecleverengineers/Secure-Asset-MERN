# Role Contract Landlord Hotfix

This hotfix fixes the production deployment failure where `npm run feature:check` rejected `landlord` inside `readRoles`, `createRoles`, `updateRoles`, and `deleteRoles`.

## Root cause

`server/src/models/index.js`, `server/src/services/resources.js`, and the RBAC layer already treat `landlord` as a valid first-class platform role. However, `scripts/verify-feature-contracts.js` still had an older hard-coded role allow-list:

```js
['admin', 'manager', 'tenant', 'user', 'surveyor']
```

Because `landlord` was missing from that validator list, deployment failed during `npm run verify` at `npm run feature:check`, even though the application role model supported landlord.

## Fix

`verify-feature-contracts.js` now imports the canonical role lists from `server/src/services/rbac.js`:

```js
import { LEGACY_ROLE_KEYS, ROLE_KEYS } from '../server/src/services/rbac.js';
const roles = new Set([...ROLE_KEYS, ...LEGACY_ROLE_KEYS]);
```

This keeps the contract checker aligned with the actual RBAC role system and prevents future mismatch when roles are updated.

## Validation

Run on the production server with Node.js `24.18.0` and npm `11.16.0`:

```bash
npm run feature:check
npm run verify
```

A focused regression test was also added to confirm that the contract role set includes `landlord`, `manager`, and `user`.
