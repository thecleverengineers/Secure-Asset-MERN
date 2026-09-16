# Advanced Rental, Tenant and Dynamic Property System

## Capability model

Every normal account is a Tenant account. The same account may enable Landlord Mode and Surveyor Mode through independent subscriptions. Landlord access is a paid capability, not a separate login or duplicate user.

## Database-driven site and CMS

The public website is controlled through MongoDB collections rather than hard-coded content:

- `SiteSetting` — site title, short title, logo, light logo, favicon, brand colours, font, contact details, social links, map provider, maintenance mode and global SEO defaults.
- `SeoPage` — route-specific title, description, keywords, robots, canonical URL, Open Graph, X/Twitter card and JSON-LD.
- `HomeCarousel` — scheduled desktop/mobile slides, CTA buttons, audience, alignment and ordering.
- `HomeSection` — statistics, features, featured content, locations, testimonials, CTA and custom sections.
- `PropertyTypeConfig` — property type, hierarchy mode, allowed purposes and form fields.
- `AreaUnit` — regional units and square-metre conversion factors.
- `LandlordPlan` — prices, structural limits and enabled features.

Admin updates are returned by `/api/v1/site/config` and applied at runtime. A content or SEO change does not require another Vite build.

## Flexible property hierarchy

The platform supports:

```text
Property
└── Building
    └── Floor
        └── Apartment / Office / Shop / Showroom / Warehouse Unit
            └── Room
                └── Bed
```

A landlord can also use a simple hierarchy for a complete house, villa, event hall or land parcel. Each eligible property or child space may be independently configured for Rent, Sale or Lease, subject to its database property-type rules.

## Subscription enforcement

Landlord plans count these resources separately:

- Properties
- Buildings
- Apartments
- Rooms
- Beds
- Public marketplace listings
- Active tenants
- Team members
- Storage

Limits are enforced by the Node.js API, not only by the interface. Reducing or expiring a plan never deletes property data. Public listings are paused or made private according to the subscription policy, while the owner retains access to existing records.

## Dynamic property forms

The Admin can define fields for every property type through `PropertyTypeConfig.fields`. Selecting a property type in the property form loads those fields from MongoDB and saves their values under `Property.customAttributes`.

Examples included by the migration:

- Apartment: building name, apartment number, lift availability
- PG/Hostel: bed inventory, shared bathroom, meal availability
- Shop/Showroom: frontage and display details
- Warehouse/Factory: clear height, loading dock, truck access and power load
- Land: land use, boundary description and road width
- Event Hall: guest capacity, stage and catering rules
- Hotel: room inventory, room categories and hotel category

The server validates that the selected property type is active, derives its hierarchy mode, and rejects a Rent/Sale/Lease purpose not allowed by that type.

## Galleries

`PropertyMedia` links media to either the complete property or a specific apartment, room, bed or commercial unit. It supports:

- Area/category labels
- Images and videos
- Captions and alt text
- Ordering and cover selection
- Public/private visibility
- Watermark and compression metadata
- Upload ownership and audit information

The public property page separates complete-property media from space-specific galleries.

## Tenant profile, occupants and KYC

Tenant records include a full profile, identity and employment documents, emergency contact, preferences and profile visibility. `TenantKyc` records the review lifecycle and reasons for corrections or rejection. `Occupant` stores each family member or authorised occupant separately.

A tenant must hold valid Verified KYC before submitting an application. Sensitive family and KYC records are ownership scoped and are never included in public marketplace responses.

## Applications, interviews and selection

Applications support complete properties and individual spaces. The API records the applicant and property owner separately so a Tenant/Landlord account can safely see:

- Applications they submitted
- Applications received for their own listings

Landlords can review, shortlist, wait-list, request documents, schedule interviews and approve or reject applicants. Approving an application can create a tenancy, reserve the selected space and preserve the application history.

## Site visits and location privacy

Customers can request a site visit for a property or child space. Owners can approve, reschedule, assign a representative, record attendance and collect feedback.

Location settings support:

- Exact public location
- Approximate public location
- Exact location after application
- Exact location after visit approval
- Selected-user access

The public page uses the map provider configured by Admin. Google Maps Embed is used when a public API key is configured; otherwise an OpenStreetMap preview is used where coordinates are public. Get Directions remains available.

## Tenancy, rent and utilities

A tenancy links the tenant, landlord, property and optional apartment/room/bed. Rental invoices support:

- Base rent
- Electricity and water
- Maintenance, parking, internet, gas and cleaning
- Common-area charges
- Security deposits and late fees
- Other custom charges
- Discounts, previous balance and partial payments

Approved meter readings calculate:

```text
Units consumed = Current reading - Previous reading
Utility amount = Units consumed × Rate per unit + Fixed charge + Tax + Other charge
```

Approved utility readings update the corresponding monthly invoice. The scheduled rental worker creates monthly invoices, identifies overdue balances and creates deduplicated reminders.

## Marketplace and promotions

Only eligible, available, public and published properties/spaces belonging to an actively subscribed landlord are returned publicly. Search supports property type, hierarchy level, Rent/Sale/Lease, location and price.

Promotions track featured, top listing, urgent rent/sale, homepage placement, views, clicks, enquiries, applications, visits and conversions.

## Exports and records

Landlords can export database-scoped property data. The Document Vault continues to manage private legal, tenant, survey, payment and property records independently of listing deletion.

## Security boundaries

- Property ownership is checked by MongoDB queries on every write.
- Managers are restricted to assigned properties.
- Tenants see only their own private tenancy data and landlord-owned records where they are the owner.
- KYC, occupant, application, payment and exact-location information are excluded from public endpoints.
- Status transitions are role and ownership aware.
- All material changes can be recorded in audit logs.
