# Add Property Page and Property Status Label Final Fix

## What changed

1. Add Property now opens a dedicated full-page workflow at `/app/add_property` instead of opening the property creation modal from `/app/properties?new=1`.
2. Existing `/app/properties?new=1` links are safely redirected to `/app/add_property` so old bookmarks do not open the modal.
3. Admin and Landlord sidebar Add Property entries now point to `/app/add_property`.
4. Landlord dashboard and Property Structure Management Add Property buttons now point to `/app/add_property`.
5. The existing `PropertyFormWizard` now supports both layouts:
   - `layout="dialog"` for edit-modal use.
   - `layout="page"` for the new dedicated add-property screen.
6. Property status actions no longer show `Set status:` prefixes.
7. Property status labels are shown in this order:
   - Draft
   - Pending Approval
   - Available
   - Partially Occupied
   - Occupied
   - Reserved
   - Rented
   - Sold
   - Leased
   - Maintenance
   - Unavailable
   - Archived

## Files changed

- `src/app/pages/app/AddPropertyPage.tsx`
- `src/app/pages/app/ModulePage.tsx`
- `src/app/pages/app/ResourcePage.tsx`
- `src/app/components/property/PropertyFormWizard.tsx`
- `src/app/pages/app/PropertyManagementPage.tsx`
- `src/app/pages/app/RoleDashboardPage.tsx`
- `server/src/services/rbac.js`
- `test/tenant-property-flow.test.js`

## Validation

Focused tests should pass with:

```bash
node --test test/tenant-property-flow.test.js test/role-sidebar-permissions.test.js test/property-workflow.test.js test/admin-ux-location.test.js
```

Then validate production with:

```bash
npm run verify
```
