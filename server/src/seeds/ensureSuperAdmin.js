import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { ensureBootstrapSuperAdmin } from '../services/bootstrapSuperAdmin.js';

await connectDatabase();
try {
  const result = await ensureBootstrapSuperAdmin();
  if (!result.applied) throw new Error('Set BOOTSTRAP_SUPER_ADMIN_ENABLED=true before running seed:super-admin');
} finally {
  await disconnectDatabase();
}
