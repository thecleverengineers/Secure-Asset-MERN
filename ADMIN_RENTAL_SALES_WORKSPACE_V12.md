# SecureAsset Admin Rental/Sales Workspace v12

Release: `2026-07-03-admin-rental-sales-workspace-v12`

This release reorganizes the admin workspace into the requested operational areas and extends property, rent, lease, sales, tenant, landlord, surveyor, payments, communications, settings, and public tenant-facing views.

## Admin workspace

The sidebar modules are grouped and ordered into:

1. User Management
2. Property Management
3. Rent Management
4. Lease Management
5. Property Sales Management
6. Track All Payments
7. Manage Subscriptions
8. Manage Surveyors
9. Manage Landlords
10. Settings
11. Communications
12. Complaint & Maintenance
13. Manage Tenants
14. Manage Site Visits
15. Tenant Applications
16. Active Tenancy

The Settings group contains Drive Administration, Security & Session, Site/SEO/Home Page, Navigation & Modules, Content Pages, Integrations, Site Identity, SMS/OTP, WhatsApp Notification, SEO Pages, Home Page Carousel, Home Page Sections, Property Type, and Area Units.

## Property Management

Property Management now exposes and persists the requested property details:

- Bedrooms, bathrooms, balconies, room count, floors, floor number, total building floors
- Built-up area in sq. ft. and sq. meters
- Carpet area in sq. ft. and sq. meters
- Property age, ownership type, furnishing status, facing, availability date
- Exact Google Maps location and coordinates
- Room number and apartment number inventory through Property Spaces
- Room/property/apartment gallery scope through Property Media

## Tenant-facing public pages

Public property and space serialization exposes tenant-safe listing details:

- Property specifications
- Area in sq. ft. and sq. meters
- Exact map location only when the listing is configured for exact public location
- Room and apartment identifiers
- Space-level and property-level gallery metadata

Direct owner/agent contact information and private legal documents remain protected.

## Rent, lease, sales, and payments

Rent and lease resources now support payment cycle, WhatsApp due-reminder flag, legal-agreement metadata, due/active status tracking, and report-ready data. Payments support rent, lease, and sale types so invoices and payment status can be tracked consistently from the Track All Payments workspace.

## Validation

Validated locally with:

- 81 automated tests
- 143 API route contracts
- 71 MongoDB model contracts
- 60 resource contracts
- 37 enterprise audit contracts
- TypeScript
- Server ESLint
- Server syntax validation
- Production frontend build
- Production dependency audit with dev dependencies omitted
