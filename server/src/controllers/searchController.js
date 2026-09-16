import { resources } from '../services/resources.js';
import { buildScope, normalizeQueryFilter } from '../services/scope.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { canResourceAction } from '../services/rbac.js';

const DEFAULT_RESOURCES = ['properties', 'property-spaces', 'applications', 'tenants', 'tenant-profiles', 'surveys', 'survey-jobs', 'survey-projects', 'complaints', 'documents', 'facilities', 'facility-bookings'];

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export const globalSearch = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) throw new ApiError(422, 'Enter at least two characters');
  if (q.length > 120) throw new ApiError(422, 'Search is too long');
  const limit = Math.min(10, Math.max(1, Number(req.query.limit || 5)));
  const requested = String(req.query.resources || '').split(',').map((value) => value.trim()).filter(Boolean);
  const candidates = [];
  for (const name of (requested.length ? requested : DEFAULT_RESOURCES)) {
    const config = resources[name];
    if (config?.search?.length && await canResourceAction(name, req.user, 'view', config)) candidates.push(name);
  }
  const expression = new RegExp(escapeRegex(q), 'i');
  const groups = await Promise.all(candidates.map(async (resource) => {
    const config = resources[resource];
    const scope = normalizeQueryFilter(await buildScope(req.user, resource));
    const search = { $or: config.search.map((field) => ({ [field]: expression })) };
    const query = config.model.find({ $and: [scope, search] }).limit(limit).sort('-updatedAt');
    const paths = Array.isArray(config.populate) ? config.populate : config.populate ? [config.populate] : [];
    paths.slice(0, 3).forEach((path) => query.populate(path, '-password -refreshTokens -otpHash'));
    const data = await query.lean();
    return { resource, count: data.length, data };
  }));
  res.json({ success: true, data: groups.filter((group) => group.count > 0), query: q });
});
