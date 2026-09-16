#!/usr/bin/env bash
# Runs on the administrator's laptop. It opens an outbound, SFTP-only session
# to the server and pulls encrypted artifacts; the laptop never needs a public
# IP address or inbound port.
set -Eeuo pipefail
IFS=$'\n\t'
umask 077

CONFIG_FILE="${SECUREASSET_BACKUP_PULL_CONFIG:-$HOME/.config/secureasset-backup-pull.env}"
[[ -f "$CONFIG_FILE" ]] || { echo "Missing laptop pull config: $CONFIG_FILE" >&2; exit 1; }
[[ -O "$CONFIG_FILE" ]] || { echo "Laptop pull config must be owned by the current user." >&2; exit 1; }
# Read a data-only KEY=value file; never execute administrator configuration.
config_value() {
  local key="$1" value
  value="$(awk -F= -v wanted="$key" '$0 !~ /^[[:space:]]*#/ && $1 ~ "^[[:space:]]*" wanted "[[:space:]]*$" { sub(/^[^=]*=/, ""); value=$0 } END { print value }' "$CONFIG_FILE")"
  value="${value#\"}"; value="${value%\"}"; value="${value#\'}"; value="${value%\'}"
  printf '%s' "${value//\$HOME/$HOME}"
}

HOST="$(config_value SECUREASSET_BACKUP_HOST)"
USER_NAME="$(config_value SECUREASSET_BACKUP_USER)"; USER_NAME="${USER_NAME:-secureasset-backup-pull}"
PORT="$(config_value SECUREASSET_BACKUP_PORT)"; PORT="${PORT:-22}"
IDENTITY_FILE="$(config_value SECUREASSET_BACKUP_IDENTITY_FILE)"; IDENTITY_FILE="${IDENTITY_FILE:-$HOME/.ssh/secureasset-backup-pull}"
KNOWN_HOSTS_FILE="$(config_value SECUREASSET_BACKUP_KNOWN_HOSTS)"; KNOWN_HOSTS_FILE="${KNOWN_HOSTS_FILE:-$HOME/.ssh/secureasset-backup-known_hosts}"
DESTINATION="$(config_value SECUREASSET_BACKUP_DESTINATION)"; DESTINATION="${DESTINATION:-$HOME/SecureAsset-Encrypted-Backups}"
RETENTION_DAYS="$(config_value SECUREASSET_BACKUP_LOCAL_RETENTION_DAYS)"; RETENTION_DAYS="${RETENTION_DAYS:-365}"

[[ -n "$HOST" && "$HOST" != *$'\n'* ]] || { echo "SECUREASSET_BACKUP_HOST is required." >&2; exit 1; }
[[ "$PORT" =~ ^[0-9]{1,5}$ ]] && (( PORT >= 1 && PORT <= 65535 )) || { echo "SECUREASSET_BACKUP_PORT is invalid." >&2; exit 1; }
[[ "$RETENTION_DAYS" =~ ^[0-9]{1,4}$ ]] && (( RETENTION_DAYS >= 7 && RETENTION_DAYS <= 3650 )) || { echo "SECUREASSET_BACKUP_LOCAL_RETENTION_DAYS must be 7-3650." >&2; exit 1; }
[[ -f "$IDENTITY_FILE" && -f "$KNOWN_HOSTS_FILE" ]] || { echo "Identity file and pinned known-hosts file are required." >&2; exit 1; }

mkdir -p "$DESTINATION"
chmod 700 "$DESTINATION"
TMP_DIR="$(mktemp -d "$DESTINATION/.pull.XXXXXX")"
cleanup() {
  [[ -n "${TMP_DIR:-}" && "$TMP_DIR" == "$DESTINATION"/.pull.* && -d "$TMP_DIR" ]] || return 0
  find "$TMP_DIR" -mindepth 1 -depth -delete 2>/dev/null || true
  rmdir "$TMP_DIR" 2>/dev/null || true
}
trap cleanup EXIT

SFTP_OPTIONS=(
  -q -i "$IDENTITY_FILE" -P "$PORT"
  -o BatchMode=yes
  -o IdentitiesOnly=yes
  -o PasswordAuthentication=no
  -o KbdInteractiveAuthentication=no
  -o StrictHostKeyChecking=yes
  -o UserKnownHostsFile="$KNOWN_HOSTS_FILE"
)

INDEX_FILE="$TMP_DIR/backup-index.json"
if ! sftp "${SFTP_OPTIONS[@]}" "${USER_NAME}@${HOST}" <<SFTP
get /backup-pull/archives/backup-index.json "$INDEX_FILE"
SFTP
then
  echo "Encrypted backup pull could not reach the server. Nothing was changed; the next scheduled laptop run will catch up." >&2
  exit 2
fi

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'; else shasum -a 256 "$1" | awk '{print $1}'; fi
}

while IFS=$'\t' read -r file_name expected_hash expected_size; do
  [[ "$file_name" =~ ^secureasset-backup-SAB-[0-9]{8}-[0-9]{6}-[A-Z0-9]{8}\.sba$ ]] || continue
  [[ "$expected_hash" =~ ^[a-f0-9]{64}$ && "$expected_size" =~ ^[0-9]+$ ]] || continue
  target="$DESTINATION/$file_name"
  if [[ -f "$target" && "$(sha256_file "$target")" == "$expected_hash" ]]; then continue; fi
  partial="$TMP_DIR/$file_name.part"
  echo "Pulling encrypted backup $file_name"
  sftp "${SFTP_OPTIONS[@]}" "${USER_NAME}@${HOST}" <<SFTP
get /backup-pull/archives/$file_name "$partial"
SFTP
  [[ -f "$partial" && "$(stat -c '%s' "$partial" 2>/dev/null || stat -f '%z' "$partial")" == "$expected_size" ]] || { echo "Downloaded size mismatch for $file_name" >&2; exit 1; }
  [[ "$(sha256_file "$partial")" == "$expected_hash" ]] || { echo "Downloaded hash mismatch for $file_name" >&2; exit 1; }
  mv -f "$partial" "$target"
  chmod 600 "$target"
done < <(node - "$INDEX_FILE" <<'NODE'
const fs = require('node:fs');
const index = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const item of Array.isArray(index?.items) ? index.items : []) {
  const fileName = String(item?.fileName || '');
  const sha256 = String(item?.sha256 || '').toLowerCase();
  const sizeBytes = Number(item?.sizeBytes);
  if (/^secureasset-backup-SAB-\d{8}-\d{6}-[A-Z0-9]{8}\.sba$/.test(fileName) && /^[a-f0-9]{64}$/.test(sha256) && Number.isSafeInteger(sizeBytes) && sizeBytes > 0) {
    process.stdout.write(`${fileName}\t${sha256}\t${sizeBytes}\n`);
  }
}
NODE
)

cp "$INDEX_FILE" "$DESTINATION/backup-index.json"
chmod 600 "$DESTINATION/backup-index.json"
find "$DESTINATION" -maxdepth 1 -type f -name 'secureasset-backup-SAB-*.sba' -mtime +"$RETENTION_DAYS" -delete
echo "Encrypted laptop copy is current: $DESTINATION"
