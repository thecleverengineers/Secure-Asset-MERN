import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { env } from '../config/env.js';

function originOf(value) {
  try { return new URL(value).origin; } catch { return ''; }
}

export function webAuthnConfig() {
  const origin = originOf(env.PUBLIC_APP_URL) || originOf(env.CLIENT_ORIGINS[0]) || 'http://localhost:5173';
  const parsed = new URL(origin);
  const origins = [...new Set([origin, ...env.CLIENT_ORIGINS.map(originOf).filter(Boolean)])];
  return { rpName: 'SecureAsset', rpID: parsed.hostname, origin, origins };
}

export async function registrationOptions({ user, credentials = [] }) {
  const { rpName, rpID } = webAuthnConfig();
  return generateRegistrationOptions({
    rpName,
    rpID,
    userID: Buffer.from(String(user._id)),
    userName: user.email,
    userDisplayName: user.name,
    timeout: 60000,
    attestationType: 'none',
    excludeCredentials: credentials.map((credential) => ({ id: credential.id, transports: credential.transports })),
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'required',
    },
    preferredAuthenticatorType: 'localDevice',
  });
}

export async function authenticationOptions({ credentials = [] }) {
  const { rpID } = webAuthnConfig();
  return generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((credential) => ({ id: credential.id, transports: credential.transports })),
    timeout: 60000,
    userVerification: 'required',
  });
}

export async function verifyRegistration({ response, expectedChallenge }) {
  const { origins, rpID } = webAuthnConfig();
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
    requireUserPresence: true,
    requireUserVerification: true,
  });
}

export async function verifyAuthentication({ response, credential, expectedChallenge }) {
  const { origins, rpID } = webAuthnConfig();
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
    credential: {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey, 'base64url'),
      counter: Number(credential.counter || 0),
      transports: credential.transports,
    },
    requireUserVerification: true,
    advancedFIDOConfig: { userVerification: 'required' },
  });
}
