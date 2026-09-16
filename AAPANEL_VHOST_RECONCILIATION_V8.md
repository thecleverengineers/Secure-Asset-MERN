# aaPanel Vhost Reconciliation v8

This release fixes Nginx deployment failures caused by duplicate `location /api/`
blocks. Older releases installed a SecureAsset extension include even when the
active aaPanel vhost already contained manually configured API or asset
locations.

The v8 repair now edits the active HTTPS application server block directly:

- finds the correct `server_name` block for the configured domain;
- removes only conflicting SecureAsset paths (`/api/`, `/socket.io/`, `/assets/`,
  `/index.html`, `/site-assets/`, and `/uploads/`);
- preserves the root SPA fallback and unrelated custom locations;
- removes the obsolete SecureAsset extension include/file;
- writes exactly one production proxy definition for every managed path;
- validates Nginx before reload and restores the previous vhost on failure;
- remains idempotent on repeated deployments.

After reload, the repair validates the active virtual host through
`127.0.0.1` while keeping the configured domain in the Host header and TLS
SNI. This verifies the real aaPanel server block and the current frontend
directly at the origin. Public DNS A/AAAA records must point directly to this
server; this repair does not contact or purge an external edge service.

Use the fast repair after extracting this release:

```bash
cd /www/secureasset
sudo bash scripts/repair-auth-routing.sh --nginx-only
```
