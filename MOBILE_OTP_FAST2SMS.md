# Mobile OTP and Fast2SMS setup

SecureAsset now uses mobile OTP for:

- New-account mobile verification
- Optional OTP login
- Password reset

Password login accepts either the registered email address or registered Indian mobile number.

## Fast2SMS admin configuration

Sign in as an administrator and open:

`Site & Marketplace Administration` → `SMS / OTP`

Default values included in the application:

- Endpoint: `https://www.fast2sms.com/dev/bulkV2`
- Route: `dlt`
- Sender ID: `SECAST`
- DLT message/template ID: `204251`
- Variable values template: `{otp}`

Enter the complete Fast2SMS authorization key in the admin panel. A masked value such as `218M********************` is intentionally rejected because it cannot authenticate an API request.

The authorization key is encrypted using AES-256-GCM before it is stored in MongoDB. It is never returned to the frontend after saving.

If the approved DLT template contains more than one variable, configure them in the required order using the pipe character, for example:

`{otp}|{name}`

Use the **Send test OTP** section before enabling registration in production.

## Administrator account

Deployment runs the non-destructive command:

```bash
npm run seed:admin
```

It creates the requested administrator when it does not already exist:

- Name: Clever Engineers
- Email: thecleverengineers@gmail.com
- Mobile: 9707949651

The bootstrap password is set from `BOOTSTRAP_ADMIN_PASSWORD`, falling back to the requested initial password in the seed script. Change it immediately after first login.

To intentionally reset an existing bootstrap administrator password, run:

```bash
RESET_BOOTSTRAP_ADMIN_PASSWORD=YES npm run seed:admin
```
