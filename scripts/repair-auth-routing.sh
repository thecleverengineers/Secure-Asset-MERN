#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$APP_DIR"
APP_NODE_BIN="$APP_DIR/node_modules/.bin"
export PATH="$APP_NODE_BIN:$PATH"
MODE="${1:-all}"
[[ "$MODE" == "all" || "$MODE" == "--nginx-only" ]] || { echo "Usage: sudo bash scripts/repair-auth-routing.sh [--nginx-only]"; exit 2; }
DIRECT_ORIGIN_REPAIR_CONTRACT="v175-direct-origin-only"

log() { printf '\n==> %s\n' "$1"; }
fail() { printf '\nERROR: %s\n' "$1" >&2; exit 1; }

verify_direct_origin() {
  local public_url="$1"
  local local_vhost_verified="$2"

  node scripts/verify-auth-routing.js "http://127.0.0.1:${PORT_VALUE}"
  node scripts/verify-public-assets.js "http://127.0.0.1:${PORT_VALUE}"
  if [[ "$local_vhost_verified" == "1" ]]; then
    node scripts/verify-auth-routing.js "$public_url" --connect-host=127.0.0.1 --insecure-tls
    node scripts/verify-public-assets.js "$public_url" --connect-host=127.0.0.1 --insecure-tls
    echo "Direct Nginx origin verification passed: $public_url"
  else
    printf 'WARNING: No local named Nginx virtual host was detected; only the PM2 loopback origin was verified. Configure the direct Nginx vhost before exposing %s.\n' "$public_url" >&2
  fi
}

[[ -f .env ]] || fail "Missing $APP_DIR/.env"
PORT_VALUE="$(node scripts/read-env-value.js PORT)"
PUBLIC_URL="$(node scripts/read-env-value.js PUBLIC_APP_URL)"
DOMAIN_VALUE="$(node -e "try{console.log(new URL(process.argv[1]).hostname)}catch{}" "$PUBLIC_URL")"
[[ -n "$DOMAIN_VALUE" ]] || fail "PUBLIC_APP_URL does not contain a valid domain"

if [[ "$MODE" == "all" ]]; then
  log "Repairing the browser API base"
  node scripts/configure-production-env.js
  node scripts/validate-production-env.js
  grep -q '^VITE_API_URL=/api/v1$' .env || fail "VITE_API_URL was not repaired to /api/v1"

  log "Rebuilding and restarting SecureAsset"
  npm run build
  [[ -x "$APP_NODE_BIN/pm2" ]] || fail "The application-local PM2 binary is missing: $APP_NODE_BIN/pm2. Run npm ci before restarting the release."
  APP_DIR="$APP_DIR" PM2_RESET_DAEMON="${PM2_RESET_DAEMON:-0}" node scripts/reconcile-pm2-release.js --reset-daemon
  APP_DIR="$APP_DIR" SECUREASSET_HTTP_PORT="$PORT_VALUE" node scripts/reconcile-http-listener.js --status
  APP_DIR="$APP_DIR" node scripts/reconcile-pm2-release.js --stop
  APP_DIR="$APP_DIR" SECUREASSET_HTTP_PORT="$PORT_VALUE" node scripts/reconcile-http-listener.js --clear
  APP_DIR="$APP_DIR" node scripts/reconcile-pm2-release.js --prepare
  ./node_modules/.bin/pm2 startOrReload "$APP_DIR/ecosystem.config.cjs" --env production --update-env
  if ! APP_DIR="$APP_DIR" PM2_HEALTH_PORT="$PORT_VALUE" PM2_HEALTH_TIMEOUT_MS="${PM2_HEALTH_TIMEOUT_MS:-120000}" node scripts/reconcile-pm2-release.js --wait; then
    ./node_modules/.bin/pm2 logs secureasset --lines 200 --nostream || true
    fail "SecureAsset did not reach HTTP health readiness. Review the PM2 diagnostics above."
  fi
  APP_DIR="$APP_DIR" node scripts/reconcile-pm2-release.js --verify
  APP_DIR="$APP_DIR" SECUREASSET_HTTP_PORT="$PORT_VALUE" node scripts/reconcile-http-listener.js --verify-pm2
  ./node_modules/.bin/pm2 save
fi

log "Checking the API directly on port $PORT_VALUE"
node scripts/verify-auth-routing.js "http://127.0.0.1:${PORT_VALUE}"

AAPANEL_ROOT="/www/server/panel/vhost/nginx"
VHOST_FILE=""
LOCAL_VHOST_VERIFIED=0
if [[ -d "$AAPANEL_ROOT" ]]; then
  while IFS= read -r candidate; do
    if grep -Eq "server_name[[:space:]][^;]*\b${DOMAIN_VALUE//./\\.}\b" "$candidate"; then VHOST_FILE="$candidate"; break; fi
  done < <(find "$AAPANEL_ROOT" -maxdepth 1 -type f -name '*.conf' -print 2>/dev/null | sort)
fi

if [[ -n "$VHOST_FILE" ]]; then
  log "Reconciling the active aaPanel vhost for $DOMAIN_VALUE"
  EXT_DIR="$AAPANEL_ROOT/extension/$DOMAIN_VALUE"
  LEGACY_TARGET="$EXT_DIR/secureasset-api.conf"
  TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
  VHOST_BACKUP="${VHOST_FILE}.secureasset-backup-${TIMESTAMP}"
  LEGACY_BACKUP="${LEGACY_TARGET}.backup-${TIMESTAMP}"
  LEGACY_EXISTED=0

  cp -a "$VHOST_FILE" "$VHOST_BACKUP"
  if [[ -f "$LEGACY_TARGET" ]]; then
    LEGACY_EXISTED=1
    cp -a "$LEGACY_TARGET" "$LEGACY_BACKUP"
  fi

  rollback_nginx_changes() {
    cp -a "$VHOST_BACKUP" "$VHOST_FILE"
    if [[ "$LEGACY_EXISTED" == "1" ]]; then
      mkdir -p "$EXT_DIR"
      cp -a "$LEGACY_BACKUP" "$LEGACY_TARGET"
    else
      rm -f "$LEGACY_TARGET"
    fi
  }

  # v7 used an extension include and could collide with a manually configured
  # /api/ location. v8 reconciles all SecureAsset paths directly inside the
  # active HTTPS server block and removes only the obsolete SecureAsset
  # extension file.
  node scripts/reconcile-aapanel-vhost.js "$VHOST_FILE" "$DOMAIN_VALUE" "$PORT_VALUE"
  rm -f "$LEGACY_TARGET"

  if [[ -x "/www/server/nginx/sbin/nginx" ]]; then
    NGINX_BIN="/www/server/nginx/sbin/nginx"
  else
    NGINX_BIN="$(command -v nginx || true)"
  fi
  [[ -x "$NGINX_BIN" ]] || fail "Nginx binary was not found"

  if ! "$NGINX_BIN" -t; then
    rollback_nginx_changes
    "$NGINX_BIN" -t || true
    fail "Nginx rejected the reconciled SecureAsset proxy; the previous vhost was restored"
  fi
  if ! "$NGINX_BIN" -s reload; then
    rollback_nginx_changes
    "$NGINX_BIN" -t || true
    "$NGINX_BIN" -s reload || true
    fail "Nginx could not reload the reconciled SecureAsset proxy; the previous vhost was restored"
  fi
  echo "aaPanel vhost reconciled and Nginx reloaded successfully."
  echo "Vhost backup retained at: $VHOST_BACKUP"
  LOCAL_VHOST_VERIFIED=1
else
  echo "No aaPanel vhost was found for $DOMAIN_VALUE. Existing system/reverse-proxy configuration was left unchanged."
fi

if [[ "$LOCAL_VHOST_VERIFIED" == "1" ]]; then
  log "Checking the configured Nginx virtual host locally"
  node scripts/verify-auth-routing.js "$PUBLIC_URL" --connect-host=127.0.0.1 --insecure-tls
  node scripts/verify-public-assets.js "$PUBLIC_URL" --connect-host=127.0.0.1 --insecure-tls
fi

log "Checking the direct origin release"
verify_direct_origin "$PUBLIC_URL" "$LOCAL_VHOST_VERIFIED"
echo "Login, registration, and current production assets are working on the direct origin: $PUBLIC_URL"
