import crypto from 'node:crypto';
import { env } from '../config/env.js';

function privateKey() {
  return String(env.DOCUSIGN_PRIVATE_KEY || '').replaceAll('\\n', '\n').trim();
}

export function isDocuSignConfigured() {
  return Boolean(
    env.DOCUSIGN_ENABLED
    && env.DOCUSIGN_API_BASE_URL
    && env.DOCUSIGN_OAUTH_BASE_URL
    && env.DOCUSIGN_ACCOUNT_ID
    && env.DOCUSIGN_INTEGRATION_KEY
    && env.DOCUSIGN_USER_ID
    && privateKey(),
  );
}

export function configurationMessage() {
  return 'DocuSign is not configured. Set DOCUSIGN_ENABLED, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID and DOCUSIGN_PRIVATE_KEY before sending signature requests.';
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function createJwtAssertion() {
  const oauthBase = new URL(env.DOCUSIGN_OAUTH_BASE_URL);
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: env.DOCUSIGN_INTEGRATION_KEY,
    sub: env.DOCUSIGN_USER_ID,
    aud: oauthBase.hostname,
    iat: now,
    exp: now + 300,
    scope: 'signature impersonation',
  }));
  const unsigned = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKey(), 'base64url')}`;
}

async function getAccessToken() {
  if (!isDocuSignConfigured()) throw new Error(configurationMessage());
  const oauthBase = String(env.DOCUSIGN_OAUTH_BASE_URL).replace(/\/+$/, '');
  const response = await fetch(`${oauthBase}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: createJwtAssertion(),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(`DocuSign authentication failed (${response.status})`);
  }
  return payload.access_token;
}

async function docusignRequest(path, options = {}) {
  const token = await getAccessToken();
  const apiBase = String(env.DOCUSIGN_API_BASE_URL).replace(/\/+$/, '');
  const response = await fetch(`${apiBase}/v2.1/accounts/${encodeURIComponent(env.DOCUSIGN_ACCOUNT_ID)}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : await response.text();
  if (!response.ok) {
    const detail = typeof payload === 'string' ? payload : payload.message || payload.errorCode || '';
    throw new Error(`DocuSign request failed (${response.status})${detail ? `: ${String(detail).slice(0, 240)}` : ''}`);
  }
  return payload;
}

export async function sendEnvelope({ documentBuffer, email, name, subject, clientUserId }) {
  const document = Buffer.from(documentBuffer).toString('base64');
  return docusignRequest('/envelopes', {
    method: 'POST',
    body: JSON.stringify({
      emailSubject: subject,
      status: 'sent',
      documents: [{ documentBase64: document, name: 'SecureAsset agreement.pdf', fileExtension: 'pdf', documentId: '1' }],
      recipients: {
        signers: [{
          email,
          name,
          recipientId: '1',
          routingOrder: '1',
          clientUserId: String(clientUserId),
          tabs: {
            signHereTabs: [{ anchorString: '/tenant_signature/', anchorYOffset: '0', anchorUnits: 'pixels', anchorXOffset: '0' }],
            dateSignedTabs: [{ anchorString: '/tenant_date/', anchorYOffset: '0', anchorUnits: 'pixels', anchorXOffset: '0' }],
          },
        }],
      },
    }),
  });
}

export async function createRecipientView({ envelopeId, email, name, clientUserId, returnUrl }) {
  return docusignRequest(`/envelopes/${encodeURIComponent(envelopeId)}/views/recipient`, {
    method: 'POST',
    body: JSON.stringify({
      returnUrl,
      authenticationMethod: 'none',
      email,
      userName: name,
      recipientId: '1',
      clientUserId: String(clientUserId),
    }),
  });
}

export async function getEnvelope(envelopeId) {
  return docusignRequest(`/envelopes/${encodeURIComponent(envelopeId)}`);
}
