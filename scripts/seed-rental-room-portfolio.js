import 'dotenv/config';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { AuditLog, Property, RentalUnit, User } from '../server/src/models/index.js';

export const ROOM_SEED_VERSION = 'global-rental-room-portfolio-v1';
export const DEFAULT_ROOM_TARGET_EMAIL = 'landlord@secureasset.in';

const ROOM_IMAGE_IDS = [
  'photo-1616594039964-ae9021a400a0', 'photo-1616486338812-3dadae4b4ace',
  'photo-1600210492486-724fe5c67fb0', 'photo-1600566753086-00f18fb6b3ea',
  'photo-1600607688969-a5bfcd646154', 'photo-1600566753190-17f0baa2a6c3',
  'photo-1615874694520-474822394e73', 'photo-1600573472592-401b489a3cdc',
  'photo-1600607687644-c7171b42498f', 'photo-1600566752355-35792bedcfea',
  'photo-1600210491892-03d54c0aaf87', 'photo-1600573472556-e636c2acda88',
  'photo-1600585154526-990dced4db0d', 'photo-1600585154363-67eb9e2e2099',
  'photo-1600563438938-a9a27216b4f5', 'photo-1600566752229-250ed79470a1',
  'photo-1600566753051-f0b89df2dd90', 'photo-1484154218962-a197022b5858',
  'photo-1600607687920-4e2a09cf159d', 'photo-1617104678098-de229db51175',
  'photo-1616137466211-f939a420be84', 'photo-1615529162924-f8605388461d',
  'photo-1618221195710-dd6b41faaea6', 'photo-1617806118233-18e1de247200',
];

const imageUrl = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1800&q=88`;
const idFor = (...parts) => createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 24);
const propertyId = (property) => String(property?._id?.$oid || property?._id || '');
const objectId = (value) => new mongoose.Types.ObjectId(String(value));

export const ROOM_TEMPLATES = Object.freeze([
  { name: 'Executive Studio', category: 'studio', type: 'studio', bhk: 'Studio', size: 285, carpet: 245, occupants: 2, bathrooms: 1, bathAccess: 'attached', toilets: 1, toiletAccess: 'attached', kitchen: true, kitchenAccess: 'private', drawing: false, living: true, dining: false, balcony: false, furnishing: 'fully_furnished', ac: 'ac', orientation: 'East', rentFactor: .58, stay: 3, occupancy: ['Working professionals', 'Couples'] },
  { name: 'Garden View Suite', category: 'suite', type: 'private_room', bhk: 'Private suite', size: 340, carpet: 295, occupants: 2, bathrooms: 1, bathAccess: 'attached', toilets: 1, toiletAccess: 'attached', kitchen: false, kitchenAccess: 'shared', drawing: false, living: true, dining: false, balcony: true, furnishing: 'fully_furnished', ac: 'ac', orientation: 'North-East', rentFactor: .68, stay: 6, occupancy: ['Working professionals', 'Couples'] },
  { name: 'Deluxe Ensuite', category: 'ensuite', type: 'private_room', bhk: 'Ensuite room', size: 265, carpet: 225, occupants: 2, bathrooms: 1, bathAccess: 'attached', toilets: 1, toiletAccess: 'attached', kitchen: false, kitchenAccess: 'shared', drawing: false, living: false, dining: false, balcony: false, furnishing: 'fully_furnished', ac: 'ac', orientation: 'South-East', rentFactor: .54, stay: 3, occupancy: ['Professionals', 'Students'] },
  { name: 'Twin Comfort Room', category: 'shared_room', type: 'twin_share', bhk: 'Twin-sharing room', size: 300, carpet: 255, occupants: 2, bathrooms: 1, bathAccess: 'shared', toilets: 1, toiletAccess: 'shared', kitchen: false, kitchenAccess: 'shared', drawing: false, living: false, dining: true, balcony: false, furnishing: 'semi_furnished', ac: 'non_ac', orientation: 'West', rentFactor: .42, stay: 2, occupancy: ['Students', 'Working professionals'] },
  { name: 'Balcony Queen Room', category: 'room', type: 'private_room', bhk: 'Private queen room', size: 310, carpet: 268, occupants: 2, bathrooms: 1, bathAccess: 'attached', toilets: 1, toiletAccess: 'attached', kitchen: false, kitchenAccess: 'shared', drawing: false, living: false, dining: false, balcony: true, furnishing: 'fully_furnished', ac: 'ac', orientation: 'North', rentFactor: .62, stay: 4, occupancy: ['Professionals', 'Couples'] },
  { name: 'Compact Smart Room', category: 'room', type: 'private_room', bhk: 'Compact private room', size: 185, carpet: 158, occupants: 1, bathrooms: 1, bathAccess: 'shared', toilets: 1, toiletAccess: 'shared', kitchen: false, kitchenAccess: 'shared', drawing: false, living: false, dining: false, balcony: false, furnishing: 'semi_furnished', ac: 'non_ac', orientation: 'South', rentFactor: .36, stay: 1, occupancy: ['Students', 'Single professionals'] },
  { name: 'Premium King Suite', category: 'suite', type: 'private_room', bhk: 'King suite', size: 395, carpet: 342, occupants: 2, bathrooms: 1, bathAccess: 'attached', toilets: 1, toiletAccess: 'attached', kitchen: true, kitchenAccess: 'private', drawing: true, living: true, dining: true, balcony: true, furnishing: 'fully_furnished', ac: 'ac', orientation: 'North-West', rentFactor: .82, stay: 6, occupancy: ['Senior professionals', 'Couples'] },
  { name: 'Family Flex Room', category: 'family_room', type: 'family_room', bhk: 'Family room', size: 410, carpet: 352, occupants: 4, bathrooms: 2, bathAccess: 'attached', toilets: 2, toiletAccess: 'attached', kitchen: true, kitchenAccess: 'private', drawing: false, living: true, dining: true, balcony: true, furnishing: 'fully_furnished', ac: 'ac', orientation: 'East', rentFactor: .86, stay: 9, occupancy: ['Families', 'Couples with children'] },
  { name: 'Co-living Private Room', category: 'co_living', type: 'private_room', bhk: 'Co-living private room', size: 230, carpet: 198, occupants: 1, bathrooms: 1, bathAccess: 'shared', toilets: 1, toiletAccess: 'shared', kitchen: false, kitchenAccess: 'shared', drawing: false, living: true, dining: true, balcony: false, furnishing: 'fully_furnished', ac: 'ac', orientation: 'South-West', rentFactor: .45, stay: 2, occupancy: ['Students', 'Remote workers', 'Single professionals'] },
  { name: 'Skyline Penthouse Room', category: 'penthouse_suite', type: 'private_room', bhk: 'Penthouse private suite', size: 375, carpet: 325, occupants: 2, bathrooms: 1, bathAccess: 'attached', toilets: 1, toiletAccess: 'attached', kitchen: true, kitchenAccess: 'private', drawing: true, living: true, dining: true, balcony: true, furnishing: 'fully_furnished', ac: 'ac', orientation: 'North', rentFactor: .9, stay: 6, occupancy: ['Executives', 'Couples'] },
]);

const GALLERY_CATEGORIES = ['bedroom', 'bathroom', 'kitchen', 'living_room', 'furniture', 'balcony'];

function galleryFor(propertyIndex, roomIndex, roomId, roomName, now) {
  return GALLERY_CATEGORIES.map((category, imageIndex) => {
    const imageNumber = (propertyIndex * 7 + roomIndex * 3 + imageIndex) % ROOM_IMAGE_IDS.length;
    const label = category.replaceAll('_', ' ');
    return {
      _id: objectId(idFor(ROOM_SEED_VERSION, roomId, category, imageIndex)),
      url: imageUrl(ROOM_IMAGE_IDS[imageNumber]),
      name: `${roomName} ${label}`,
      category,
      caption: `${roomName} — ${label}`,
      description: `High-resolution view of the ${label} and its included finishes, fixtures and furnishings.`,
      sortOrder: imageIndex,
      uploadedAt: now,
    };
  });
}

export function buildRentalUnits(properties, landlordId, now = new Date()) {
  const rentProperties = properties.filter((property) => String(property.purpose || property.listingType).toLowerCase() === 'rent');
  if (rentProperties.length !== 20) throw new Error(`Expected 20 rent properties, found ${rentProperties.length}`);
  return rentProperties.flatMap((property, propertyIndex) => ROOM_TEMPLATES.map((template, roomIndex) => {
    const parentId = propertyId(property);
    if (!/^[a-f\d]{24}$/i.test(parentId)) throw new Error(`Invalid property id for ${property.title || property.code}`);
    const roomNumber = `${String(propertyIndex + 1).padStart(2, '0')}-${String(roomIndex + 1).padStart(2, '0')}`;
    const roomId = idFor(ROOM_SEED_VERSION, parentId, roomNumber);
    const baseRent = Number(property.pricing?.monthlyRent || property.rentalSummary?.startingMonthlyRent || 30000);
    const monthlyRent = Math.max(6000, Math.round((baseRent * template.rentFactor + roomIndex * 375) / 250) * 250);
    const gallery = galleryFor(propertyIndex, roomIndex, roomId, template.name, now);
    const maintenanceCharge = 1200 + roomIndex * 150;
    return {
      _id: objectId(roomId),
      property: objectId(parentId),
      landlord: objectId(landlordId),
      roomNumber,
      roomNumberKey: roomNumber.toLocaleLowerCase('en-IN'),
      name: `${template.name} ${roomNumber}`,
      referenceNumber: `RU-${String(property.code || parentId).slice(-14)}-${String(roomIndex + 1).padStart(2, '0')}`.toUpperCase().slice(0, 80),
      specifications: {
        roomCategory: template.category,
        roomType: template.type,
        bhkConfiguration: template.bhk,
        bedroomCount: 1,
        bathroomCount: template.bathrooms,
        bathroomAccess: template.bathAccess,
        toiletCount: template.toilets,
        toiletAccess: template.toiletAccess,
        kitchenAvailable: template.kitchen,
        kitchenAccess: template.kitchenAccess,
        drawingRoom: template.drawing,
        livingRoom: template.living,
        diningHall: template.dining,
        balcony: template.balcony,
        furnishingStatus: template.furnishing,
        airConditioning: template.ac,
        liftAccess: property.liftAvailable !== false,
        roomSize: { value: template.size + propertyIndex * 2, unit: 'sqft' },
        carpetArea: { value: template.carpet + propertyIndex * 2, unit: 'sqft' },
        maximumOccupants: template.occupants,
        preferredOccupancy: template.occupancy,
        orientation: template.orientation,
        electricityArrangement: 'Dedicated metered supply with backup for essential points',
        waterArrangement: 'Continuous supply with building-level backup storage',
        internetWifi: true,
        parkingEligibility: roomIndex >= 4,
        otherAmenities: ['Digital door lock', 'Wardrobe storage', 'Study desk', 'Blackout curtains', 'Housekeeping-ready', 'Fire-safety equipment'],
      },
      amenities: ['High-speed Wi-Fi', '24/7 security', 'Power backup', 'Housekeeping support', 'Laundry access', 'CCTV common areas', 'Water backup', template.ac === 'ac' ? 'Air conditioning' : 'Ceiling fan'],
      primaryImage: {
        ...gallery[0],
        _id: objectId(idFor(ROOM_SEED_VERSION, roomId, 'primary')),
        name: `${template.name} primary image`,
        caption: `${template.name} at ${property.title}`,
        description: `Primary listing image for ${template.name} ${roomNumber} at ${property.title}.`,
        sortOrder: 0,
      },
      gallery,
      pricing: {
        currency: 'INR',
        monthlyRent,
        securityDeposit: monthlyRent * 2,
        maintenanceCharge,
        maintenanceFrequency: 'monthly',
        electricity: 'metered',
        electricityFixedAmount: 0,
        water: 'included',
        waterFixedAmount: 0,
        bookingAmount: Math.round(monthlyRent * .2 / 100) * 100,
        minimumStayMonths: template.stay,
        availableFrom: new Date(now.getTime() + roomIndex * 86400000),
        additionalCharges: [
          { label: 'Move-in cleaning', amount: 900 + roomIndex * 50, recurring: false },
          { label: 'Community services', amount: 600 + roomIndex * 75, recurring: true },
        ],
      },
      visibility: 'public',
      publicationStatus: 'published',
      availabilityStatus: 'AVAILABLE',
      isAvailable: true,
      activeApplicationCount: 0,
      statusHistory: [{ to: 'AVAILABLE', reason: `Created by ${ROOM_SEED_VERSION}`, changedBy: objectId(landlordId), changedAt: now }],
      createdBy: objectId(landlordId),
      updatedBy: objectId(landlordId),
      createdAt: now,
      updatedAt: now,
      __v: 0,
    };
  }));
}

function validateUnits(units) {
  if (units.length !== 200) throw new Error(`Expected 200 rental rooms, found ${units.length}`);
  const byProperty = Map.groupBy(units, (unit) => String(unit.property));
  if (byProperty.size !== 20 || [...byProperty.values()].some((rooms) => rooms.length !== 10)) throw new Error('Every rent property must have exactly 10 rooms');
  if (units.some((unit) => unit.gallery.length !== 6 || !unit.primaryImage?.url)) throw new Error('Every room must have a primary image and six-image gallery');
  return byProperty;
}

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(mongoUri);
  try {
    const email = String(process.env.TARGET_EMAIL || DEFAULT_ROOM_TARGET_EMAIL).trim().toLowerCase();
    const user = await User.findOne({ email }).lean();
    if (!user) throw new Error(`User not found: ${email}`);
    const properties = await Property.find({ owner: user._id, purpose: 'rent', deletedAt: null }).sort({ code: 1 }).lean();
    const now = new Date();
    const units = buildRentalUnits(properties, user._id, now);
    validateUnits(units);
    await RentalUnit.bulkWrite(units.map((unit) => ({
      replaceOne: { filter: { _id: unit._id }, replacement: unit, upsert: true },
    })), { ordered: false });
    for (const property of properties) {
      const propertyUnits = units.filter((unit) => String(unit.property) === String(property._id));
      await Property.updateOne({ _id: property._id }, { $set: {
        totalUnits: 10,
        occupiedUnits: 0,
        status: 'available',
        'rentalSummary.totalUnits': 10,
        'rentalSummary.availableUnits': 10,
        'rentalSummary.occupiedUnits': 0,
        'rentalSummary.startingMonthlyRent': Math.min(...propertyUnits.map((unit) => unit.pricing.monthlyRent)),
        'rentalSummary.lastSyncedAt': now,
        updatedBy: user._id,
        updatedAt: now,
      } });
    }
    await AuditLog.create({
      user: user._id, role: 'system', action: 'seed_global_rental_rooms', module: 'rental-units',
      updatedValue: { seedVersion: ROOM_SEED_VERSION, targetEmail: email, rooms: 200, roomsPerProperty: 10, galleryImages: 1200 },
    });
    console.log(JSON.stringify({ email, properties: properties.length, rooms: units.length, galleryImages: units.length * 6 }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run().catch((error) => { console.error(error); process.exitCode = 1; });
