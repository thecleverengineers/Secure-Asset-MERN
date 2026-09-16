# Tenant KYC upload/category resilience — v42

- Added the five tenant KYC categories to the encrypted Vault file model.
- KYC document uploads accept JPG, JPEG, PNG, and PDF, subject to the existing size and content checks.
- KYC files are stored with `identity_document` confidentiality.
- Government Identity front upload remains required; the back upload is optional.
- Address Proof front and back and the passport photograph remain required for KYC submission.
