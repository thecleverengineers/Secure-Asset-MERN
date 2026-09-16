# Premium marketplace search and mobile UX

## Included

- Unified public search across properties, spaces, verified rentals, verified surveyors, trusted sellers, active landlords, cities, states, countries, localities, districts, landmarks and public addresses.
- Dedicated `/search` results page with category filters and ranked public results.
- Public search API at `GET /api/v1/public/search?q=...` with rate limiting and public-data sanitisation.
- Marketplace URL filters for `search`, `city`, `state`, `country`, `address`, `landlord`, `verified`, `trustedSeller`, `listingType`, property type and price range.
- Fixed public mobile app header and five-item bottom app bar.
- Mobile workspace header with module title and full-screen workspace search.
- Search suggestions rendered through a portal above dialogs and headers to prevent dropdown/loading overlap.
- Desktop header no longer uses an absolutely centred search pill, preventing collisions with navigation and account actions.

## Deployment

```bash
cd /www
sudo unzip -o secureasset2-premium-mobile-search-ux.zip -d /www
cd /www/secureasset
sudo bash deploy.sh
```

The deployment retains the existing `.env`, database records and uploaded storage.

## Validation

- TypeScript: passed
- Frontend production build: passed
- API route contracts: 139 passed
- Schema contracts: 71 models passed
- Feature contracts: 60 resources and 71 models passed
- Enterprise audit: 37 contracts passed
- Automated tests: 39 passed
- Server lint and syntax: passed
- Production dependency audit: 0 vulnerabilities
