# SecureAsset - Overall Features & Functions

This document summarizes the final consolidated SecureAsset feature set included in this package.

## 1. Platform Overview

SecureAsset is a role-based property, rental, lease, sale, tenant, surveyor, document, payment, communication, and reporting management platform. The system supports four primary operating roles:

1. Admin
2. Landlord
3. Tenant
4. Surveyor

Each role has separate sidebar menus, permissions, route access, data visibility, and feature controls.

---

## 2. Core System Functions

### Authentication & Account Access

- Email login support.
- Mobile/OTP authentication support.
- Fast2SMS OTP integration support.
- Admin account seeding/verification.
- Email/mobile identifier mapping validation.
- Secure session handling.
- Role-aware dashboard access.
- Tenant dashboard KYC gate.

### Role-Based Access Control

- Admin full platform access.
- Landlord own-data-only access.
- Tenant own-profile/application/payment/tenancy access.
- Surveyor assigned-data-only access.
- Dynamic sidebar loading by role.
- Direct URL access blocking where permission is missing.
- Permission categories:
  - view
  - create
  - edit
  - delete
  - approve
  - export
  - download
  - notify

### Subscription Control

- Landlord subscription plans.
- Surveyor subscription plans.
- Subscription feature limits.
- Subscription expiry handling.
- View-only behavior for expired subscriptions where applicable.
- Subscription invoices/history support.
- Plan upgrade/renewal navigation.

---

## 3. Admin Features

### Admin Dashboard

- Full platform overview.
- User counts.
- Landlord, tenant, and surveyor counts.
- Property totals.
- Rent, lease, and sale status overview.
- Payment and subscription overview.
- Complaints and maintenance overview.
- Site visits and tenant applications overview.

### User Management

- View all users.
- Add users.
- Edit users.
- Delete users.
- Assign roles.
- Change user status.
- Manage role permissions.
- Separate admin, landlord, tenant, and surveyor user groups.

### Property Management

- View all properties.
- Add property through dedicated page `/app/add_property`.
- Edit property.
- Delete property.
- View full property details.
- Approve/reject property.
- Publish/private property control.
- Manage property status.
- Manage property specifications.
- Manage room numbers.
- Manage gallery/media.
- Manage Google Map location.
- Manage property documents.
- Property verification support.

### Full Property View Sections

The Property Management view action displays details in structured sections:

1. Property Details
2. Utilities & Amenities
3. Legal Details
4. Media & Contacts
5. Media Preview

### Rent Management

- View all rent records.
- Create rent records.
- Edit rent records.
- Delete rent records.
- Track rent cycles.
- Track paid/unpaid/due rents.
- Generate rent invoices.
- Generate rent agreements.
- Send WhatsApp due reminders where configured.
- Download rent reports.

### Lease Management

- View all lease records.
- Create lease records.
- Edit lease records.
- Delete lease records.
- Track lease cycles.
- Track paid/unpaid/due lease records.
- Generate lease invoices.
- Generate lease agreements.
- Send WhatsApp due reminders where configured.
- Download lease reports.

### Property Sales Management

- View all property sales.
- Create sale records.
- Edit sale records.
- Delete sale records.
- Manage sale status.
- Manage payment status.
- Generate sale invoices.
- Generate sale agreements.
- Download sales reports.

### Payment Management

- View all payments.
- Track rent payments.
- Track lease payments.
- Track sales payments.
- Track subscription payments.
- Track pending, paid, unpaid, and failed payment status.
- Download payment reports.

### Subscription Management

- Create subscription plans.
- Edit subscription plans.
- Delete subscription plans.
- Assign subscriptions to landlords.
- Assign subscriptions to surveyors.
- Track active subscriptions.
- Track expired subscriptions.
- Send overdue notifications where configured.

### Landlord Management

- View all landlords.
- Add landlord.
- Edit landlord.
- Delete landlord.
- Verify landlord KYC.
- Verify ownership documents.
- View landlord properties.
- View landlord tenants.
- View landlord payments.
- View landlord subscriptions.

### Tenant Management

- View all tenants.
- Add tenant.
- Edit tenant.
- Delete tenant.
- View tenant profile.
- Verify tenant KYC.
- View family details.
- View occupation details.
- View interviews.
- View tenancy history.
- View payment history.

### Surveyor Management

- View all surveyors.
- Add surveyor.
- Edit surveyor.
- Delete surveyor.
- Verify surveyor documents.
- Assign property surveys.
- View submitted survey reports.
- Manage surveyor subscription.

### Site Visit Management

- View all visits.
- Approve/reject visits.
- Assign visits to landlords/surveyors.
- Reschedule visits.
- Track visit status.
- Notify tenant, landlord, or surveyor where configured.

### Tenant Applications

- View all applications.
- Approve/reject applications.
- Forward applications to landlords.
- View applicant KYC.
- View applicant full profile.
- Track application status.

### Active Tenancy

- View all active tenancies.
- Manage rent tenancy.
- Manage lease tenancy.
- Manage sale transfer tenancy.
- Track agreement periods.
- Track payment cycles.
- Manage renewals.
- Manage move-out process.

### Complaint & Maintenance

- View all complaints.
- Assign complaints.
- Update complaint status.
- Notify landlord/tenant where configured.
- Close complaints.
- Manage maintenance requests.

### Communications

- View messages.
- Reply to messages.
- View website inquiries.
- Manage contact form inquiries.
- Manage property inquiries.
- Manage booking inquiries.

### Reports

- Rent reports.
- Lease reports.
- Sales reports.
- Payment reports.
- Subscription reports.
- Income reports.
- Tax reports.
- PDF/Excel export support where enabled.

### Settings

- Drive administration.
- Security and session settings.
- Site, SEO, and home page settings.
- Navigation and module settings.
- Content pages.
- Integrations.
- Site identity.
- SMS/OTP settings.
- WhatsApp notification settings.
- SEO pages.
- Home carousel.
- Home sections.
- Property type configuration.
- Area unit configuration.

---

## 4. Landlord Features

Landlords can access only their own data according to subscription plan limits.

### Landlord Dashboard

- Own property summary.
- Own tenants.
- Rent income.
- Lease income.
- Sales income.
- Pending payments.
- Booking requests.
- Applications.
- Subscription status.
- Own property complaints.

### My Properties

- Add property based on subscription limit.
- Add property opens dedicated page `/app/add_property`.
- Edit own property.
- Delete own property.
- View own property.
- Publish/private status control.
- Manage gallery.
- Manage rooms.
- Manage pricing.
- Manage availability.
- Manage documents.

### Landlord Property Add/Edit Workflow

Property add/edit supports the complete multi-step workflow:

#### Step 1: Property Details

##### Basic Information

- Property title.
- Property type dropdown.
- Listing type dropdown.
- Property status.
- Property description.
- Property profile image drag-and-drop upload.

##### Property Location

- Country dropdown.
- State/province dropdown filtered by selected country.
- City dropdown filtered by selected state.
- Locality.
- Landmark.
- Pin code.
- Full address.
- Google Map/current-location address autofill support.

##### Property Specifications

Optional section controlled by enable checkbox:

- Number of bedrooms.
- Number of bathrooms.
- Number of balconies.
- Floor number.
- Kitchen attached checkbox.
- Area in square feet.
- Property age.
- Furnishing status.
- Ownership type.
- Available from date.

##### Parking

Optional section controlled by enable checkbox:

- Car parking spaces.
- Two-wheeler parking spaces.
- Visitor parking.

##### Pricing

- Monthly rent when listing type is rent.
- Sale price when listing type is sale.
- Lease amount when listing type is lease.
- Security deposit.
- Maintenance charges.
- Price per square foot.
- Tax.

### Property Status Labels

Status action labels are clean and ordered as:

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

### Tenant Management

- Add own tenants.
- View own tenants only.
- Edit own tenant details.
- View tenant KYC status.
- View tenant family details.
- View tenant occupation details.
- View tenant interview details.
- Assign tenant to own property.

### Rent Management

- Create rent for own property.
- Select own tenant.
- Edit rent.
- Delete rent.
- View rent cycle.
- View due date status.
- Generate rent agreement.
- Generate rent invoice.
- Track paid/unpaid rent.
- Send WhatsApp reminders where configured.

### Lease Management

- Create lease for own property.
- Select own tenant.
- Edit lease.
- Delete lease.
- View lease cycle.
- View due date status.
- Generate lease agreement.
- Generate lease invoice.
- Track paid/unpaid lease.
- Send WhatsApp reminders where configured.

### Sales Management

- Create sale for own property.
- Select own tenant/buyer.
- Edit sale.
- Delete sale.
- Manage sale status.
- Manage payment status.
- Generate sale agreement.
- Generate sale invoice.
- Notify buyer after transfer where configured.

### Booking & Applications

- Receive booking requests for own properties.
- View applicant tenant profile.
- Check KYC status.
- Approve/reject applications.
- Chat with applicant where enabled.
- Schedule site visits.

### Site Visits

- View site visits for own properties.
- Approve/reject visits.
- Reschedule visits.
- Mark visit completed.
- Chat with applicant where enabled.

### Payments

- View own rent payments.
- View own lease payments.
- View own sales payments.
- Track paid/unpaid payments.
- Download receipts.
- Download invoices.

### Reports

- Own reports only.
- Monthly reports.
- Yearly reports.
- Income reports.
- Profit and loss summary.
- Tax-friendly reports.
- PDF/Excel export where enabled.

### Legal Toolkit

- Rent agreement generator.
- Lease agreement generator.
- Sale agreement generator.
- Agreement download.
- Notice templates.
- Tenant verification form.
- Property handover form.

### Complaints & Maintenance

- View complaints for own properties.
- Reply to complaints.
- Update maintenance status.
- Mark complaint resolved.

### Landlord Profile & Verification

- Update landlord profile.
- Upload identity proof.
- Upload ownership document.
- Upload address proof.
- View verification status.
- Bank details section.

---

## 5. Tenant Features

Tenants can access only their own data and public property discovery.

### Tenant KYC Gate

Before dashboard access, tenants must complete KYC. If KYC is incomplete, the dashboard redirects to:

`/app/tenant-kyc?required=dashboard`

### Tenant KYC Steps

#### Step A: Government Identity

Document type dropdown includes:

- Aadhaar Card
- PAN Card
- Voter ID / EPIC
- Passport
- Driving Licence
- Government-issued Employee ID
- NREGA Job Card
- OCI Card
- Foreign Passport and valid Visa

Fields:

- Document ID.
- Front document drag-and-drop upload.
- Back document drag-and-drop upload.

#### Step B: Address Proof

Document type dropdown includes:

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
- Government-issued residence or domicile certificate
- Employer-issued accommodation letter

Fields:

- Document ID.
- Front document drag-and-drop upload.
- Back document drag-and-drop upload.

#### Step C: Passport-Size Photograph

- Recent colour photograph.
- Clear front-facing image.
- White or light background recommended.
- No sunglasses or filters.
- JPG, JPEG, or PNG format.
- Maximum file size: 2 MB.
- Recommended dimensions: 35 mm x 45 mm.
- Drag-and-drop upload field label: Upload Passport-Size Photograph.

### Tenant Dashboard

- Application status.
- Active tenancy.
- Rent/lease payment status.
- Upcoming due date.
- Site visit status.
- Complaints.
- Notifications.

### Tenant Discovery Sidebar

Discovery dropdown includes:

1. Browse Properties
2. Rent Properties
3. Lease Properties
4. Sales Properties
5. Saved Properties

### Property Search

- View public properties.
- Search rent properties.
- Search lease properties.
- Search sale properties.
- View property details.
- View property gallery.
- View property location.
- View room availability.
- Save properties.

### Booking / Apply Flow

- `Book Now` button opens a dedicated page instead of modal:
  - `/app/apply_property/:propertyId`
- `Schedule Site Visit` opens a dedicated page instead of modal:
  - `/app/schedule_visit/:propertyId`

### Tenant Applications

- Apply for rent property.
- Apply for lease property.
- Apply for property purchase.
- View application status.
- Cancel application.
- Chat with landlord/admin where enabled.

### Site Visits

- Book property visit.
- View scheduled visits.
- Reschedule visits.
- Cancel visits.
- View visit status.

### My Tenancy

- Active tenancy.
- Rent tenancy.
- Lease tenancy.
- Purchased property.
- Agreement period.
- Landlord details.
- Property details.
- Renewal request.
- Move-out request.

### Payments

- View own rent payments.
- View own lease payments.
- View own sale payments.
- Pay pending dues.
- Download invoices.
- Download receipts.
- View payment history.

### Agreements

- View own rent agreement.
- View own lease agreement.
- View own sale agreement.
- Download agreements.

### Complaints & Maintenance

- Raise complaint.
- Raise maintenance request.
- View complaint status.
- Reply to complaint.
- Close complaint after resolution.

### Messages & Notifications

- Inbox.
- Landlord chat where enabled.
- Admin chat where enabled.
- Rent due notifications.
- Lease due notifications.
- Payment notifications.
- Application updates.
- Site visit updates.
- Complaint updates.

---

## 6. Surveyor Features

Surveyors can access only properties and visits assigned by Admin.

### Surveyor Dashboard

- Assigned survey summary.
- Pending surveys.
- Completed surveys.
- Rejected/correction surveys.
- Subscription status where applicable.

### Assigned Properties

- View assigned properties only.
- View property details.
- View property location.
- View landlord basic details.
- View survey instructions.
- Start survey.
- Submit survey report.

### Property Survey

- Verify property location.
- Verify property images.
- Verify specifications.
- Verify room numbers.
- Verify parking details.
- Verify facilities.
- Upload survey images.
- Upload survey notes.
- Submit property condition report.

### Survey Reports

- View submitted reports.
- Edit before admin approval.
- Download own reports.
- Resubmit corrected reports.

### Site Visits

- View assigned visits.
- Coordinate visits.
- Update visit status.
- Mark visit completed.
- Submit visit notes.

### Documents

- Upload survey documents.
- View submitted documents.
- Upload verification proof.

### Subscription

- View surveyor subscription.
- View expiry date.
- Renew subscription.
- Download subscription invoice.

### Profile & Verification

- Update surveyor profile.
- Upload identity proof.
- Upload address proof.
- View verification status.

---

## 7. Media, Uploads & Document Vault

### Upload System

- Media upload support.
- Document upload support.
- Drag-and-drop upload support in major workflows.
- Local vault storage support.
- Public and protected file workflows.
- Upload metadata tracking.

### Malware Scanning Disabled

External malware scanning is disabled directly in the upload flow to avoid production upload failures when ClamAV is unavailable.

The following remain enabled:

- File extension allow-list.
- File size validation.
- Executable file guard.
- EICAR test-signature guard.
- File content vs extension validation where possible.
- Storage quota validation.

### Drive / Vault Features

- Folders.
- Files.
- File versions.
- Shares.
- Activity logs.
- Comments.
- Usage tracking.
- Upload sessions.
- Content reports.
- Drive policy support.

---

## 8. Public Website & Marketplace

### Public Property Marketplace

- Public property listing.
- Rent property discovery.
- Lease property discovery.
- Sale property discovery.
- Property details page.
- Property image/gallery display.
- Location and map support.
- Room availability display.
- Inquiry and booking entry points.

### Public Content Management

- SEO pages.
- Home carousel.
- Home sections.
- Content pages.
- Site settings.
- Site identity.
- Public assets and SPA fallback handling.

---

## 9. Notifications & Communications

- Notification preferences.
- Notification delivery records.
- SMS/OTP settings.
- WhatsApp notification settings where configured.
- Conversations.
- Messages.
- Website inquiries.
- Property inquiries.
- Booking inquiries.
- Contact forms.
- Due reminders where configured.

---

## 10. Automation & Background Scripts

### Database / Migration Scripts

- MongoDB connection check.
- Schema contract validation.
- Migration contract validation.
- Automatic migration runner.
- Advanced rental migration.
- Tenant/landlord migration.
- Document vault migration.
- Legacy upload migration.
- Enterprise platform migration.
- Auth identifier migration.

### Repair Scripts

- Production index repair.
- Surveyor subscription index repair.
- User phone index repair.
- Legacy ObjectId placeholder repair.
- Auth routing repair.

### Production Scripts

- Runtime check.
- Production environment validation.
- Production dependency install.
- Production service check.
- Server syntax check.
- Public asset verification.
- Build verification.
- PM2 release reconciliation.
- aaPanel vhost reconciliation.
- aaPanel vhost include repair.
- NGINX template support.

### Background Jobs

- Notification delivery processor.
- Rental automation processor.
- Drive trash purge.

---

## 11. Deployment & Runtime

### Supported Runtime

- Node.js 24.18.0 or newer as configured by the project.
- npm 11.16.0 or compatible with the runtime contract.
- MongoDB 8.x supported in production checks.

### Deployment Support

- One-click deploy scripts.
- Enterprise deploy script.
- aaPanel NGINX templates.
- Static SPA fallback support.
- PM2 ecosystem configuration.
- Production backup before deployment.
- Production environment examples.

### Validation Commands

Recommended production validation:

```bash
npm ci
npm run verify
```

Individual checks:

```bash
npm run runtime:check
npm run schema:check
npm run migration:check
npm run feature:check
npm run route:check
npm run audit:enterprise
npm run test
npm run build
```

---

## 12. Final Consolidated Hotfixes Included

This package includes the completed fixes from the recent delivery chain:

- Landlord property workflow final.
- Role-based sidebar and permission system.
- Landlord role contract hotfix.
- Duplicate platform module audit hotfix.
- Enterprise route-target audit hotfix.
- Tenant booking and KYC flow.
- Add Property full-page workflow.
- Clean property status labels.
- Full property detail view sections.
- Malware scanning disabled for uploads.

---

## 13. Important Notes

- The system is designed to enforce both UI-level sidebar visibility and backend/direct-route permission protection.
- Landlords should only see and manage their own data.
- Tenants should only access public property discovery and their own records.
- Surveyors should only access assigned properties/visits/reports.
- Admin retains full access.
- Full production verification should always be run on the target server using the required Node.js version and live MongoDB configuration.
