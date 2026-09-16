# Tenant KYC previews and admin review — v43

- Tenant KYC upload cards show authenticated image thumbnails and PDF previews after each upload.
- KYC file references are populated with safe DriveFile metadata for review screens without exposing storage keys.
- Administrators and scoped managers receive a dedicated Tenant KYC workspace with submitted-record filtering, document review, and application dialogs for approval or rejection.
- Approving a submission sets the KYC status to `verified`, records the reviewer and verification expiry, updates the tenant account status, and preserves the history entry.
- Rejecting a submission requires a reason and records the reviewer decision in the KYC history.
- Preview access uses a narrow authenticated KYC endpoint, checks KYC document categories and ownership/scope, disables public links, and streams with no-store security headers.
- The regular Document Vault device-unlock boundary remains unchanged; the KYC endpoint does not expose general Vault files.
