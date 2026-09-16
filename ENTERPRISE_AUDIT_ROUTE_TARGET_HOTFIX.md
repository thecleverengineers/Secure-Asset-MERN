# Enterprise Audit Route Target Hotfix

## Issue
Production deployment reached `npm run audit:enterprise` and failed even though the API route contract and feature contract checks passed.

The failing audit line was:

`Every enabled application module resolves to a functional screen`

The audit listed many enabled sidebar items such as `add-property`, `pending-properties`, `rent-invoices`, `assigned-properties`, and similar role-based menu entries.

## Root Cause
Those sidebar records are valid menu aliases. Many of them intentionally route to an existing functional page with query filters, for example:

- `add-property` routes to `/app/properties?new=1`
- `pending-properties` routes to `/app/properties?status=pending_approval`
- `rent-invoices` routes to `/app/rental-invoices`
- `assigned-properties` routes to `/app/properties`

The old audit checked the module `key` only. It did not check the actual `/app/<screen>` route target. Because of that, it incorrectly expected separate frontend screens for every filtered sidebar alias.

## Fix
- Updated `scripts/audit-enterprise-features.js` to resolve enabled app modules by their actual route target.
- Updated `test/enterprise-platform.test.js` with the same route-target resolution logic.
- Added a functional `saved-properties` tenant workspace screen because that item points to its own `/app/saved-properties` route.
- Wired `saved-properties` in `ModulePage.tsx` so direct URL access renders a real screen after RBAC allows it.

## Result
The screen audit now validates what the user actually opens in the browser:

- query-filtered sidebar aliases resolve to their target resource/specialized screen
- direct app modules still require their own functional screen
- external marketplace links remain recognized as external modules

Static validation confirms:

- duplicate platform module records: 0
- unresolved enabled app modules: 0
- generic UI resources without backend contracts: 0
