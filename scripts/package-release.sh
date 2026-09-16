#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_PATH="${1:-$ROOT_DIR/../secureasset-release-$(date +%Y%m%d-%H%M%S).zip}"

mkdir -p "$(dirname "$OUTPUT_PATH")"
cd "$ROOT_DIR"

# Build in a fresh temporary archive so reusing an output filename can never
# retain entries from an older release (zip updates existing archives in
# place). The verified archive is moved into place only after all checks pass.
TEMP_DIR="$(mktemp -d "${OUTPUT_PATH}.tmp.XXXXXX")"
TEMP_ARCHIVE="$TEMP_DIR/release.zip"
LISTING_FILE=""
cleanup() {
  [[ -z "$LISTING_FILE" ]] || rm -f -- "$LISTING_FILE"
  rm -rf -- "$TEMP_DIR"
}
trap cleanup EXIT

# Keep safe example files (they contain no runtime secrets), while excluding
# only real runtime state. Excluding `.env.*` as a glob is unsafe because it
# also removes `.env.production.example` and makes deploy.sh fail on a clean
# release.
zip -qr "$TEMP_ARCHIVE" . \
  -x 'node_modules/*' \
     '.frontend-releases/*' \
     'dist' 'dist/*' \
     'logs/*' '*.log' \
     '.env' '.env.local' '.env.development' '.env.test' '.env.production'

unzip -t "$TEMP_ARCHIVE" >/dev/null
LISTING_FILE="$(mktemp)"
unzip -l "$TEMP_ARCHIVE" > "$LISTING_FILE"
if ! grep -q '\.env\.production\.example' "$LISTING_FILE"; then
  echo "Release packaging error: .env.production.example is missing from $OUTPUT_PATH" >&2
  exit 1
fi
if grep -Eq 'node_modules/|\.frontend-releases/' "$LISTING_FILE"; then
  echo "Release packaging error: generated dependencies or frontend releases were included." >&2
  exit 1
fi

mv -f -- "$TEMP_ARCHIVE" "$OUTPUT_PATH"

echo "Release archive created: $OUTPUT_PATH"
echo "SHA-256: $(sha256sum "$OUTPUT_PATH" | awk '{print $1}')"
