# Tenant Booking, Site Visit and KYC Flow Final

This release wires the requested tenant-facing workflow changes on top of the previous working deployment hotfix.

## 1. Property Detail Actions

### Schedule Site Visit
- The public property detail page no longer sends the tenant to the generic `property-visits?new=1` modal-style resource flow.
- Clicking **Schedule site visit** now opens a dedicated page:
  - `/app/schedule_visit/:propertyId`
  - Alias also supported: `/app/schedule-visit/:propertyId`
- The selected room/space is passed through `?space=<spaceId>`.
- The page submits a real `property-visits` record through the protected resource API.

### Book Now
- The old **Apply for this room/property** button is renamed to **Book Now**.
- Clicking **Book Now** now opens a dedicated page:
  - `/app/apply_property/:propertyId`
  - Alias also supported: `/app/apply-property/:propertyId`
- The selected room/space is passed through `?space=<spaceId>`.
- The page submits a rental/property application through the existing secure application API.

## 2. Tenant Discovery Sidebar Dropdown

The tenant sidebar now groups Discovery links under a dropdown with this order:

1. Browse Properties
2. Rent Properties
3. Lease Properties
4. Sales Properties
5. Saved Properties

The dropdown is rendered in `AppShell.tsx` and uses the role-based platform module configuration from `rbac.js` / `platformDefaults.js`.

## 3. Tenant Dashboard KYC Gate

Regular tenant dashboard access is now gated:

- If a tenant opens `/app` or `/app/dashboard` before completing/submitting KYC, they are redirected to:
  - `/app/tenant-kyc?required=dashboard`
- Dashboard access is enabled once KYC is submitted, under review, or verified.
- If KYC is rejected/expired/changes required/not started, the tenant is sent back to the KYC page.

## 4. New Tenant KYC Form

The tenant KYC page now contains the requested 3-step KYC flow.

### Step A — Government Identity
Fields:
- Government identity dropdown
- Document ID input
- Front upload drag/drop
- Back upload drag/drop

Supported options:
- Aadhaar Card
- PAN Card
- Voter ID / EPIC
- Passport
- Driving Licence
- Government-issued Employee ID
- NREGA Job Card
- OCI Card
- Foreign Passport and valid Visa

### Step B — Address Proof
Fields:
- Address proof dropdown
- Document ID input
- Front upload drag/drop
- Back upload drag/drop

Supported options:
- Aadhaar Card
- Passport
- Voter ID Card
- Driving Licence
- Ration Card
- Recent electricity bill
- Recent water bill
- Recent gas bill
- Recent landline telephone bill
- Property tax receipt
- Registered rent or lease agreement
- Bank statement or bank passbook showing current address
- Government-issued residence/domicile certificate
- Employer-issued accommodation letter

### Step C — Passport Size Photo
Field:
- Upload Passport-Size Photograph drag/drop

Client validation:
- JPG, JPEG, PNG only
- Maximum size: 2 MB
- Shows required passport photo instructions in the UI

## 5. Backend KYC Mapping

`TenantKyc` now stores structured KYC details:

- `governmentIdentity.documentType`
- `governmentIdentity.documentId`
- `governmentIdentity.frontFile`
- `governmentIdentity.backFile`
- `addressProofDetails.documentType`
- `addressProofDetails.documentId`
- `addressProofDetails.frontFile`
- `addressProofDetails.backFile`
- `passportPhoto.file`

Legacy fields remain populated for compatibility:

- `governmentId`
- `addressProof`
- `profilePhoto`

## 6. Validation Performed

The following focused tests passed in the sandbox:

```bash
node --test test/property-workflow.test.js test/admin-ux-location.test.js test/tenant-property-flow.test.js test/role-sidebar-permissions.test.js
```

Result: 21/21 tests passed.

Static validation also confirmed:

- Platform modules: 200 total, 200 unique, 0 duplicates
- Enabled app modules unresolved by frontend screen audit simulation: 0
- Changed backend JS files pass `node --check`

## 7. Server Validation Note

This sandbox does not have `node_modules` installed, so commands importing `mongoose` such as `npm run feature:check`, `npm run route:check`, `npm run audit:enterprise`, and full `npm run verify` must be run on the production server after `npm ci`.
