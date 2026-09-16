# Add Property Page, Status Labels, and Property View Final Update

This release applies the requested UI and workflow updates on top of the previous tenant booking/KYC and route-audit fixes.

## 1. Add Property full page

- The Add Property action opens the dedicated full-page route `/app/add_property`.
- The existing property wizard is reused in `layout="page"` mode so create/edit field mapping remains consistent.
- Sidebar and dashboard Add Property entry points already target `/app/add_property`.
- The old `/app/properties?new=1` resource-modal shortcut remains redirected safely to `/app/add_property`.

## 2. Property status action labels

Property Management status actions now use clean labels without `Set status:` and in this order:

1. Draft
2. Pending Approval
3. Available
4. Partially Occuped
5. Occupied
6. Reserved
7. Rented
8. Sold
9. Leased
10. Maintenance
11. Unavailable
12. Archidved

The same label mapping is used by the property wizard and the resource listing/action menus.

## 3. Full property details view

In Property Management, clicking the View action now opens a detailed grouped property view instead of only showing table columns.

The detail view includes:

- Property Details
- Utilities & Amenities
- Legal Details
- Media & Contacts
- Media Preview

The grouped view shows all available property information including basic details, location, pricing, specifications, parking, utilities, amenities, nearby facilities, legal details, documents, media, owner/manager, and contact fields.

## 4. Validation

Focused static tests passed:

```bash
node --test test/property-workflow.test.js test/admin-ux-location.test.js test/tenant-property-flow.test.js test/role-sidebar-permissions.test.js
```

Result: 25/25 tests passed.

Full production `npm run verify` should be run on the deployment server where Node 24.18.0 and npm dependencies are installed.
