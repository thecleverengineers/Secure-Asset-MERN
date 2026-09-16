# User phone index production hotfix

Release `2026-06-30-user-phone-index-hotfix-v3` repairs the legacy MongoDB
`users.phone_1` index that older installations created without `sparse: true`.

The deployment now runs `npm run db:repair-user-phone-index` before the general
index reconciliation. The repair:

- handles only `{ phone: 1 }` on the `users` collection;
- changes an ordinary non-unique index to `sparse: true`;
- refuses TTL, partial, collation, hidden, wildcard, or unique definitions;
- restores the original index if MongoDB cannot create or verify the replacement;
- is idempotent and safe on repeated deployments.

Email/mobile authentication normalization and unique normalized identifier indexes
remain handled by the automatic migration suite.
