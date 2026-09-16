# Node.js 24.18 Validation

Validation completed for this hotfix package:

- All server and migration JavaScript files pass `node --check`.
- All Bash deployment scripts pass `bash -n`.
- All relative imports resolve.
- No package-lock URLs reference the internal build registry.
- `package.json` and package-lock root dependencies match.
- No schema uses per-field `index: 'text'` declarations.
- Every declared text index is a named compound index.
- The index-repair utility was tested against a simulated legacy `name_text` conflict.
- The supplied production environment shape passes validation with warnings for blank S3 static credentials, unauthenticated local MongoDB, blank SMTP, and enabled ClamAV.

A full `npm ci` and Vite build could not be rerun inside the packaging environment because it has Node.js 22 and no external package-registry access. The deployment target must run Node.js 24.18.0 or newer within the Node 24 release line; `npm ci`, `npm run schema:check`, `npm run build`, and the production service preflight are enforced on the target server.
