import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AuthResult, RegistrationChallenge, TwoFactorChallenge, User } from '../services/types';
import {
  clearSession, completeTwoFactorLogin as apiCompleteTwoFactor, getInitialSession, getMe, login as apiLogin, logout as apiLogout,
  register as apiRegister, renewSession, verifyRegistration as apiVerifyRegistration, verifyOtp as apiVerifyOtp,
} from '../services/api';

type AuthAttempt = { user?: User; challenge?: TwoFactorChallenge };
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<AuthAttempt>;
  register: (body: { name: string; email: string; phone: string; password: string; invitationToken?: string }) => Promise<RegistrationChallenge>;
  verifyRegistration: (phone: string, otp: string) => Promise<User>;
  verifyOtp: (body: { identifier?: string; email?: string; phone?: string; otp: string }) => Promise<AuthAttempt>;
  completeTwoFactor: (challengeToken: string, code: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
function isChallenge(result: AuthResult): result is TwoFactorChallenge { return Boolean((result as TwoFactorChallenge)?.requiresTwoFactor); }

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialSession = getInitialSession();
  const [user, setUser] = useState<User | null>(() => initialSession?.user || null);
  // Server-side session prehydration means the first protected render never
  // waits for a client-side restore request.
  const loading = false;
  const refreshPromise = useRef<Promise<void> | null>(null);

  const refreshUser = useCallback(() => {
    if (refreshPromise.current) return refreshPromise.current;
    const pending = (async () => {
      try { const result = await getMe(); setUser(result.data); }
      catch { clearSession(); setUser(null); }
    })();
    refreshPromise.current = pending;
    void pending.finally(() => {
      if (refreshPromise.current === pending) refreshPromise.current = null;
    });
    return pending;
  }, []);

  useEffect(() => {
    const onSession = (event: Event) => {
      const detail = (event as CustomEvent<{ authenticated?: boolean; user?: User }>).detail;
      setUser(detail?.authenticated && detail.user ? detail.user : null);
    };
    window.addEventListener('secureasset:session', onSession);
    return () => window.removeEventListener('secureasset:session', onSession);
  }, []);

  useEffect(() => {
    if (!user?._id) return undefined;
    let lastRenewalAttempt = 0;
    let disposed = false;
    const renew = () => {
      if (disposed || Date.now() - lastRenewalAttempt < 60_000) return;
      lastRenewalAttempt = Date.now();
      void renewSession().then((session) => {
        if (!disposed && session?.user) setUser(session.user);
      });
    };
    const onFocus = () => renew();
    const onVisibility = () => { if (document.visibilityState === 'visible') renew(); };
    const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'mousemove'];
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    activityEvents.forEach((event) => window.addEventListener(event, renew, { passive: true }));
    const timer = window.setInterval(renew, 5 * 60_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      activityEvents.forEach((event) => window.removeEventListener(event, renew));
    };
  }, [user?._id]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    async login(identifier, password) {
      const result = await apiLogin(identifier, password);
      if (isChallenge(result.data)) return { challenge: result.data };
      setUser(result.data.user); return { user: result.data.user };
    },
    async register(body) {
      const result = await apiRegister(body);
      return { ...result.data, message: result.message, developmentOtp: result.developmentOtp };
    },
    async verifyRegistration(phone, otp) { const result = await apiVerifyRegistration(phone, otp); setUser(result.data.user); return result.data.user; },
    async verifyOtp(body) {
      const result = await apiVerifyOtp(body);
      if (isChallenge(result.data)) return { challenge: result.data };
      setUser(result.data.user); return { user: result.data.user };
    },
    async completeTwoFactor(challengeToken, code) { const result = await apiCompleteTwoFactor(challengeToken, code); setUser(result.data.user); return result.data.user; },
    async logout() { try { await apiLogout(); } finally { setUser(null); } },
    refreshUser,
  }), [loading, refreshUser, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
