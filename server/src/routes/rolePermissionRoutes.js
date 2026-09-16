import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { getRolePermissionCatalog, getRolePermissions, resetRolePermissions, updateRolePermissions } from '../controllers/rolePermissionController.js';

const router = Router();
router.use(authenticate, authorize('admin'));
router.get('/catalog', getRolePermissionCatalog);
router.get('/:role', getRolePermissions);
router.put('/:role', updateRolePermissions);
router.post('/:role/reset', resetRolePermissions);

export default router;
