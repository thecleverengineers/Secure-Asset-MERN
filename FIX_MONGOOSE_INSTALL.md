# Repair `ERR_MODULE_NOT_FOUND` for Mongoose

The original lockfile was generated against a private build registry. This corrected package uses public `https://registry.npmjs.org/` tarball URLs.

## Recommended repair on Ubuntu / Debian

```bash
cd /www/secureasset

# Recommended: Node.js 24 LTS via nvm
nvm install 24
nvm use 24
nvm alias default 24

# Remove the incomplete dependency tree and npm cache metadata
rm -rf node_modules
npm cache verify

# Force the public npm registry
npm config set registry https://registry.npmjs.org/

# Install exact dependencies from the corrected lockfile
npm ci

# Confirm runtime and Mongoose
npm run runtime:check
node -e "import('mongoose').then(m => console.log('Mongoose', m.default.version))"

# Continue deployment
npm run db:check
npm run build
npm run pm2:reload
```

If you are still using the older package-lock file, remove it once and regenerate it:

```bash
rm -rf node_modules package-lock.json
npm config set registry https://registry.npmjs.org/
npm install
npm run db:check
npm run build
npm run pm2:reload
```

Do not copy `node_modules` between Windows/macOS and Linux. Install dependencies directly on the production server.
