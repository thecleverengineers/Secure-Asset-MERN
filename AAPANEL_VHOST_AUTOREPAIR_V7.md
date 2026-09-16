# SecureAsset aaPanel Vhost Auto-Repair v7

This release repairs aaPanel installations whose active vhost does not already include the extension directory.

During deployment SecureAsset now:

1. Finds the active aaPanel vhost containing the configured domain.
2. Creates a timestamped backup of the vhost.
3. Selects the HTTPS/application server block rather than a redirect-only HTTP block.
4. Inserts the managed extension include when it is missing.
5. Writes the API, Socket.IO, current frontend asset, site-asset and upload proxy locations.
6. Validates the complete configuration with aaPanel's own Nginx binary.
7. Reloads Nginx only after validation succeeds.
8. Restores both the vhost and extension file if validation or reload fails.
9. Verifies login, registration and frontend assets through the public domain.

The repair is idempotent and can also be run independently:

```bash
sudo bash scripts/repair-auth-routing.sh --nginx-only
```
