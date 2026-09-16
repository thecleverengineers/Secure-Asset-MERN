function base64UrlToBytes(value: string) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value || '').length / 4) * 4, '=');
  const binary = window.atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64Url(value: ArrayBuffer | ArrayLike<number>) {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : Uint8Array.from(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function deviceUnlockSupported() {
  return typeof window !== 'undefined' && window.isSecureContext && typeof navigator.credentials?.create === 'function' && typeof navigator.credentials?.get === 'function' && typeof PublicKeyCredential !== 'undefined';
}

export function registrationOptionsForBrowser(options: Record<string, any>): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64UrlToBytes(options.challenge),
    user: { ...options.user, id: base64UrlToBytes(options.user.id) },
    excludeCredentials: (options.excludeCredentials || []).map((credential: any) => ({ ...credential, id: base64UrlToBytes(credential.id) })),
  } as unknown as PublicKeyCredentialCreationOptions;
}

export function authenticationOptionsForBrowser(options: Record<string, any>): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64UrlToBytes(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((credential: any) => ({ ...credential, id: base64UrlToBytes(credential.id) })),
  } as PublicKeyCredentialRequestOptions;
}

export function serializePublicKeyCredential(credential: Credential | null) {
  if (!credential) throw new Error('The device did not return a credential');
  const value = credential as PublicKeyCredential;
  const response = value.response as AuthenticatorAttestationResponse | AuthenticatorAssertionResponse;
  const payload: Record<string, any> = {
    id: value.id,
    rawId: bytesToBase64Url(value.rawId),
    type: value.type,
    authenticatorAttachment: value.authenticatorAttachment || undefined,
    clientExtensionResults: value.getClientExtensionResults?.() || {},
    response: {
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
    },
  };
  if ('attestationObject' in response) {
    const attestation = response as AuthenticatorAttestationResponse;
    payload.response.attestationObject = bytesToBase64Url(attestation.attestationObject);
    payload.response.transports = attestation.getTransports?.() || undefined;
  } else {
    const assertion = response as AuthenticatorAssertionResponse;
    payload.response.authenticatorData = bytesToBase64Url(assertion.authenticatorData);
    payload.response.signature = bytesToBase64Url(assertion.signature);
    payload.response.userHandle = assertion.userHandle ? bytesToBase64Url(assertion.userHandle) : undefined;
  }
  return payload;
}
