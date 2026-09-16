#!/usr/bin/env bash
# Controlled production restore entrypoint. This is intentionally root-side:
# a browser request can only issue a short-lived, two-factor authorised token.
set -Eeuo pipefail
IFS=$'\n\t'
umask 077

APP_DIR="${APP_DIR:-/www/secureasset}"
BACKUP_ID=""
RESTORE_TOKEN=""
COMPONENTS=""
APPLY=0
PREPARED=0
STAGE_DIR=""

usage() {
  echo "Usage: sudo APP_DIR=/www/secureasset bash scripts/secureasset-backup-restore.sh --backup-id SAB-... --restore-token <one-time-token> --components database,vault,source --apply" >&2
}
fail() { echo "ERROR: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup-id) BACKUP_ID="${2:-}"; shift 2 ;;
    --restore-token) RESTORE_TOKEN="${2:-}"; shift 2 ;;
    --components) COMPONENTS="${2:-}"; shift 2 ;;
    --apply) APPLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage; fail "Unknown argument: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || fail "Run this controlled restore with sudo/root."
[[ $APPLY -eq 1 ]] || fail "--apply is required; this command changes production data only after explicit confirmation."
[[ "$APP_DIR" == /* && -d "$APP_DIR" && -f "$APP_DIR/.env" ]] || fail "APP_DIR must be an existing absolute SecureAsset directory with .env."
[[ "$BACKUP_ID" =~ ^SAB-[0-9]{8}-[0-9]{6}-[A-Z0-9]{8}$ ]] || fail "Invalid --backup-id."
[[ "$RESTORE_TOKEN" =~ ^[A-Za-z0-9_-]{32,128}$ ]] || fail "Invalid --restore-token."
[[ "$COMPONENTS" =~ ^(database|vault|source)(,(database|vault|source)){0,2}$ ]] || fail "--components must be a comma-separated selection of database, vault, source."

cd "$APP_DIR"
NODE_BIN="$(command -v node || true)"
[[ -n "$NODE_BIN" ]] || fail "Node.js is required."
for command in mongorestore tar rsync; do command -v "$command" >/dev/null 2>&1 || fail "$command is required for a controlled restore."; done

DEPLOY_USER="${DEPLOY_USER:-$(stat -c '%U' "$APP_DIR")}" 
DEPLOY_GROUP="$(id -gn "$DEPLOY_USER")"
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
[[ -n "$DEPLOY_HOME" ]] || fail "Could not resolve home directory for $DEPLOY_USER."

run_app() {
  if [[ "$DEPLOY_USER" == root ]]; then
    "$@"
  else
    runuser -u "$DEPLOY_USER" -- env HOME="$DEPLOY_HOME" PATH="$PATH" "$@"
  fi
}
read_env() { APP_DIR="$APP_DIR" "$NODE_BIN" scripts/read-env-value.js "$1"; }
BACKUP_TEMP_DIR="$(read_env BACKUP_TEMP_DIR)"
VAULT_STORAGE_DIR="$(read_env VAULT_STORAGE_DIR)"
CMS_ASSET_DIR="$(read_env CMS_ASSET_DIR)"
UPLOAD_DIR="$(read_env UPLOAD_DIR || true)"
MONGODB_URI="$(read_env MONGODB_URI)"
[[ "$BACKUP_TEMP_DIR" == /* && "$VAULT_STORAGE_DIR" == /* && "$CMS_ASSET_DIR" == /* && -n "$MONGODB_URI" ]] || fail "Backup, storage, or database settings are invalid."

cleanup_stage() {
  [[ -n "$STAGE_DIR" && "$STAGE_DIR" == "$BACKUP_TEMP_DIR"/restore.* && -d "$STAGE_DIR" ]] || return 0
  find "$STAGE_DIR" -mindepth 1 -depth -delete 2>/dev/null || true
  rmdir "$STAGE_DIR" 2>/dev/null || true
}
on_error() {
  local code=$?
  if [[ $PREPARED -eq 1 ]]; then
    run_app env APP_DIR="$APP_DIR" "$NODE_BIN" scripts/backup-recovery-cli.js fail-restore --backup-id "$BACKUP_ID" --error "Root-side restore exited with code $code" >/dev/null 2>&1 || true
  fi
  cleanup_stage
  echo "Controlled restore failed. The prior encrypted pre-restore snapshot remains available." >&2
  exit "$code"
}
trap on_error ERR

mkdir -p "$BACKUP_TEMP_DIR"
chmod 700 "$BACKUP_TEMP_DIR"
STAGE_DIR="$(mktemp -d "$BACKUP_TEMP_DIR/restore.XXXXXX")"

echo "Validating the encrypted artifact and one-time restore authorization..."
run_app env APP_DIR="$APP_DIR" "$NODE_BIN" scripts/backup-recovery-cli.js prepare-restore --backup-id "$BACKUP_ID" --restore-token "$RESTORE_TOKEN" --stage-dir "$STAGE_DIR" --consume true >/dev/null
PREPARED=1

echo "Creating the mandatory encrypted pre-restore safety snapshot..."
run_app env APP_DIR="$APP_DIR" "$NODE_BIN" scripts/run-system-backup.js --trigger pre_restore --label "Automatic pre-restore safety snapshot for $BACKUP_ID" >/dev/null

IFS=',' read -r -a REQUESTED_COMPONENTS <<< "$COMPONENTS"
has_component() {
  local requested
  for requested in "${REQUESTED_COMPONENTS[@]}"; do [[ "$requested" == "$1" ]] && return 0; done
  return 1
}

echo "Stopping only SecureAsset PM2 processes before recovery..."
for process in secureasset secureasset-rental-automation secureasset-notification-delivery secureasset-vault-retention secureasset-backup-automation; do
  run_app "$APP_DIR/node_modules/.bin/pm2" delete "$process" >/dev/null 2>&1 || true
done

if has_component database; then
  echo "Restoring MongoDB database..."
  mongorestore --uri="$MONGODB_URI" --archive="$STAGE_DIR/database.archive.gz" --gzip --drop
fi

restore_data_directory() {
  local source_key="$1"
  local destination="$2"
  local source="$STAGE_DIR/data/$source_key"
  [[ -d "$source" ]] || return 0
  mkdir -p "$destination"
  rsync -a --delete --chown="$DEPLOY_USER:$DEPLOY_GROUP" "$source/" "$destination/"
  chmod 700 "$destination" || true
}
if has_component vault; then
  echo "Restoring encrypted vault and uploaded data..."
  mkdir -p "$STAGE_DIR/data"
  tar -xzf "$STAGE_DIR/uploaded-data.tar.gz" -C "$STAGE_DIR/data"
  restore_data_directory vault "$VAULT_STORAGE_DIR"
  restore_data_directory site-assets "$CMS_ASSET_DIR"
  [[ -n "$UPLOAD_DIR" && "$UPLOAD_DIR" == /* ]] && restore_data_directory legacy-uploads "$UPLOAD_DIR"
fi

if has_component source; then
  echo "Restoring the application source tree while preserving this server's environment and runtime data..."
  SOURCE_STAGE="$STAGE_DIR/source"
  mkdir -p "$SOURCE_STAGE"
  tar -xzf "$STAGE_DIR/application-source.tar.gz" -C "$SOURCE_STAGE" --no-same-owner
  rsync -a --delete --chown="$DEPLOY_USER:$DEPLOY_GROUP" \
    --exclude='.env' --exclude='.env.*' --exclude='node_modules/' --exclude='dist/' --exclude='logs/' \
    --exclude='backups/' --exclude='.frontend-releases/' --exclude='storage/' --exclude='uploads/' --exclude='server/src/uploads/' \
    "$SOURCE_STAGE/" "$APP_DIR/"
fi

echo "Starting the recovered release using its guarded PM2/port-owner handoff..."
run_app env APP_DIR="$APP_DIR" DEPLOY_MODE=upgrade bash "$APP_DIR/deploy.sh"
run_app env APP_DIR="$APP_DIR" "$NODE_BIN" scripts/backup-recovery-cli.js complete-restore --backup-id "$BACKUP_ID" >/dev/null
PREPARED=0
cleanup_stage
echo "Controlled restore completed successfully. SecureAsset health checks passed through deploy.sh."
