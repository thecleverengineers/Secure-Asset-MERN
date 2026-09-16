import http from 'node:http';
import https from 'node:https';

export class HttpProbeTransportError extends Error {
  constructor(error, target) {
    super(`${error?.code ? `${error.code}: ` : ''}${error?.message || 'request failed'}`);
    this.name = 'HttpProbeTransportError';
    this.code = error?.code;
    this.target = target;
    this.cause = error;
  }
}

function lookupFor(connectHost) {
  if (!connectHost) return undefined;
  const family = connectHost.includes(':') ? 6 : 4;
  return (_hostname, options, callback) => {
    // Node 24's connection-racing lookup path asks for an address array.
    // Returning the legacy single-address form in that case silently turns
    // into an undefined address and can look like an Nginx 502.
    if (options?.all) return callback(null, [{ address: connectHost, family }]);
    return callback(null, connectHost, family);
  };
}

function localVhostAgent(secure, connectHost) {
  if (!connectHost) return undefined;
  const Agent = secure ? https.Agent : http.Agent;
  // Node 24 can opt into environment proxies via NODE_USE_ENV_PROXY. A local
  // vhost probe must never be sent to that proxy: it must connect directly to
  // 127.0.0.1 while retaining the public Host header and TLS SNI name.
  return new Agent({
    keepAlive: false,
    proxyEnv: { NO_PROXY: '*', no_proxy: '*' },
  });
}

export function requestBytes(urlValue, {
  method = 'GET',
  headers = {},
  body,
  connectHost = '',
  insecureTls = false,
  timeoutMs = 15_000,
} = {}) {
  const target = new URL(urlValue);
  const secure = target.protocol === 'https:';
  if (!secure && target.protocol !== 'http:') throw new Error(`Unsupported URL protocol: ${target.protocol}`);
  const transport = secure ? https : http;
  const agent = localVhostAgent(secure, connectHost);

  return new Promise((resolve, reject) => {
    const request = transport.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || undefined,
      method,
      path: `${target.pathname}${target.search}`,
      headers,
      lookup: lookupFor(connectHost),
      agent,
      ...(secure ? { servername: target.hostname, rejectUnauthorized: !insecureTls } : {}),
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.once('error', (error) => reject(new HttpProbeTransportError(error, target.toString())));
      response.once('end', () => resolve({
        url: target.toString(),
        status: response.statusCode || 0,
        headers: response.headers,
        bytes: Buffer.concat(chunks),
      }));
    });

    request.once('error', (error) => reject(new HttpProbeTransportError(error, target.toString())));
    request.setTimeout(timeoutMs, () => request.destroy(Object.assign(new Error(`Request timed out after ${timeoutMs}ms`), { code: 'ETIMEDOUT' })));
    if (body !== undefined) request.write(body);
    request.end();
  });
}

export function headerValue(headers, name) {
  const value = headers?.[String(name).toLowerCase()];
  return Array.isArray(value) ? value.join(', ') : String(value || '');
}

export function transportExitCode(error) {
  if (!(error instanceof HttpProbeTransportError)) return 1;
  // Exit code 2 is intentionally reserved for a network-path failure. The
  // deployment may tolerate it after a strict localhost-vhost check passes.
  const softNetworkCodes = new Set(['EAI_AGAIN', 'ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH']);
  if (softNetworkCodes.has(error.code)) return 2;
  // TLS certificate errors must remain hard failures: external visitors would
  // see the same certificate problem.
  return 3;
}
