# SecureAsset authenticated dashboard redesign

## What changed

- Rebuilt the authenticated application shell with a calmer, premium workspace layout: grouped navigation, clear active states, responsive mobile navigation, a command-style global search, account mode controls, and polished profile/notification actions.
- Introduced a shared `PageHeader` component and applied it to the dashboard, data modules, property management, property workflow, document vault, KYC, messages, notifications, subscriptions, field surveys, field data, search, applications, and site-visit flows.
- Restyled shared MUI primitives so every logged-in page now inherits consistent cards, controls, tables, dialogs, menus, chips, progress bars, and light/dark-mode treatment.
- Redesigned the role dashboard for administrators, managers, landlords, tenants, users, and surveyors with role-aware metrics, clear next actions, collection health, live activity, and a less dense information hierarchy.
- Refined the generic resource/table workspace to make filters, exports, status controls, records, mobile cards, and empty states faster to scan.
- Polished the four-step property wizard while preserving the existing workflow, uploads, dependent locations, private legal documents, and role/subscription enforcement.

## Design direction

The interface uses original SecureAsset styling with warm neutral surfaces, deep blue-green brand colour, restrained coral accents, generous whitespace, rounded operational cards, and quiet visual hierarchy. It takes inspiration from the clarity and ease of a modern hospitality/product dashboard without copying Airbnb assets, copy, or proprietary layouts.

## Runtime note

Build this package with the app's required runtime before deploying:

```bash
node --version # must be >= 24.18.0 and < 25
npm --version  # must be >= 11.16.0 and < 12
npm ci
npm run build
```

The supplied source package intentionally excludes `.env`, logs, backups, `node_modules`, and existing compiled frontend output. This keeps credentials private and ensures deployment generates a frontend that matches the redesigned source.
