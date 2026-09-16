let ioServer = null;

export function setRealtimeServer(io) { ioServer = io; }
export function getRealtimeServer() { return ioServer; }

function serialize(value) {
  if (!value) return value;
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
}

export function emitRealtime(resource, action, record, options = {}) {
  if (!ioServer) return;
  const base = {
    resource,
    action,
    id: String(record?._id || options.recordId || ''),
    at: new Date().toISOString(),
  };
  // Resource and role rooms receive invalidations only. Records may contain KYC,
  // payment or legal data and must always be reloaded through permission-scoped APIs.
  ioServer.to(`resource:${resource}`).emit('resource:changed', base);
  ioServer.to('role:admin').emit('resource:changed', { ...base, ...(options.includeData === false ? {} : { data: serialize(record) }) });
  for (const role of options.roles || []) ioServer.to(`role:${role}`).emit('resource:changed', base);
  for (const userId of options.users || []) {
    if (userId) ioServer.to(`user:${String(userId)}`).emit('resource:changed', base);
  }
  if (options.dashboard !== false) {
    ioServer.to('role:admin').emit('dashboard:invalidate', { resource, at: base.at });
    for (const userId of options.users || []) if (userId) ioServer.to(`user:${String(userId)}`).emit('dashboard:invalidate', { resource, at: base.at });
  }
}

export function emitNotification(notification) {
  if (!ioServer || !notification?.user) return;
  ioServer.to(`user:${String(notification.user?._id || notification.user)}`).emit('notification:new', serialize(notification));
}

export function emitSiteChanged(path = '*') {
  if (!ioServer) return;
  ioServer.emit('site:changed', { path, at: new Date().toISOString() });
}
