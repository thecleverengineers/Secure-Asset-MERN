#!/usr/bin/env bash
# One-time root-side setup for the laptop's outbound, read-only SFTP pull.
# Usage: sudo APP_DIR=/www/secureasset bash scripts/setup-laptop-backup-pull.sh /root/laptop-backup-pull.pub
set -Eeuo pipefail
IFS=$'\n\t'
umask 077

APP_DIR="${APP_DIR:-/www/secureasset}"
PUBLIC_KEY_FILE="${1:-}"
fail() { echo "ERROR: $*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || fail "Run this setup as root."
[[ "$APP_DIR" == /* && -d "$APP_DIR" && -f "$APP_DIR/.env" ]] || fail "APP_DIR must be an existing absolute application directory with .env."
[[ -f "$PUBLIC_KEY_FILE" ]] || fail "Pass the laptop's public key file as the only argument."
command -v sshd >/dev/null 2>&1 || fail "OpenSSH server (sshd) is required."
command -v useradd >/dev/null 2>&1 || fail "useradd is required."
grep -Eq '^[[:space:]]*Include[[:space:]]+/etc/ssh/sshd_config\.d/\*\.conf' /etc/ssh/sshd_config || fail "This OpenSSH configuration does not include /etc/ssh/sshd_config.d/*.conf; add that standard Include line before using the restricted pull account."

PUBLIC_KEY="$(tr -d '\r\n' < "$PUBLIC_KEY_FILE")"
[[ "$PUBLIC_KEY" =~ ^(ssh-ed25519|ecdsa-sha2-nistp256|sk-ssh-ed25519@openssh.com)[[:space:]][A-Za-z0-9+/=]+([[:space:]].*)?$ ]] || fail "Only a single modern ed25519, ECDSA P-256, or security-key public key is accepted."

cd "$APP_DIR"
EXPECTED_STORAGE="/var/lib/secureasset/backup-pull/archives"
ACTUAL_STORAGE="$(APP_DIR="$APP_DIR" node scripts/read-env-value.js BACKUP_STORAGE_DIR)"
[[ "$ACTUAL_STORAGE" == "$EXPECTED_STORAGE" ]] || fail "BACKUP_STORAGE_DIR must remain $EXPECTED_STORAGE for this restricted SFTP layout."
DEPLOY_USER="${DEPLOY_USER:-$(stat -c '%U' "$APP_DIR")}" 
id "$DEPLOY_USER" >/dev/null 2>&1 || fail "Cannot determine the application deployment user."

getent group secureasset-backup >/dev/null || groupadd --system secureasset-backup
id secureasset-backup-pull >/dev/null 2>&1 || useradd --system --gid secureasset-backup --home-dir /backup-pull --shell /usr/sbin/nologin secureasset-backup-pull
usermod -a -G secureasset-backup "$DEPLOY_USER"

# sshd requires every chroot path component to be root-owned and not writable
# by a non-root user. Child archive permissions grant read-only group access.
STATE_ROOT="/var/lib/secureasset"
PULL_ROOT="$STATE_ROOT/backup-pull"
ARCHIVE_ROOT="$PULL_ROOT/archives"
install -d -o root -g root -m 0711 "$STATE_ROOT"
install -d -o root -g root -m 0755 "$PULL_ROOT"
install -d -o "$DEPLOY_USER" -g secureasset-backup -m 2750 "$ARCHIVE_ROOT"

KEY_ROOT="/etc/ssh/authorized_keys"
install -d -o root -g root -m 0700 "$KEY_ROOT"
printf '%s\n' "$PUBLIC_KEY" > "$KEY_ROOT/secureasset-backup-pull"
chown root:root "$KEY_ROOT/secureasset-backup-pull"
chmod 0600 "$KEY_ROOT/secureasset-backup-pull"

SSHD_DROPIN="/etc/ssh/sshd_config.d/secureasset-backup-pull.conf"
install -d -o root -g root -m 0755 /etc/ssh/sshd_config.d
cat > "$SSHD_DROPIN" <<'SSHD'
# SecureAsset laptop disaster-recovery pull account: encrypted files only.
Match User secureasset-backup-pull
    ChrootDirectory /var/lib/secureasset
    AuthorizedKeysFile /etc/ssh/authorized_keys/%u
    ForceCommand internal-sftp -u 077
    AuthenticationMethods publickey
    PasswordAuthentication no
    KbdInteractiveAuthentication no
    PermitEmptyPasswords no
    PermitTTY no
    AllowTcpForwarding no
    X11Forwarding no
    PermitTunnel no
    GatewayPorts no
Match all
SSHD
chmod 0600 "$SSHD_DROPIN"
sshd -t
if command -v systemctl >/dev/null 2>&1; then
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
else
  service ssh reload 2>/dev/null || service sshd reload
fi

echo "Restricted laptop pull account configured."
echo "Pinned host key: ssh-keyscan -t ed25519 <server-host> > ~/.ssh/secureasset-backup-known_hosts"
echo "Verify the fingerprint out-of-band before trusting that command's result."
echo "The laptop pulls /backup-pull/archives through SFTP and cannot open a shell or write server backups."
