# SecureAsset API Reference

Base URL: `/api/v1`. Protected endpoints require:

```http
Authorization: Bearer <accessToken>
```

Refresh tokens are stored in an HTTP-only cookie.

## Authentication

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/send-otp`
- `POST /auth/verify-otp`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

New public registrations are Tenant accounts.

## Property and landlord subscription

- `GET /subscriptions/plans`
- `GET /subscriptions/me`
- `POST /subscriptions/checkout`
- `POST /subscriptions/:id/cancel`
- `GET /public/properties`
- `GET /public/properties/:id`

Tenant-owned property CRUD uses `/resources/properties`. Public marketplace eligibility is validated server-side.

## Surveyor subscription and mode

- `GET /surveyor-subscriptions/plans`
- `GET /surveyor-subscriptions/me`
- `POST /surveyor-subscriptions/checkout`
- `POST /surveyor-subscriptions/change-plan`
- `POST /surveyor-subscriptions/renew`
- `POST /surveyor-subscriptions/:id/cancel`
- `POST /surveyor-subscriptions/mode`
- `GET /surveyor-subscriptions/dashboard`

Mode body:

```json
{ "mode": "surveyor" }
```

Allowed values are `regular`, `landlord` and `surveyor`, subject to active capability.

## Verification and profile

- `GET /surveyor-subscriptions/verification`
- `PUT /surveyor-subscriptions/verification`
- `POST /surveyor-subscriptions/verification/submit`
- `POST /surveyor-subscriptions/verification/:id/review` — Admin
- `PUT /surveyor-subscriptions/profile`
- `POST /surveyor-subscriptions/profile/visibility`
- `POST /surveyor-subscriptions/profile/share-link`
- `DELETE /surveyor-subscriptions/profile/share-link`

Optional protected link body:

```json
{ "accessCode": "client-code" }
```

## Public survey marketplace

- `GET /public/surveyors`
- `GET /public/surveyors/:id-or-slug`
- `GET /public/surveyor-private/:id?token=...&code=...`
- `GET /public/survey-services`
- `GET /public/survey-jobs`

## Surveyor records

Scoped CRUD is available under `/resources/:resource` for:

`surveyor-plans`, `surveyor-subscriptions`, `surveyor-verifications`, `surveyor-profiles`, `survey-services`, `survey-jobs`, `survey-quotations`, `survey-projects`, `site-visits`, `field-data`, `survey-equipment`, `survey-reports`, `survey-team`, `survey-clients`, `survey-reviews`, `survey-disputes`, `survey-promotions`.

The server applies ownership, role, subscription, verification, limit and workflow checks.

## Quotation to project

```http
POST /surveyor-subscriptions/quotations/<quotation-id>/accept
```

Only the recorded client or an authorised Admin can accept an eligible quotation.

## Field data and calculations

- `POST /surveyor-subscriptions/field-data/sync`
- `POST /surveyor-subscriptions/field-data/:id/calculate`
- `POST /surveyor-subscriptions/field-data/:id/calculations/:calculationId/approve`
- `GET /surveyor-subscriptions/projects/:projectId/geojson`
- `GET /surveyor-subscriptions/projects/:projectId/kml`

## Survey reports

- `POST /surveyor-subscriptions/reports/:id/finalize`
- `GET /surveyor-subscriptions/reports/:id/export?format=pdf`

Formats: `pdf`, `xlsx`, `csv`, `json`, `html`, `svg`.

## Survey invoicing

- `POST /surveyor-subscriptions/projects/:projectId/invoices`
- `POST /surveyor-subscriptions/invoices/:id/pay`

The local `pay` operation is a development payment simulation. Replace it with verified gateway webhook processing in production.

## Uploads

```http
POST /uploads/document
Content-Type: multipart/form-data
```

Uploads are authenticated and validated for size, declared MIME, basic file signature, blocked executable content and checksum. Production deployments should add cloud storage and a dedicated malware-scanning service.


# Universal Document Vault

All `/drive` endpoints require authentication unless stated otherwise.

## Drive and folders

- `GET /drive/bootstrap`
- `GET /drive/items?folderId=&status=&category=&visibility=&starred=`
- `GET /drive/search?q=&category=&visibility=&tag=&property=&surveyProject=`
- `GET /drive/shared-with-me`
- `GET /drive/activity`
- `GET /drive/analytics`
- `POST /drive/folders`
- `PATCH /drive/folders/:id`
- `POST /drive/folders/:id/duplicate`
- `GET /drive/folders/:id/download`
- `POST /drive/bulk`

## Files, scanning and generated documents

- `POST /drive/files` — multipart field `file`
- `POST /drive/scan-to-pdf` — multipart JPG/PNG fields named `pages`
- `POST /drive/generated-documents` — platform-generated text/base64 record
- `GET /drive/files/:id`
- `GET /drive/files/:id/content?download=true|false`
- `PATCH /drive/files/:id`
- `POST /drive/files/:id/versions`
- `POST /drive/files/:id/versions/:version/restore`
- `POST /drive/files/:id/approval`

## Sharing

- `GET /drive/:type/:id/shares`
- `POST /drive/:type/:id/shares`
- `DELETE /drive/shares/:shareId`
- `POST /drive/:type/:id/public-link`
- `DELETE /drive/:type/:id/public-link`

Public endpoints:

- `GET /public-drive/:type/:token`
- `GET /public-drive/file/:token/content`
- `GET /public-drive/folder/:token/files/:fileId/content`

Restricted links accept `x-share-password`, `x-share-email` and `x-country-code` headers, or corresponding query values where supported.

## Retention

- `POST /drive/:type/:id/trash`
- `POST /drive/:type/:id/restore`
- `DELETE /drive/:type/:id/permanent`

Final immutable records cannot be deleted by normal users. Scheduled cleanup is handled by `npm run vault:purge` and the PM2 retention process.

## Admin

- `GET /drive/admin/overview`
- `GET /drive/admin/usage`
- `GET /drive/admin/reports`
- `POST /drive/admin/reports/:id/review`
- `GET /drive/admin/policy`
- `PATCH /drive/admin/policy`
- `POST /drive/admin/users/:userId/recalculate`

# Dynamic Site CMS and Advanced Rental API

## Public site configuration

- `GET /site/config?path=/marketplace`
- `POST /site/enquiries`
- `GET /site/properties/:id/structure`

The configuration response contains public-safe site settings, route SEO, active carousel slides, active homepage sections, landlord plans, property types and area units.

## Admin CMS resources

Admin CRUD uses `/resources/:resource` for:

- `site-settings`
- `seo-pages`
- `home-carousel`
- `home-sections`
- `landlord-plans`
- `property-type-configs`
- `area-units`
- `site-enquiries`

Admin image upload:

- `POST /site/admin-assets` — authenticated multipart field `file`

## Property hierarchy and rental operations

- `GET /property-management/landlord-overview`
- `GET /property-management/properties/:propertyId/tree`
- `GET /property-management/properties/:propertyId/export?format=json|csv`
- `POST /property-management/kyc/submit`
- `POST /property-management/kyc/:id/review`
- `POST /property-management/applications`
- `POST /property-management/applications/:id/decision`
- `POST /property-management/applications/:id/create-tenancy`
- `POST /property-management/utility/calculate`

Scoped CRUD resources include:

- `properties`
- `property-spaces`
- `property-media`
- `tenant-profiles`
- `tenant-kyc`
- `occupants`
- `applications`
- `tenant-interviews`
- `property-visits`
- `tenancies`
- `rental-invoices`
- `utility-readings`
- `reminder-rules`
- `property-promotions`

Property writes validate the database property type, allowed listing purpose and hierarchy mode. Tenant/Landlord writes are ownership scoped, and structural subscription limits are checked server-side.
