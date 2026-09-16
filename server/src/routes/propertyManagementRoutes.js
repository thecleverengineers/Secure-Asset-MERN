import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireCapabilityPermission, requireFeaturePermission } from '../middleware/rolePermission.js';
import { getPropertyTree, streamPropertyMedia, streamPropertyMediaForProperty, streamLegacyPropertyImage, getLandlordOverview, submitTenantKyc, reviewTenantKyc, streamTenantKycDocument, createRentalApplication, decideApplication, createTenancyFromApplication, calculateUtility, exportProperty, getPropertyVisitNavigation } from '../controllers/propertyManagementController.js';
import {
  applyRentalUnitPricing,
  archivePropertyFloor,
  changeRentalUnitStatus,
  createPropertyFloor,
  createRentalUnit,
  duplicateRentalUnit,
  getAdminRentalManagement,
  getPropertyFloorOverview,
  getPropertyOccupancy,
  getRentalStructure,
  getRentalUnitTenancyDetail,
  startRentalTenancy,
  streamManagedRentalUnitImage,
  transitionRentalTenancy,
  updatePropertyFloor,
  updateRentalUnit,
} from '../controllers/rentalUnitController.js';
const router = Router();
router.use(authenticate);
router.get('/landlord-overview', requireCapabilityPermission('landlord', 'module:property-management'), getLandlordOverview);
// This router serves both landlord operations and tenant journeys. A single
// landlord-only middleware here used to block tenant KYC and property
// applications before their controller could enforce the correct ownership
// rules. Keep authorization at the endpoint boundary instead.
router.get('/properties/:propertyId/tree', requireFeaturePermission('module:property-management'), getPropertyTree);
router.get('/properties/:propertyId/rental-structure', requireFeaturePermission('module:property-management'), getRentalStructure);
router.get('/properties/:propertyId/floors/:floorId/overview', requireFeaturePermission('module:property-management'), getPropertyFloorOverview);
router.post('/properties/:propertyId/floors', requireFeaturePermission('module:property-management', 'create'), createPropertyFloor);
router.patch('/floors/:floorId', requireFeaturePermission('module:property-management', 'edit'), updatePropertyFloor);
router.delete('/floors/:floorId', requireFeaturePermission('module:property-management', 'delete'), archivePropertyFloor);
router.post('/properties/:propertyId/rental-units', requireFeaturePermission('module:property-management', 'create'), createRentalUnit);
router.patch('/rental-units/:unitId', requireFeaturePermission('module:property-management', 'edit'), updateRentalUnit);
router.post('/rental-units/:unitId/duplicate', requireFeaturePermission('module:property-management', 'create'), duplicateRentalUnit);
router.post('/rental-units/:unitId/status', requireFeaturePermission('module:property-management', 'edit'), changeRentalUnitStatus);
router.post('/properties/:propertyId/rental-units/apply-pricing', requireFeaturePermission('module:property-management', 'edit'), applyRentalUnitPricing);
router.get('/rental-units/:unitId/images/:fileId/content', requireFeaturePermission('module:property-management'), streamManagedRentalUnitImage);
router.get('/properties/:propertyId/occupancy', requireFeaturePermission('module:tenancies', 'view'), getPropertyOccupancy);
router.get('/rental-units/:unitId/tenancy', requireFeaturePermission('module:tenancies', 'view'), getRentalUnitTenancyDetail);
router.post('/rental-units/:unitId/start-tenancy', requireFeaturePermission('module:tenancies', 'edit'), startRentalTenancy);
router.post('/tenancies/:tenancyId/transition', requireFeaturePermission('module:tenancies', 'edit'), transitionRentalTenancy);
router.get('/admin/rental-management', requireFeaturePermission('module:tenancies', 'view'), getAdminRentalManagement);
router.get('/properties/:propertyId/media/:mediaId/content', requireFeaturePermission('module:property-management'), streamPropertyMediaForProperty);
router.get('/property-media/:mediaId/content', requireFeaturePermission('module:property-management'), streamPropertyMedia);
router.get('/properties/:propertyId/images/:fileId/content', requireFeaturePermission('module:property-management'), streamLegacyPropertyImage);
router.get('/properties/:propertyId/export', requireFeaturePermission('module:property-management', 'export'), exportProperty);
router.get('/property-visits/:visitId/navigation', requireFeaturePermission('module:property-visits', 'view'), getPropertyVisitNavigation);
router.post('/kyc/submit', requireFeaturePermission('module:tenant-kyc', 'create'), submitTenantKyc);
router.post('/kyc/:id/review', requireFeaturePermission('module:tenant-kyc', 'edit'), reviewTenantKyc);
router.get('/kyc/documents/:documentId/content', requireFeaturePermission('module:tenant-kyc', 'view'), streamTenantKycDocument);
router.post('/applications', requireFeaturePermission('module:applications', 'create'), createRentalApplication);
router.post('/applications/:id/decision', requireFeaturePermission('module:applications', 'approve'), decideApplication);
router.post('/applications/:id/create-tenancy', requireFeaturePermission('module:tenancies', 'create'), createTenancyFromApplication);
router.post('/utility/calculate', requireFeaturePermission('module:utility-readings', 'create'), calculateUtility);
export default router;
