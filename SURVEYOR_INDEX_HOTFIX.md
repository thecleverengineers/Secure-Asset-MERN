# SurveyorSubscription index hotfix

Release: `2026-06-30-surveyor-index-hotfix-v2`

The current subscription model keeps history, so `surveyorsubscriptions.user_1` must be non-unique.
Deployment now runs `npm run db:repair-surveyor-index` before the general index reconciler.
The repair is idempotent, allow-listed to this collection/key, rejects TTL/partial/collation/hidden/wildcard indexes, and restores the original index if replacement fails.
