#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"

if [[ -f .env ]] && grep -Eq '^NODE_ENV=production\s*$' .env; then
  echo 'Production environment detected. Running the safe production deploy script instead of local demo setup.'
  exec bash ./deploy.sh "$@"
fi

node scripts/check-runtime.js
npm ci --include=dev --no-fund
npm run db:check

if [[ "${SEED_DEMO_DATA:-0}" == "1" ]]; then
  ALLOW_DESTRUCTIVE_SEED=YES npm run seed
else
  echo 'Demo seed skipped. To intentionally reset a development database, run: SEED_DEMO_DATA=1 ./setup-unix.sh'
fi

printf '\nSetup completed. Run ./start-unix.sh to launch the app.\n'
