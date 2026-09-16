# Production PM2 Reconciliation v6

This release prevents PM2 from reloading an obsolete SecureAsset process definition after the application directory changes.

Before activation, deployment inspects every managed process and compares its working directory, executable path, package version, and log paths with the active release. Any stale managed definition is deleted and recreated from the absolute `/www/secureasset/ecosystem.config.cjs` path.

After activation, deployment verifies that all four managed process definitions point to the current release and that the API has an online process with a live PID.

The repair specifically handles legacy processes that still reference `/var/secureasset` while the active installation is `/www/secureasset`. Existing unrelated PM2 applications are not modified.
