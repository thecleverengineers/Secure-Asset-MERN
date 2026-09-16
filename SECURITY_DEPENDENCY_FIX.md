# SecureAsset dependency and deployment audit repair

The deployment audit failure in `Pasted text (431).txt` was caused by vulnerable transitive packages, not by MongoDB, PM2 health, the API, or the frontend build.

The source now permanently addresses the dependency chain:

- ExcelJS was removed. Both XLSX exports use the controlled `server/src/services/xlsxWorkbook.js` writer backed by the existing JSZip package, so the abandoned ExcelJS/old archive/unzip chain is no longer installed.
- Archiver is pinned to the ESM-compatible `8.0.0` release and Drive folder downloads use its `ZipArchive` API.
- React and React DOM are pinned to `19.2.8`, React Router to `8.3.0`, and the calendar component to `react-day-picker@10.0.1`.
- Vite, the React Vite plugin, Tailwind, and the Tailwind Vite plugin are upgraded to current Node 24-compatible releases.
- `js-yaml@5.2.2` and `brace-expansion@5.0.8` are enforced through npm overrides. The older unsafe PM2 YAML override was removed.
- A regression test verifies workbook escaping and the dependency policy.

Run the deployment on the required runtime:

```bash
node -v   # v24.18.x
npm -v    # 11.16.x
npm ci --include=dev --no-fund --audit=false
npm run audit:production
npm run build
bash deploy.sh
```

`npm audit` and `npm audit --omit=dev --audit-level=high` both report zero vulnerabilities for this release. The source runtime guard intentionally rejects Node 24.14 or any other version outside `>=24.18.0 <25`.
