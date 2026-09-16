# Admin UX and Worldwide Location Release v11

Release: `2026-07-02-admin-ux-location-v11`

## Approval property selection

Add Approval and Edit Approval now use the shared reference selector for properties. The field loads property records and displays their property titles instead of requiring administrators to copy or enter a MongoDB ObjectId.

## Responsive professional modal windows

Application dialogs use `ProfessionalDialog`, which provides a consistent responsive header and window controls:

- close
- minimize and restore
- maximize and restore
- automatic full-screen presentation on small screens

Existing dialog titles and content are retained, while the shared header prevents every module from implementing different window controls.

## Admin-managed sidebar sections and order

Administrators can manage application navigation from the Platform Modules screen. Each application module supports:

- section name
- section order
- item order within the section
- enabled or disabled state
- mobile navigation visibility

The sidebar is grouped and sorted from MongoDB configuration. The new `sectionOrder` field is backward-compatible, and the release adds a distinct production index rather than changing the definition of the existing navigation index.

## Avatar uploads

User profile and administrator-managed user forms upload an image file instead of asking for an external avatar URL. JPEG, PNG, WebP and GIF images are accepted. Profile uploads use the authenticated avatar endpoint and site-asset validation.

## Worldwide dependent locations

Shared regional forms now use searchable country, state/province and city selectors:

1. Choose any supported country.
2. Load only the states or provinces belonging to that country.
3. Load only the cities belonging to the selected state or province.

The location dataset is served through cached public API endpoints, keeping the browser bundle small. Existing legacy text values remain visible while records are edited. User profiles, properties, marketplace filters, area units, survey locations and generic resource forms use the shared selector where applicable.

## Public location API

- `GET /api/v1/public/locations/countries`
- `GET /api/v1/public/locations/states?country=IN`
- `GET /api/v1/public/locations/cities?country=IN&state=NL`

Responses are public-cacheable for one day and validate country/state codes before querying the dataset.
