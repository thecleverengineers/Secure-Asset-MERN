import { createReadStream, storedObjectSupportsRange } from '../services/storage.js';

function safeFilename(name = 'file') {
  return String(name).replace(/[\r\n]/g, '_');
}

function parseRange(value, size) {
  if (!value || !String(value).startsWith('bytes=') || !Number.isFinite(size) || size <= 0) return null;
  const raw = String(value).slice(6).split(',')[0].trim();
  const [left, right] = raw.split('-');
  let start;
  let end;
  if (left === '') {
    const suffix = Number(right);
    if (!Number.isInteger(suffix) || suffix <= 0) return null;
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(left);
    end = right === '' ? size - 1 : Number(right);
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

export async function sendStoredFile(req, res, file, { download = false } = {}) {
  const size = Number(file.sizeBytes || 0);
  const supportsRange = !download && await storedObjectSupportsRange(file.storageDriver, file.storageKey);
  const requestedRange = supportsRange ? parseRange(req.headers.range, size) : null;

  if (req.headers.range && supportsRange && !requestedRange) {
    res.status(416).setHeader('Content-Range', `bytes */${size}`);
    res.end();
    return;
  }

  const activeContent = ['image/svg+xml', 'text/html', 'application/xhtml+xml'].includes(String(file.mimeType || '').toLowerCase());
  const forceAttachment = download || activeContent;
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'");
  res.setHeader('Content-Disposition', `${forceAttachment ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(safeFilename(file.name))}`);
  res.setHeader('Accept-Ranges', supportsRange ? 'bytes' : 'none');

  if (requestedRange) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${requestedRange.start}-${requestedRange.end}/${size}`);
    res.setHeader('Content-Length', requestedRange.end - requestedRange.start + 1);
  } else {
    res.setHeader('Content-Length', size);
  }

  const stream = await createReadStream(file.storageDriver, file.storageKey, requestedRange);
  stream.once('error', (error) => res.destroy(error));
  stream.pipe(res);
}
