// Response hardening for the authenticated Document Vault surface. Vault
// responses contain private metadata or file bytes and must never be cached,
// framed by another origin, or treated as executable content by a browser.
export function vaultSecurityHeaders(_req, res, next) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
  });
  next();
}
