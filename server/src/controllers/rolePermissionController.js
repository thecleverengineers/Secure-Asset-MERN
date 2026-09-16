import { RolePermission, AuditLog } from '../models/index.js';
import { ACTIONS, PERMISSION_SCOPES, ROLE_KEYS, clearRolePermissionCache, defaultPermissionEntriesForRole, normalizePermissionRole, permissionCatalog } from '../services/rbac.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

function cleanRole(value) {
  const role = normalizePermissionRole(value);
  if (!ROLE_KEYS.includes(role)) throw new ApiError(422, 'Unsupported permission role');
  return role;
}

function normalizeEntries(role, input) {
  if (!Array.isArray(input)) throw new ApiError(422, 'Permission entries must be an array');
  if (input.length > 1000) throw new ApiError(422, 'Permission map is too large');
  const catalog = new Map(permissionCatalog().map((entry) => [entry.key, entry]));
  const submitted = new Map();
  for (const raw of input) {
    const key = String(raw?.key || '').trim().toLowerCase();
    const definition = catalog.get(key);
    if (!definition) throw new ApiError(422, `Unknown permission feature: ${key || 'missing key'}`);
    const actions = [...new Set((Array.isArray(raw?.actions) ? raw.actions : []).map((action) => String(action).toLowerCase()))]
      .filter((action) => ACTIONS.includes(action));
    if (actions.some((action) => action !== 'view') && !actions.includes('view')) actions.unshift('view');
    submitted.set(key, {
      key,
      label: definition.label,
      category: definition.category,
      kind: definition.kind,
      enabled: raw?.enabled !== false,
      actions,
      scope: PERMISSION_SCOPES.includes(String(raw?.scope || 'all')) ? String(raw.scope) : (role === 'admin' ? 'all' : 'own'),
    });
  }
  return defaultPermissionEntriesForRole(role).map((fallback) => submitted.get(fallback.key) || fallback);
}

export const getRolePermissionCatalog = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { roles: ROLE_KEYS, actions: ACTIONS, scopes: PERMISSION_SCOPES, catalog: permissionCatalog() } });
});

export const getRolePermissions = asyncHandler(async (req, res) => {
  const role = cleanRole(req.params.role);
  const defaults = defaultPermissionEntriesForRole(role);
  const record = await RolePermission.findOne({ role }).lean();
  res.json({ success: true, data: { role, entries: record?.entries?.length ? record.entries : defaults, updatedAt: record?.updatedAt || null } });
});

export const updateRolePermissions = asyncHandler(async (req, res) => {
  const role = cleanRole(req.params.role);
  const entries = normalizeEntries(role, req.body?.entries);
  const previous = await RolePermission.findOne({ role }).lean();
  const record = await RolePermission.findOneAndUpdate(
    { role },
    { $set: { role, entries, updatedBy: req.user._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  clearRolePermissionCache(role);
  await AuditLog.create({
    user: req.user._id, role: req.user.role, action: 'role-permissions:updated', module: 'role-permissions', recordId: record._id,
    previousValue: previous?.entries || [], updatedValue: entries, ip: req.ip, device: req.get('user-agent'),
  });
  res.json({ success: true, data: { role, entries: record.entries, updatedAt: record.updatedAt }, message: `${role} permissions saved.` });
});

export const resetRolePermissions = asyncHandler(async (req, res) => {
  const role = cleanRole(req.params.role);
  const entries = defaultPermissionEntriesForRole(role);
  const record = await RolePermission.findOneAndUpdate(
    { role },
    { $set: { role, entries, updatedBy: req.user._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  clearRolePermissionCache(role);
  await AuditLog.create({ user: req.user._id, role: req.user.role, action: 'role-permissions:reset', module: 'role-permissions', recordId: record._id, updatedValue: entries, ip: req.ip, device: req.get('user-agent') });
  res.json({ success: true, data: { role, entries: record.entries, updatedAt: record.updatedAt }, message: `${role} permissions restored to the secure defaults.` });
});
