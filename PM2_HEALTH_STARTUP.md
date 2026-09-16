# PM2 health-gated startup

SecureAsset no longer relies on a PM2 IPC `ready` message. PM2 supervises the
Node process, while deployment verifies the real HTTP endpoint:

```text
PM2 process online → /api/health/ready returns 200 → PM2 release verification
```

The health endpoint is intentionally strict: it requires both a connected
MongoDB connection and an available production frontend build. The deployment
scripts poll it through `scripts/reconcile-pm2-release.js --wait` before
running the final PM2 verification.

Before activation, PM2 reconciliation removes a persisted `secureasset`
definition when it contains the old `wait_ready=true`, a non-zero
`listen_timeout`, or a non-online status. This prevents a previous PM2 state
from overriding the current ecosystem configuration.

The deployment refreshes the PM2 daemon when its process list contains only
SecureAsset-managed applications. If unrelated PM2 applications exist, the
default behavior preserves the shared daemon and reloads only the SecureAsset
processes. This prevents `kaki-crm`, `taxsaathi-mern`, or another application
from being interrupted during a SecureAsset deployment. Set
`PM2_RESET_DAEMON=1` only when a full shared-daemon restart is intentionally
approved.

The reconciliation command reads PM2 with `pm2 --silent jlist` and uses a
balanced JSON-array parser. This handles PM2 7's startup banner safely and
prevents a valid process list from being rejected as malformed JSON during a
fresh daemon start.

To control the wait window, set `PM2_HEALTH_TIMEOUT_MS` to an integer between
20,000 and 600,000 milliseconds. The default is 120,000 milliseconds. The
health port is passed automatically from the production `.env` `PORT` value.

If startup fails, inspect `logs/pm2-error.log` and `logs/pm2-out.log`. The
deployment also prints the latest PM2 diagnostics automatically when it detects
a restart loop or a health timeout.
