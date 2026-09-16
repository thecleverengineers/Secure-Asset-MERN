# Exact Stack Validation Report

Date: 2026-06-26

Target:
- Node.js 24.18.0
- npm 11.16.0
- MongoDB 8.0.26
- Ubuntu 22.04 x86_64

Validated locally with the exact Node.js and npm versions:

- Runtime guard: passed
- Mongoose schema contracts: 65 models passed
- Resource/model contracts: 55 resources passed
- Server ESLint: passed with zero warnings
- Automated tests: 13 passed, 0 failed
- TypeScript strict compilation: passed
- Server JavaScript syntax: passed
- Vite production build: passed, 12,318 modules transformed
- Production build artifact verification: passed
- npm production security audit: 0 vulnerabilities
- npm dependency tree resolution: passed; optional platform tooling may be absent without affecting runtime
- Package secret scan: no pasted JWT or vault key found

Not executed inside the artifact sandbox:

- Connection to the user's live MongoDB 8.0.26 instance
- Live S3 bucket read/write/delete check
- Live ClamAV daemon scan
- Live SMTP authentication and email delivery
- Nginx/Let's Encrypt configuration on the user's VPS

These are intentionally covered by `npm run certify:production` and `bash deploy.sh` on the target server. A service failure blocks deployment instead of being silently ignored.
