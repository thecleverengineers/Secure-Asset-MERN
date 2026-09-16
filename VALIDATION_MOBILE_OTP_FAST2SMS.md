# Mobile OTP and Fast2SMS Validation

Validated on 30 June 2026.

## Implemented flows

- Registration requires name, email, Indian mobile number and password.
- A purpose-bound OTP is sent to the registration mobile through Fast2SMS.
- The account remains pending until the mobile OTP is verified.
- Password login accepts either the registered email or registered mobile number.
- Optional OTP login resolves either identifier to the account and sends the OTP only to its registered mobile.
- Password reset accepts the registered email or mobile number and sends the reset OTP only to that account's registered mobile.
- Fast2SMS endpoint, route, sender ID, DLT message ID, variable template, schedule time, authorization key and enabled state are editable by an administrator.
- The Fast2SMS authorization key is encrypted at rest and is never returned by the API.
- A test-OTP action is available in Site Administration > SMS / OTP.
- The Clever Engineers administrator seed is wired into production deployment without deleting existing users.

## Automated validation

- TypeScript: passed
- Server ESLint with zero warnings: passed
- Node automated tests: 27 passed
- Frontend/API route contracts: 138 passed across 18 mounted route groups
- Feature contracts: 60 resources and 71 models passed
- Schema contracts: 71 models passed
- Enterprise audit: 37 contracts passed
- Server syntax validation: passed
- Vite production build: passed
- SPA fallback production validation: passed

## Deployment requirements

1. Deploy with Node.js 24 as required by the project runtime policy.
2. Configure the complete Fast2SMS authorization key in Site Administration > SMS / OTP. A masked value cannot authenticate and is intentionally rejected.
3. Use the Test OTP button to verify the live Fast2SMS/DLT template before enabling public registration.
4. Run `npm run seed:admin` or the included production deployment script to create/promote the requested administrator.
5. Change the bootstrap administrator password immediately after first successful login.

Live delivery was not executed in this workspace because the supplied Fast2SMS authorization value was masked and no production MongoDB was connected.
