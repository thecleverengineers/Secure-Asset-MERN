# Login and registration request failure repair

This release repairs the two deployment conditions that make every authentication request fail while the website itself still loads:

1. a stale production `VITE_API_URL` that points to `localhost`; and
2. an aaPanel/Nginx static-site configuration that serves the React application but does not proxy `/api/` to Express.

## Deploy

```bash
cd /www/secureasset
sudo bash deploy.sh
```

The deployment now refuses to finish unless the following public routes reach the JSON API:

- `GET /api/health/ready`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`

The two POST checks send empty validation bodies. They do not create users, change passwords, or send OTP messages.

## Repair an already deployed installation

```bash
cd /www/secureasset
sudo bash scripts/repair-auth-routing.sh
```

## Expected result

```text
Authentication routing passed: http://127.0.0.1:5000
Authentication routing passed: https://secureasset.in
Login and registration routing are working through https://secureasset.in
```

If the direct test passes but the public test fails, the Node application is healthy and the active aaPanel/Nginx website configuration is still intercepting `/api/`.
