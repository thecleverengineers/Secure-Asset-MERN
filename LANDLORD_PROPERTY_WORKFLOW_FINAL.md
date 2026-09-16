# Landlord Property Workflow Update

This build adds the requested landlord property add/edit/view workflow into the existing SecureAsset property module.

## What changed

### Landlord access and subscription control
- Landlords using tenant accounts can add properties only when landlord mode/subscription access is enabled.
- Backend property creation continues to enforce landlord subscription limits using the existing `assertLandlordLimit()` flow.
- Tenant-landlords can view and manage only their own scoped properties through the existing resource scope logic.

### Property add/edit wizard
The property wizard now keeps the platform's 4-step flow, with Step 1 expanded into the requested landlord property detail sections:

1. **Property Details**
   - A) Basic Information
   - B) Property Location
   - C) Property Specifications, optional with enable switch
   - D) Parking, optional with enable switch
   - E) Pricing, with dynamic rent/sale/lease amount field
2. **Utilities & Amenities**
3. **Legal Details**
4. **Media & Contact**

### Step 1 field coverage

#### A) Basic Information
- Property Title
- Property Type dropdown
- Listing Type dropdown
- Property Status
- Property Description
- Property Profile Image drag/drop upload

#### B) Property Location
- Worldwide Country dropdown
- State/Province dropdown based on selected country
- City dropdown based on selected country/state
- Locality
- Landmark
- PIN code
- Full address
- Google Map field
- Use Current Location button with backend reverse geocoding and address autofill

#### C) Property Specifications, optional
- Number of bedrooms
- Number of bathrooms
- Number of balconies
- Floor number
- Kitchen attached
- Area in sq. feet
- Property age
- Furnishing status
- Ownership type
- Available from

#### D) Parking, optional
- Car parking spaces
- Two-wheeler parking spaces
- Visitor parking

#### E) Pricing
- Monthly rent, sale price, or lease amount based on listing type
- Security deposit
- Maintenance charges
- Price per sq. feet
- Tax

### Public listing visibility
The new details are persisted to the property schema and the public detail page now displays the added kitchen-attached and tax fields when available.

## Main files changed

- `src/app/components/property/PropertyFormWizard.tsx`
- `src/app/pages/app/ResourcePage.tsx`
- `src/app/pages/PropertyDetailPage.tsx`
- `src/app/services/api.ts`
- `server/src/controllers/locationController.js`
- `server/src/routes/publicRoutes.js`
- `server/src/models/index.js`
- `server/src/controllers/resourceController.js`
- `.env.example`
- `.env.oneclick.example`
- `.env.production.example`
- `test/property-workflow.test.js`
- `test/admin-ux-location.test.js`

## Validation performed in this environment

Passed:

```bash
node --check server/src/controllers/locationController.js
node --check server/src/routes/publicRoutes.js
node --check server/src/models/index.js
node --check server/src/controllers/resourceController.js
node --test test/property-workflow.test.js test/admin-ux-location.test.js
```

Full `node --test test/*.test.js` could not fully complete in this container because dependencies were not installed and runtime packages such as `mongoose` were missing. The project also requires Node `>=24.18.0 <25` and npm `>=11.16.0 <12`, while this execution container has Node `22.16.0` and npm `10.9.2`.

## Deployment note

For Google Maps reverse geocoding, set either:

```env
GOOGLE_MAPS_GEOCODING_API_KEY=
```

or

```env
GOOGLE_MAPS_API_KEY=
```

If no Google key is configured, the backend attempts OpenStreetMap/Nominatim reverse geocoding as a fallback.
