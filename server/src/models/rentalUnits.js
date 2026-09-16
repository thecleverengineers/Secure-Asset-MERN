import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;
const objectId = (ref, required = false) => ({ type: Schema.Types.ObjectId, ref, required });
const timestamps = { timestamps: true };

export const RENTAL_UNIT_AVAILABILITY_STATUSES = Object.freeze([
  'AVAILABLE',
  'RESERVED',
  'APPLICATION_PENDING',
  'AGREEMENT_PENDING',
  'PAYMENT_PENDING',
  'OCCUPIED',
  'NOTICE_PERIOD',
  'VACATING',
  'MAINTENANCE',
  'BLOCKED',
  'ARCHIVED',
]);

export const PUBLIC_RENTAL_UNIT_STATUSES = Object.freeze(['AVAILABLE', 'APPLICATION_PENDING']);

const RentalUnitGalleryImageSchema = new Schema({
  file: objectId('DriveFile'),
  url: { type: String, trim: true, maxlength: 2048, default: '' },
  name: { type: String, required: true, trim: true, maxlength: 180 },
  category: {
    type: String,
    enum: ['bedroom', 'bathroom', 'toilet', 'kitchen', 'balcony', 'living_room', 'furniture', 'other'],
    default: 'other',
  },
  caption: { type: String, trim: true, maxlength: 300, default: '' },
  description: { type: String, trim: true, maxlength: 1500, default: '' },
  sortOrder: { type: Number, min: 0, default: 0 },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

const RentalUnitPricingSchema = new Schema({
  currency: { type: String, enum: ['INR'], default: 'INR' },
  monthlyRent: { type: Number, min: 0, default: 0 },
  securityDeposit: { type: Number, min: 0, default: 0 },
  maintenanceCharge: { type: Number, min: 0, default: 0 },
  maintenanceFrequency: { type: String, enum: ['monthly', 'one_time', 'included'], default: 'monthly' },
  electricity: { type: String, enum: ['metered', 'included', 'fixed', 'prepaid', 'tenant_direct'], default: 'metered' },
  electricityFixedAmount: { type: Number, min: 0, default: 0 },
  water: { type: String, enum: ['metered', 'included', 'fixed', 'tenant_direct'], default: 'included' },
  waterFixedAmount: { type: Number, min: 0, default: 0 },
  bookingAmount: { type: Number, min: 0, default: 0 },
  minimumStayMonths: { type: Number, min: 0, max: 120, default: 0 },
  availableFrom: Date,
  additionalCharges: [{ label: { type: String, trim: true, maxlength: 120 }, amount: { type: Number, min: 0 }, recurring: { type: Boolean, default: false } }],
}, { _id: false });

const RentalUnitSpecificationsSchema = new Schema({
  roomCategory: { type: String, trim: true, maxlength: 100, default: 'room' },
  roomType: { type: String, trim: true, maxlength: 100, default: 'private_room' },
  bhkConfiguration: { type: String, trim: true, maxlength: 40, default: '' },
  bedroomCount: { type: Number, min: 0, max: 50, default: 1 },
  bathroomCount: { type: Number, min: 0, max: 50, default: 0 },
  bathroomAccess: { type: String, enum: ['attached', 'shared', 'none'], default: 'none' },
  toiletCount: { type: Number, min: 0, max: 50, default: 0 },
  toiletAccess: { type: String, enum: ['attached', 'shared', 'none'], default: 'none' },
  kitchenAvailable: { type: Boolean, default: false },
  kitchenAccess: { type: String, enum: ['private', 'shared', 'none'], default: 'none' },
  drawingRoom: { type: Boolean, default: false },
  livingRoom: { type: Boolean, default: false },
  diningHall: { type: Boolean, default: false },
  balcony: { type: Boolean, default: false },
  furnishingStatus: { type: String, enum: ['unfurnished', 'semi_furnished', 'fully_furnished'], default: 'unfurnished' },
  airConditioning: { type: String, enum: ['ac', 'non_ac'], default: 'non_ac' },
  liftAccess: { type: Boolean, default: false },
  roomSize: { value: { type: Number, min: 0 }, unit: { type: String, default: 'sqft', trim: true, maxlength: 24 } },
  carpetArea: { value: { type: Number, min: 0 }, unit: { type: String, default: 'sqft', trim: true, maxlength: 24 } },
  maximumOccupants: { type: Number, min: 1, max: 100, default: 1 },
  preferredOccupancy: [{ type: String, trim: true, maxlength: 80 }],
  orientation: { type: String, trim: true, maxlength: 80, default: '' },
  electricityArrangement: { type: String, trim: true, maxlength: 120, default: '' },
  waterArrangement: { type: String, trim: true, maxlength: 120, default: '' },
  internetWifi: { type: Boolean, default: false },
  parkingEligibility: { type: Boolean, default: false },
  otherAmenities: [{ type: String, trim: true, maxlength: 120 }],
}, { _id: false });

const RentalUnitStatusHistorySchema = new Schema({
  from: { type: String, enum: RENTAL_UNIT_AVAILABILITY_STATUSES },
  to: { type: String, enum: RENTAL_UNIT_AVAILABILITY_STATUSES, required: true },
  reason: { type: String, trim: true, maxlength: 1000, default: '' },
  changedBy: objectId('User'),
  changedAt: { type: Date, default: Date.now },
}, { _id: false });

const PropertyFloorSchema = new Schema({
  property: { ...objectId('Property', true), index: true },
  landlord: { ...objectId('User', true), index: true },
  floorNumber: { type: Number, required: true, min: -10, max: 300 },
  floorName: { type: String, required: true, trim: true, maxlength: 120 },
  floorCode: { type: String, trim: true, uppercase: true, maxlength: 40, default: '' },
  sortOrder: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'disabled', 'archived'], default: 'active', index: true },
  archivedAt: Date,
  createdBy: objectId('User'),
  updatedBy: objectId('User'),
}, timestamps);
PropertyFloorSchema.index({ property: 1, floorNumber: 1 }, { unique: true, name: 'property_floor_number_unique' });
PropertyFloorSchema.index({ property: 1, status: 1, sortOrder: 1 }, { name: 'property_floor_structure' });

const RentalUnitSchema = new Schema({
  property: { ...objectId('Property', true), index: true },
  floor: { ...objectId('PropertyFloor'), index: true },
  landlord: { ...objectId('User', true), index: true },
  roomNumber: { type: String, required: true, trim: true, maxlength: 80 },
  roomNumberKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
  name: { type: String, required: true, trim: true, maxlength: 180 },
  referenceNumber: { type: String, trim: true, uppercase: true, maxlength: 80, sparse: true },
  specifications: { type: RentalUnitSpecificationsSchema, default: () => ({}) },
  amenities: [{ type: String, trim: true, maxlength: 120 }],
  primaryImage: { type: RentalUnitGalleryImageSchema, default: undefined },
  gallery: { type: [RentalUnitGalleryImageSchema], default: [] },
  pricing: { type: RentalUnitPricingSchema, default: () => ({}) },
  visibility: { type: String, enum: ['private', 'public'], default: 'private', index: true },
  publicationStatus: { type: String, enum: ['draft', 'published', 'paused', 'archived'], default: 'draft', index: true },
  availabilityStatus: { type: String, enum: RENTAL_UNIT_AVAILABILITY_STATUSES, default: 'AVAILABLE', index: true },
  isAvailable: { type: Boolean, default: true, index: true },
  activeApplicationCount: { type: Number, min: 0, default: 0 },
  currentTenancyId: { ...objectId('Tenancy'), index: true },
  currentTenantId: { ...objectId('User'), index: true },
  legacySpaceId: { ...objectId('PropertySpace'), index: true },
  disabledAt: Date,
  archivedAt: Date,
  statusHistory: { type: [RentalUnitStatusHistorySchema], default: [] },
  createdBy: objectId('User'),
  updatedBy: objectId('User'),
}, timestamps);

RentalUnitSchema.pre('validate', function normalizeRoom() {
  this.roomNumber = String(this.roomNumber || '').trim();
  this.roomNumberKey = this.roomNumber.toLocaleLowerCase('en-IN');
  this.name = String(this.name || this.roomNumber || '').trim();
  this.isAvailable = PUBLIC_RENTAL_UNIT_STATUSES.includes(this.availabilityStatus);
});
RentalUnitSchema.index({ property: 1, roomNumberKey: 1 }, { unique: true, name: 'rental_unit_property_room_unique' });
RentalUnitSchema.index({ property: 1, floor: 1, availabilityStatus: 1, roomNumberKey: 1 }, { name: 'rental_unit_property_floor_status' });
RentalUnitSchema.index({ visibility: 1, publicationStatus: 1, availabilityStatus: 1, isAvailable: 1, 'pricing.monthlyRent': 1 }, { name: 'rental_unit_public_marketplace' });
RentalUnitSchema.index({ landlord: 1, availabilityStatus: 1, updatedAt: -1 }, { name: 'rental_unit_landlord_status' });

const RentCycleSchema = new Schema({
  tenancy: { ...objectId('Tenancy', true), index: true },
  property: { ...objectId('Property', true), index: true },
  rentalUnit: { ...objectId('RentalUnit', true), index: true },
  landlord: { ...objectId('User', true), index: true },
  tenant: { ...objectId('User', true), index: true },
  cycleMonth: { type: String, required: true, match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Cycle month must use YYYY-MM'], index: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  dueAt: { type: Date, required: true, index: true },
  invoice: { ...objectId('RentalInvoice'), index: true },
  amount: { type: Number, min: 0, default: 0 },
  paidAmount: { type: Number, min: 0, default: 0 },
  outstandingAmount: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ['upcoming', 'pending', 'partial', 'paid', 'overdue', 'waived', 'cancelled'], default: 'pending', index: true },
  closedAt: Date,
  createdBy: objectId('User'),
  updatedBy: objectId('User'),
}, timestamps);
RentCycleSchema.index({ tenancy: 1, cycleMonth: 1 }, { unique: true, name: 'rent_cycle_tenancy_month_unique' });
RentCycleSchema.index({ rentalUnit: 1, cycleMonth: -1 }, { name: 'rent_cycle_unit_month' });
RentCycleSchema.index({ landlord: 1, status: 1, dueAt: 1 }, { name: 'rent_cycle_landlord_due' });

export const PropertyFloor = models.PropertyFloor || model('PropertyFloor', PropertyFloorSchema);
export const RentalUnit = models.RentalUnit || model('RentalUnit', RentalUnitSchema);
export const RentCycle = models.RentCycle || model('RentCycle', RentCycleSchema);
