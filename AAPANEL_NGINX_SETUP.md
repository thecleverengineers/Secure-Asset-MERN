# aaPanel / Nginx React route reload fix

A React application that uses `createBrowserRouter` must return `dist/index.html` for page URLs such as `/login`, `/marketplace/123` and `/app/dashboard`. Without this fallback, Nginx looks for physical files at those paths and returns 404 on refresh.

## Recommended aaPanel configuration

1. Build and restart the application:

```bash
cd /www/secureasset
npm ci
npm run build
pm2 startOrReload ecosystem.config.cjs --env production --update-env
```

2. In **aaPanel → Website → your domain → Config**, either reverse-proxy the entire website to `http://127.0.0.1:5000`, or serve `dist` directly with the configuration in `deploy/nginx/secureasset-static.conf.template`.

3. When serving `dist` directly, the essential line is:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Keep `/api/`, `/socket.io/`, `/site-assets/` and `/uploads/` proxied to the Node process. Replace `DOMAIN`, `APP_DIR` and `PORT` in the supplied template, test with `nginx -t`, then reload Nginx.

4. Verify deep-link reloads:

```bash
curl -I -H 'Accept: text/html' https://YOUR_DOMAIN/login
curl -I -H 'Accept: text/html' https://YOUR_DOMAIN/app/dashboard
curl -I -H 'Accept: text/html' https://YOUR_DOMAIN/marketplace/test-id
```

Each page request must return `200` and `Content-Type: text/html`. An unknown API request such as `/api/v1/does-not-exist` must still return JSON `404`, not the React HTML page.

## Repair login and registration request failures

If pages open normally but login, registration, OTP, or password reset shows `Request failed`, the static website is usually not forwarding `/api/` to the Node process, or the frontend was built with a legacy localhost API URL.

Run the included repair from the actual application directory:

```bash
cd /www/secureasset
sudo bash scripts/repair-auth-routing.sh
```

The repair performs all of the following:

- forces the production browser API base to `/api/v1`;
- rebuilds the frontend and restarts PM2;
- verifies the API directly on the configured internal port;
- installs a managed aaPanel `/api/` and Socket.IO proxy include when the standard aaPanel extension include is present;
- backs up and restores the previous Nginx include if `nginx -t` fails;
- verifies the actual configured Nginx virtual host locally (with the public
  domain Host/SNI) so `/api/`, React routing, and current assets are proven
  directly from this server. The deployment does not contact an external
  cache or edge service. The public DNS A/AAAA records must point directly to
  this server for visitors to receive the active release.

The route-only diagnostic can also be run independently:

```bash
cd /www/secureasset
node scripts/verify-auth-routing.js http://127.0.0.1:5000
# Test the active direct Nginx vhost without depending on public DNS:
node scripts/verify-auth-routing.js https://secureasset.in --connect-host=127.0.0.1 --insecure-tls
node scripts/verify-public-assets.js https://secureasset.in --connect-host=127.0.0.1 --insecure-tls
```
