# SecureAsset Rental Unit Architecture — v168

SecureAsset rent listings now separate the public property/building profile from independently rentable rooms.

## Data ownership

`Property → PropertyFloor → RentalUnit → Tenancy → RentCycle`

- `Property` stores the address, building specifications, floor-management preference, common amenities, rules, gallery and visibility. Parent rent pricing is intentionally empty.
- `PropertyFloor` is optional. When floor management is disabled, units are returned as a flat list. When enabled, the landlord can add, edit, disable or delete (archive) floors and open a floor manager that groups every room by floor.
- `RentalUnit` owns room specifications, named/category-aware gallery metadata, independent pricing, public visibility and availability.
- `Tenancy` is a permanent record for one tenant's occupation of one room. Historical tenancies are never overwritten.
- `RentCycle` links every occupied room tenancy to an independent calendar-month invoice and payment balance.

## Availability and occupancy lock

Public rent properties are listed without a parent-property price. Their public structure includes every published room except archived rooms, grouped by floor when enabled. `AVAILABLE` and `APPLICATION_PENDING` rooms can be booked; rooms in the later tenancy workflow remain visible as locked so renters can inspect their details without submitting a duplicate booking. The permanent lock is created only after:

1. landlord accepts the application;
2. landlord and tenant complete the agreement;
3. the required initial room invoice is paid and landlord-approved; and
4. landlord selects **Verify & Start Rent Workflow**.

At that point the room moves to `OCCUPIED`, `isAvailable` becomes false, and `currentTenancyId` plus `currentTenantId` are set. The parent property remains public while any other room remains publicly available.

The landlord floor manager loads each floor's room status, current tenant contact details and complete tenancy history. Every history row retains the tenant, entered (`startDate`) and left (`endDate`) dates, agreement and payment links.

Public renters can open a dedicated `/room_details/:id` page for any published room. It displays that room's gallery, price and features, keeps locked rooms readable with a disabled **Book Now** button, and sends available-room bookings through the existing verified-KYC tenant application flow.

## Move-out

The tenancy follows notice period, vacating, inspection, final calculation, landlord review, final payment and deposit settlement before closure. Only a closed tenancy releases the room and clears its current-tenant pointers. All agreements, cycles, invoices, payments, evidence, inspections, notices and settlement records remain attached to the historical tenancy.

## Migration and deployment

`npm run migrate:rental-units` performs an idempotent conversion of legacy rentable `PropertySpace` records, links applications/agreements/tenancies/invoices, creates monthly cycles and clears parent-property rent pricing. The migration runs automatically before production indexes through `npm run db:auto-migrate`.

Run the standard production verification before deployment:

```bash
npm ci
npm run verify:offline
```
