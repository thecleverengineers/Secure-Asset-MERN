# SecureAsset Reload Fix and Application Audit

Date: 30 June 2026

## Problems corrected

1. Browser refreshes on React routes such as `/login`, `/marketplace/:id`, `/surveyors/:id`, `/public-drive/*` and `/app/*` could return web-server 404 responses when Nginx/aaPanel served `dist` as ordinary static files.
2. The production Express fallback previously served `index.html` too broadly and could mask missing GET API or asset paths.
3. The root deployment script failed during NodeSource setup when executed as `root` because `-E` was invoked without `sudo`.
4. Deployment validation did not test browser-history reload routes.
5. There was no automated frontend-to-backend API route contract check.

## Implemented fixes

- Added a production SPA middleware that serves `index.html` only for genuine HTML navigation requests.
- Reserved `/api`, `/socket.io`, `/site-assets` and `/uploads` from the SPA fallback.
- Prevented missing file requests such as `/missing-file.js` from being rewritten to HTML.
- Added Nginx/aaPanel, Apache, IIS and static-host history fallback files.
- Added `dist/404.html` generation for hosts that use a custom 404 document.
- Added a complete Nginx static-site template with API and Socket.IO proxy rules.
- Added route-reload checks to the production deployment script.
- Fixed root execution of the Node.js installation step.
- Added an automated contract verifier covering frontend API calls against Express routes.

## Validation results

- 22 automated Node tests passed.
- 8 representative React browser routes returned HTTP 200 and the React entry document on direct reload.
- Unknown API and asset paths remained proper JSON 404 responses.
- 133 frontend API endpoint contracts matched 17 mounted Express route groups.
- 60 resource contracts passed across 71 Mongoose models.
- 71 schema model contracts passed.
- 37 enterprise application audit contracts passed.
- TypeScript `--noEmit` validation passed.
- Server ESLint validation passed with zero warnings.
- Production Vite build passed and generated all fallback files.
- Server JavaScript and deployment shell syntax checks passed.
- Nginx configuration syntax test passed.
- End-to-end Nginx tests passed for `/login`, `/app/dashboard`, `/marketplace/example` and `/surveyors/example`; unknown API requests still returned JSON 404.
- Production dependency audit reported 0 vulnerabilities.

## Deployment requirement

Replacing application files alone cannot change an already-active aaPanel/Nginx virtual-host rule. After uploading this release, run the production deployment or apply the supplied Nginx template:

```bash
cd /www/secureasset
sudo bash deploy.sh
```

For an aaPanel site that serves `dist` directly, follow `AAPANEL_NGINX_SETUP.md` and use `deploy/nginx/secureasset-static.conf.template`. The required browser-history rule is:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

## External-service limitation

Static, contract, server-routing, build and reverse-proxy behavior were verified. Live MongoDB data, SMTP, SMS/WhatsApp, payment providers, S3 and domain TLS require the production credentials and services configured in the deployment environment. The project enforces Node.js 24.18.x and npm 11.16.x for its certified production runtime.
