# Role-Based Sidebar Permission & Access Wiring Final

This release wires the requested Admin, Landlord, Tenant and Surveyor sidebar/permission structure into the SecureAsset application.

## What was implemented

### 1. Central RBAC service

Added `server/src/services/rbac.js` as the single permission map for:

- Effective role resolution: `admin`, `landlord`, `tenant`, `surveyor`.
- Legacy mode compatibility: tenant accounts in Landlord Mode resolve as `landlord`; tenant accounts in Surveyor Mode resolve as `surveyor`.
- Admin, Landlord, Tenant and Surveyor sidebar definitions.
- Resource action permissions: `view`, `create`, `edit`, `delete`, `approve`, `export`, `download`, `notify`.
- Subscription-based module restrictions for landlords and surveyors.
- Expired subscription behaviour: view-only modules remain visible; create/edit/delete/approve/notify actions are blocked.

### 2. Dynamic sidebar configuration

Updated platform configuration so `/api/v1/site/app-config` now returns:

- `modules`: sidebar modules filtered for the logged-in role/mode/subscription.
- `permissions`: action permissions for visible modules.
- `effectiveRole`: resolved role after mode handling.
- `effectiveMode`: resolved mode.
- `subscription`: subscription state/tier used for sidebar gating.

The frontend sidebar in `AppShell.tsx` consumes this app config and renders only the allowed modules.

### 3. Direct URL blocking

Updated frontend module routing in `ModulePage.tsx` so hidden sidebar items are also blocked if a user manually enters the URL. Unauthorized users see an Access Denied screen.

Updated backend resources so every resource endpoint checks the RBAC action before running list, get, create, update, delete or status-change logic.

### 4. Data scoping

Updated `server/src/services/scope.js` so data access is scoped correctly:

- Admin: all data.
- Landlord: own properties, own tenants, own rent/lease/sales/payment/application/complaint/site-visit records.
- Tenant: own profile, applications, tenancy, payments, agreements, complaints and public property discovery.
- Surveyor: only assigned properties/surveys/site visits/reports and own subscription/profile/documents.

### 5. Subscription rules

Landlord and surveyor menus now use tier checks:

- Basic/free/starter: dashboard, limited listing/profile/basic records.
- Standard/professional: rent/lease/site visits/basic reports.
- Premium/business/enterprise: sales, WhatsApp reminder workflows, legal toolkit, advanced reports and export-oriented features.

If subscription is inactive/expired, mutations are blocked by backend RBAC and the sidebar keeps only renewal/view-safe modules.

### 6. Realtime and search/report enforcement

Updated realtime resource subscription, global search and report endpoints to use the same RBAC action checks. This avoids leaking module data through secondary APIs.

### 7. Raw landlord role support

The user model, platform module model, frontend role type and resource metadata now include a first-class `landlord` role while preserving the existing tenant Landlord Mode compatibility.

## Key changed files

- `server/src/services/rbac.js`
- `server/src/services/platformDefaults.js`
- `server/src/services/platformConfiguration.js`
- `server/src/services/scope.js`
- `server/src/services/socket.js`
- `server/src/services/resources.js`
- `server/src/controllers/siteController.js`
- `server/src/controllers/resourceController.js`
- `server/src/controllers/searchController.js`
- `server/src/controllers/reportController.js`
- `server/src/controllers/dashboardController.js`
- `server/src/controllers/propertyManagementController.js`
- `server/src/models/index.js`
- `server/src/models/propertyManagement.js`
- `src/app/components/layout/AppShell.tsx`
- `src/app/pages/app/ModulePage.tsx`
- `src/app/pages/app/ResourcePage.tsx`
- `src/app/components/shared/ProtectedRoute.tsx`
- `src/app/services/api.ts`
- `src/app/services/types.ts`
- `test/role-sidebar-permissions.test.js`

## Validation performed

Passing focused tests:

```bash
node --test test/property-workflow.test.js test/admin-ux-location.test.js test/role-sidebar-permissions.test.js
```

Syntax checks performed:

```bash
node --check server/src/services/rbac.js
node --check server/src/services/platformDefaults.js
node --check server/src/services/platformConfiguration.js
node --check server/src/controllers/siteController.js
node --check server/src/controllers/resourceController.js
node --check server/src/controllers/searchController.js
node --check server/src/controllers/reportController.js
node --check server/src/services/scope.js
node --check server/src/services/socket.js
node --check server/src/services/resources.js
node --check server/src/controllers/dashboardController.js
node --check server/src/controllers/propertyManagementController.js
```

Full test/build note:

This sandbox does not have `node_modules` installed and is running Node 22.16.0, while the project declares Node >=24.18.0 and npm >=11.16.0. Run `npm ci`, `npm run build`, and `npm test` on the required production runtime before deployment.
