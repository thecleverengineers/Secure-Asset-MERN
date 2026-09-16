# MongoDB Index and Email/Mobile Login Production Fix

This release repairs the legacy `SurveyorSubscription.user_1` index and maps every user to canonical email and Indian mobile login identifiers.

## What deployment does automatically

1. Refuses to deploy from an aaPanel `.Recycle_bin` directory.
2. Connects to MongoDB and creates a pre-deployment backup when `mongodump` is installed.
3. Treats missing boolean index options and explicit `false` options as equivalent.
4. Replaces only the allow-listed legacy `surveyorsubscriptions.user_1` unique index with the required non-unique index.
5. Restores the original index automatically if replacement fails.
6. Normalizes existing email addresses to lowercase.
7. Normalizes Indian mobile numbers to their canonical 10-digit form.
8. Detects duplicate/invalid identifiers before writing any migration data.
9. Creates unique sparse indexes for `emailNormalized` and `phoneNormalized`.
10. Verifies every user can be resolved through email and supported mobile formats.

## Correct deployment command

Open a fresh shell location after extracting the release. Do not deploy from a terminal whose working directory was deleted or replaced by aaPanel.

```bash
cd /
cd /www/secureasset
sudo bash deploy.sh
```

## Accepted mobile login formats

The following values all resolve to the same registered account:

- `9707949651`
- `+919707949651`
- `919707949651`
- `09707949651`
- formatted values such as `+91 97079 49651`

Email login is trimmed and case-insensitive.

## Duplicate identifiers

The migration will stop safely if two users resolve to the same normalized email or mobile. It prints the affected user IDs so the duplicate accounts can be corrected without silently merging or deleting data.
