import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import {
  AgreementRequest, Application, Property, PropertyFloor, PropertySpace, RentCycle,
  RentalInvoice, RentalUnit, Tenancy,
} from '../server/src/models/index.js';
import { billingMonthKey, monthlyRentCycleBoundsForBillingMonth } from '../server/src/services/rentalBilling.js';
import { syncPropertyRentalSummary } from '../server/src/services/rentalUnitLifecycle.js';

const LIVE = new Set(['reserved', 'application_pending', 'deposit_pending', 'agreement_pending', 'payment_pending', 'active', 'notice', 'notice_period', 'vacating', 'move_out', 'move_out_inspection', 'final_calculation', 'landlord_review', 'final_payment', 'deposit_settlement']);
const unitStatus = (tenancy) => tenancy?.status === 'active' ? 'OCCUPIED'
  : ['notice', 'notice_period'].includes(tenancy?.status) ? 'NOTICE_PERIOD'
    : ['vacating', 'move_out', 'move_out_inspection', 'final_calculation', 'landlord_review', 'final_payment', 'deposit_settlement'].includes(tenancy?.status) ? 'VACATING'
      : tenancy?.status === 'payment_pending' || tenancy?.status === 'deposit_pending' ? 'PAYMENT_PENDING'
        : tenancy?.status === 'agreement_pending' ? 'AGREEMENT_PENDING' : 'AVAILABLE';

async function migrateProperty(property) {
  const spaces = await PropertySpace.find({ property: property._id, deletedAt: null }).sort({ floorNumber: 1, createdAt: 1 }).lean();
  const rentable = spaces.filter((space) => space.rentable !== false && ['room', 'bed', 'apartment', 'office', 'shop', 'warehouse_unit', 'other'].includes(space.level));
  const hasFloors = spaces.some((space) => space.level === 'floor') || rentable.some((space) => Number.isFinite(Number(space.floorNumber)));
  const floorByNumber = new Map();
  if (hasFloors) {
    const numbers = [...new Set(rentable.map((space) => Number(space.floorNumber ?? 0)))];
    for (const floorNumber of numbers) {
      const legacyFloor = spaces.find((space) => space.level === 'floor' && Number(space.floorNumber ?? 0) === floorNumber);
      const floor = await PropertyFloor.findOneAndUpdate(
        { property: property._id, floorNumber },
        { $set: { landlord: property.owner, floorName: legacyFloor?.name || (floorNumber === 0 ? 'Ground Floor' : `Floor ${floorNumber}`), floorCode: legacyFloor?.code || '', status: 'active', updatedBy: property.owner }, $setOnInsert: { createdBy: property.owner } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      floorByNumber.set(floorNumber, floor);
    }
  }

  for (const space of rentable) {
    const roomNumber = String(space.roomNumber || space.apartmentNumber || space.code || space.name || space._id).trim();
    const floor = floorByNumber.get(Number(space.floorNumber ?? 0));
    const unit = await RentalUnit.findOneAndUpdate(
      { legacySpaceId: space._id },
      { $set: {
        property: property._id, floor: floor?._id, landlord: property.owner, roomNumber, roomNumberKey: roomNumber.toLocaleLowerCase('en-IN'), name: space.name || roomNumber,
        specifications: {
          roomCategory: space.level || 'room', roomType: space.level === 'apartment' ? 'entire_unit' : 'private_room', bedroomCount: Number(space.roomDetails?.bedrooms || (space.level === 'room' ? 1 : 0)),
          bathroomCount: Number(space.roomDetails?.bathrooms || 0), maximumOccupants: Number(space.occupancyRules?.maxTotal || 1), furnishingStatus: space.furnishing?.status || 'unfurnished',
          roomSize: { value: Number(space.area?.value || 0), unit: space.area?.unit || 'sqft' }, otherAmenities: space.amenities || [],
        },
        amenities: space.amenities || [], primaryImage: space.coverImage ? { url: space.coverImage, name: `${roomNumber} primary image`, category: 'other' } : undefined,
        pricing: { monthlyRent: Number(space.price || property.pricing?.monthlyRent || 0), securityDeposit: Number(space.securityDeposit || property.pricing?.securityDeposit || 0), maintenanceCharge: Number(space.maintenanceCharge || property.pricing?.maintenanceCharge || 0), availableFrom: space.availableFrom },
        visibility: space.visibility === 'public' ? 'public' : 'private', publicationStatus: space.publicationStatus === 'published' ? 'published' : 'draft', updatedBy: property.owner,
      }, $setOnInsert: { availabilityStatus: 'AVAILABLE', statusHistory: [{ to: 'AVAILABLE', reason: 'Migrated from legacy property space', changedBy: property.owner, changedAt: new Date() }], createdBy: property.owner } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await Promise.all([
      Application.updateMany({ targetSpace: space._id, rentalUnit: null }, { $set: { rentalUnit: unit._id } }),
      AgreementRequest.updateMany({ space: space._id, rentalUnit: null }, { $set: { rentalUnit: unit._id } }),
      RentalInvoice.updateMany({ space: space._id, rentalUnit: null }, { $set: { rentalUnit: unit._id } }),
    ]);
    const tenancies = await Tenancy.find({ space: space._id }).sort({ createdAt: -1 });
    let liveAssigned = false;
    for (const tenancy of tenancies) {
      if (LIVE.has(tenancy.status) && liveAssigned) continue;
      tenancy.rentalUnit = unit._id;
      tenancy.tenancyNumber ||= `TNC-${String(unit._id).slice(-6).toUpperCase()}-${String(tenancy._id).slice(-6).toUpperCase()}`;
      tenancy.pricingSnapshot ||= unit.pricing?.toObject?.() || unit.pricing || {};
      tenancy.agreement ||= (await AgreementRequest.findOne({ application: tenancy.application }).sort({ createdAt: -1 }).select('_id').lean())?._id;
      await tenancy.save({ validateModifiedOnly: true });
      if (LIVE.has(tenancy.status)) {
        liveAssigned = true;
        const status = unitStatus(tenancy);
        unit.availabilityStatus = status;
        if (status === 'OCCUPIED') { unit.currentTenancyId = tenancy._id; unit.currentTenantId = tenancy.tenant; }
        await unit.save({ validateModifiedOnly: true });
      }
    }
  }
  property.floorManagementEnabled = hasFloors;
  property.pricing ||= {};
  property.pricing.monthlyRent = undefined; property.pricing.securityDeposit = undefined; property.pricing.maintenanceCharge = undefined;
  property.price = 0;
  await property.save({ validateModifiedOnly: true });
  await syncPropertyRentalSummary(property._id, property.owner);
}

async function migrateCycles() {
  const invoices = await RentalInvoice.find({ rentalUnit: { $ne: null }, tenancy: { $ne: null } }).lean();
  for (const invoice of invoices) {
    const month = invoice.billingMonth || billingMonthKey(invoice.createdAt || new Date());
    const bounds = monthlyRentCycleBoundsForBillingMonth(month, invoice.createdAt || new Date());
    const tenancy = await Tenancy.findById(invoice.tenancy).lean();
    if (!tenancy?.rentalUnit) continue;
    const cycle = await RentCycle.findOneAndUpdate(
      { tenancy: tenancy._id, cycleMonth: month },
      { $set: { property: tenancy.property, rentalUnit: tenancy.rentalUnit, landlord: tenancy.landlord, tenant: tenancy.tenant, startsAt: invoice.cycleStartsAt || bounds.startsAt, endsAt: invoice.cycleEndsAt || bounds.endsAt, dueAt: invoice.dueDate, invoice: invoice._id, amount: Number(invoice.totalAmount || 0), paidAmount: Number(invoice.paidAmount || 0), outstandingAmount: Number(invoice.balanceAmount || 0), status: invoice.status === 'partially_paid' ? 'partial' : ['paid', 'overdue', 'waived'].includes(invoice.status) ? invoice.status : 'pending', updatedBy: tenancy.landlord }, $setOnInsert: { createdBy: tenancy.landlord } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await RentalInvoice.updateOne({ _id: invoice._id }, { $set: { rentCycle: cycle._id } });
  }
}

try {
  await connectDatabase();
  const properties = await Property.find({ deletedAt: null, $or: [{ listingType: 'rent' }, { purpose: 'rent' }] });
  for (const property of properties) await migrateProperty(property);
  await migrateCycles();
  console.log(`Rental-unit migration completed for ${properties.length} rent properties.`);
} catch (error) {
  console.error('Rental-unit migration failed:', error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
