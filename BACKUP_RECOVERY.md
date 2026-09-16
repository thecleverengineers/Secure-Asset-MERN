# SecureAsset Backup & Recovery Center

This release adds administrator-only encrypted recovery points containing:

- the MongoDB database;
- locally stored encrypted vault files, site assets, and legacy upload data;
- the complete application source, excluding `.env`, runtime dependencies, logs, generated assets, and existing deployment backups.

The managed archive format is AES-256-GCM. Its independent 32-byte key is stored as `BACKUP_ENCRYPTION_KEY_BASE64` in the server-only `.env`. Do not copy that key to a laptop or include it in a support ticket.

## Server operation

After normal deployment, open **Backup & Recovery** as an administrator. The page shows tool readiness, the 5 PM `BACKUP_TIMEZONE` schedule, retention, managed backup history, and existing legacy deployment backup count. Existing `backups/` files are never modified.

The PM2 worker `secureasset-backup-automation` runs `BACKUP_CRON` (`0 17 * * *` by default) and uses a unique day key, so a PM2 restart does not create a duplicate daily backup. Manual backups are queued from the page and are audited.

The deployment validates `mongodump`, `mongorestore`, tar, gzip, rsync, the backup key, retention, and time zone. On Debian/Ubuntu it installs MongoDB Database Tools by default; set `INSTALL_MONGODB_TOOLS=0` only when those tools are already installed manually.

## Controlled restore

The browser never restores data directly. An administrator selects a completed backup and then supplies:

1. the exact `RESTORE SAB-...` phrase;
2. their current password;
3. an authenticator code or one of their one-time 2FA recovery codes;
4. the selected recovery components.

The application returns a one-time command that expires after `BACKUP_RESTORE_TOKEN_TTL_MINUTES` (15 minutes by default). Run that exact command in a root shell. It validates AES-GCM and component checksums, creates a mandatory encrypted pre-restore snapshot, stops only SecureAsset PM2 processes, restores the selected components, and restarts through the guarded `deploy.sh` PM2/port-owner handoff. Every authorization and result is written to the audit log.

## Offline-friendly encrypted laptop copy

The server cannot reliably push to an intermittently offline laptop behind NAT. Instead, the laptop makes an outbound, read-only SFTP pull after the 5 PM server backup. The timer persists missed runs and catches up from the server index when the laptop comes back online.

1. On the laptop, create a dedicated key:

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/secureasset-backup-pull -C secureasset-backup-pull
   ```

2. Transfer only `~/.ssh/secureasset-backup-pull.pub` to the server by a trusted method. On the server, run:

   ```bash
   sudo APP_DIR=/www/secureasset bash /www/secureasset/scripts/setup-laptop-backup-pull.sh /path/to/secureasset-backup-pull.pub
   ```

3. Verify the server SSH host-key fingerprint out-of-band, then add the verified key to the laptop's dedicated known-hosts file:

   ```bash
   ssh-keyscan -t ed25519 your-server.example > ~/.ssh/secureasset-backup-known_hosts
   chmod 600 ~/.ssh/secureasset-backup-known_hosts
   ```

4. Copy `scripts/laptop-backup-pull.sh` and `scripts/install-laptop-backup-pull-timer.sh` to the laptop. Run the installer once; it writes a local, owner-only configuration template. Fill in the verified host and key paths, then run the installer again:

   ```bash
   bash install-laptop-backup-pull-timer.sh
   ```

The SFTP account has no SSH shell, no password authentication, no port forwarding, no terminal, and read-only access to encrypted artifacts. The laptop verifies each downloaded file's size and SHA-256 before retaining it. It receives neither the database password nor the backup encryption key.
