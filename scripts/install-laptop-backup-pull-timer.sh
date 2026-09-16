#!/usr/bin/env bash
# Install on a Linux or macOS administrator laptop after copying this script
# and laptop-backup-pull.sh from the trusted SecureAsset release package.
set -Eeuo pipefail
IFS=$'\n\t'
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PULL_SCRIPT="${1:-$SCRIPT_DIR/laptop-backup-pull.sh}"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}"
CONFIG_FILE="$CONFIG_DIR/secureasset-backup-pull.env"
[[ -x "$PULL_SCRIPT" || -f "$PULL_SCRIPT" ]] || { echo "Missing laptop-backup-pull.sh: $PULL_SCRIPT" >&2; exit 1; }

mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"
if [[ ! -f "$CONFIG_FILE" ]]; then
  cat > "$CONFIG_FILE" <<'CONFIG'
# Copy values supplied by the server administrator. Do not put the backup
# encryption key here: this laptop stores encrypted artifacts only.
SECUREASSET_BACKUP_HOST=backup.example.com
SECUREASSET_BACKUP_USER=secureasset-backup-pull
SECUREASSET_BACKUP_PORT=22
SECUREASSET_BACKUP_IDENTITY_FILE=$HOME/.ssh/secureasset-backup-pull
SECUREASSET_BACKUP_KNOWN_HOSTS=$HOME/.ssh/secureasset-backup-known_hosts
SECUREASSET_BACKUP_DESTINATION=$HOME/SecureAsset-Encrypted-Backups
SECUREASSET_BACKUP_LOCAL_RETENTION_DAYS=365
CONFIG
  chmod 600 "$CONFIG_FILE"
  echo "Created $CONFIG_FILE. Set the verified server hostname, key paths, and pinned known_hosts entry, then run this installer again." >&2
  exit 2
fi
chmod 600 "$CONFIG_FILE"
chmod 700 "$PULL_SCRIPT"

if command -v systemctl >/dev/null 2>&1 && [[ "$(uname -s)" == Linux ]]; then
  UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
  mkdir -p "$UNIT_DIR"
  cat > "$UNIT_DIR/secureasset-backup-pull.service" <<SERVICE
[Unit]
Description=SecureAsset encrypted backup pull

[Service]
Type=oneshot
ExecStart=/usr/bin/env bash $PULL_SCRIPT
Nice=10
IOSchedulingClass=best-effort
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
SERVICE
  cat > "$UNIT_DIR/secureasset-backup-pull.timer" <<'TIMER'
[Unit]
Description=Pull SecureAsset encrypted backups after the 5 PM server backup

[Timer]
OnCalendar=*-*-* 17:20:00
OnUnitActiveSec=6h
Persistent=true
RandomizedDelaySec=5m
Unit=secureasset-backup-pull.service

[Install]
WantedBy=timers.target
TIMER
  systemctl --user daemon-reload
  systemctl --user enable --now secureasset-backup-pull.timer
  echo "Installed Linux user timer. Verify with: systemctl --user list-timers secureasset-backup-pull.timer"
  exit 0
fi

if [[ "$(uname -s)" == Darwin ]]; then
  LABEL="com.secureasset.backup-pull"
  PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$PULL_SCRIPT</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>17</integer><key>Minute</key><integer>20</integer></dict>
  <key>StartInterval</key><integer>21600</integer>
  <key>RunAtLoad</key><true/>
</dict></plist>
PLIST
  launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  echo "Installed macOS LaunchAgent. It pulls at 5:20 PM and retries every six hours after the laptop is awake."
  exit 0
fi

echo "Unsupported laptop scheduler. Run $PULL_SCRIPT from your local scheduler every day after 5:20 PM." >&2
exit 1
