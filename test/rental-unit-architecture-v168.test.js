import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { UNIT_TRANSITIONS } from '../server/src/services/rentalUnitLifecycle.js';

const root = new URL('../', import.meta.url);
const source = (file) => readFile(new URL(file, root), 'utf8');

test('rent property creation does not require parent pricing', async () => {
  const [controller, wizard] = await Promise.all([source('server/src/controllers/resourceController.js'), source('src/app/components/property/PropertyFormWizard.tsx')]);
  assert.match(controller, /listingType !== 'rent'/);
  assert.match(controller, /body\.price = 0/);
  assert.match(wizard, /values\.listingType !== 'rent'/);
  assert.match(wizard, /My Listings → Manage Rooms/);
});

test('room hierarchy and permanent tenancy models are separate collections', async () => {
  const model = await source('server/src/models/rentalUnits.js');
  for (const marker of ['PropertyFloor', 'RentalUnit', 'RentCycle', 'currentTenancyId', 'currentTenantId', 'APPLICATION_PENDING', 'PAYMENT_PENDING', 'OCCUPIED', 'NOTICE_PERIOD', 'VACATING']) assert.match(model, new RegExp(marker));
  const tenancy = await source('server/src/models/propertyManagement.js');
  assert.match(tenancy, /tenancy_one_live_record_per_rental_unit/);
  assert.match(tenancy, /statusHistory/);
  assert.match(tenancy, /moveOutSettlement/);
});

test('occupancy starts only after agreement, payment and explicit landlord verification', async () => {
  const [agreement, controller, lifecycle] = await Promise.all([source('server/src/controllers/agreementController.js'), source('server/src/controllers/rentalUnitController.js'), source('server/src/services/rentalUnitLifecycle.js')]);
  assert.match(agreement, /Agreement approved; required initial payment is pending/);
  assert.match(agreement, /ensureInitialRentalInvoice/);
  assert.match(controller, /Verify the required initial payment before starting the rent workflow/);
  assert.match(controller, /transitionRentalUnit\(unit, 'OCCUPIED'/);
  assert.match(lifecycle, /unit\.currentTenancyId = tenancyId/);
  assert.match(lifecycle, /unit\.currentTenantId = tenantId/);
});

test('verify and start rent reconciles an application-pending room before payment pending', async () => {
  const [agreement, controller, lifecycle] = await Promise.all([source('server/src/controllers/agreementController.js'), source('server/src/controllers/rentalUnitController.js'), source('server/src/services/rentalUnitLifecycle.js')]);
  assert.ok(UNIT_TRANSITIONS.APPLICATION_PENDING.includes('AGREEMENT_PENDING'));
  assert.ok(UNIT_TRANSITIONS.AGREEMENT_PENDING.includes('PAYMENT_PENDING'));
  assert.match(lifecycle, /export async function transitionRentalUnitToPaymentPending/);
  assert.match(lifecycle, /if \(current === 'APPLICATION_PENDING'\)/);
  assert.match(lifecycle, /transitionRentalUnit\(unit, 'AGREEMENT_PENDING'/);
  assert.match(agreement, /transitionRentalUnitToPaymentPending\(rentalUnit/);
  assert.match(controller, /\['PAYMENT_PENDING', 'APPLICATION_PENDING'\]\.includes\(unit\.availabilityStatus\)/);
  assert.match(controller, /transitionRentalUnitToPaymentPending\(unit/);
});

test('room marketplace, landlord management and admin tracking are routed', async () => {
  const [routes, clientRoutes, propertyDetail, propertyDetails, modulePage, manage, admin, roomDetails, viewRoom, queries] = await Promise.all([
    source('server/src/routes/propertyManagementRoutes.js'), source('src/app/routes.tsx'), source('src/app/pages/PropertyDetailPage.tsx'),
    source('src/app/pages/app/PropertyDetailsPage.tsx'), source('src/app/pages/app/ModulePage.tsx'), source('src/app/pages/app/ManageRentalUnitsPage.tsx'), source('src/app/pages/app/RentalManagementAdminPage.tsx'),
    source('src/app/pages/RentalRoomDetailsPage.tsx'), source('src/app/pages/app/ViewRoomPage.tsx'), source('src/app/queries/propertyQueries.ts'),
  ]);
  assert.match(routes, /rental-structure/); assert.match(routes, /floors\/:floorId\/overview/); assert.match(routes, /start-tenancy/); assert.match(routes, /admin\/rental-management/);
  assert.match(clientRoutes, /my-listings\/:propertyId\/rooms/); assert.match(clientRoutes, /rooms\/view_room\/:unitId/); assert.match(clientRoutes, /view_room\/:unitId/); assert.match(clientRoutes, /rental-management/); assert.match(clientRoutes, /room_details\/:id/);
  assert.match(propertyDetail, /Available Rooms/); assert.match(propertyDetail, /rentalUnit=/);
  assert.match(propertyDetails, /data-secureasset-rental-unit-entry="dedicated-manager-v184"/); assert.match(propertyDetails, /Open Rental Units/); assert.match(propertyDetails, /isRentProperty/); assert.doesNotMatch(propertyDetails, /ManageRentalUnitsPage/); assert.match(propertyDetails, /!isRentProperty && <Box/);
  assert.match(modulePage, /module === 'rental-management'/); assert.match(modulePage, /RentalManagementAdminPage/);
  assert.match(manage, /Apply same pricing/); assert.match(manage, /Manage Floors/); assert.match(manage, /updatePropertyFloor/); assert.match(manage, /archivePropertyFloor/); assert.match(manage, /Permanent tenant history/); assert.match(manage, /entry and exit record/); assert.match(manage, /viewRoom/); assert.match(manage, /View room/);
  assert.match(manage, /ROOM_TYPE_OPTIONS/); assert.match(manage, /diningHall/); assert.match(manage, /size=\{\{ xs: 6, sm: 6, md: 4, lg: 3 \}\}/);
  assert.match(roomDetails, /publicRentalUnitQueryOptions/); assert.match(roomDetails, /Book Now/); assert.match(roomDetails, /disabled=\{!canBook\}/); assert.match(viewRoom, /data-secureasset-landlord-room-view="view-room-v184"/); assert.match(viewRoom, /getRentalUnitTenancyDetail/); assert.match(viewRoom, /Permanent tenant history/); assert.match(viewRoom, /Current tenant and tenancy/); assert.match(viewRoom, /fetchRentalUnitImageBlob/); assert.match(queries, /fetchPublicRentalUnit/);
  assert.match(admin, /Previous/); assert.match(admin, /Outstanding/);
});

test('public rent listings are room-priced and keep locked rooms viewable', async () => {
  const [publicController, siteController, serializer, marketplace, detail, applicationController] = await Promise.all([
    source('server/src/controllers/publicController.js'), source('server/src/controllers/siteController.js'), source('server/src/services/publicPropertySerialization.js'),
    source('src/app/pages/MarketplacePage.tsx'), source('src/app/pages/PropertyDetailPage.tsx'), source('server/src/controllers/propertyManagementController.js'),
  ]);
  assert.match(publicController, /status: \{ \$in: \['available', 'partially_occupied', 'occupied', 'reserved', 'rented'\] \}/);
  assert.match(publicController, /availabilityStatus: \{ \$ne: 'ARCHIVED' \}/);
  assert.match(publicController, /listingType === 'rent' && \(req\.query\.minPrice \|\| req\.query\.maxPrice\)/);
  assert.match(publicController, /const visibleProperties = properties;/);
  assert.match(siteController, /status: \{ \$in: \['available', 'partially_occupied', 'occupied', 'reserved', 'rented'\] \}/);
  assert.match(siteController, /availabilityStatus: \{ \$ne: 'ARCHIVED' \}/);
  assert.doesNotMatch(siteController, /No rental rooms are currently available/);
  assert.match(serializer, /isLocked: !canBook/); assert.match(serializer, /Locked — already booked/); assert.match(serializer, /canBook/);
  assert.match(marketplace, /roomPricedRentProperty/); assert.match(marketplace, /View rooms for monthly price/);
  assert.match(detail, /Rooms by floor|Available Rooms by floor/); assert.match(detail, /isLocked/); assert.match(detail, /room_details/);
  assert.match(applicationController, /status: \{ \$in: \['available', 'partially_occupied', 'occupied', 'reserved', 'rented'\] \}/);
});

test('public rent parent listings remain discoverable before room inventory is published', async () => {
  const controller = await source('server/src/controllers/publicController.js');
  assert.match(controller, /A public rent listing is the parent property/);
  assert.match(controller, /const visibleProperties = properties;/);
  assert.match(controller, /if \(listingType === 'rent' && \(req\.query\.minPrice \|\| req\.query\.maxPrice\)\)/);
});

test('room gallery uses secure uploads with a separate main thumbnail image', async () => {
  const [manage, api, publicController, publicRoutes, managedController, managedRoutes, serializer] = await Promise.all([
    source('src/app/pages/app/ManageRentalUnitsPage.tsx'), source('src/app/services/api.ts'), source('server/src/controllers/publicController.js'),
    source('server/src/routes/publicRoutes.js'), source('server/src/controllers/rentalUnitController.js'), source('server/src/routes/propertyManagementRoutes.js'),
    source('server/src/services/publicPropertySerialization.js'),
  ]);
  assert.match(manage, /ROOM_IMAGE_ACCEPT/);
  assert.match(manage, /Main thumbnail image/);
  assert.match(manage, /primaryImageFile/);
  assert.match(manage, /galleryFiles/);
  assert.match(manage, /uploadDocument/);
  assert.match(manage, /primaryImage,\s*gallery/);
  assert.doesNotMatch(manage, /Primary image URL|Gallery image .* URL|Add an image URL/);
  assert.match(api, /fetchRentalUnitImageBlob/);
  assert.match(publicController, /streamPublicRentalUnitImage/);
  assert.match(publicController, /Public room image is unavailable/);
  assert.match(publicRoutes, /rental-units\/\:unitId\/images\/\:fileId\/content/);
  assert.match(managedController, /streamManagedRentalUnitImage/);
  assert.match(managedRoutes, /streamManagedRentalUnitImage/);
  assert.match(serializer, /public\/rental-units/);
});

test('rental rooms may be standalone when floor management is enabled', async () => {
  const [controller, manage] = await Promise.all([
    source('server/src/controllers/rentalUnitController.js'),
    source('src/app/pages/app/ManageRentalUnitsPage.tsx'),
  ]);
  assert.match(controller, /if \(!floorId\) return null/);
  assert.match(controller, /unit\.floor = \(await floorForProperty\(property, req\.body\.floor\)\)\?\._id \|\| null/);
  assert.match(manage, /Floor \(optional\)/);
  assert.match(manage, /No floor \/ standalone room/);
  assert.match(manage, /floor: form\.floor \|\| null/);
  assert.match(manage, /Rooms without a floor/);
});

test('room, floor, tenancy and property editing use inline accordions', async () => {
  const [manage, propertyDetails, publicPropertyDetails] = await Promise.all([
    source('src/app/pages/app/ManageRentalUnitsPage.tsx'),
    source('src/app/pages/app/PropertyDetailsPage.tsx'),
    source('src/app/pages/PropertyDetailPage.tsx'),
  ]);
  assert.match(manage, /data-secureasset-rental-actions="accordion-dropdown-v184"/);
  assert.match(manage, /AccordionSummary/);
  assert.match(manage, /AccordionDetails/);
  assert.match(manage, /unitAccordionOpen/);
  assert.match(manage, /floorAccordionOpen/);
  assert.match(manage, /rental-tenant-history-accordion/);
  assert.doesNotMatch(manage, /ProfessionalDialog open=\{floorAccordionOpen\}/);
  assert.doesNotMatch(manage, /ProfessionalDialog open=\{unitAccordionOpen\}/);
  assert.doesNotMatch(manage, /ProfessionalDialog open=\{Boolean\(detail\)\}/);
  assert.match(propertyDetails, /data-secureasset-property-editor="accordion-dropdown-v184"/);
  assert.match(propertyDetails, /propertyEditorOpen/);
  assert.match(propertyDetails, /PropertyFormWizard/);
  assert.match(propertyDetails, /layout="page"/);
  assert.doesNotMatch(propertyDetails, /app\/properties\?record=/);
  assert.match(publicPropertyDetails, /role="link"/);
  assert.match(publicPropertyDetails, /room_details\/\$\{unit\._id\}/);
  assert.match(publicPropertyDetails, /onKeyDown=\{\(event\) =>/);
  assert.match(publicPropertyDetails, /data-secureasset-public-rental-room-cards="marketplace-style-v184"/);
});

test('landlord view_room uses manager-only room and tenancy data', async () => {
  const [controller, routes, page] = await Promise.all([
    source('server/src/controllers/rentalUnitController.js'), source('server/src/routes/propertyManagementRoutes.js'), source('src/app/pages/app/ViewRoomPage.tsx'),
  ]);
  assert.match(controller, /const property = await propertyManagedBy\(req\.user, unit\.property\)/);
  assert.doesNotMatch(controller, /const tenantAccess = await Tenancy\.exists\(\{ rentalUnit: unit\._id, tenant: req\.user\._id \}\)/);
  assert.match(controller, /property: property\.toObject\(\)/);
  assert.match(routes, /rental-units\/\:unitId\/tenancy/);
  assert.match(page, /view-room-v184/); assert.match(page, /getRentalUnitTenancyDetail/); assert.match(page, /Permanent tenant history/); assert.match(page, /Room status history/);
});

test('rent parent property details show rooms without parent gallery or room-based price panel', async () => {
  const detail = await source('src/app/pages/PropertyDetailPage.tsx');
  assert.match(detail, /data-secureasset-rent-parent-surface=\{isRentListing \? 'rooms-only-v184'/);
  assert.match(detail, /const normalizedPurpose = purpose\.replace/);
  assert.match(detail, /const isRentListing = \['rent', 'rental', 'for_rent', 'forrent'\]/);
  assert.match(detail, /rentalUnits\.length > 0/);
  assert.match(detail, /\{!isRentListing && <Grid container spacing=\{3\} mt=\{1\}>/);
  assert.match(detail, /!isRentListing && \(tourMedia\.length > 0 \|\| floorPlanMedia\.length > 0\)/);
  assert.doesNotMatch(detail, /purpose === 'rent' \? 'ROOM-BASED RENT'/);
  assert.match(detail, /const pricingRows: Array<\[string, unknown\]> = isRentListing \? \[\] :/);
  assert.match(detail, /Available Rooms/);
  assert.match(detail, /room_details\/\$\{unit\._id\}/);
});

test('monthly room rent cycles and migration are registered', async () => {
  const [billing, migration, packageJson, runner] = await Promise.all([source('server/src/services/rentalBilling.js'), source('scripts/migrate-rental-units-v168.js'), source('package.json'), source('scripts/run-automatic-migrations.js')]);
  assert.match(billing, /RNT-\$\{room\}-\$\{String\(month\).+tenancy\._id/s);
  assert.match(billing, /RentCycle\.findOneAndUpdate/);
  assert.match(migration, /legacySpaceId/);
  assert.match(packageJson, /migrate:rental-units/);
  assert.match(runner, /rental-units-v168/);
});
