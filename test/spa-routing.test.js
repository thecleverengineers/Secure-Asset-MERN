import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'production';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.PUBLIC_APP_URL = 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
process.env.ENCRYPTION_MASTER_KEY_BASE64 = Buffer.alloc(32, 100).toString('base64');
process.env.BACKUP_ENCRYPTION_KEY_BASE64 = Buffer.alloc(32, 101).toString('base64');
process.env.VAULT_ENCRYPTION_KEY = 'c'.repeat(64);
process.env.PAYMENT_AUTO_APPROVE = 'false';
process.env.CLAMAV_ENABLED = 'false';
// Keep this isolated test independent from a production /var/lib vault path.
process.env.VAULT_TEMP_DIR = '/tmp/secureasset-spa-routing';
process.env.CMS_ASSET_DIR = '/tmp/secureasset-spa-site-assets';

const { createApp } = await import('../server/src/app.js');

async function withServer(run) {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('production server returns the React entry point for every browser route reload', async () => {
  await withServer(async (baseUrl) => {
    for (const route of ['/login', '/reset-password', '/marketplace/example-property', '/surveyors/example', '/public-drive/folder/example', '/app/dashboard', '/app/documents', '/about', '/search?q=dimapur']) {
      const response = await fetch(`${baseUrl}${route}`, { headers: { accept: 'text/html' } });
      assert.equal(response.status, 200, route);
      assert.match(response.headers.get('content-type') || '', /text\/html/i, route);
      assert.match(await response.text(), /<div id="root"><\/div>/, route);
    }
  });
});

test('SPA fallback never masks missing API or asset routes', async () => {
  await withServer(async (baseUrl) => {
    const api = await fetch(`${baseUrl}/api/v1/does-not-exist`, { headers: { accept: 'application/json' } });
    assert.equal(api.status, 404);
    assert.match(api.headers.get('content-type') || '', /application\/json/i);
    assert.equal((await api.json()).success, false);

    const asset = await fetch(`${baseUrl}/missing-file.js`, { headers: { accept: '*/*' } });
    assert.equal(asset.status, 404);
    assert.match(asset.headers.get('content-type') || '', /application\/json/i);
  });
});
