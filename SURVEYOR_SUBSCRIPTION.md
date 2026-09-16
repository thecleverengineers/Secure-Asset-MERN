# Surveyor Subscription Module

## Same-account design

A registered Tenant can purchase a Surveyor Subscription and enable Surveyor Mode on the same authenticated account. The user keeps regular marketplace, property, application and payment features. Landlord and Surveyor subscriptions are independent and may coexist.

## Plans and limits

Seeded plans are Basic, Professional, Premium, Agency and Enterprise. Plans store configurable limits and features including:

- Public service listings
- Monthly jobs and quotations
- Team members and service locations
- Storage and report generation
- Client management and invoicing
- Digital signature, mapping, analytics and API access
- Featured placement and support level

Usage is checked in server-side services before public publishing or quota-consuming actions.

## Lifecycle

Supported statuses include trial, active, expiring soon, grace period, expired, suspended, cancelled and payment pending. A scheduled lifecycle service checks expiry, licence expiry, equipment calibration, project deadlines and overdue invoices.

After expiry/grace:

- Public profile and services are paused
- New public job applications and quotation submissions are blocked
- Existing projects, clients, reports, documents and pending payments remain accessible
- Renewal can restore eligible public records within the renewed plan limits

## Verification

Surveyors can save a draft verification record, upload professional details and submit it. Admin can mark it under review, request changes, verify, reject, suspend or expire it with notes/reasons. Public profile and service publishing require verified status.

## Profiles and services

Profiles support individual or agency records, specialisations, qualifications, licence details, languages, service locations, availability, pricing and portfolio information.

Visibility options:

- Private: dashboard-only and private share-link access
- Public: searchable marketplace profile after verification and active-plan validation

Private share links are revocable and may include an access code. Tokens and codes are stored as hashes.

Services support private/public visibility, pricing methods, coverage, duration, deliverables, equipment, policies and moderation. Public services require active subscription, verification and approval.

## Jobs, quotations and projects

Clients can create public, invited or private survey jobs. Public marketplace output hides exact location and contact data. Surveyors can submit scoped quotations with charges, tax, discounts, advance amount, schedule, terms and signature.

When a client accepts an eligible quotation:

1. The quotation becomes Accepted
2. Competing open quotations are rejected
3. The job becomes Awarded
4. A Survey Project is created
5. An advance invoice is created when required
6. Client and surveyor receive notifications

## Field operations

Surveyor Mode includes site visits, GPS capture, AES-GCM encrypted IndexedDB offline drafts, queued field media, server sync, timestamped measurements, observations, client/surveyor signatures and calculation records. Supported calculation handlers include plot area, perimeter, distance, elevation difference, slope, volume, unit conversion, built-up/carpet area, valuation and quantity estimates. Results retain inputs, formula, output, unit, performer and approval state.

Project geometry can be exported as GeoJSON or KML. GIS/CAD files and drawings can be stored as controlled project documents; production map tile/geocoding services require provider credentials.

## Reports

Reports support draft, review, revision, final and locked states with revision snapshots. A surveyor can digitally sign, finalize and lock a report. Locked reports are protected from normal edits. Authenticated exports are available as PDF, Excel, CSV, JSON, HTML and SVG.

## Finance

Surveyors can create advance, milestone and final invoices. Payments identify payer, payee, project and quotation, and track tax, travel, discount and platform commission. The included gateway action is a development simulation; production activation must come from a verified payment webhook.

## Privacy and security

- Surveyor ownership scoping applies to private profiles, services, clients, quotations, projects, field records, equipment, reports and payments
- Clients see only records in which they are the recorded client/payer
- Exact job location/contact details are removed from public payloads
- Uploads use size, MIME and file-signature checks plus SHA-256 checksums
- Audit logs record profile, verification, status, finance and report actions
- Public discovery requires active/grace-eligible subscription and publishing eligibility

## Administration

Admin resources include plans, subscriptions, verification, profiles, services, jobs, quotations, projects, reports, disputes, reviews, promotions, equipment categories and audit records. Admin review actions remain separate from surveyor ownership actions.
