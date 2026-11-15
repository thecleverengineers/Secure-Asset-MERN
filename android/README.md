# SecureAsset Android

Native Android client for SecureAsset, built with Kotlin and Jetpack Compose. It uses the existing `/api/v1` service for account sessions, property discovery, saved listings, tenant verification, applications and notifications.

## Build

Open this `android` directory in Android Studio with JDK 17 or newer and Android SDK Platform 37 installed, or run:

```bash
gradle :app:assembleDebug
```

The default API is `https://secureasset.in/api/v1/`. For a staging environment, override it with a Gradle property:

```bash
gradle :app:assembleDebug -PsecureAssetApiBaseUrl=https://staging.example.com/api/v1/
```

Only HTTPS is permitted. The app supports Android 7.0 (API 24) and newer, compiles against API 37, targets API 36, adapts navigation for phones and larger displays, and stores only the rotating session and CSRF cookies encrypted with an Android Keystore AES-GCM key.

The GitHub Actions Android build assembles debug and release APKs on relevant pushes and pull requests. The release APK is unsigned until production signing credentials are configured.

## Included flows

- Browse public listings as a guest; sign in when saving a home or applying.
- Email or phone and password sign-in, two-factor challenge, password reset, tenant registration and registration OTP.
- Browse, search and filter public rent, sale and lease listings.
- Property detail, image gallery, map hand-off, saved listings, rental applications, notifications and account sign-out.
- Tenant KYC document uploads, review status, corrections and WhatsApp contact updates for verified tenants.
- Owned property listings when the signed-in account has landlord capability.

The app is a native client and does not wrap the website in a WebView. It respects the API's server-side KYC, ownership and role checks.

## Design reference

The screen language adapts the image-led listing cards, rounded white surfaces, map/favorites cues and green action accents from [Rise Real Estate App UI Kit by uifreebies](https://www.figma.com/community/file/1096718124964343229/real-estate-app-ui-kit). The kit is credited under its [CC BY 4.0 license](https://creativecommons.org/licenses/by/4.0/); this app is an adaptation for SecureAsset. SecureAsset's existing wordmark, API and product hierarchy remain authoritative.
