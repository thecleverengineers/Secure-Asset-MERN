import type {
  ApiResponse, DashboardOverview, DashboardStats, Document, OtpSendRequest, OtpVerifyRequest,
  PaginatedResponse, Payment, Property, PropertyFilters, ResourceList, Tenant, User, AuthResult, AuthSession, RegistrationChallenge, TwoFactorChallenge, Fast2SmsSettings, MapsSettings, PublicSearchPayload, WishlistItem, WishlistListingKind,
} from './types';

function isLocalHostname(hostname: string): boolean {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return value === 'localhost' || value === '127.0.0.1' || value === '::1' || value.endsWith('.localhost');
}

function normalizeApiBase(configuredValue?: string): string {
  const raw = String(configuredValue || '').trim();
  if (!raw || raw === '/') return '/api/v1';

  let candidate = raw.replace(/\/+$/, '');
  if (!candidate.startsWith('/') && !/^https?:\/\//i.test(candidate)) candidate = `/${candidate}`;

  try {
    const url = new URL(candidate);
    const browserHost = typeof window !== 'undefined' ? window.location.hostname : '';

    // A production bundle must never send visitors to their own localhost.
    // Older .env files sometimes contained http://localhost:5000/api/v1.
    if (browserHost && !isLocalHostname(browserHost) && isLocalHostname(url.hostname)) return '/api/v1';

    if (!url.pathname || url.pathname === '/') return `${url.origin}/api/v1`;
    if (/\/api$/i.test(url.pathname)) return `${url.origin}${url.pathname}/v1`;
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    // Relative same-origin paths are preferred for the standard deployment.
  }

  if (/\/api\/v1$/i.test(candidate)) return candidate;
  if (/\/api$/i.test(candidate)) return `${candidate}/v1`;
  return candidate;
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);
let refreshing: Promise<AuthSession | null> | null = null;
let accessToken: string | null = null;
let deviceUnlockToken: string | null = null;
let vaultPinUnlockToken: string | null = null;
type SessionBootstrap = { authenticated: boolean; user?: User | null; sessionId?: string; sessionExpiresAt?: string; absoluteExpiresAt?: string };

function initialSessionBootstrap(): SessionBootstrap | null {
  if (typeof document === 'undefined') return null;
  const node = document.getElementById('secureasset-session-bootstrap');
  if (!node?.textContent) return null;
  try {
    const parsed = JSON.parse(node.textContent) as SessionBootstrap;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

const bootstrappedSession = initialSessionBootstrap();
let currentUser: User | null = bootstrappedSession?.authenticated ? (bootstrappedSession.user || null) : null;

const SESSION_CHANNEL_NAME = 'secureasset-session-v98';
const tabId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
const sessionChannel: BroadcastChannel | null = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel(SESSION_CHANNEL_NAME)
  : null;
let lastSessionEventAt = 0;

// Normal application requests can legitimately include cold-start database
// work. Keep a generous client ceiling; authorization and server/proxy
// timeouts remain authoritative and prevent truly hung requests.
const DEFAULT_REQUEST_TIMEOUT_MS = 90_000;
const AUTH_REQUEST_TIMEOUT_MS = 45_000;
const MAP_REQUEST_TIMEOUT_MS = 45_000;
const UPLOAD_REQUEST_TIMEOUT_MS = 180_000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const forwardAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', forwardAbort, { once: true });
  }

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error(`SecureAsset API request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
      timeoutError.name = 'SecureAssetTimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', forwardAbort);
  }
}

async function fetchBinary(input: RequestInfo | URL, init: RequestInit, message: string, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<Blob> {
  const response = await fetchWithTimeout(input, init, timeoutMs);
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) throw new Error('The web server returned the application page instead of the requested file. Check the API proxy configuration.');
  if (!response.ok) {
    const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
    throw new Error(payload?.message || message);
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error(`${message} (empty response)`);
  return blob;
}

function readCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const prefix = `${name}=`;
  const item = document.cookie.split(';').map((value) => value.trim()).find((value) => value.startsWith(prefix));
  if (!item) return '';
  try { return decodeURIComponent(item.slice(prefix.length)); } catch { return item.slice(prefix.length); }
}

function broadcastSession(message: Record<string, unknown>) {
  try { sessionChannel?.postMessage({ ...message, source: tabId, at: Date.now() }); } catch { /* Safari/private mode may disable the channel. */ }
}

// Access tokens, when received from a legacy server, stay memory-only. The
// current server contract is cookie-only: the raw rotating session token is
// never visible to JavaScript and the safe profile is prehydrated in HTML.
export function getToken(): string | null { return accessToken; }
export function getInitialSession(): AuthSession | null {
  if (!bootstrappedSession?.authenticated || !bootstrappedSession.user) return null;
  return {
    user: bootstrappedSession.user,
    sessionId: bootstrappedSession.sessionId,
    sessionExpiresAt: bootstrappedSession.sessionExpiresAt,
    absoluteExpiresAt: bootstrappedSession.absoluteExpiresAt,
  };
}
export function setSession(session: AuthSession, { broadcast = true } = {}) {
  accessToken = session.accessToken || session.token || null;
  currentUser = session.user || null;
  lastSessionEventAt = Date.now();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('secureasset:session', { detail: { authenticated: Boolean(currentUser), user: currentUser, sessionExpiresAt: session.sessionExpiresAt || session.expiresAt, absoluteExpiresAt: session.absoluteExpiresAt } }));
  if (broadcast && currentUser) broadcastSession({ type: 'authenticated', user: currentUser, sessionId: session.sessionId, sessionExpiresAt: session.sessionExpiresAt || session.expiresAt, absoluteExpiresAt: session.absoluteExpiresAt });
}
export function clearSession({ broadcast = true } = {}) {
  accessToken = null;
  deviceUnlockToken = null;
  vaultPinUnlockToken = null;
  currentUser = null;
  lastSessionEventAt = Date.now();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('secureasset:session', { detail: { authenticated: false } }));
  if (broadcast) broadcastSession({ type: 'logout' });
}
export function setDeviceUnlockToken(token: string | null) { deviceUnlockToken = token || null; }
export function setVaultPinUnlockToken(token: string | null) { vaultPinUnlockToken = token || null; }
export function hasVaultPinUnlockToken() { return Boolean(vaultPinUnlockToken); }
export function clearDeviceUnlockToken() { deviceUnlockToken = null; vaultPinUnlockToken = null; }
export function getCurrentUser(): User | null { return currentUser; }

export async function renewSession(): Promise<AuthSession | null> {
  if (!refreshing) {
    refreshing = fetchWithTimeout(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' }, AUTH_REQUEST_TIMEOUT_MS)
      .then(async (res) => {
        // A definitive session rejection (expiry, revocation, or account
        // disablement) must clear the in-memory profile immediately. Network
        // errors and rate limits remain silent so a brief outage never signs
        // an active user out locally.
        if (res.status === 401) { clearSession(); return null; }
        if (!res.ok) return null;
        const payload = await res.json() as ApiResponse<AuthSession>;
        if (payload.success && payload.data?.user) { setSession(payload.data); return payload.data; }
        return null;
      })
      .catch(() => null)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function refreshSession(): Promise<boolean> { return Boolean(await renewSession()); }

sessionChannel?.addEventListener('message', (event) => {
  const data = event.data as { source?: string; at?: number; type?: string; user?: User; sessionId?: string; sessionExpiresAt?: string; absoluteExpiresAt?: string };
  if (!data || data.source === tabId || !data.type || Number(data.at || 0) < lastSessionEventAt) return;
  lastSessionEventAt = Number(data.at || Date.now());
  if (data.type === 'authenticated' && data.user) {
    setSession({ user: data.user, sessionId: data.sessionId, sessionExpiresAt: data.sessionExpiresAt, absoluteExpiresAt: data.absoluteExpiresAt }, { broadcast: false });
  } else if (data.type === 'logout') clearSession({ broadcast: false });
});

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  // A body-less GET must stay a simple request. Adding JSON content type to
  // every request can trigger an avoidable CORS preflight when an installation
  // uses a separate API origin.
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(String(init.method || 'GET').toUpperCase())) {
    const csrf = readCookie('sa_csrf');
    if (csrf) headers.set('X-SecureAsset-CSRF', csrf);
  }
  if (path.startsWith('/drive')) {
    if (deviceUnlockToken) headers.set('X-SecureAsset-Device-Unlock', deviceUnlockToken);
    if (vaultPinUnlockToken) headers.set('X-SecureAsset-Vault-Pin-Unlock', vaultPinUnlockToken);
  }
  let res: Response;
  const timeoutMs = init.body instanceof FormData
    ? UPLOAD_REQUEST_TIMEOUT_MS
    : path.startsWith('/maps/')
      ? MAP_REQUEST_TIMEOUT_MS
    : path.startsWith('/auth/') || path.startsWith('/site/config')
      ? AUTH_REQUEST_TIMEOUT_MS
      : DEFAULT_REQUEST_TIMEOUT_MS;
  try {
    res = await fetchWithTimeout(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' }, timeoutMs);
  } catch (error) {
    if (error instanceof Error && error.name === 'SecureAssetTimeoutError') throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot reach the SecureAsset API. Verify that the server is running and Nginx/aaPanel proxies /api/ to port 5000. (${reason})`);
  }
  if (res.status === 401 && retry && !['/auth/login', '/auth/refresh', '/auth/register', '/auth/register/verify', '/auth/register/resend-otp', '/auth/verify-otp', '/auth/two-factor/challenge', '/auth/forgot-password', '/auth/reset-password'].includes(path)) {
    if (await refreshSession()) return request<T>(path, init, false);
    clearSession();
  }
  if (res.status === 423 && path.startsWith('/drive')) {
    deviceUnlockToken = null;
    vaultPinUnlockToken = null;
    window.dispatchEvent(new CustomEvent('secureasset:device-unlock-required'));
  }
  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await res.json() : await res.text();
  if (contentType.includes('text/html')) {
    throw new Error('The web server returned the application page instead of the API response. Configure Nginx/aaPanel to proxy /api/ to 127.0.0.1:5000.');
  }
  if (!res.ok) throw new Error(typeof payload === 'object' && payload?.message ? payload.message : `Request failed (${res.status})`);
  return payload as T;
}

function isAuthSession(value: AuthResult): value is AuthSession { return Boolean((value as AuthSession)?.user && !(value as TwoFactorChallenge)?.requiresTwoFactor); }
export async function login(identifier: string, password: string) {
  const result = await request<ApiResponse<AuthResult>>('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });
  if (isAuthSession(result.data)) setSession(result.data); return result;
}
export async function completeTwoFactorLogin(challengeToken: string, code: string) {
  const result = await request<ApiResponse<AuthSession>>('/auth/two-factor/challenge', { method: 'POST', body: JSON.stringify({ challengeToken, code }) });
  setSession(result.data); return result;
}
export async function register(body: { name: string; email: string; phone: string; password: string; invitationToken?: string }) {
  return request<ApiResponse<RegistrationChallenge>>('/auth/register', { method: 'POST', body: JSON.stringify(body) });
}
export async function verifyRegistration(phone: string, otp: string) {
  const result = await request<ApiResponse<AuthSession>>('/auth/register/verify', { method: 'POST', body: JSON.stringify({ phone, otp }) });
  setSession(result.data); return result;
}
export async function resendRegistrationOtp(phone: string) {
  return request<ApiResponse<null>>('/auth/register/resend-otp', { method: 'POST', body: JSON.stringify({ phone }) });
}
export async function getLandlordTenants(params: { page: number; limit: number; filter: string; search: string }) {
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
  return request<{ success: boolean; data: Record<string, any>[]; pagination: { page: number; pages: number; total: number }; counts: { all: number; added: number; holders: number } }>('/resources/tenant-invitations/workspace?' + query);
}
export async function lookupTenantInvitation(token: string) {
  return request<ApiResponse<Record<string, any>>>('/public/tenant-invitations/lookup', { method: 'POST', body: JSON.stringify({ token }) });
}
export async function createTenantInvitation(body: { name: string; email: string; phone: string; property: string; unitName?: string; privateNotes?: string }) {
  return request<ApiResponse<Record<string, any>>>('/resources/tenant-invitations', { method: 'POST', body: JSON.stringify(body) });
}
export async function resendTenantInvitation(id: string) {
  return request<ApiResponse<Record<string, any>>>('/resources/tenant-invitations/' + encodeURIComponent(id) + '/resend', { method: 'POST', body: JSON.stringify({}) });
}
export async function acceptTenantInvitation(token: string) {
  return request<ApiResponse<Record<string, any>>>('/resources/tenant-invitations/accept', { method: 'POST', body: JSON.stringify({ token }) });
}
export async function cancelTenantInvitation(id: string) {
  return request<ApiResponse<null>>('/resources/tenant-invitations/' + encodeURIComponent(id) + '/cancel', { method: 'POST', body: JSON.stringify({}) });
}
export async function logout() {
  try { await request('/auth/logout', { method: 'POST' }); } finally { clearSession(); }
}
export async function getMe() { return request<ApiResponse<User>>('/auth/me'); }
export async function updateMe(body: { name?: string; avatar?: string; region?: string; country?: string; state?: string; city?: string }) { return request<ApiResponse<User>>('/auth/me', { method: 'PATCH', body: JSON.stringify(body) }); }
export async function uploadProfileAvatar(file: File) { const form = new FormData(); form.append('file', file); return request<ApiResponse<{ url: string; filename: string; mimeType: string; size: number }>>('/auth/me/avatar', { method: 'POST', body: form }); }
export async function sendOtp(body: OtpSendRequest) { return request<ApiResponse<{ maskedMobile?: string }>>('/auth/send-otp', { method: 'POST', body: JSON.stringify(body) }); }
export async function verifyOtp(body: OtpVerifyRequest) {
  const result = await request<ApiResponse<AuthResult>>('/auth/verify-otp', { method: 'POST', body: JSON.stringify(body) });
  if (isAuthSession(result.data)) setSession(result.data); return result;
}
export async function forgotPassword(identifier: string) { return request<ApiResponse<{ maskedMobile?: string }>>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ identifier }) }); }
export async function resetPassword(identifier: string, otp: string, password: string) { return request<ApiResponse<null>>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ identifier, otp, password }) }); }

export async function getFast2SmsSettings() { return request<ApiResponse<Fast2SmsSettings>>('/integrations/fast2sms'); }
export async function updateFast2SmsSettings(body: Pick<Fast2SmsSettings, 'enabled'|'endpoint'|'route'|'senderId'|'messageId'|'variablesTemplate'|'scheduleTime'|'whatsappEnabled'|'whatsappEndpoint'|'whatsappPhoneNumberId'> & { authorization?: string }) { return request<ApiResponse<Fast2SmsSettings>>('/integrations/fast2sms', { method: 'PATCH', body: JSON.stringify(body) }); }
export async function testFast2SmsSettings(mobile: string, otp = '123456', templateKey?: string, variables?: string[]) { return request<ApiResponse<null>>('/integrations/fast2sms/test', { method: 'POST', body: JSON.stringify(templateKey ? { mobile, templateKey, variables } : { mobile, otp }) }); }
export async function getMapsSettings() { return request<ApiResponse<MapsSettings>>('/integrations/maps'); }
export async function updateMapsSettings(body: {
  enabled: boolean; provider: MapsSettings['provider']; publicApiKey: string; serverApiKey?: string; geocodingApiKey?: string; directionsApiKey?: string; placesApiKey?: string;
  routesApiKey?: string; elevationApiKey?: string; roadsApiKey?: string; addressValidationApiKey?: string; groundingLiteApiKey?: string; navigationConnectAccessToken?: string; routeOptimizationAccessToken?: string; streetViewAccessToken?: string;
  navigationEnabled: boolean; locationPickerEnabled: boolean; reverseGeocodeEnabled: boolean; directionsEnabled: boolean; serverRoutesEnabled: boolean; routesEnabled: boolean; placesEnabled: boolean; placesUiKitEnabled: boolean; addressValidationEnabled: boolean; elevationEnabled: boolean; roadsEnabled: boolean; routeOptimizationEnabled: boolean; navigationConnectEnabled: boolean; groundingLiteEnabled: boolean; streetViewPublishEnabled: boolean; useTraffic: boolean;
  routeRefreshSeconds: number; locationUpdateSeconds: number; maxRouteWaypoints: number; cloudProjectId: string; regionCode: string; languageCode: string; units: MapsSettings['units']; navigationConnectAndroidAppId?: string; navigationConnectIosAppId?: string; mapId: string;
  defaultLatitude: number; defaultLongitude: number; defaultZoom: number; travelMode: MapsSettings['travelMode'];
}) { return request<ApiResponse<MapsSettings>>('/integrations/maps', { method: 'PATCH', body: JSON.stringify(body) }); }

export async function getMapsPlatformStatus() { return request<ApiResponse<Record<string, any>>>('/maps/status'); }
export async function computeMapRoute(body: { origin: { latitude: number; longitude: number }; destination: { latitude: number; longitude: number }; travelMode?: string; routingPreference?: string; intermediates?: Array<{ latitude: number; longitude: number }>; departureTime?: string }) {
  return request<ApiResponse<{ provider: string; route: { distanceMeters: number; durationSeconds: number; distanceText: string; durationText: string; encodedPolyline: string }; routes: any[] }>>('/maps/routes', { method: 'POST', body: JSON.stringify(body) });
}
export async function computeMapRouteMatrix(body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>('/maps/route-matrix', { method: 'POST', body: JSON.stringify(body) }); }
export async function validateMapAddress(body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>('/maps/address-validation', { method: 'POST', body: JSON.stringify(body) }); }
export async function autocompleteMapPlaces(body: Record<string, any>) { return request<ApiResponse<{ suggestions: Array<Record<string, any>> }>>('/maps/places/autocomplete', { method: 'POST', body: JSON.stringify(body) }); }
export async function getMapPlaceDetails(placeId: string) { return request<ApiResponse<Record<string, any>>>(`/maps/places/${encodeURIComponent(placeId)}`); }
export async function searchMapPlaces(body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>('/maps/places/search', { method: 'POST', body: JSON.stringify(body) }); }
export async function getMapElevation(points: Array<Record<string, any>>) { return request<ApiResponse<Record<string, any>>>('/maps/elevation', { method: 'POST', body: JSON.stringify({ points }) }); }
export async function snapMapRoads(points: Array<Record<string, any>>, interpolate = true) { return request<ApiResponse<Record<string, any>>>('/maps/roads/snap', { method: 'POST', body: JSON.stringify({ points, interpolate }) }); }
export async function nearestMapRoads(points: Array<Record<string, any>>) { return request<ApiResponse<Record<string, any>>>('/maps/roads/nearest', { method: 'POST', body: JSON.stringify({ points }) }); }
export async function getMapRoadSpeedLimits(options: { points?: Array<Record<string, any>>; placeIds?: string[]; units?: 'KPH' | 'MPH' }) { return request<ApiResponse<Record<string, any>>>('/maps/roads/speed-limits', { method: 'POST', body: JSON.stringify(options) }); }
export async function getMapNavigationConnectTrip(name: string, routePolylineFormat: 'SIMPLE' | 'ENCODED' | 'S2ENCODED' | 'GEO_JSON' = 'SIMPLE') {
  const query = new URLSearchParams({ name, routePolylineFormat });
  return request<ApiResponse<Record<string, any>>>(`/maps/navigation-connect/trip?${query}`);
}
export async function createMapNavigationConnectTrip(body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>('/maps/navigation-connect/trips', { method: 'POST', body: JSON.stringify(body) }); }
export async function optimizeMapTours(model: Record<string, any>, options: { projectId?: string; validateOnly?: boolean } = {}) {
  return request<ApiResponse<Record<string, any>>>('/maps/route-optimization', { method: 'POST', body: JSON.stringify({ model, ...options }) });
}
export async function getGroundingLiteTools() { return request<ApiResponse<Record<string, any>>>('/maps/grounding-lite/tools'); }
export async function callGroundingLiteTool(name: string, args: Record<string, any> = {}) {
  return request<ApiResponse<Record<string, any>>>('/maps/grounding-lite/call', { method: 'POST', body: JSON.stringify({ name, arguments: args }) });
}
export async function publishMapStreetViewPhoto(file: File, metadata: { latitude: number; longitude: number; heading?: number; pitch?: number; roll?: number; altitude?: number; placeId?: string }) {
  const form = new FormData();
  form.append('file', file);
  Object.entries(metadata).forEach(([key, value]) => { if (value !== undefined && value !== null) form.append(key, String(value)); });
  return request<ApiResponse<Record<string, any>>>('/maps/street-view/publish', { method: 'POST', body: form });
}

export type SecuritySession = { id: string; device?: string; ip?: string; createdAt?: string; lastUsedAt?: string; expiresAt?: string; absoluteExpiresAt?: string; current?: boolean; persistent?: boolean };
export type SecurityOverview = { twoFactorEnabled: boolean; deviceUnlockEnabled: boolean; vaultPinEnabled: boolean; sessions: SecuritySession[] };
export async function getSecurityOverview() { return request<ApiResponse<SecurityOverview>>('/auth/security'); }
export async function setVaultPin(pin: string) {
  const result = await request<ApiResponse<{ vaultPinEnabled: boolean; token: string }>>('/auth/vault-pin/set', { method: 'POST', body: JSON.stringify({ pin }) });
  setVaultPinUnlockToken(result.data.token);
  return result;
}
export async function unlockVaultPin(pin: string) {
  const result = await request<ApiResponse<{ unlocked: boolean; token: string }>>('/auth/vault-pin/unlock', { method: 'POST', body: JSON.stringify({ pin }) });
  setVaultPinUnlockToken(result.data.token);
  return result;
}
export type AdminSession = SecuritySession & { rotation?: number; user?: { _id: string; name?: string; email?: string; role?: string; status?: string } | null };
export async function getAdminSessions(limit = 100) { return request<ApiResponse<AdminSession[]>>(`/auth/admin/sessions?limit=${Math.min(200, Math.max(1, Math.round(limit)))}`); }
export async function revokeAdminSession(sessionId: string) { return request<ApiResponse<null>>(`/auth/admin/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }); }
export async function revokeAdminUserSessions(userId: string) { return request<ApiResponse<null>>(`/auth/admin/users/${encodeURIComponent(userId)}/sessions/revoke`, { method: 'POST' }); }
export async function changePassword(currentPassword: string, newPassword: string) { return request<ApiResponse<null>>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); }
export async function beginTwoFactorSetup() { return request<ApiResponse<{ secret: string; otpauthUri: string }>>('/auth/two-factor/setup', { method: 'POST' }); }
export async function enableTwoFactor(password: string, code: string) { return request<ApiResponse<{ backupCodes: string[] }>>('/auth/two-factor/enable', { method: 'POST', body: JSON.stringify({ password, code }) }); }
export async function disableTwoFactor(password: string, code: string) { return request<ApiResponse<null>>('/auth/two-factor/disable', { method: 'POST', body: JSON.stringify({ password, code }) }); }
export async function regenerateBackupCodes(password: string, code: string) { return request<ApiResponse<{ backupCodes: string[] }>>('/auth/two-factor/backup-codes', { method: 'POST', body: JSON.stringify({ password, code }) }); }
export async function revokeSession(sessionId: string) { return request<ApiResponse<null>>(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }); }
export async function revokeOtherSessions(password: string) { return request<ApiResponse<null>>('/auth/sessions/revoke-others', { method: 'POST', body: JSON.stringify({ password }) }); }
export async function beginDeviceUnlockSetup(currentPassword: string) { return request<ApiResponse<Record<string, any>>>('/auth/device-unlock/setup/options', { method: 'POST', body: JSON.stringify({ currentPassword }) }); }
export async function completeDeviceUnlockSetup(response: Record<string, any>) { return request<ApiResponse<{ deviceUnlockEnabled: boolean }>>('/auth/device-unlock/setup/verify', { method: 'POST', body: JSON.stringify({ response }) }); }
export async function beginDeviceUnlockAuthentication() { return request<ApiResponse<Record<string, any>>>('/auth/device-unlock/authentication/options', { method: 'POST' }); }
export async function completeDeviceUnlockAuthentication(response: Record<string, any>) {
  const result = await request<ApiResponse<{ unlocked: boolean; token: string }>>('/auth/device-unlock/authentication/verify', { method: 'POST', body: JSON.stringify({ response }) });
  setDeviceUnlockToken(result.data.token);
  return result;
}
export async function resetDeviceUnlock(currentPassword: string) { return request<ApiResponse<{ deviceUnlockEnabled: boolean }>>('/auth/device-unlock', { method: 'DELETE', body: JSON.stringify({ currentPassword }) }); }
export async function requestContactChange(type: 'email' | 'phone', value: string, currentPassword: string) { return request<ApiResponse<{ type: 'email' | 'phone'; maskedMobile: string }>>('/auth/contact-change/request', { method: 'POST', body: JSON.stringify({ type, value, currentPassword }) }); }
export async function verifyContactChange(type: 'email' | 'phone', otp: string) { return request<ApiResponse<User>>('/auth/contact-change/verify', { method: 'POST', body: JSON.stringify({ type, otp }) }); }

export async function getProperties(filters: PropertyFilters = {}): Promise<PaginatedResponse<Property>> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value !== undefined && value !== '' && value !== 'all' && params.set(key, String(value)));
  return request(`/public/properties?${params}`);
}
export async function getPropertyById(id: string): Promise<ApiResponse<Property | null>> { return request(`/public/properties/${id}`); }
export async function searchPublicMarketplace(query: string, options: { types?: string[]; limit?: number } = {}) { const qs = new URLSearchParams({ q: query, limit: String(options.limit || 8) }); if (options.types?.length) qs.set('types', options.types.join(',')); return request<ApiResponse<PublicSearchPayload>>(`/public/search?${qs}`); }
export async function getWishlist() { return request<ApiResponse<WishlistItem[]>>('/wishlist'); }
export async function addWishlistItem(listingId: string, listingKind: WishlistListingKind = 'property') { return request<ApiResponse<WishlistItem>>('/wishlist', { method: 'POST', body: JSON.stringify({ listingId, listingKind }) }); }
export async function removeWishlistItem(listingId: string, listingKind: WishlistListingKind = 'property') { return request<ApiResponse<{ listingId: string; listingKind: WishlistListingKind }>>(`/wishlist/${encodeURIComponent(listingId)}?listingKind=${encodeURIComponent(listingKind)}`, { method: 'DELETE' }); }
export async function syncWishlistItems(items: Array<{ listingId: string; listingKind: WishlistListingKind }>) { return request<ApiResponse<WishlistItem[]>>('/wishlist/sync', { method: 'POST', body: JSON.stringify({ items }) }); }
export async function getSubscriptionPlans() { return request<ApiResponse<Array<Record<string, any>>>>('/subscriptions/plans'); }
export async function getMySubscription() { return request<ApiResponse<Record<string, any> | null>>('/subscriptions/me'); }
export async function getMySubscriptionHistory() { return request<ApiResponse<Array<Record<string, any>>>>('/subscriptions/history'); }
export async function buyLandlordSubscription(body: { plan: string; billingCycle: 'monthly' | 'yearly'; method?: string; transactionId?: string; proofUrl?: string }) { return request<ApiResponse<Record<string, any>>>('/subscriptions/checkout', { method: 'POST', body: JSON.stringify(body) }); }
export async function renewLandlordSubscription(id: string, body: { plan?: string; billingCycle?: 'monthly' | 'yearly'; method?: string; transactionId?: string; proofUrl?: string }) { return request<ApiResponse<Record<string, any>>>(`/subscriptions/${encodeURIComponent(id)}/renew`, { method: 'POST', body: JSON.stringify(body) }); }
export async function getSubscriptionPaymentConfig() { return request<ApiResponse<Record<string, any>>>('/subscription-payments/config'); }
export async function createSubscriptionRazorpayOrder(paymentId: string) { return request<ApiResponse<Record<string, any>>>('/subscription-payments/razorpay/order', { method: 'POST', body: JSON.stringify({ paymentId }) }); }
export async function verifySubscriptionRazorpayPayment(body: { orderId: string; paymentId: string; signature: string }) { return request<ApiResponse<Record<string, any>>>('/subscription-payments/razorpay/verify', { method: 'POST', body: JSON.stringify(body) }); }
export async function cancelSubscriptionRazorpayPayment(body: { paymentId: string; orderId?: string }) { return request<ApiResponse<Record<string, any>>>('/subscription-payments/razorpay/cancel', { method: 'POST', body: JSON.stringify(body) }); }
export async function getPendingSubscriptionPayments(status = 'pending') { return request<ApiResponse<Record<string, any>[]>>(`/subscription-payments/admin?status=${encodeURIComponent(status)}`); }
export async function getRazorpaySettings() { return request<ApiResponse<Record<string, any>>>('/integrations/razorpay'); }
export async function updateRazorpaySettings(body: { keyId: string; secret?: string; webhookSecret?: string; upiId: string; upiName: string; upiQrUrl?: string }) { return request<ApiResponse<Record<string, any>>>('/integrations/razorpay', { method: 'PATCH', body: JSON.stringify(body) }); }
export async function approveSubscriptionPayment(id: string) { return request<ApiResponse<Record<string, any>>>(`/subscription-payments/admin/${id}/approve`, { method: 'POST' }); }
export async function approveTenantSubscription(id: string) { return request<ApiResponse<Record<string, any>>>(`/subscription-payments/admin/subscription/${id}/approve`, { method: 'POST' }); }
export async function rejectTenantSubscription(id: string, reason: string) { return request<ApiResponse<Record<string, any>>>(`/subscription-payments/admin/subscription/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }); }
export async function rejectSubscriptionPayment(id: string, reason: string) { return request<ApiResponse<Record<string, any>>>(`/subscription-payments/admin/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }); }
export async function fetchSubscriptionPaymentProof(id: string, download = false) {
  return fetchAuthenticatedBlob(`/subscription-payments/admin/${encodeURIComponent(id)}/proof?download=${download}`, 'Could not open payment screenshot');
}
export async function cancelLandlordSubscription(id: string) { return request<ApiResponse<Record<string, any>>>(`/subscriptions/${id}/cancel`, { method: 'POST' }); }


export async function getSurveyorPlans() { return request<ApiResponse<Array<Record<string, any>>>>('/surveyor-subscriptions/plans'); }
export async function getMySurveyorSubscription() { return request<ApiResponse<Record<string, any>>>('/surveyor-subscriptions/me'); }
export async function buySurveyorSubscription(body: { plan: string; billingCycle: 'monthly' | 'yearly'; method?: string; autoRenew?: boolean; transactionId?: string; proofUrl?: string }) { return request<ApiResponse<Record<string, any>>>('/surveyor-subscriptions/checkout', { method: 'POST', body: JSON.stringify(body) }); }
export async function changeSurveyorPlan(plan: string) { return request<ApiResponse<Record<string, any>>>('/surveyor-subscriptions/change-plan', { method: 'POST', body: JSON.stringify({ plan }) }); }
export async function renewSurveyorSubscription(body: { transactionId?: string; autoRenew?: boolean } = {}) { return request<ApiResponse<Record<string, any>>>('/surveyor-subscriptions/renew', { method: 'POST', body: JSON.stringify(body) }); }
export async function cancelSurveyorSubscription(id: string, immediate = false) { return request<ApiResponse<Record<string, any>>>(`/surveyor-subscriptions/${id}/cancel`, { method: 'POST', body: JSON.stringify({ immediate }) }); }
export async function switchAccountMode(mode: 'regular' | 'landlord' | 'surveyor') { return request<ApiResponse<User>>('/surveyor-subscriptions/mode', { method: 'POST', body: JSON.stringify({ mode }) }); }
export async function getSurveyorVerification() { return request<ApiResponse<Record<string, any> | null>>('/surveyor-subscriptions/verification'); }
export async function saveSurveyorVerification(body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>('/surveyor-subscriptions/verification', { method: 'PUT', body: JSON.stringify(body) }); }
export async function requestSurveyorVerificationOtp(mobile: string) {
  return request<ApiResponse<{ mobile: string; expiresInSeconds: number }>>('/surveyor-subscriptions/verification/mobile-otp/request', { method: 'POST', body: JSON.stringify({ mobile }) });
}
export async function verifySurveyorVerificationOtp(mobile: string, otp: string) {
  return request<ApiResponse<{ mobileVerified: boolean; verifiedAt: string }>>('/surveyor-subscriptions/verification/mobile-otp/verify', { method: 'POST', body: JSON.stringify({ mobile, otp }) });
}
export async function uploadSurveyorVerificationDocument(file: File, kind: 'identity_front' | 'identity_back' | 'bank_passbook') {
  const form = new FormData();
  form.append('file', file);
  return request<ApiResponse<Record<string, any>>>('/uploads/surveyor-verification-document', {
    method: 'POST',
    headers: { 'X-SecureAsset-Verification-Document': kind },
    body: form,
  });
}
export async function uploadSurveyorVerificationAsset(file: File) {
  const form = new FormData();
  form.append('file', file);
  return request<ApiResponse<{ url: string; filename: string; mimeType: string; size: number }>>('/surveyor-subscriptions/verification/assets', { method: 'POST', body: form });
}
export async function submitSurveyorVerification() { return request<ApiResponse<Record<string, any>>>('/surveyor-subscriptions/verification/submit', { method: 'POST' }); }
export async function uploadSurveyorProfileAsset(file: File, kind: 'profile_photo' | 'agency_logo') {
  const form = new FormData();
  form.append('file', file);
  return request<ApiResponse<{ url: string; filename: string; mimeType: string; size: number; kind: string }>>('/surveyor-subscriptions/profile/assets', {
    method: 'POST',
    headers: { 'X-SecureAsset-Profile-Asset': kind },
    body: form,
  });
}
export async function saveSurveyorProfile(body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>('/surveyor-subscriptions/profile', { method: 'PUT', body: JSON.stringify(body) }); }
export async function setSurveyorProfileVisibility(visibility: 'private' | 'public') { return request<ApiResponse<Record<string, any>>>('/surveyor-subscriptions/profile/visibility', { method: 'POST', body: JSON.stringify({ visibility }) }); }
export async function createSurveyorPrivateLink(accessCode?: string) { return request<ApiResponse<{ token: string; url: string }>>('/surveyor-subscriptions/profile/share-link', { method: 'POST', body: JSON.stringify({ accessCode }) }); }
export async function revokeSurveyorPrivateLink() { return request<ApiResponse<Record<string, any>>>('/surveyor-subscriptions/profile/share-link', { method: 'DELETE' }); }
export async function getSurveyorDashboard() { return request<ApiResponse<Record<string, any>>>('/surveyor-subscriptions/dashboard'); }
// Hiring is a landlord-capability action for normal tenant accounts. Keep the
// legacy function name for existing screens, but route it through the
// entitlement-aware workflow endpoint so tenants do not need a role switch.
export async function acceptSurveyQuotation(id: string) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/quotations/${encodeURIComponent(id)}/hire`, { method: 'POST' }); }
function surveyWorkflowQuery(params: Record<string, string | number | boolean | undefined> = {}) {
  const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => value !== undefined && value !== '' && query.set(key, String(value))); return query;
}
export async function getSurveyJobMarketplace(params: Record<string, string | number | boolean | undefined> = {}) {
  const query = surveyWorkflowQuery(params); return request<PaginatedResponse<Record<string, any>>>(`/survey-workflow/marketplace${query.size ? `?${query}` : ''}`);
}
export async function getLandlordSurveyJobs(params: Record<string, string | number | boolean | undefined> = {}) {
  const query = surveyWorkflowQuery(params); return request<PaginatedResponse<Record<string, any>>>(`/survey-workflow/jobs${query.size ? `?${query}` : ''}`);
}
export async function getSurveyJobBids(jobId: string) { return request<ApiResponse<{ job: Record<string, any>; bids: Record<string, any>[] }>>(`/survey-workflow/jobs/${encodeURIComponent(jobId)}/bids`); }
export async function hireSurveyorFromQuotation(quotationId: string) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/quotations/${encodeURIComponent(quotationId)}/hire`, { method: 'POST' }); }
export async function getSurveyorProposals(params: Record<string, string | number | boolean | undefined> = {}) {
  const query = surveyWorkflowQuery(params); return request<PaginatedResponse<Record<string, any>>>(`/survey-workflow/proposals${query.size ? `?${query}` : ''}`);
}
export async function getSurveyWorkflowProjects(params: Record<string, string | number | boolean | undefined> = {}) {
  const query = surveyWorkflowQuery(params); return request<PaginatedResponse<Record<string, any>>>(`/survey-workflow/projects${query.size ? `?${query}` : ''}`);
}
export async function getMySurveyorQuoteRequests(params: Record<string, string | number | boolean | undefined> = {}) {
  const query = surveyWorkflowQuery(params);
  return request<PaginatedResponse<Record<string, any>>>(`/survey-workflow/requests/mine${query.size ? `?${query}` : ''}`);
}
export async function getIncomingSurveyorQuoteRequests(params: Record<string, string | number | boolean | undefined> = {}) {
  const query = surveyWorkflowQuery(params);
  return request<PaginatedResponse<Record<string, any>>>(`/survey-workflow/requests/incoming${query.size ? `?${query}` : ''}`);
}
export async function requestSurveyorQuote(body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>('/survey-workflow/requests', { method: 'POST', body: JSON.stringify(body) }); }
export async function respondSurveyorQuoteRequest(jobId: string, body: { decision: 'accept' | 'reject'; reason?: string }) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/requests/${encodeURIComponent(jobId)}/respond`, { method: 'POST', body: JSON.stringify(body) }); }
export async function getSurveyWorkflowProject(projectId: string) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}`); }
export async function checkInSurveyWorkflowProject(projectId: string, gps: { latitude?: number; longitude?: number; accuracy?: number } = {}) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/check-in`, { method: 'POST', body: JSON.stringify(gps) }); }
export async function checkOutSurveyWorkflowProject(projectId: string, gps: { latitude: number; longitude: number; accuracy?: number }) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/check-out`, { method: 'POST', body: JSON.stringify(gps) }); }
export async function saveSurveyWorkflowFieldwork(projectId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/fieldwork`, { method: 'POST', body: JSON.stringify(body) }); }
export async function submitSurveyWorkflowFieldwork(projectId: string) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/fieldwork/submit`, { method: 'POST' }); }
export async function reviewSurveyWorkflowFieldwork(projectId: string, body: { checklist: { measurementsReviewed: boolean; evidenceReviewed: boolean; scopeReviewed: boolean }; comment?: string }) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/fieldwork/review`, { method: 'POST', body: JSON.stringify(body) }); }
export async function attachSurveyWorkflowEvidence(projectId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/evidence`, { method: 'POST', body: JSON.stringify(body) }); }
export async function removeSurveyWorkflowEvidence(projectId: string, evidenceId: string) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/evidence/${encodeURIComponent(evidenceId)}`, { method: 'DELETE' }); }
export async function acceptSurveyWorkflowPayment(projectId: string, paymentId: string, body: { receiptConfirmed?: boolean; confirmationNote?: string } = {}) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/payments/${encodeURIComponent(paymentId)}/accept`, { method: 'POST', body: JSON.stringify(body) }); }
export async function submitSurveyWorkflowFinalPayment(projectId: string, paymentId: string, body: { transactionId: string; proofFileId: string; method?: 'upi' | 'bank_transfer' | 'offline'; payerDeclaration: boolean }) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/payments/${encodeURIComponent(paymentId)}/submit`, { method: 'POST', body: JSON.stringify(body) }); }
export async function submitSurveyWorkflowMilestonePayment(projectId: string, milestoneId: string, body: { transactionId: string; proofFileId: string; method?: 'upi' | 'bank_transfer' | 'offline'; payerDeclaration: boolean }) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}/payment`, { method: 'POST', body: JSON.stringify(body) }); }
export async function rejectSurveyWorkflowFinalPayment(projectId: string, paymentId: string, reason: string) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/payments/${encodeURIComponent(paymentId)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }); }
export async function attachSurveyWorkflowReportFile(projectId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/report/file`, { method: 'POST', body: JSON.stringify(body) }); }
export async function submitSurveyWorkflowReport(projectId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/report/submit`, { method: 'POST', body: JSON.stringify(body) }); }
export async function requestSurveyWorkflowRevision(projectId: string, reason: string) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/report/revision`, { method: 'POST', body: JSON.stringify({ reason }) }); }
export async function approveSurveyWorkflowReport(projectId: string) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/report/approve`, { method: 'POST' }); }
export async function fetchSurveyWorkflowEvidence(projectId: string, fileId: string, download = false) {
  return fetchAuthenticatedBlob(`/survey-workflow/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/content?download=${download}`, 'Could not open survey evidence');
}
export async function fetchSurveyWorkflowPaymentProof(projectId: string, paymentId: string, download = false) {
  return fetchAuthenticatedBlob(`/survey-workflow/projects/${encodeURIComponent(projectId)}/payments/${encodeURIComponent(paymentId)}/proof/content?download=${download}`, 'Could not open final payment screenshot');
}
export async function downloadSurveyWorkflowEvidence(projectId: string, fileId: string, name: string) {
  const blob = await fetchSurveyWorkflowEvidence(projectId, fileId, true); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name || 'survey-evidence'; anchor.click(); URL.revokeObjectURL(url);
}
export async function fetchSurveyWorkflowReportFile(projectId: string, download = false) {
  return fetchAuthenticatedBlob(`/survey-workflow/projects/${encodeURIComponent(projectId)}/report/file/content?download=${download}`, 'Could not open the uploaded survey report');
}
export async function downloadSurveyWorkflowReportFile(projectId: string, name = 'survey-report') {
  const blob = await fetchSurveyWorkflowReportFile(projectId, true); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name || 'survey-report'; anchor.click(); URL.revokeObjectURL(url);
}
export async function createSurveyMilestone(projectId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/milestones`, { method: 'POST', body: JSON.stringify(body) }); }
export async function updateSurveyMilestone(projectId: string, milestoneId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`, { method: 'PATCH', body: JSON.stringify(body) }); }
export async function acceptSurveyMilestone(projectId: string, milestoneId: string) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}/accept`, { method: 'POST' }); }
export async function submitSurveyMilestone(projectId: string, milestoneId: string) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}/submit`, { method: 'POST' }); }
export async function approveSurveyMilestone(projectId: string, milestoneId: string) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}/approve`, { method: 'POST' }); }
export async function rejectSurveyMilestone(projectId: string, milestoneId: string, reason: string) { return request<ApiResponse<Record<string, any>>>(`/survey-workflow/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }); }
export async function finalizeSurveyReport(id: string, digitalSignature?: string) { return request<ApiResponse<Record<string, any>>>(`/surveyor-subscriptions/reports/${id}/finalize`, { method: 'POST', body: JSON.stringify({ digitalSignature }) }); }
export async function syncSurveyFieldData(items: Record<string, any>[]) { return request<ApiResponse<Record<string, any>[]>>('/surveyor-subscriptions/field-data/sync', { method: 'POST', body: JSON.stringify({ items }) }); }
export async function calculateSurveyFieldData(id: string, type: string, input: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/surveyor-subscriptions/field-data/${id}/calculate`, { method: 'POST', body: JSON.stringify({ type, input }) }); }
export async function approveSurveyCalculation(id: string, calculationId: string) { return request<ApiResponse<Record<string, any>>>(`/surveyor-subscriptions/field-data/${id}/calculations/${calculationId}/approve`, { method: 'POST' }); }
export function surveyReportExportUrl(id: string, format: 'pdf' | 'xlsx' | 'csv' | 'json' | 'html' | 'svg') { return `${API_BASE}/surveyor-subscriptions/reports/${id}/export?format=${format}`; }
export async function downloadSurveyReport(id: string, format: 'pdf' | 'xlsx' | 'csv' | 'json' | 'html' | 'svg') {
  const token = getToken();
  const blob = await fetchBinary(surveyReportExportUrl(id, format), { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' }, 'Could not export survey report', UPLOAD_REQUEST_TIMEOUT_MS); const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `survey-report-${id}.${format}`; a.click(); URL.revokeObjectURL(url);
}
function livePublicQuery(params: Record<string, string | number | boolean | undefined> = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && qs.set(k, String(v)));
  // The directory is subscription/profile data and must reflect the current
  // database immediately after an admin publishes or changes a profile.
  qs.set('_live', String(Date.now()));
  return qs;
}
export async function getPublicSurveyors(params: Record<string, string | number | boolean | undefined> = {}) { return request<PaginatedResponse<Record<string, any>>>(`/public/surveyors?${livePublicQuery(params)}`, { cache: 'no-store' }); }
export async function getPublicSurveyor(id: string) { return request<ApiResponse<Record<string, any>>>(`/public/surveyors/${encodeURIComponent(id)}?_live=${Date.now()}`, { cache: 'no-store' }); }
export async function getPublicSurveyServices(params: Record<string, string | number | boolean | undefined> = {}) { return request<PaginatedResponse<Record<string, any>>>(`/public/survey-services?${livePublicQuery(params)}`, { cache: 'no-store' }); }
export async function getPublicSurveyJobs(params: Record<string, string | number | boolean | undefined> = {}) { const qs = new URLSearchParams(); Object.entries(params).forEach(([k,v]) => v !== undefined && v !== '' && qs.set(k, String(v))); return request<PaginatedResponse<Record<string, any>>>(`/public/survey-jobs?${qs}`); }

export async function getResource<T = Record<string, any>>(resource: string, params: Record<string, string | number | undefined> = {}): Promise<ResourceList<T>> {
  const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && qs.set(k, String(v)));
  const live = resource === 'surveyor-profiles';
  if (live) qs.set('_live', String(Date.now()));
  return request(`/resources/${resource}?${qs}`, live ? { cache: 'no-store' } : undefined);
}
export async function getMyListings<T = Record<string, any>>(params: Record<string, string | number | undefined> = {}): Promise<ResourceList<T>> {
  const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && qs.set(k, String(v)));
  return request(`/resources/properties/mine?${qs}`);
}
export async function getMyTenantApplications<T = Record<string, any>>(params: Record<string, string | number | undefined> = {}): Promise<ResourceList<T>> {
  const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && qs.set(k, String(v)));
  return request(`/resources/applications/mine?${qs}`);
}
export async function getResourceById<T = Record<string, any>>(resource: string, id: string): Promise<ApiResponse<T>> {
  const live = resource === 'surveyor-profiles';
  const suffix = live ? `?_live=${Date.now()}` : '';
  return request(`/resources/${resource}/${encodeURIComponent(id)}${suffix}`, live ? { cache: 'no-store' } : undefined);
}
export async function createResource<T = Record<string, any>>(resource: string, body: Record<string, any>): Promise<ApiResponse<T>> { return request(`/resources/${resource}`, { method: 'POST', body: JSON.stringify(body) }); }
export async function updateResource<T = Record<string, any>>(resource: string, id: string, body: Record<string, any>): Promise<ApiResponse<T>> { return request(`/resources/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); }
export async function deleteResource(resource: string, id: string): Promise<ApiResponse<null>> { return request(`/resources/${resource}/${id}`, { method: 'DELETE' }); }
export async function changeResourceStatus<T = Record<string, any>>(resource: string, id: string, status: string, comment?: string): Promise<ApiResponse<T>> { return request(`/resources/${resource}/${id}/status`, { method: 'POST', body: JSON.stringify({ status, comment }) }); }
export async function getPropertyVisitNavigation(visitId: string) { return request<ApiResponse<Record<string, any>>>(`/property-management/property-visits/${encodeURIComponent(visitId)}/navigation`); }
export type AgreementType = 'rent' | 'lease' | 'sale';
export async function getAgreementTemplates(agreementType?: AgreementType) {
  const query = agreementType ? `?agreementType=${encodeURIComponent(agreementType)}` : '';
  return request<ApiResponse<Record<string, any>[]>>(`/agreements/templates${query}`);
}
export async function createAgreementTemplate(body: Record<string, any>) {
  return request<ApiResponse<Record<string, any>>>('/agreements/templates', { method: 'POST', body: JSON.stringify(body) });
}
export async function updateAgreementTemplate(id: string, body: Record<string, any>) {
  return request<ApiResponse<Record<string, any>>>(`/agreements/templates/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export async function deleteAgreementTemplate(id: string) {
  return request<ApiResponse<null>>(`/agreements/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
export async function getAgreementRequests(params: { application?: string; status?: string } = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => value && query.set(key, value));
  return request<ApiResponse<Record<string, any>[]>>(`/agreements/requests${query.size ? `?${query}` : ''}`);
}
export async function prepareAgreementRequest(body: { application: string; template: string; durationMonths?: number; startDate?: string; renewalOf?: string }) {
  return request<ApiResponse<Record<string, any>>>('/agreements/requests', { method: 'POST', body: JSON.stringify(body) });
}
export async function uploadFirstPartyAgreementMark(id: string, file: File, markType: 'signature' | 'stamp_seal') {
  const form = new FormData();
  form.append('file', file);
  form.append('markType', markType);
  return request<ApiResponse<Record<string, any>>>(`/agreements/requests/${encodeURIComponent(id)}/first-party-mark`, { method: 'POST', body: form });
}
export async function sendInternalAgreementRequest(id: string) {
  return request<ApiResponse<Record<string, any>>>(`/agreements/requests/${encodeURIComponent(id)}/send`, { method: 'POST' });
}
export async function uploadSecondPartyAgreementSignature(id: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  form.append('accepted', 'true');
  return request<ApiResponse<Record<string, any>>>(`/agreements/requests/${encodeURIComponent(id)}/second-party-signature`, { method: 'POST', body: form });
}
export async function submitAgreementSecurityDeposit(id: string, transactionId: string, file: File) {
  const form = new FormData();
  form.append('transactionId', transactionId);
  form.append('file', file);
  return request<ApiResponse<Record<string, any>>>(`/agreements/requests/${encodeURIComponent(id)}/security-deposit`, { method: 'POST', body: form });
}
export async function rejectAgreementSecurityDeposit(id: string, reason: string) {
  return request<ApiResponse<Record<string, any>>>(`/agreements/requests/${encodeURIComponent(id)}/security-deposit/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
}
export async function approveAgreementRequest(id: string, note = '') {
  return request<ApiResponse<Record<string, any>>>(`/agreements/requests/${encodeURIComponent(id)}/approve`, { method: 'POST', body: JSON.stringify({ note }) });
}
export async function renewAgreementCycle(id: string) {
  return request<ApiResponse<Record<string, any>>>(`/agreements/requests/${encodeURIComponent(id)}/renew`, { method: 'POST' });
}
export async function requestAgreementCancellation(id: string, reason = '') {
  return request<ApiResponse<Record<string, any>>>(`/agreements/requests/${encodeURIComponent(id)}/cancellation-request`, { method: 'POST', body: JSON.stringify({ reason }) });
}
export async function rejectAgreementCancellation(id: string) {
  return request<ApiResponse<Record<string, any>>>(`/agreements/requests/${encodeURIComponent(id)}/cancellation-request/reject`, { method: 'POST' });
}
export async function cancelAgreementCycle(id: string) {
  return request<ApiResponse<Record<string, any>>>(`/agreements/requests/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}
export async function closeAgreementCycle(id: string) {
  return request<ApiResponse<Record<string, any>>>(`/agreements/requests/${encodeURIComponent(id)}/close`, { method: 'POST' });
}
async function fetchAgreementBlob(path: string, message: string, retry = true): Promise<Blob> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, { headers: driveRequestHeaders(), credentials: 'include', cache: 'no-store' }, DEFAULT_REQUEST_TIMEOUT_MS);
  if (res.status === 401 && retry) {
    if (await refreshSession()) return fetchAgreementBlob(path, message, false);
    clearSession();
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.message || message);
  }
  const blob = await res.blob();
  if (!blob.size) throw new Error(`${message} (empty response)`);
  return blob;
}
export async function fetchAgreementPreviewBlob(id: string) {
  return fetchAgreementBlob(`/agreements/requests/${encodeURIComponent(id)}/preview`, 'Could not open the stamp-paper agreement');
}
export async function fetchAgreementPartyMarkBlob(id: string, party: 'first-party' | 'second-party') {
  return fetchAgreementBlob(`/agreements/requests/${encodeURIComponent(id)}/marks/${party}`, 'Could not load the signature or stamp/seal');
}
export async function fetchAgreementSecurityDepositProofBlob(id: string) {
  return fetchAgreementBlob(`/agreements/requests/${encodeURIComponent(id)}/security-deposit-proof`, 'Could not load the security deposit payment proof');
}
export type RentalPaymentSubmission = {
  method: 'upi' | 'card' | 'bank_transfer' | 'cash' | 'cheque' | 'gateway' | 'offline';
  transactionId?: string;
  proofUrl?: string;
  notes?: string;
};
export async function submitRentalInvoicePayment(invoiceId: string, body: RentalPaymentSubmission) {
  return request<ApiResponse<Record<string, any>>>(`/rentals/invoices/${encodeURIComponent(invoiceId)}/payment`, { method: 'POST', body: JSON.stringify(body) });
}
export async function acceptRentalPayment(paymentId: string) {
  return request<ApiResponse<Record<string, any>>>(`/rentals/payments/${encodeURIComponent(paymentId)}/accept`, { method: 'POST' });
}
export async function rejectRentalPayment(paymentId: string, reason: string) {
  return request<ApiResponse<Record<string, any>>>(`/rentals/payments/${encodeURIComponent(paymentId)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
}
export async function getDashboardOverview() { return request<ApiResponse<DashboardOverview>>('/dashboard/overview'); }
export async function getMyProperties() {
  return request<ApiResponse<{ rented: Record<string, any>[]; leased: Record<string, any>[]; purchased: Record<string, any>[]; summary: Record<string, number> }>>('/dashboard/my-properties');
}
export async function getMyPropertyRentCycle(tenancyId: string) {
  return request<ApiResponse<Record<string, any>>>(`/dashboard/my-properties/${encodeURIComponent(tenancyId)}/rent-cycle`);
}
export async function uploadDocument(file: File, metadata: Record<string, string> = {}) {
  const form = new FormData(); form.append('file', file); Object.entries(metadata).forEach(([key, value]) => form.append(key, value));
  return request<ApiResponse<Document>>('/uploads/document', { method: 'POST', body: form });
}

export async function uploadDocumentWithProgress(
  file: File,
  metadata: Record<string, string> = {},
  onProgress?: (progress: number) => void,
) {
  const run = (retry = true): Promise<ApiResponse<Document>> => new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    Object.entries(metadata).forEach(([key, value]) => form.append(key, value));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/uploads/document`);
    xhr.withCredentials = true;
    xhr.timeout = UPLOAD_REQUEST_TIMEOUT_MS;

    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    const csrf = readCookie('sa_csrf');
    if (csrf) xhr.setRequestHeader('X-SecureAsset-CSRF', csrf);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))));
    };

    xhr.onerror = () => reject(new Error('Could not upload the document. Check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('Document upload timed out. Please try again.'));
    xhr.onabort = () => reject(new Error('Document upload was cancelled.'));
    xhr.onload = async () => {
      let payload: any = {};
      try { payload = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch { payload = {}; }

      if (xhr.status === 401 && retry) {
        if (await refreshSession()) {
          run(false).then(resolve).catch(reject);
          return;
        }
        clearSession();
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(payload?.message || `Document upload failed (${xhr.status})`));
        return;
      }
      onProgress?.(100);
      resolve(payload as ApiResponse<Document>);
    };

    onProgress?.(0);
    xhr.send(form);
  });

  return run(true);
}
export async function uploadRentalPaymentProof(file: File, invoiceId: string) {
  const form = new FormData();
  form.append('file', file);
  return request<ApiResponse<Document>>('/uploads/rent-payment-proof', {
    method: 'POST',
    body: form,
    headers: { 'X-SecureAsset-Rental-Invoice': invoiceId },
  });
}

export async function uploadSubscriptionPaymentProof(file: File, metadata: Record<string, string> = {}) {
  const form = new FormData(); form.append('file', file); Object.entries(metadata).forEach(([key, value]) => form.append(key, value));
  return request<ApiResponse<Document>>('/uploads/subscription-payment-proof', {
    method: 'POST', body: form, headers: { 'X-SecureAsset-Upload-Purpose': 'subscription_payment_proof' },
  });
}
export async function checkIn(gps: { lat: number; lng: number; accuracy?: number }) { return request('/attendance/check-in', { method: 'POST', body: JSON.stringify({ gps }) }); }
export async function checkOut(gps: { lat: number; lng: number; accuracy?: number }) { return request('/attendance/check-out', { method: 'POST', body: JSON.stringify({ gps }) }); }
type NotificationCountResponse = ApiResponse<{ count: number }>;
const notificationCountRequests = new Map<string, Promise<NotificationCountResponse>>();
const notificationCountCache = new Map<string, { response: NotificationCountResponse; expiresAt: number }>();
const NOTIFICATION_COUNT_CACHE_MS = 5_000;
function notificationCacheKey() { return getToken() || `user:${currentUser?._id || 'anonymous'}`; }
export async function getUnreadNotificationCount(force = false) {
  const key = notificationCacheKey();
  const cached = notificationCountCache.get(key);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.response;
  const existing = notificationCountRequests.get(key);
  if (existing) return existing;
  const pending = request<NotificationCountResponse>('/notifications/unread-count')
    .then((response) => { notificationCountCache.set(key, { response, expiresAt: Date.now() + NOTIFICATION_COUNT_CACHE_MS }); return response; })
    .finally(() => { if (notificationCountRequests.get(key) === pending) notificationCountRequests.delete(key); });
  notificationCountRequests.set(key, pending);
  return pending;
}
export async function markAllNotificationsRead() {
  const response = await request('/notifications/mark-all-read', { method: 'POST' });
  notificationCountCache.delete(notificationCacheKey());
  return response;
}
export async function getReportCatalog() { return request<ApiResponse<Array<Record<string, any>>>>('/reports/catalog'); }
export function reportUrl(resource: string, format: 'csv' | 'xlsx' | 'pdf' = 'csv') { return `${API_BASE}/reports/${resource}.${format}`; }


export async function globalSearch(query: string, limit = 5) { const qs = new URLSearchParams({ q: query, limit: String(limit) }); return request<ApiResponse<Array<{ resource: string; count: number; data: Record<string, any>[] }>>>(`/search?${qs}`); }
// Compatibility wrappers for the original Figma prototype.
export async function getTenants(): Promise<ApiResponse<Tenant[]>> { const r = await getResource<Tenant>('tenants', { limit: 100 }); return { success: true, data: r.data }; }
export async function getPayments(): Promise<ApiResponse<Payment[]>> { const r = await getResource<Payment>('payments', { limit: 100 }); return { success: true, data: r.data }; }
export async function getDocuments(): Promise<ApiResponse<Document[]>> { const r = await getResource<Document>('documents', { limit: 100 }); return { success: true, data: r.data }; }
export async function getUsers(): Promise<ApiResponse<User[]>> { const r = await getResource<User>('users', { limit: 100 }); return { success: true, data: r.data }; }
export async function getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
  const r = await getDashboardOverview(); const k = r.data.kpis;
  return { success: true, data: { totalProperties: k.totalProperties, activeTenantsCount: k.totalTenants, monthlyRevenue: k.monthlyRentCollection, kycPending: 0, occupancyRate: r.data.occupancyRate, overduePayments: k.outstandingDues, totalDocuments: 0, revenueGrowth: 0 } };
}
export async function createProperty(data: Partial<Property>) { return createResource<Property>('properties', data as Record<string, any>); }
export async function updateProperty(id: string, data: Partial<Property>) { return updateResource<Property>('properties', id, data as Record<string, any>); }
export async function deleteProperty(id: string) { return deleteResource('properties', id); }
export async function recordPayment(data: Partial<Payment>) { return createResource<Payment>('payments', data as Record<string, any>); }
export async function downloadReport(resource: string, format: 'csv' | 'xlsx' | 'pdf' = 'csv') {
  const token = getToken();
  const res = await fetchWithTimeout(`${API_BASE}/reports/${resource}.${format}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' }, UPLOAD_REQUEST_TIMEOUT_MS);
  if (!res.ok) {
    let message = 'Could not export report';
    try { message = (await res.json()).message || message; } catch { /* binary or empty response */ }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const a = document.createElement('a');
  a.href = url; a.download = match?.[1] || `${resource}-${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function reviewSurveyorVerification(id: string, body: { status: string; notes?: string; rejectionReason?: string; suspensionReason?: string }) { return request<ApiResponse<Record<string, any>>>(`/surveyor-subscriptions/verification/${id}/review`, { method: 'POST', body: JSON.stringify(body) }); }
export async function getPrivateSurveyor(id: string, token: string, code = '') { const qs = new URLSearchParams({ token }); if (code) qs.set('code', code); return request<ApiResponse<Record<string, any>>>(`/public/surveyor-private/${id}?${qs}`); }
export async function createSurveyInvoice(projectId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/surveyor-subscriptions/projects/${projectId}/invoices`, { method: 'POST', body: JSON.stringify(body) }); }
export async function paySurveyInvoice(id: string, body: { method?: string; transactionId?: string } = {}) { return request<ApiResponse<Record<string, any>>>(`/surveyor-subscriptions/invoices/${id}/pay`, { method: 'POST', body: JSON.stringify(body) }); }

// Universal Document Vault
export async function getDriveBootstrap() { return request<ApiResponse<Record<string, any>>>('/drive/bootstrap'); }
export async function getDriveItems(params: Record<string, string | number | boolean | undefined> = {}) {
  const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && qs.set(k, String(v)));
  return request<ApiResponse<{ folders: Record<string, any>[]; files: Record<string, any>[] }>>(`/drive/items?${qs}`);
}
export async function getDriveBreadcrumbs(id: string) { return request<ApiResponse<Record<string, any>[]>>(`/drive/folders/${id}/breadcrumbs`); }
export async function createDriveFolder(body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>('/drive/folders', { method: 'POST', body: JSON.stringify(body) }); }
export async function updateDriveFolder(id: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/drive/folders/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); }
export async function updateDriveFile(id: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/drive/files/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); }
export async function getDriveFile(id: string) { return request<ApiResponse<Record<string, any>>>(`/drive/files/${id}`); }
export async function createDriveLegalTemplates() { return request<ApiResponse<Record<string, any>>>('/drive/legal-templates', { method: 'POST' }); }
export async function driveItemAction(type: 'file' | 'folder', id: string, action: 'trash' | 'restore') { return request<ApiResponse<Record<string, any>>>(`/drive/${type}/${id}/${action}`, { method: 'POST' }); }
export async function permanentlyDeleteDriveItem(type: 'file' | 'folder', id: string) { return request<ApiResponse<null>>(`/drive/${type}/${id}/permanent`, { method: 'DELETE' }); }
export async function bulkDriveAction(body: Record<string, any>) { return request<ApiResponse<Record<string, any>[]>>('/drive/bulk', { method: 'POST', body: JSON.stringify(body) }); }
export async function shareDriveItem(type: 'file' | 'folder', id: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/drive/${type}/${id}/shares`, { method: 'POST', body: JSON.stringify(body) }); }
export async function getDriveShares(type: 'file' | 'folder', id: string) { return request<ApiResponse<Record<string, any>[]>>(`/drive/${type}/${id}/shares`); }
export async function revokeDriveShare(shareId: string) { return request<ApiResponse<null>>(`/drive/shares/${shareId}`, { method: 'DELETE' }); }
export async function createDrivePublicLink(type: 'file' | 'folder', id: string, body: Record<string, any>) { return request<ApiResponse<{ token: string; slug?: string; url: string }>>(`/drive/${type}/${id}/public-link`, { method: 'POST', body: JSON.stringify(body) }); }
export async function revokeDrivePublicLink(type: 'file' | 'folder', id: string) { return request<ApiResponse<null>>(`/drive/${type}/${id}/public-link`, { method: 'DELETE' }); }
export async function getDriveSharedWithMe() { return request<ApiResponse<Record<string, any>>>('/drive/shared-with-me'); }
export async function searchDrive(params: Record<string, string | undefined>) { const qs = new URLSearchParams(); Object.entries(params).forEach(([k,v]) => v && qs.set(k,v)); return request<ApiResponse<Record<string, any>>>(`/drive/search?${qs}`); }
export async function getDriveAnalytics() { return request<ApiResponse<Record<string, any>>>('/drive/analytics'); }
export async function getDriveActivity(itemId?: string) { return request<ApiResponse<Record<string, any>[]>>(`/drive/activity${itemId ? `?itemId=${encodeURIComponent(itemId)}` : ''}`); }
export async function setDriveFileApproval(id: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/drive/files/${id}/approval`, { method: 'POST', body: JSON.stringify(body) }); }
export async function addDriveComment(id: string, body: string) { return request<ApiResponse<Record<string, any>>>(`/drive/files/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }); }
export async function getDriveComments(id: string) { return request<ApiResponse<Record<string, any>[]>>(`/drive/files/${id}/comments`); }
export async function restoreDriveVersion(id: string, version: number) { return request<ApiResponse<Record<string, any>>>(`/drive/files/${id}/versions/${version}/restore`, { method: 'POST' }); }
export function driveFolderDownloadUrl(id: string) { return `${API_BASE}/drive/folders/${id}/download`; }
function driveRequestHeaders() {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const csrf = readCookie('sa_csrf');
  if (csrf) headers.set('X-SecureAsset-CSRF', csrf);
  if (deviceUnlockToken) headers.set('X-SecureAsset-Device-Unlock', deviceUnlockToken);
  if (vaultPinUnlockToken) headers.set('X-SecureAsset-Vault-Pin-Unlock', vaultPinUnlockToken);
  return headers;
}
function notifyVaultUnlockRequired() {
  deviceUnlockToken = null;
  vaultPinUnlockToken = null;
  window.dispatchEvent(new CustomEvent('secureasset:device-unlock-required'));
}
async function fetchAuthenticatedBlob(path: string, message: string, retry = true): Promise<Blob> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, { headers: driveRequestHeaders(), credentials: 'include', cache: 'no-store' }, UPLOAD_REQUEST_TIMEOUT_MS);
  if (res.status === 401 && retry) {
    if (await refreshSession()) return fetchAuthenticatedBlob(path, message, false);
    clearSession();
  }
  if (res.status === 423) notifyVaultUnlockRequired();
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    const payload = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {};
    throw new Error(payload?.message || message);
  }
  if (contentType.includes('text/html')) {
    throw new Error('The property image endpoint returned the application page instead of image bytes.');
  }
  const blob = await res.blob();
  if (!blob.size) throw new Error(`${message} (empty response)`);
  return blob;
}
async function normalizeImageBlob(blob: Blob): Promise<Blob> {
  if (String(blob.type || '').toLowerCase().startsWith('image/')) return blob;
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  let mimeType = '';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mimeType = 'image/jpeg';
  else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) mimeType = 'image/png';
  else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) mimeType = 'image/gif';
  else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) mimeType = 'image/webp';
  else if (bytes[0] === 0x42 && bytes[1] === 0x4d) mimeType = 'image/bmp';
  else if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) mimeType = 'image/x-icon';
  return mimeType ? new Blob([blob], { type: mimeType }) : blob;
}
export async function uploadDriveFile(file: File, metadata: Record<string, string> = {}, onProgress?: (percent: number) => void) {
  return new Promise<ApiResponse<Record<string, any>>>((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open('POST', `${API_BASE}/drive/files`); xhr.withCredentials = true; xhr.timeout = UPLOAD_REQUEST_TIMEOUT_MS;
    const headers = driveRequestHeaders(); headers.forEach((value, key) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => { try { const payload = JSON.parse(xhr.responseText); if (xhr.status === 423) notifyVaultUnlockRequired(); if (xhr.status >= 200 && xhr.status < 300) resolve(payload); else reject(new Error(payload?.message || `Upload failed (${xhr.status})`)); } catch { reject(new Error('Upload failed')); } };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Check your connection and try again.'));
    const form = new FormData(); form.append('file', file); Object.entries(metadata).forEach(([k,v]) => form.append(k,v)); xhr.send(form);
  });
}
export async function uploadDriveScannedPng(file: File, metadata: Record<string, string> = {}, onProgress?: (percent: number) => void) {
  return uploadDriveFile(file, { ...metadata, source: 'scan-securely', enhancement: metadata.enhancement || 'ai-document-premium-v1' }, onProgress);
}
export async function createDriveScannedPdf(files: File[], metadata: Record<string, string> = {}, onProgress?: (percent: number) => void) {
  return new Promise<ApiResponse<Record<string, any>>>((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open('POST', `${API_BASE}/drive/scan-to-pdf`); xhr.withCredentials = true; xhr.timeout = UPLOAD_REQUEST_TIMEOUT_MS;
    const headers = driveRequestHeaders(); headers.forEach((value, key) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => { try { const payload = JSON.parse(xhr.responseText); if (xhr.status === 423) notifyVaultUnlockRequired(); if (xhr.status >= 200 && xhr.status < 300) resolve(payload); else reject(new Error(payload?.message || `Scan failed (${xhr.status})`)); } catch { reject(new Error('Scan failed')); } };
    xhr.onerror = () => reject(new Error('Network error during scan upload'));
    xhr.ontimeout = () => reject(new Error('Scan upload timed out. Check your connection and try again.'));
    const form = new FormData(); files.forEach((file) => form.append('pages', file)); Object.entries(metadata).forEach(([key, value]) => form.append(key, value)); xhr.send(form);
  });
}

export async function uploadDriveVersion(id: string, file: File, changeDescription = '', onProgress?: (percent: number) => void) {
  return new Promise<ApiResponse<Record<string, any>>>((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open('POST', `${API_BASE}/drive/files/${id}/versions`); xhr.withCredentials = true; xhr.timeout = UPLOAD_REQUEST_TIMEOUT_MS;
    const headers = driveRequestHeaders(); headers.forEach((value, key) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => { try { const payload = JSON.parse(xhr.responseText); if (xhr.status === 423) notifyVaultUnlockRequired(); if (xhr.status >= 200 && xhr.status < 300) resolve(payload); else reject(new Error(payload?.message || 'Version upload failed')); } catch { reject(new Error('Version upload failed')); } };
    xhr.onerror = () => reject(new Error('Network error during upload')); xhr.ontimeout = () => reject(new Error('Version upload timed out. Check your connection and try again.')); const form = new FormData(); form.append('file', file); form.append('changeDescription', changeDescription); xhr.send(form);
  });
}
export async function fetchDriveFileBlob(id: string, download = false) {
  return fetchAuthenticatedBlob(`/drive/files/${encodeURIComponent(id)}/content?download=${download}`, 'Could not open file');
}
export async function downloadDriveFile(id: string, name: string) { const blob = await fetchDriveFileBlob(id, true); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
export async function downloadDriveFolder(id: string, name: string) {
  const blob = await fetchAuthenticatedBlob(`/drive/folders/${encodeURIComponent(id)}/download`, 'Could not download folder'); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${name}.zip`; a.click(); URL.revokeObjectURL(url);
}
export async function getPublicDriveItem(type: 'file' | 'folder', token: string, password = '', folderId = '', email = '') { const qs = new URLSearchParams(); if (password) qs.set('password', password); if (folderId) qs.set('folderId', folderId); if (email) qs.set('email', email); return request<ApiResponse<Record<string, any>>>(`/public-drive/${type}/${encodeURIComponent(token)}${qs.size ? `?${qs}` : ''}`); }
export function publicDriveFolderFileUrl(token: string, fileId: string, password = '', download = false, email = '') { const qs = new URLSearchParams({ download: String(download) }); if (password) qs.set('password', password); if (email) qs.set('email', email); return `${API_BASE}/public-drive/folder/${encodeURIComponent(token)}/files/${encodeURIComponent(fileId)}/content?${qs}`; }
export function publicDriveContentUrl(token: string, password = '', download = false, email = '') { const qs = new URLSearchParams({ download: String(download) }); if (password) qs.set('password', password); if (email) qs.set('email', email); return `${API_BASE}/public-drive/file/${encodeURIComponent(token)}/content?${qs}`; }
export async function getDriveAdminOverview() { return request<ApiResponse<Record<string, any>>>('/drive/admin/overview'); }
export async function getDriveAdminUsage() { return request<ResourceList<Record<string, any>>>('/drive/admin/usage'); }
export async function getDriveAdminReports(status = '') { return request<ApiResponse<Record<string, any>[]>>(`/drive/admin/reports${status ? `?status=${encodeURIComponent(status)}` : ''}`); }
export async function reviewDriveContentReport(id: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/drive/admin/reports/${id}/review`, { method: 'POST', body: JSON.stringify(body) }); }
export async function getDrivePolicy() { return request<ApiResponse<Record<string, any>>>('/drive/admin/policy'); }
export async function updateDrivePolicy(body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>('/drive/admin/policy', { method: 'PATCH', body: JSON.stringify(body) }); }

export async function getBackupRecoveryOverview() { return request<ApiResponse<Record<string, any>>>('/backup-recovery/overview'); }
export async function getSystemBackups(limit = 50) { return request<ApiResponse<Record<string, any>[]>>(`/backup-recovery/backups?limit=${Math.min(Math.max(limit, 1), 200)}`); }
export async function createSystemBackup(reason = '') { return request<ApiResponse<Record<string, any>>>('/backup-recovery/backups', { method: 'POST', body: JSON.stringify({ reason }) }); }
export async function requestSystemRestore(id: string, body: { confirmation: string; currentPassword: string; twoFactorCode: string; components: Array<'database' | 'vault' | 'source'> }) {
  return request<ApiResponse<{ backup: Record<string, any>; expiresAt: string; components: string[]; command: string }>>(`/backup-recovery/backups/${encodeURIComponent(id)}/restore-request`, { method: 'POST', body: JSON.stringify(body) });
}

export async function getSiteConfig(path = '/') {
  return request<ApiResponse<Record<string, any>>>(`/site/config?path=${encodeURIComponent(path)}`);
}
export async function submitSiteEnquiry(body: Record<string, any>) {
  return request<ApiResponse<{ _id: string }>>('/site/enquiries', { method: 'POST', body: JSON.stringify(body) });
}
export async function getPublicPropertyStructure(id: string) {
  return request<ApiResponse<Record<string, any>>>(`/site/properties/${id}/structure`);
}
export async function getLandlordOverview() {
  return request<ApiResponse<Record<string, any>>>('/property-management/landlord-overview');
}
export async function getRentalStructure(propertyId: string) { return request<ApiResponse<Record<string, any>>>(`/property-management/properties/${encodeURIComponent(propertyId)}/rental-structure`); }
export async function getPropertyFloorOverview(propertyId: string, floorId: string) { return request<ApiResponse<Record<string, any>>>(`/property-management/properties/${encodeURIComponent(propertyId)}/floors/${encodeURIComponent(floorId)}/overview`); }
export async function createPropertyFloor(propertyId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/property-management/properties/${encodeURIComponent(propertyId)}/floors`, { method: 'POST', body: JSON.stringify(body) }); }
export async function updatePropertyFloor(floorId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/property-management/floors/${encodeURIComponent(floorId)}`, { method: 'PATCH', body: JSON.stringify(body) }); }
export async function archivePropertyFloor(floorId: string) { return request<ApiResponse<Record<string, any>>>(`/property-management/floors/${encodeURIComponent(floorId)}`, { method: 'DELETE' }); }
export async function createRentalUnit(propertyId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/property-management/properties/${encodeURIComponent(propertyId)}/rental-units`, { method: 'POST', body: JSON.stringify(body) }); }
export async function updateRentalUnit(unitId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/property-management/rental-units/${encodeURIComponent(unitId)}`, { method: 'PATCH', body: JSON.stringify(body) }); }
export async function duplicateRentalUnit(unitId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/property-management/rental-units/${encodeURIComponent(unitId)}/duplicate`, { method: 'POST', body: JSON.stringify(body) }); }
export async function changeRentalUnitStatus(unitId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/property-management/rental-units/${encodeURIComponent(unitId)}/status`, { method: 'POST', body: JSON.stringify(body) }); }
export async function applyRentalUnitPricing(propertyId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/property-management/properties/${encodeURIComponent(propertyId)}/rental-units/apply-pricing`, { method: 'POST', body: JSON.stringify(body) }); }
export async function getPropertyOccupancy(propertyId: string) { return request<ApiResponse<Record<string, any>>>(`/property-management/properties/${encodeURIComponent(propertyId)}/occupancy`); }
export async function getRentalUnitTenancyDetail(unitId: string) { return request<ApiResponse<Record<string, any>>>(`/property-management/rental-units/${encodeURIComponent(unitId)}/tenancy`); }
export async function getTenancyHistoryProperties(params: Record<string, string | number>) {
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
  return request<{ success: boolean; data: Record<string, any>[]; pagination: { page: number; pages: number; total: number } }>('/property-management/tenancy-history/properties?' + query);
}
export async function getPropertyTenancyHistory(propertyId: string, params: Record<string, string | number>) {
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
  return request<ApiResponse<Record<string, any>>>('/property-management/properties/' + encodeURIComponent(propertyId) + '/tenancy-history?' + query);
}
export async function getTenancyDetails(tenancyId: string) { return request<ApiResponse<Record<string, any>>>(`/property-management/tenancies/${encodeURIComponent(tenancyId)}/details`); }
export async function sendTenancyRentReminder(tenancyId: string, invoiceId: string) { return request<ApiResponse<Record<string, any>>>(`/property-management/tenancies/${encodeURIComponent(tenancyId)}/reminders`, { method: 'POST', body: JSON.stringify({ invoiceId }) }); }
export async function recordTenancyPayment(tenancyId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/property-management/tenancies/${encodeURIComponent(tenancyId)}/payments`, { method: 'POST', body: JSON.stringify(body) }); }
export async function fetchRentalUnitImageBlob(unitId: string, fileId: string) {
  const blob = await fetchAuthenticatedBlob(`/property-management/rental-units/${encodeURIComponent(unitId)}/images/${encodeURIComponent(fileId)}/content`, 'Could not open room image');
  return normalizeImageBlob(blob);
}
export async function startRentalTenancy(unitId: string, tenancyId: string) { return request<ApiResponse<Record<string, any>>>(`/property-management/rental-units/${encodeURIComponent(unitId)}/start-tenancy`, { method: 'POST', body: JSON.stringify({ tenancyId }) }); }
export async function transitionRentalTenancy(tenancyId: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/property-management/tenancies/${encodeURIComponent(tenancyId)}/transition`, { method: 'POST', body: JSON.stringify(body) }); }
export async function getAdminRentalManagement(params: Record<string, string> = {}) { const query = new URLSearchParams(params); return request<ApiResponse<Record<string, any>[]>>(`/property-management/admin/rental-management${query.size ? `?${query}` : ''}`); }
export async function getPropertyTree(id: string) {
  return request<ApiResponse<Record<string, any>>>(`/property-management/properties/${id}/tree`);
}
// Property gallery previews are loaded as authenticated blobs so private
// landlord media works as reliably as public media. An <img> tag cannot add
// the bearer token by itself, so the page converts this response to a blob URL.
// When the property id is known, use the explicit property-scoped endpoint so
// legacy media ids can never resolve outside the property being viewed.
export async function fetchPropertyMediaBlob(id: string, propertyId = '') {
  const path = propertyId
    ? `/property-management/properties/${encodeURIComponent(propertyId)}/media/${encodeURIComponent(id)}/content`
    : `/property-management/property-media/${encodeURIComponent(id)}/content`;
  const blob = await fetchAuthenticatedBlob(path, 'Could not open property media');
  return normalizeImageBlob(blob);
}
function mediaSourceId(source: string, kind: 'drive' | 'property-media') {
  const raw = String(source || '').trim();
  const bare = raw.replace(/^\/+/, '').split(/[?#]/, 1)[0];
  if (kind === 'drive' && /^[a-f\d]{24}$/i.test(bare)) return bare;
  const match = kind === 'drive'
    ? raw.match(/\/(?:api\/v\d+\/)?(?:drive\/files|files)\/([a-f\d]{24})(?:\/content)?(?:[/?#]|$)/i)
    : raw.match(/\/(?:api\/v\d+\/)?property-media\/([a-f\d]{24})(?:\/content)?(?:[/?#]|$)/i);
  return match?.[1] || '';
}
export async function fetchPropertyImageBlob(source: string, propertyId = '') {
  const mediaId = mediaSourceId(source, 'property-media');
  if (mediaId) return fetchPropertyMediaBlob(mediaId, propertyId);
  const driveFileId = mediaSourceId(source, 'drive');
  if (!driveFileId) throw new Error('Unsupported property image source');
  const path = propertyId
    ? `/property-management/properties/${encodeURIComponent(propertyId)}/images/${encodeURIComponent(driveFileId)}/content`
    : `/drive/files/${encodeURIComponent(driveFileId)}/content`;
  const blob = await fetchAuthenticatedBlob(path, 'Could not open property image');
  return normalizeImageBlob(blob);
}
export async function submitTenantKyc(body: Record<string, any>) {
  return request<ApiResponse<Record<string, any>>>('/property-management/kyc/submit', { method: 'POST', body: JSON.stringify(body) });
}
export async function reviewPropertyPublicListing(propertyId: string, body: { status: 'approved' | 'rejected'; reason?: string }) {
  return request<ApiResponse<Record<string, any>>>(`/property-management/properties/${encodeURIComponent(propertyId)}/public-listing-approval`, { method: 'POST', body: JSON.stringify(body) });
}
export async function reviewTenantKyc(id: string, body: Record<string, any>) {
  return request<ApiResponse<Record<string, any>>>(`/property-management/kyc/${id}/review`, { method: 'POST', body: JSON.stringify(body) });
}
export async function fetchTenantKycDocumentBlob(fileId: string) {
  return fetchAuthenticatedBlob(`/property-management/kyc/documents/${encodeURIComponent(fileId)}/content`, 'Could not open KYC document');
}
export async function createRentalApplication(body: Record<string, any>) {
  return request<ApiResponse<Record<string, any>>>('/property-management/applications', { method: 'POST', body: JSON.stringify(body) });
}
export async function decideRentalApplication(id: string, body: Record<string, any>) {
  return request<ApiResponse<Record<string, any>>>(`/property-management/applications/${id}/decision`, { method: 'POST', body: JSON.stringify(body) });
}
export async function getApplicationDetails(id: string) {
  return request<ApiResponse<Record<string, any>>>(`/property-management/applications/${encodeURIComponent(id)}/details`, { cache: 'no-store' });
}
export async function updateApplicationPrivateNotes(id: string, notes: string) {
  return request<ApiResponse<Record<string, any>>>(`/property-management/applications/${encodeURIComponent(id)}/private-notes`, { method: 'PATCH', body: JSON.stringify({ notes }) });
}
export async function reviewApplicationDocument(id: string, documentId: string, body: { status: string; note?: string }) {
  return request<ApiResponse<Record<string, any>>>(`/property-management/applications/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/review`, { method: 'PATCH', body: JSON.stringify(body) });
}
export async function fetchApplicationDocumentBlob(id: string, documentId: string, download = false) {
  return fetchAuthenticatedBlob(`/property-management/applications/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/content?download=${download}`, 'Could not open the application document');
}
export async function createTenancyFromApplication(id: string, body: Record<string, any>) {
  return request<ApiResponse<Record<string, any>>>(`/property-management/applications/${id}/create-tenancy`, { method: 'POST', body: JSON.stringify(body) });
}
export async function calculateUtilityBill(body: Record<string, any>) {
  return request<ApiResponse<{ unitsConsumed: number; totalAmount: number }>>('/property-management/utility/calculate', { method: 'POST', body: JSON.stringify(body) });
}
export function propertyExportUrl(id: string, format: 'json' | 'csv' = 'json') {
  return `${API_BASE}/property-management/properties/${id}/export?format=${format}`;
}
export async function downloadPropertyExport(id: string, format: 'json' | 'csv' = 'json') {
  const token = getToken();
  const res = await fetchWithTimeout(propertyExportUrl(id, format), { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' }, UPLOAD_REQUEST_TIMEOUT_MS);
  if (!res.ok) throw new Error('Could not export property');
  const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `property-${id}.${format}`; a.click(); URL.revokeObjectURL(url);
}

export async function uploadSiteAsset(file: File) {
  const form = new FormData(); form.append('file', file);
  return request<ApiResponse<{ url: string; filename: string; mimeType: string; size: number }>>('/site/admin-assets', { method: 'POST', body: form });
}

type AppConfiguration = { modules: Record<string, any>[]; permissions?: Record<string, string[]>; resourcePermissions?: Record<string, string[]>; effectiveRole?: string; effectiveMode?: string; subscription?: Record<string, any>; role: string; mode: string };
const appConfigurationRequests = new Map<string, Promise<ApiResponse<AppConfiguration>>>();

/** Coalesce the shell and page access checks made during one render pass. */
export async function getAppConfiguration() {
  const requestKey = getToken() || `user:${currentUser?._id || 'anonymous'}`;
  const existing = appConfigurationRequests.get(requestKey);
  if (existing) return existing;
  const pending = request<ApiResponse<AppConfiguration>>('/site/app-config');
  const tracked = pending.finally(() => {
    if (appConfigurationRequests.get(requestKey) === tracked) appConfigurationRequests.delete(requestKey);
  });
  appConfigurationRequests.set(requestKey, tracked);
  return tracked;
}

export type RolePermissionEntry = { key: string; label: string; category: string; kind: 'module' | 'resource' | 'feature'; enabled: boolean; actions: string[]; scope: 'all' | 'own' | 'assigned' | 'public' };
export type RolePermissionCatalog = { roles: string[]; actions: string[]; scopes: string[]; catalog: Array<{ key: string; label: string; category: string; kind: string; actions: string[]; scopeOptions: string[] }> };
export async function getRolePermissionCatalog() { return request<ApiResponse<RolePermissionCatalog>>('/permissions/catalog'); }
export async function getRolePermissions(role: string) { return request<ApiResponse<{ role: string; entries: RolePermissionEntry[]; updatedAt?: string | null }>>(`/permissions/${encodeURIComponent(role)}`); }
export async function updateRolePermissions(role: string, entries: RolePermissionEntry[]) { return request<ApiResponse<{ role: string; entries: RolePermissionEntry[]; updatedAt?: string }>>(`/permissions/${encodeURIComponent(role)}`, { method: 'PUT', body: JSON.stringify({ entries }) }); }
export async function resetRolePermissions(role: string) { return request<ApiResponse<{ role: string; entries: RolePermissionEntry[]; updatedAt?: string }>>(`/permissions/${encodeURIComponent(role)}/reset`, { method: 'POST' }); }

export async function getNotifications(params: Record<string, string | number | boolean> = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => value !== undefined && value !== '' && query.set(key, String(value)));
  return request<PaginatedResponse<Record<string, any>>>(`/notifications${query.size ? `?${query}` : ''}`);
}
export async function markNotificationRead(id: string) { return request<ApiResponse<Record<string, any>>>(`/notifications/${id}/read`, { method: 'PATCH' }); }
export async function deleteNotification(id: string) { return request<ApiResponse<null>>(`/notifications/${id}`, { method: 'DELETE' }); }
export async function getNotificationPreferences() { return request<ApiResponse<Record<string, any>>>('/notifications/preferences'); }
export async function updateNotificationPreferences(body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>('/notifications/preferences', { method: 'PATCH', body: JSON.stringify(body) }); }

export async function getMessagingContacts(search = '') { const qs = search ? `?search=${encodeURIComponent(search)}` : ''; return request<ApiResponse<Record<string, any>[]>>(`/messaging/contacts${qs}`); }
export async function getConversations(params: Record<string, string | number> = {}) {
  const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => query.set(key, String(value)));
  return request<PaginatedResponse<Record<string, any>>>(`/messaging/conversations${query.size ? `?${query}` : ''}`);
}
export async function createConversation(body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>('/messaging/conversations', { method: 'POST', body: JSON.stringify(body) }); }
export async function getConversationMessages(id: string, params: Record<string, string | number> = {}) {
  const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => query.set(key, String(value)));
  return request<PaginatedResponse<Record<string, any>>>(`/messaging/conversations/${id}/messages${query.size ? `?${query}` : ''}`);
}
export async function sendConversationMessage(id: string, body: Record<string, any>) { return request<ApiResponse<Record<string, any>>>(`/messaging/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify(body) }); }
export async function markConversationRead(id: string) { return request<ApiResponse<null>>(`/messaging/conversations/${id}/read`, { method: 'PATCH' }); }
export async function archiveConversation(id: string) { return request<ApiResponse<null>>(`/messaging/conversations/${id}/archive`, { method: 'PATCH' }); }

export type LocationOption = { name: string; isoCode?: string; countryCode?: string; stateCode?: string; phonecode?: string; flag?: string; latitude?: string; longitude?: string };
export type ReverseGeocodeResult = { country?: string; state?: string; city?: string; locality?: string; landmark?: string; pinCode?: string; fullAddress?: string; googleMapsLocation?: string; latitude: number; longitude: number; provider?: string };
export async function getLocationCountries() { return request<ApiResponse<LocationOption[]>>('/public/locations/countries'); }
export async function getLocationStates(country: string) { return request<ApiResponse<LocationOption[]>>(`/public/locations/states?country=${encodeURIComponent(country)}`); }
export async function getLocationCities(country: string, state?: string) { return request<ApiResponse<LocationOption[]>>(`/public/locations/cities?country=${encodeURIComponent(country)}${state ? `&state=${encodeURIComponent(state)}` : ''}`); }
export async function reverseGeocodeLocation(latitude: number, longitude: number) {
  const qs = new URLSearchParams({ lat: String(latitude), lng: String(longitude) });
  return request<ApiResponse<ReverseGeocodeResult>>(`/public/locations/reverse?${qs}`);
}
