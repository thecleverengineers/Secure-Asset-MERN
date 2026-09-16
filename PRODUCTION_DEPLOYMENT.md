# Production Deployment — npm build and PM2, No Docker

## 1. Server requirements

- Ubuntu 22.04/24.04 or another maintained Linux distribution
- Node.js 24.18.0 (supported range: `>=24.18.0 <25`)
- npm 11.16.0 (supported range: `>=11.16.0 <12`)
- MongoDB 8.0.26 or a compatible authenticated MongoDB Community Server/Atlas deployment
- Nginx/Caddy or another HTTPS reverse proxy
- Persistent local disk or S3-compatible storage
- Optional ClamAV daemon for malware scanning

## 2. Install

```bash
cd /www/secureasset
npm ci
cp .env.production.example .env
chmod 600 .env
mkdir -p logs /var/lib/secureasset/vault /var/lib/secureasset/tmp storage/site-assets
```

Generate independent secrets:

```bash
openssl rand -hex 64   # JWT_ACCESS_SECRET
openssl rand -hex 64   # JWT_REFRESH_SECRET
openssl rand -hex 64   # VAULT_ENCRYPTION_KEY
```

Configure MongoDB, CORS, the public application URL, file storage and provider credentials in `.env`.

## 3. Database preparation

### Fresh database

```bash
npm run db:check
npm run seed
npm run migrate:document-vault
npm run migrate:advanced-rental
npm run db:indexes
```

### Existing database

Create and verify a backup, then run:

```bash
npm run db:check
npm run migrate:tenant-landlord
npm run migrate:surveyor-subscription
npm run migrate:document-vault
npm run migrate:advanced-rental
npm run db:indexes
```

The advanced rental migration adds CMS defaults, dynamic property types, regional area units, landlord plans, property hierarchy compatibility, landlord links on legacy applications and safe demo structures only where eligible. Existing property and legal data is retained.

## 4. Build

```bash
npm run build
npx tsc --noEmit
npm run check
```

The production server serves `dist/` when `NODE_ENV=production`.

## 5. PM2

```bash
npm run pm2:start
npm run pm2:status
npm run pm2:save
npx pm2 startup
```

Run the root command printed by PM2 and save again.

Processes:

```text
secureasset                     Express, API, Socket.IO and built SPA
secureasset-rental-automation   Daily invoice, overdue and reminder processing
secureasset-vault-retention     Daily controlled Trash/retention cleanup
```

Deploy an update:

```bash
npm ci
npm run db:check
npm run migrate:advanced-rental
npm run db:indexes
npm run pm2:reload
```

Operational commands:

```bash
npm run pm2:logs
npm run pm2:status
npm run pm2:restart
npm run pm2:stop
npm run rent:automation
npm run vault:purge
```

## 6. Nginx example

```nginx
server {
    listen 80;
    server_name app.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
    client_max_body_size 300m;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```


### React route reloads

The example above proxies every request to Express, which already serves `dist/index.html` for browser routes. If Nginx or aaPanel serves the `dist` folder directly instead, use `deploy/nginx/secureasset-static.conf.template`. Its `try_files $uri $uri/ /index.html;` rule is required; without it, refreshing `/login`, `/marketplace/:id` or any `/app/*` page returns 404.

### Direct-origin verification

The direct deployment verifies the PM2 loopback origin and then verifies the
configured Nginx virtual host by connecting to `127.0.0.1` while preserving the
public Host header and HTTPS SNI name. This tests the actual Nginx server block,
`/api/` proxy, React route fallback, and current asset files without contacting
an external cache or edge service. The active `dist` symlink is rebuilt
atomically before PM2 starts, so the verified Node process and Nginx origin
serve the same release-specific index and chunks.

For visitors to receive this release, the DNS A/AAAA records for the public
hostname must point directly to this server. Remove any proxy/CDN layer at the
DNS provider; the SecureAsset deployment cannot change records at a provider
that it does not use.

```bash
APP_DIR=/www/secureasset bash deploy.sh
```

## 7. Dynamic CMS launch checklist

- Set the Site title, short title, logo, favicon and default social image in Admin.
- Set `seo.canonicalBaseUrl`, page-specific SEO and Google verification token.
- Configure homepage carousel schedules and CTA links.
- Review property-type fields and regional Bigha/Katha/Lessa conversion values.
- Configure the public map provider and restricted public browser API key.
- Replace all demo contact information and carousel images.
- Confirm maintenance mode is disabled before launch.

## 8. Security checklist

- Restrict MongoDB network access and require TLS/authentication.
- Keep JWT and vault encryption keys in a secret manager.
- Use S3-compatible storage for multi-instance deployment.
- Enable malware scanning or connect an approved scanning provider.
- Configure verified payment webhooks; never trust browser-only payment success.
- Back up MongoDB and object storage and test recovery.
- Monitor PM2 logs, failed login/link attempts and storage usage.
- Run `npm audit --omit=dev` during every deployment. The deployment retries
  transient npm advisory-service failures and uses the local cache before
  continuing with the pinned lockfile; real vulnerability results remain a
  hard failure.


## Dependency installation repair

If Node reports `Cannot find package .../node_modules/mongoose/index.js`, the dependency tree is incomplete. Do not continue to migrations or PM2. Run the commands in `FIX_MONGOOSE_INSTALL.md`, then verify `import("mongoose")` before running `db:check`. Use Node.js 24 LTS for production.
