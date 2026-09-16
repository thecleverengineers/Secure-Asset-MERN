import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { clearSession, getCurrentUser, getToken } from '../services/api';

type RealtimeStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type EventHandler<T = any> = (payload: T) => void;

type RealtimeContextValue = {
  status: RealtimeStatus;
  socket: Socket | null;
  subscribe: <T = any>(event: string, handler: EventHandler<T>) => () => void;
  subscribeResource: (resource: string) => () => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendMessage: (payload: Record<string, any>, acknowledgement?: (response: any) => void) => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function socketOrigin() {
  const explicit = String(import.meta.env.VITE_SOCKET_URL || '').trim();
  return explicit || window.location.origin;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const presenceRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');

  const disconnect = useCallback(() => {
    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();
    socketRef.current = null;
    presenceRef.current?.removeAllListeners();
    presenceRef.current?.disconnect();
    presenceRef.current = null;
    setStatus('disconnected');
  }, []);

  const connect = useCallback(() => {
    const token = getToken();
    // The v98 cookie is HttpOnly, so an authenticated bootstrap profile is
    // the signal to connect. A memory bearer is accepted only for old servers.
    if (!token && !getCurrentUser()) { disconnect(); return; }
    disconnect();
    setStatus('connecting');
    const socket = io(socketOrigin(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      ...(token ? { auth: { token } } : {}),
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 10_000,
      timeout: 12_000,
    });
    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('error'));
    socket.on('site:changed', (payload) => window.dispatchEvent(new CustomEvent('secureasset:site-changed', { detail: payload })));
    socket.on('dashboard:invalidate', (payload) => window.dispatchEvent(new CustomEvent('secureasset:dashboard-invalidate', { detail: payload })));
    socket.on('resource:changed', (payload) => window.dispatchEvent(new CustomEvent('secureasset:resource-changed', { detail: payload })));
    socket.on('notification:new', (payload) => window.dispatchEvent(new CustomEvent('secureasset:notification', { detail: payload })));
    socket.on('message:new', (payload) => window.dispatchEvent(new CustomEvent('secureasset:message', { detail: payload }))); 
    socket.on('session:revoked', () => clearSession());
    socketRef.current = socket;

    const presence = io(`${socketOrigin()}/presence`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      ...(token ? { auth: { token } } : {}),
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1200,
      reconnectionDelayMax: 15_000,
      timeout: 12_000,
    });
    presence.on('presence:state', (payload) => window.dispatchEvent(new CustomEvent('secureasset:presence', { detail: payload })));
    presence.on('presence:changed', (payload) => window.dispatchEvent(new CustomEvent('secureasset:presence', { detail: payload })));
    presence.on('session:revoked', () => clearSession());
    presenceRef.current = presence;
  }, [disconnect]);

  useEffect(() => {
    connect();
    const onSession = () => connect();
    window.addEventListener('secureasset:session', onSession);
    return () => { window.removeEventListener('secureasset:session', onSession); disconnect(); };
  }, [connect, disconnect]);

  const subscribe = useCallback(<T,>(event: string, handler: EventHandler<T>) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on(event, handler as EventHandler);
    return () => socket.off(event, handler as EventHandler);
  }, []);

  const subscribeResource = useCallback((resource: string) => {
    const socket = socketRef.current;
    if (!socket || !resource) return () => {};
    socket.emit('resource:subscribe', resource);
    return () => socket.emit('resource:unsubscribe', resource);
  }, []);

  const value = useMemo<RealtimeContextValue>(() => ({
    status,
    socket: socketRef.current,
    subscribe,
    subscribeResource,
    joinConversation(conversationId) { socketRef.current?.emit('conversation:join', conversationId); },
    leaveConversation(conversationId) { socketRef.current?.emit('conversation:leave', conversationId); },
    sendMessage(payload, acknowledgement) { socketRef.current?.emit('message:send', payload, acknowledgement); },
  }), [status, subscribe, subscribeResource]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const value = useContext(RealtimeContext);
  if (!value) throw new Error('useRealtime must be used inside RealtimeProvider');
  return value;
}
