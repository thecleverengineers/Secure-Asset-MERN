import 'dotenv/config';
import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { AuditLog, Property, PropertyMedia, Subscription, User } from '../server/src/models/index.js';
import { ensureLandlordPlans } from '../server/src/services/landlordSubscription.js';

export const SEED_VERSION = 'global-landlord-portfolio-v1';
export const DEFAULT_TARGET_EMAIL = 'landlord@secureasset.in';

const IMAGE_IDS = [
  'photo-1600585154340-be6161a56a0c', 'photo-1564013799919-ab600027ffc6',
  'photo-1570129477492-45c003edd2be', 'photo-1512917774080-9991f1c4c750',
  'photo-1600566753190-17f0baa2a6c3', 'photo-1600607687939-ce8a6c25118c',
  'photo-1600566753086-00f18fb6b3ea', 'photo-1600573472592-401b489a3cdc',
  'photo-1600607687920-4e2a09cf159d', 'photo-1600607688969-a5bfcd646154',
  'photo-1600210492486-724fe5c67fb0', 'photo-1600566753051-f0b89df2dd90',
  'photo-1600585152915-d208bec867a1', 'photo-1484154218962-a197022b5858',
  'photo-1615874694520-474822394e73', 'photo-1616486338812-3dadae4b4ace',
  'photo-1600607687644-c7171b42498f', 'photo-1600566752355-35792bedcfea',
  'photo-1600210491892-03d54c0aaf87', 'photo-1600573472556-e636c2acda88',
  'photo-1600585154526-990dced4db0d', 'photo-1600585154363-67eb9e2e2099',
  'photo-1600563438938-a9a27216b4f5', 'photo-1600566752229-250ed79470a1',
];

const imageUrl = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1800&q=86`;

const location = (key, country, state, city, locality, latitude, longitude, postalCode) => ({
  key, country, state, city, locality, latitude, longitude, postalCode,
});

export const PORTFOLIO_LOCATIONS = {
  rent: [
    location('IND-MUM', 'India', 'Maharashtra', 'Mumbai', 'Bandra West', 19.0596, 72.8295, '400050'),
    location('IND-BLR', 'India', 'Karnataka', 'Bengaluru', 'Indiranagar', 12.9784, 77.6408, '560038'),
    location('IND-GOA', 'India', 'Goa', 'Panaji', 'Dona Paula', 15.4589, 73.8056, '403004'),
    location('IND-DEL', 'India', 'Delhi', 'New Delhi', 'Greater Kailash', 28.5494, 77.2425, '110048'),
    location('USA-AUS', 'USA', 'Texas', 'Austin', 'Downtown Austin', 30.2672, -97.7431, '78701'),
    location('USA-MIA', 'USA', 'Florida', 'Miami', 'Brickell', 25.7617, -80.1918, '33131'),
    location('USA-SEA', 'USA', 'Washington', 'Seattle', 'South Lake Union', 47.6253, -122.3361, '98109'),
    location('USA-SD', 'USA', 'California', 'San Diego', 'La Jolla', 32.8328, -117.2713, '92037'),
    location('CHN-SHA', 'China', 'Shanghai', 'Shanghai', 'Pudong', 31.2304, 121.4737, '200120'),
    location('CHN-BEI', 'China', 'Beijing', 'Beijing', 'Chaoyang', 39.9219, 116.4436, '100020'),
    location('CHN-SZX', 'China', 'Guangdong', 'Shenzhen', 'Nanshan', 22.5333, 113.9304, '518052'),
    location('CHN-HGH', 'China', 'Zhejiang', 'Hangzhou', 'Xihu', 30.2590, 120.1303, '310007'),
    location('RUS-MOW', 'Russia', 'Moscow', 'Moscow', 'Presnensky', 55.7558, 37.6173, '123100'),
    location('RUS-LED', 'Russia', 'Saint Petersburg', 'Saint Petersburg', 'Petrogradsky', 59.9607, 30.3026, '197101'),
    location('RUS-AER', 'Russia', 'Krasnodar Krai', 'Sochi', 'Svetlana', 43.5855, 39.7231, '354000'),
    location('RUS-KZN', 'Russia', 'Tatarstan', 'Kazan', 'Vakhitovsky', 55.7963, 49.1088, '420111'),
    location('FRA-PAR1', 'France', 'Ile-de-France', 'Paris', '1st Arrondissement', 48.8647, 2.3319, '75001'),
    location('FRA-PAR7', 'France', 'Ile-de-France', 'Paris', '7th Arrondissement', 48.8566, 2.3126, '75007'),
    location('FRA-PAR8', 'France', 'Ile-de-France', 'Paris', '8th Arrondissement', 48.8738, 2.2950, '75008'),
    location('FRA-PAR16', 'France', 'Ile-de-France', 'Paris', '16th Arrondissement', 48.8637, 2.2769, '75016'),
  ],
  lease: [
    location('TUR-IST', 'Turkey', 'Istanbul', 'Istanbul', 'Besiktas', 41.0430, 29.0094, '34349'),
    location('TUR-AYT', 'Turkey', 'Antalya', 'Antalya', 'Lara', 36.8529, 30.7700, '07230'),
    location('TUR-IZM', 'Turkey', 'Izmir', 'Izmir', 'Alsancak', 38.4370, 27.1441, '35220'),
    location('TUR-BJV', 'Turkey', 'Mugla', 'Bodrum', 'Yalikavak', 37.1052, 27.2970, '48990'),
    location('AUS-SYD', 'Australia', 'New South Wales', 'Sydney', 'Darling Harbour', -33.8749, 151.2008, '2000'),
    location('AUS-MEL', 'Australia', 'Victoria', 'Melbourne', 'Southbank', -37.8252, 144.9641, '3006'),
    location('AUS-BNE', 'Australia', 'Queensland', 'Brisbane', 'New Farm', -27.4679, 153.0500, '4005'),
    location('AUS-PER', 'Australia', 'Western Australia', 'Perth', 'Elizabeth Quay', -31.9566, 115.8561, '6000'),
    location('THA-BKK', 'Thailand', 'Bangkok', 'Bangkok', 'Sukhumvit', 13.7304, 100.5697, '10110'),
    location('THA-HKT', 'Thailand', 'Phuket', 'Phuket', 'Kamala', 7.9499, 98.2836, '83150'),
    location('THA-CNX', 'Thailand', 'Chiang Mai', 'Chiang Mai', 'Nimman', 18.7961, 98.9675, '50200'),
    location('THA-PYX', 'Thailand', 'Chonburi', 'Pattaya', 'Jomtien', 12.8991, 100.8696, '20150'),
    location('USA-NYM', 'USA', 'New York', 'New York', 'Manhattan', 40.7831, -73.9712, '10024'),
    location('USA-NYB', 'USA', 'New York', 'New York', 'Brooklyn Heights', 40.6960, -73.9933, '11201'),
    location('USA-NYQ', 'USA', 'New York', 'New York', 'Long Island City', 40.7447, -73.9485, '11101'),
    location('USA-NYS', 'USA', 'New York', 'New York', 'Staten Island', 40.5795, -74.1502, '10301'),
    location('CAN-TOR', 'Canada', 'Ontario', 'Toronto', 'Yorkville', 43.6709, -79.3933, 'M5R 1C4'),
    location('CAN-YVR', 'Canada', 'British Columbia', 'Vancouver', 'Coal Harbour', 49.2901, -123.1271, 'V6G 3E7'),
    location('CAN-YUL', 'Canada', 'Quebec', 'Montreal', 'Old Montreal', 45.5075, -73.5540, 'H2Y 1C6'),
    location('CAN-YYC', 'Canada', 'Alberta', 'Calgary', 'Beltline', 51.0407, -114.0719, 'T2R 0G8'),
  ],
  sale: [
    location('IND-HYD', 'India', 'Telangana', 'Hyderabad', 'Jubilee Hills', 17.4326, 78.4071, '500033'),
    location('IND-PUN', 'India', 'Maharashtra', 'Pune', 'Koregaon Park', 18.5362, 73.8940, '411001'),
    location('IND-CCU', 'India', 'West Bengal', 'Kolkata', 'New Town', 22.5797, 88.4655, '700156'),
    location('NZL-AKL', 'New Zealand', 'Auckland', 'Auckland', 'Parnell', -36.8547, 174.7809, '1052'),
    location('NZL-WLG', 'New Zealand', 'Wellington', 'Wellington', 'Oriental Bay', -41.2906, 174.7948, '6011'),
    location('NZL-ZQN', 'New Zealand', 'Otago', 'Queenstown', 'Lake Hayes', -44.9981, 168.8127, '9371'),
    location('HKG-CEN', 'Hong Kong', 'Hong Kong Island', 'Hong Kong', 'Central', 22.2819, 114.1589, '00000'),
    location('HKG-KLN', 'Hong Kong', 'Kowloon', 'Hong Kong', 'West Kowloon', 22.3047, 114.1604, '00000'),
    location('HKG-RPB', 'Hong Kong', 'Hong Kong Island', 'Hong Kong', 'Repulse Bay', 22.2361, 114.1974, '00000'),
    location('BGR-SOF', 'Bulgaria', 'Sofia City', 'Sofia', 'Lozenets', 42.6718, 23.3290, '1164'),
    location('BGR-VAR', 'Bulgaria', 'Varna', 'Varna', 'Sea Garden', 43.2141, 27.9318, '9002'),
    location('BGR-PDV', 'Bulgaria', 'Plovdiv', 'Plovdiv', 'Old Town', 42.1507, 24.7524, '4000'),
    location('UAE-DXB', 'UAE', 'Dubai', 'Dubai', 'Dubai Marina', 25.0805, 55.1403, '00000'),
    location('UAE-AUH', 'UAE', 'Abu Dhabi', 'Abu Dhabi', 'Saadiyat Island', 24.5376, 54.4347, '00000'),
    location('UAE-SHJ', 'UAE', 'Sharjah', 'Sharjah', 'Al Majaz', 25.3292, 55.3873, '00000'),
    location('GRC-ATH', 'Greece', 'Attica', 'Athens', 'Kolonaki', 37.9783, 23.7410, '106 73'),
    location('GRC-JTR', 'Greece', 'South Aegean', 'Santorini', 'Oia', 36.4618, 25.3753, '847 02'),
    location('GRC-SKG', 'Greece', 'Central Macedonia', 'Thessaloniki', 'Waterfront', 40.6265, 22.9484, '546 21'),
    location('ENG-LON', 'England', 'Greater London', 'London', 'Kensington', 51.4991, -0.1938, 'W8 5SA'),
    location('ENG-MAN', 'England', 'Greater Manchester', 'Manchester', 'Deansgate', 53.4790, -2.2490, 'M3 4EN'),
  ],
};

const HOME_TYPES = ['Luxury apartment', 'Garden villa', 'Skyline penthouse', 'Contemporary residence'];
const AMENITY_SETS = [
  ['24/7 Security', 'Covered Parking', 'Power Backup', 'High-speed Internet', 'Fitness Centre', 'Landscaped Garden'],
  ['Swimming Pool', 'Concierge', 'Visitor Parking', 'Smart Home', 'Air Conditioning', 'Clubhouse'],
  ['Gated Community', 'CCTV', 'Lift', 'Modular Kitchen', 'Balcony', 'Pet Friendly'],
  ['Waterfront View', 'Terrace', 'Wheelchair Access', 'Community Hall', 'Jogging Track', 'Children Play Area'],
];

function galleryFor(index) {
  return Array.from({ length: 6 }, (_, offset) => imageUrl(IMAGE_IDS[(index * 4 + offset) % IMAGE_IDS.length]));
}

function seedCode(purpose, item, index) {
  return `SA-${purpose.slice(0, 1).toUpperCase()}-${item.key}-${String(index + 1).padStart(2, '0')}`;
}

function priceFor(purpose, index) {
  if (purpose === 'rent') return 45000 + (index * 7500);
  if (purpose === 'lease') return 1800000 + (index * 275000);
  return 9500000 + (index * 1650000);
}

function propertyFor(purpose, item, index) {
  const code = seedCode(purpose, item, index);
  const bedrooms = 2 + (index % 4);
  const bathrooms = Math.max(2, bedrooms - 1);
  const totalArea = 1250 + (index * 115);
  const amount = priceFor(purpose, index);
  const images = galleryFor(index + ({ rent: 0, lease: 7, sale: 13 }[purpose] || 0));
  const homeType = HOME_TYPES[index % HOME_TYPES.length];
  const title = `${item.locality} ${homeType}`;
  const slug = `${title}-${code}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
  const now = new Date();
  const monthlyRent = purpose === 'rent' ? amount : undefined;
  const leaseAmount = purpose === 'lease' ? amount : undefined;
  const salePrice = purpose === 'sale' ? amount : undefined;

  return {
    title,
    code,
    slug,
    referenceNumber: code,
    description: `${homeType} in ${item.locality}, ${item.city}. Professionally presented with generous living spaces, modern finishes, strong connectivity and a complete six-image gallery.`,
    type: homeType.includes('villa') ? 'Villa' : homeType.includes('penthouse') ? 'Penthouse' : 'Apartment',
    customType: homeType,
    customAttributes: { seedVersion: SEED_VERSION, regionKey: item.key, displayCurrency: 'INR', portfolioPurpose: purpose },
    hierarchyMode: homeType.includes('villa') ? 'simple' : 'apartment_building',
    status: 'available',
    price: purpose === 'rent' ? 0 : amount,
    listingType: purpose,
    purpose,
    isSale: purpose === 'sale',
    floorManagementEnabled: purpose === 'rent',
    liftAvailable: !homeType.includes('villa'),
    buildingSpecifications: { structure: 'Premium residential', elevators: homeType.includes('villa') ? 0 : 2, fireSafety: true, accessibility: true },
    commonFacilities: AMENITY_SETS[index % AMENITY_SETS.length],
    rulesAndRestrictions: ['Government identification required', 'Respect community quiet hours', 'Subject to standard verification'],
    rentalSummary: { totalUnits: purpose === 'rent' ? 1 : 0, availableUnits: purpose === 'rent' ? 1 : 0, occupiedUnits: 0, startingMonthlyRent: monthlyRent || 0, lastSyncedAt: now },
    visibility: 'public',
    publicationStatus: 'published',
    publishedAt: now,
    requiresActiveSubscription: true,
    bedrooms,
    bathrooms,
    area: totalArea,
    roomCounts: { rooms: bedrooms + 3, balconies: 1 + (index % 2), bathrooms, toilets: bathrooms, kitchens: 1, bedrooms, diningRooms: 1, masterBedrooms: 1, livingRooms: 1 },
    roomDetails: { totalApartments: 1, totalRooms: bedrooms + 3, bedrooms, masterBedrooms: 1, bathrooms, toilets: bathrooms, kitchens: 1, livingRooms: 1, diningRooms: 1, balconies: 1 + (index % 2), gardens: index % 3 === 0 ? 1 : 0, swimmingPools: index % 4 === 1 ? 1 : 0, parkingSpaces: 2 },
    listingDetails: { securityDeposit: purpose === 'rent' ? amount * 2 : Math.round(amount * 0.08), maintenanceCharge: 6500 + (index * 350), negotiable: true, furnishing: 'fully_furnished', parkingSpaces: 2, floor: `${2 + (index % 18)}`, totalFloors: 20, propertyAgeYears: 1 + (index % 8), availableFrom: now, possessionStatus: 'Ready to move', facing: ['North', 'East', 'South', 'West'][index % 4], petFriendly: index % 3 !== 0 },
    pricing: { salePrice, monthlyRent, leaseAmount, securityDeposit: purpose === 'rent' ? amount * 2 : Math.round(amount * 0.08), maintenanceCharge: 6500 + (index * 350), negotiable: true, pricePerUnitArea: Math.round((amount || 1) / totalArea), propertyTax: purpose === 'sale' ? Math.round(amount * 0.012) : 0, tax: 0, additionalCharges: [{ label: 'Community maintenance', amount: 6500 + (index * 350), recurring: purpose === 'rent' }] },
    areas: { unit: 'sqft', total: totalArea, carpet: Math.round(totalArea * 0.78), builtUp: Math.round(totalArea * 0.9), superBuiltUp: totalArea, plot: homeType.includes('villa') ? Math.round(totalArea * 1.35) : 0, garden: homeType.includes('villa') ? 420 : 0, parking: 240 },
    furnishing: { status: 'fully_furnished', items: ['Wardrobes', 'Modular kitchen', 'Lighting', 'Air conditioning', 'Sofa set', 'Dining set'], notes: 'Move-in ready premium furnishing package.' },
    ageDetails: { band: '0-10 years', constructionYear: 2017 + (index % 8), renovationYear: 2024 + (index % 2), availableFrom: now },
    address: { line1: `${100 + index}, ${item.locality} Residential Avenue`, line2: 'SecureAsset Global Portfolio', locality: item.locality, landmark: `${item.locality} Central District`, city: item.city, state: item.state, country: item.country, postalCode: item.postalCode },
    location: { type: 'Point', coordinates: [item.longitude, item.latitude] },
    map: { latitude: item.latitude, longitude: item.longitude, googleMapsLocation: `${item.latitude},${item.longitude}`, landmark: `${item.locality} Central District`, locality: item.locality, district: item.city, nearbyPlaces: [{ name: 'City centre', distance: '1.5 km', type: 'business' }, { name: 'International school', distance: '2.2 km', type: 'education' }, { name: 'Hospital', distance: '3 km', type: 'healthcare' }], approximateLatitude: Number((item.latitude + 0.004).toFixed(6)), approximateLongitude: Number((item.longitude + 0.004).toFixed(6)) },
    locationPrivacy: 'approximate_public',
    occupancyRules: { maxTotal: bedrooms * 2, maxAdults: bedrooms * 2, maxChildren: bedrooms, maxPerRoom: 2, familyAllowed: true, bachelorsAllowed: true, studentsAllowed: purpose === 'rent', professionalsAllowed: true, sharedOccupancyAllowed: purpose === 'rent', petsAllowed: index % 3 !== 0, additionalOccupantsRequireApproval: true },
    specifications: { bedrooms, bathrooms, balconies: 1 + (index % 2), rooms: bedrooms + 3, numberOfFloors: 20, floorNumber: 2 + (index % 18), totalFloorsInBuilding: 20, facing: ['North', 'East', 'South', 'West'][index % 4], propertyAge: 1 + (index % 8), furnishingStatus: 'fully_furnished', ownershipType: 'Freehold', availableFrom: now, kitchenAttached: true, areaUnit: 'sqft', builtUpAreaSqft: Math.round(totalArea * 0.9), builtUpAreaSqm: Number((totalArea * 0.08361).toFixed(2)), carpetAreaSqft: Math.round(totalArea * 0.78), carpetAreaSqm: Number((totalArea * 0.07246).toFixed(2)) },
    parking: { carSpaces: 2, twoWheelerSpaces: 2, visitorParking: true },
    utilities: { waterSupply: 'Continuous municipal and backup supply', electricityConnection: 'Metered connection', powerBackup: 'Full common-area backup', internetAvailability: true, gasConnection: true, sewageConnection: true },
    amenityDetails: { lift: !homeType.includes('villa'), security: true, cctv: true, gatedCommunity: true, garden: true, swimmingPool: index % 4 === 1, gym: true, clubhouse: true, childrenPlayArea: true, joggingTrack: true, communityHall: true, terrace: true, balcony: true, airConditioning: true, modularKitchen: true, storeRoom: true, servantRoom: bedrooms >= 4, wheelchairAccess: true },
    legalDetails: { titleClear: true, loanApproved: true, occupancyCertificate: true, completionCertificate: true },
    contactInformation: { ownerName: 'SecureAsset Landlord', emailAddress: DEFAULT_TARGET_EMAIL, preferredContactMethod: 'email' },
    nearbyFacilities: { school: 'Within 2.2 km', hospital: 'Within 3 km', market: 'Within 900 m', busStop: 'Within 500 m', railwayStation: 'Within 6 km', airport: 'Within 25 km', shoppingMall: 'Within 2 km', park: 'Within 700 m', bank: 'Within 1 km', pharmacy: 'Within 800 m' },
    images,
    galleryCover: images[0],
    amenities: AMENITY_SETS[index % AMENITY_SETS.length],
    totalUnits: purpose === 'rent' ? 1 : 0,
    occupiedUnits: 0,
    isVerified: false,
    surveyVerificationStatus: 'unverified',
    isFeatured: index % 5 === 0,
    promotion: { featured: index % 5 === 0, topListing: index % 7 === 0, urgentType: purpose === 'rent' ? 'available_now' : 'none', startsAt: now },
    metrics: { views: 0, clicks: 0, enquiries: 0, applications: 0, siteVisits: 0, conversions: 0 },
    deletedAt: null,
  };
}

export function buildPortfolio() {
  return Object.entries(PORTFOLIO_LOCATIONS).flatMap(([purpose, locations]) => locations.map((item, index) => propertyFor(purpose, item, index)));
}

function validatePortfolio(properties) {
  const expected = { rent: 20, lease: 20, sale: 20 };
  const counts = properties.reduce((acc, property) => ({ ...acc, [property.purpose]: (acc[property.purpose] || 0) + 1 }), {});
  for (const [purpose, count] of Object.entries(expected)) {
    if (counts[purpose] !== count) throw new Error(`Expected ${count} ${purpose} listings, found ${counts[purpose] || 0}`);
  }
  if (new Set(properties.map((property) => property.code)).size !== 60) throw new Error('Portfolio property codes must be unique');
  if (properties.some((property) => property.images.length !== 6)) throw new Error('Every seeded property must have six gallery images');
  return counts;
}

async function activateEnterpriseSubscription(user, now) {
  const plans = await ensureLandlordPlans();
  const plan = plans.find((candidate) => candidate.key === 'enterprise');
  if (!plan) throw new Error('The Enterprise landlord plan is not available');
  const expiresAt = new Date(now);
  expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
  const limits = {
    ...plan.limits,
    rentAutomation: true,
    advancedReports: true,
    promotions: true,
    apiAccess: true,
  };
  let subscription = await Subscription.findOne({ user: user._id, status: 'active' }).sort({ expiresAt: -1, createdAt: -1 });
  if (!subscription) subscription = new Subscription({ user: user._id, plan: plan.key, amount: 0, currency: plan.prices?.currency || 'INR', createdBy: user._id });
  subscription.set({
    plan: plan.key,
    billingCycle: 'yearly',
    amount: 0,
    currency: plan.prices?.currency || 'INR',
    status: 'active',
    startsAt: now,
    expiresAt,
    nextRenewalAt: expiresAt,
    limits,
    payment: { method: 'administrative_activation', transactionId: `${SEED_VERSION}-${user._id}`, gateway: 'system', paidAt: now, metadata: { reason: 'Requested global demo portfolio' } },
    updatedBy: user._id,
  });
  await subscription.save();
  await User.updateOne({ _id: user._id }, { $set: { status: 'active', landlordEnabled: true, landlordSubscriptionExpiresAt: expiresAt, landlordPlan: plan.key, activeMode: 'landlord' } });
  return subscription;
}

async function upsertProperties(user, properties) {
  const operations = properties.map((property) => ({
    updateOne: {
      filter: { owner: user._id, code: property.code },
      update: { $set: { ...property, owner: user._id, createdBy: user._id, updatedBy: user._id } },
      upsert: true,
    },
  }));
  await Property.bulkWrite(operations, { ordered: true });
  const codes = properties.map((property) => property.code);
  return Property.find({ owner: user._id, code: { $in: codes } }).select('_id code title images').lean();
}

async function upsertGalleryMedia(user, storedProperties) {
  const operations = storedProperties.flatMap((property) => property.images.map((url, index) => ({
    updateOne: {
      filter: { property: property._id, owner: user._id, url },
      update: { $set: { property: property._id, owner: user._id, category: 'property', mediaType: 'image', url, thumbnailUrl: url, caption: `${property.title} — gallery image ${index + 1}`, altText: `${property.title} property image ${index + 1}`, sortOrder: index, cover: index === 0, visibility: 'public', watermark: { enabled: false }, compressed: true, uploadedBy: user._id, deletedAt: null } },
      upsert: true,
    },
  })));
  if (operations.length) await PropertyMedia.bulkWrite(operations, { ordered: false });
  return operations.length;
}

async function verifySeed(user, codes) {
  const propertyCounts = await Property.aggregate([
    { $match: { owner: user._id, code: { $in: codes }, visibility: 'public', publicationStatus: 'published', deletedAt: null } },
    { $group: { _id: '$purpose', count: { $sum: 1 } } },
  ]);
  const properties = await Property.find({ owner: user._id, code: { $in: codes } }).select('_id').lean();
  const mediaCount = await PropertyMedia.countDocuments({ property: { $in: properties.map((property) => property._id) }, owner: user._id, mediaType: 'image', visibility: 'public', deletedAt: null });
  const subscription = await Subscription.findOne({ user: user._id, status: 'active', expiresAt: { $gt: new Date() } }).sort({ expiresAt: -1 }).lean();
  const counts = Object.fromEntries(propertyCounts.map((entry) => [entry._id, entry.count]));
  if (counts.rent !== 20 || counts.lease !== 20 || counts.sale !== 20) throw new Error(`Seed verification failed: ${JSON.stringify(counts)}`);
  if (mediaCount < 360) throw new Error(`Seed verification failed: expected at least 360 public gallery images, found ${mediaCount}`);
  if (!subscription || subscription.plan !== 'enterprise') throw new Error('Seed verification failed: Enterprise landlord subscription is not active');
  return { properties: counts, galleryImages: mediaCount, subscription: { plan: subscription.plan, status: subscription.status, expiresAt: subscription.expiresAt } };
}

export async function runSeed() {
  const properties = buildPortfolio();
  const counts = validatePortfolio(properties);
  if (process.env.DRY_RUN === '1') {
    console.log(JSON.stringify({ dryRun: true, targetEmail: process.env.TARGET_LANDLORD_EMAIL || DEFAULT_TARGET_EMAIL, counts, galleryImages: properties.reduce((sum, property) => sum + property.images.length, 0), countries: [...new Set(properties.map((property) => property.address.country))] }, null, 2));
    return;
  }

  if (process.env.CONFIRM_SEED !== 'YES') throw new Error('Set CONFIRM_SEED=YES to activate the subscription and seed the live portfolio');
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is required');
  const targetEmail = String(process.env.TARGET_LANDLORD_EMAIL || DEFAULT_TARGET_EMAIL).trim().toLowerCase();

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  try {
    const user = await User.findOne({ email: targetEmail });
    if (!user) throw new Error(`User not found: ${targetEmail}`);
    const now = new Date();
    await activateEnterpriseSubscription(user, now);
    const storedProperties = await upsertProperties(user, properties);
    const galleryImages = await upsertGalleryMedia(user, storedProperties);
    await AuditLog.create({ user: user._id, role: 'system', action: 'seed_global_landlord_portfolio', module: 'properties', updatedValue: { seedVersion: SEED_VERSION, targetEmail, counts, galleryImages } });
    const verification = await verifySeed(user, properties.map((property) => property.code));
    console.log(JSON.stringify({ success: true, targetEmail, ...verification }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) runSeed().catch(async (error) => {
  console.error(`Global landlord portfolio seed failed: ${error.message}`);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
