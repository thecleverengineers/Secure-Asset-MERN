# Registration encryption and admin bootstrap resilience — v41

## Root cause

Registration sends a mobile OTP through the stored Fast2SMS authorization key. Older releases encrypted that key with `JWT_REFRESH_SECRET`. When the JWT secret changed during a deployment, AES-256-GCM could no longer authenticate the old ciphertext and the browser exposed:

```text
Unsupported state or unable to authenticate data
```

## Permanent repair

- Provider and two-factor secrets now use `ENCRYPTION_MASTER_KEY_BASE64`, a dedicated stable 32-byte Base64 key.
- Existing three-part encrypted records remain readable.
- Existing records encrypted with the old Vault/JWT-derived key are automatically re-encrypted with the stable key after a successful read.
- Production environment preparation generates the master key only when it is missing or still a template placeholder.
- Production validation rejects a missing or incorrectly sized master key.
- JWT signing secrets can now rotate without breaking OTP delivery, Razorpay credentials, or two-factor secrets.
- Bootstrap administrator setup resolves an existing email before a mobile number, so a pre-existing email/mobile split cannot cause a duplicate-key deployment failure.

## Deployment safety

Never regenerate `ENCRYPTION_MASTER_KEY_BASE64` on an existing installation. Keep the value in `/www/secureasset/.env` across deployments. If the old JWT secret was already lost and a stored Fast2SMS credential cannot be read, save the Fast2SMS authorization key again in the admin integration settings; the new value will be stored with the stable master key.
