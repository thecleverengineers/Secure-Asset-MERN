# SecureAsset One-Click Production Deployment

The deployment script installs dependencies, validates production configuration, checks MongoDB, optionally backs up the database, applies migrations, creates indexes, builds the React frontend, starts/reloads PM2, enables reboot recovery, runs a health check, and can configure Nginx and Let's Encrypt.

## Existing production installation

Keep the existing `.env`, extract the updated files over the application, and run:

```bash
cd /www/secureasset
sudo bash deploy.sh
```

The script preserves the existing `.env` and generates only missing secrets.

If a hosting panel or release extractor omitted the hidden `.env.*.example`
files, the configurator automatically uses its built-in safe template instead
of stopping with “No environment template was found”. It defaults to local
MongoDB (`mongodb://127.0.0.1:27017/secureasset`), encrypted local storage,
`/api/v1`, `https://secureasset.in`, and newly generated secrets. For another
domain or a remote database, pass `APP_URL`/`MONGODB_URI` explicitly as shown
below; never commit the generated `.env` file.

## New server with a domain

```bash
cd /www/secureasset
sudo APP_URL=https://property.example.com \
  DOMAIN=property.example.com \
  MONGODB_URI='mongodb+srv://USER:PASSWORD@CLUSTER/secureasset?retryWrites=true&w=majority' \
  CONFIGURE_NGINX=1 \
  ENABLE_SSL=1 \
  SSL_EMAIL=admin@example.com \
  DEPLOY_MODE=fresh \
  CONFIRM_FRESH=YES \
  bash deploy.sh
```

`DEPLOY_MODE=fresh` runs the destructive demo seed and must only be used with a new, empty database. Normal updates use the safe default `DEPLOY_MODE=upgrade`.

## New server without automatic Nginx or SSL

```bash
sudo APP_URL=http://SERVER_IP:5000 \
  MONGODB_URI='mongodb://127.0.0.1:27017/secureasset' \
  CONFIGURE_NGINX=0 \
  DEPLOY_MODE=fresh \
  CONFIRM_FRESH=YES \
  bash deploy.sh
```

## Update later

```bash
cd /www/secureasset
sudo bash deploy.sh
```

## Optional flags

- `DEPLOY_MODE=upgrade|fresh`
- `SKIP_DB_BACKUP=1`
- `SKIP_MIGRATIONS=1`
- `CONFIGURE_NGINX=auto|1|0`
- `ENABLE_SSL=1`
- `SKIP_PM2_STARTUP=1`
- `STORAGE_DRIVER=local|s3`
- `DEPLOY_USER=ubuntu`

The full deployment log is written inside `logs/deploy-YYYYMMDD-HHMMSS.log`.
