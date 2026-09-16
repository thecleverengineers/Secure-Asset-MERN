# Property Workflow v9

Release: `2026-07-01-property-workflow-v9`

## Add and edit workflow

The Properties module now uses one dedicated responsive four-step form for both new listings and edits. The legacy generic property editor is bypassed.

1. **Property details**
   - Basic information and cover image upload
   - Full location and Google Maps location
   - Property specifications
   - Parking
   - Listing-specific pricing
2. **Utilities & amenities**
   - Utilities
   - Requested amenity switches
3. **Legal details**
   - RERA and legal/certificate status
4. **Media & contact**
   - Photos, floor plans, video, 360 media and legal documents
   - Owner/agent contact
   - Nearby facilities

## Data mapping

Every field is mapped to the Property MongoDB model and the writable resource API. Compatibility fields used by the marketplace and rental modules are updated from the new canonical groups:

- `specifications`
- `parking`
- `pricing`
- `utilities`
- `amenityDetails`
- `legalDetails`
- `contactInformation`
- `nearbyFacilities`
- `address`, `map`, and GeoJSON `location`

Existing properties remain compatible and are prefilled from either the new fields or their legacy equivalents.

## Media security

Property files use the existing SecureAsset Vault upload flow.

- Public images, videos, 360 media and floor plans are linked through controlled public streaming URLs.
- Property legal documents are stored with legal/private visibility and are not exposed by public listing APIs.
- Direct phone numbers and email addresses are not returned by public property serialization. Public visitors use the application or site-visit workflow for secure contact exchange.

## Deployment

No manual MongoDB migration is required because all new fields are optional schema additions. Use the normal deployment command:

```bash
cd /www/secureasset
sudo bash deploy.sh
```
