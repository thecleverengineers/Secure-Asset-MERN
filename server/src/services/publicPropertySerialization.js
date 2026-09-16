function asObject(value) {
  if (!value) return {};
  if (typeof value.toObject === 'function') return value.toObject();
  return { ...value };
}

export function publicPropertySlug(value) {
  return String(value || 'property')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'property';
}

function publicOwner(owner) {
  if (!owner) return null;
  if (typeof owner === 'string') return null;
  const value = asObject(owner);
  return {
    _id: value._id,
    name: value.name,
    avatar: value.avatar || null,
    verified: value.kycStatus === 'verified',
    trusted: value.kycStatus === 'verified' && Boolean(value.landlordEnabled),
  };
}

export function publicLocation(property) {
  const privacy = property.locationPrivacy || 'approximate_public';
  const address = property.address || {};
  const map = property.map || {};
  const baseAddress = {
    locality: address.locality || map.locality || undefined,
    landmark: address.landmark || map.landmark || undefined,
    city: address.city || undefined,
    district: map.district || undefined,
    state: address.state || undefined,
    country: address.country || 'India',
  };

  if (privacy === 'exact_public') {
    const latitude = Number.isFinite(Number(map.latitude)) ? Number(map.latitude) : property.location?.coordinates?.[1];
    const longitude = Number.isFinite(Number(map.longitude)) ? Number(map.longitude) : property.location?.coordinates?.[0];
    return {
      privacy,
      address: { ...address },
      map: {
        latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : undefined,
        longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : undefined,
        landmark: map.landmark || undefined,
        locality: map.locality || undefined,
        district: map.district || undefined,
        nearbyPlaces: Array.isArray(map.nearbyPlaces) ? map.nearbyPlaces : [], googleMapsLocation: map.googleMapsLocation || undefined,
      },
    };
  }

  if (privacy === 'approximate_public') {
    const rawLat = map.approximateLatitude ?? map.latitude ?? property.location?.coordinates?.[1];
    const rawLng = map.approximateLongitude ?? map.longitude ?? property.location?.coordinates?.[0];
    const latitude = Number.isFinite(Number(rawLat)) ? Math.round(Number(rawLat) * 100) / 100 : undefined;
    const longitude = Number.isFinite(Number(rawLng)) ? Math.round(Number(rawLng) * 100) / 100 : undefined;
    return {
      privacy,
      address: baseAddress,
      map: { latitude, longitude, landmark: map.landmark || undefined, locality: map.locality || undefined, district: map.district || undefined },
    };
  }

  return { privacy, address: baseAddress, map: { locality: map.locality || undefined, district: map.district || undefined } };
}

function toSqm(value) { return Number.isFinite(Number(value)) ? Math.round(Number(value) * 0.092903 * 100) / 100 : undefined; }
function toSqft(value) { return Number.isFinite(Number(value)) ? Math.round(Number(value) * 10.7639 * 100) / 100 : undefined; }

function serializePublicRentalUnitImage(input, rentalUnitId) {
  const image = asObject(input);
  const file = asObject(image.file);
  const fileId = file._id || image.file;
  const publicUrl = /^[a-f\d]{24}$/i.test(String(fileId || ''))
    ? `/api/v1/public/rental-units/${rentalUnitId}/images/${fileId}/content`
    : image.url || '';
  const { file: _file, ...safeImage } = image;
  return { ...safeImage, url: publicUrl };
}

export function serializePublicProperty(input) {
  const doc = asObject(input);
  const location = publicLocation(doc);
  const listingType = doc.purpose || doc.listingType || 'rent';
  const price = Number(listingType === 'rent'
    ? doc.rentalSummary?.startingMonthlyRent || 0
    : doc.pricing?.salePrice || doc.pricing?.leaseAmount || doc.price || 0);
  return {
    _id: doc._id,
    slug: doc.slug || publicPropertySlug(doc.title),
    listingKind: 'property',
    propertyId: doc._id,
    spaceId: null,
    title: doc.title,
    code: doc.code,
    referenceNumber: doc.referenceNumber,
    description: doc.description || '',
    type: doc.type,
    customType: doc.customType,
    customAttributes: doc.customAttributes || {},
    hierarchyMode: doc.hierarchyMode,
    status: doc.status,
    purpose: listingType,
    listingType,
    isSale: (doc.purpose || doc.listingType) === 'sale',
    price,
    startingMonthlyRent: listingType === 'rent' ? price : undefined,
    availableRoomCount: Number(doc.rentalSummary?.availableUnits || 0),
    rentalSummary: doc.rentalSummary || {},
    pricing: doc.pricing || {},
    areas: { ...(doc.areas || {}), builtUpSqft: doc.areas?.builtUp ?? doc.specifications?.builtUpAreaSqft, builtUpSqm: doc.specifications?.builtUpAreaSqm ?? toSqm(doc.areas?.builtUp), carpetSqft: doc.areas?.carpet ?? doc.specifications?.carpetAreaSqft, carpetSqm: doc.specifications?.carpetAreaSqm ?? toSqm(doc.areas?.carpet) },
    area: Number(doc.areas?.total || doc.area || 0),
    areaUnit: doc.areas?.unit || 'sqft',
    roomDetails: doc.roomDetails || {},
    roomCounts: doc.roomCounts || {},
    bedrooms: doc.roomDetails?.bedrooms ?? doc.roomCounts?.bedrooms ?? doc.bedrooms ?? null,
    bathrooms: doc.roomDetails?.bathrooms ?? doc.roomCounts?.bathrooms ?? doc.bathrooms ?? null,
    furnishing: doc.furnishing || doc.listingDetails?.furnishing || null,
    ageDetails: doc.ageDetails || {},
    listingDetails: doc.listingDetails || {},
    specifications: doc.specifications || {},
    parking: doc.parking || {},
    utilities: doc.utilities || {},
    amenityDetails: doc.amenityDetails || {},
    legalDetails: doc.legalDetails || {},
    nearbyFacilities: doc.nearbyFacilities || {},
    publicContact: { ownerName: doc.contactInformation?.ownerName || '', agentName: doc.contactInformation?.agentName || '', preferredContactMethod: doc.contactInformation?.preferredContactMethod || '' },
    amenities: Array.isArray(doc.amenities) ? doc.amenities : [],
    occupancyRules: doc.occupancyRules || {},
    galleryCover: doc.galleryCover || null,
    images: [doc.galleryCover, ...(Array.isArray(doc.images) ? doc.images : [])].filter(Boolean),
    visibility: 'public',
    publicationStatus: 'published',
    publishedAt: doc.publishedAt,
    promotion: doc.promotion || {},
    isFeatured: Boolean(doc.promotion?.featured || doc.isFeatured),
    urgentType: doc.promotion?.urgentType || 'none',
    isVerified: Boolean(doc.isVerified),
    owner: publicOwner(doc.owner),
    landlordId: doc.owner?._id || null,
    address: location.address,
    map: location.map,
    locationPrivacy: location.privacy,
    location: location.address?.line1 || location.address?.locality || location.address?.city || '',
    city: location.address?.city || '',
    country: location.address?.country || 'India',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function serializePublicRentalUnit(input) {
  const doc = asObject(input);
  const floor = asObject(doc.floor);
  const availabilityStatus = String(doc.availabilityStatus || 'AVAILABLE').toUpperCase();
  const canBook = ['AVAILABLE', 'APPLICATION_PENDING'].includes(availabilityStatus);
  const availabilityLabel = availabilityStatus === 'APPLICATION_PENDING'
    ? 'Application in progress'
    : canBook ? 'Available to book' : 'Locked — already booked';
  return {
    _id: doc._id,
    propertyId: doc.property?._id || doc.property,
    floor: floor?._id ? { _id: floor._id, floorName: floor.floorName, floorNumber: floor.floorNumber, floorCode: floor.floorCode } : null,
    roomNumber: doc.roomNumber,
    name: doc.name,
    specifications: doc.specifications || {},
    amenities: Array.isArray(doc.amenities) ? doc.amenities : [],
    primaryImage: doc.primaryImage ? serializePublicRentalUnitImage(doc.primaryImage, doc._id) : null,
    gallery: Array.isArray(doc.gallery) ? doc.gallery.map((image) => serializePublicRentalUnitImage(image, doc._id)) : [],
    pricing: doc.pricing || {},
    availabilityStatus,
    availabilityLabel,
    canBook,
    isLocked: !canBook,
    applicationInProgress: availabilityStatus === 'APPLICATION_PENDING',
  };
}

export function serializePublicSpace(input) {
  const doc = asObject(input);
  const property = asObject(doc.property);
  const publicProperty = serializePublicProperty(property);
  return {
    _id: doc._id,
    listingKind: 'space',
    propertyId: property._id,
    spaceId: doc._id,
    parent: doc.parent || null,
    level: doc.level,
    type: doc.level,
    name: doc.name,
    code: doc.code,
    title: `${doc.name} · ${property.title || 'Property'}`,
    description: doc.description || property.description || '',
    floorNumber: doc.floorNumber,
    sortOrder: doc.sortOrder,
    roomNumber: doc.roomNumber || doc.code || doc.name,
    apartmentNumber: doc.apartmentNumber || '',
    galleryScope: doc.galleryScope || (doc.level === 'apartment' ? 'apartment' : doc.level === 'room' ? 'room' : 'property'),
    status: doc.status,
    purpose: doc.purpose || 'rent',
    listingType: doc.purpose || 'rent',
    isSale: doc.purpose === 'sale',
    rentable: Boolean(doc.rentable),
    sellable: Boolean(doc.sellable),
    price: Number(doc.price || 0),
    securityDeposit: Number(doc.securityDeposit || 0),
    maintenanceCharge: Number(doc.maintenanceCharge || 0),
    area: Number(doc.area?.value || 0),
    areaUnit: doc.area?.unit || 'sqft',
    roomDetails: doc.roomDetails || {},
    bedrooms: doc.roomDetails?.bedrooms ?? (doc.level === 'room' ? 1 : null),
    bathrooms: doc.roomDetails?.bathrooms ?? null,
    furnishing: doc.furnishing || {},
    amenities: [...new Set([...(doc.amenities || []), ...(property.amenities || [])])],
    occupancyRules: doc.occupancyRules || {},
    availableFrom: doc.availableFrom,
    coverImage: doc.coverImage || null,
    images: [doc.coverImage, property.galleryCover, ...(property.images || [])].filter(Boolean),
    promotion: doc.promotion || {},
    isFeatured: Boolean(doc.promotion?.featured || property.promotion?.featured),
    urgentType: doc.promotion?.urgentType || property.promotion?.urgentType || 'none',
    isVerified: Boolean(property.isVerified),
    owner: publicProperty.owner,
    landlordId: publicProperty.landlordId,
    address: publicProperty.address,
    map: publicProperty.map,
    locationPrivacy: publicProperty.locationPrivacy,
    location: publicProperty.location,
    city: publicProperty.city,
    country: publicProperty.country,
    property: publicProperty,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function serializePublicMedia(input) {
  const doc = asObject(input);
  return {
    _id: doc._id,
    property: doc.property,
    space: doc.space || null,
    category: doc.category,
    mediaType: doc.mediaType,
    url: doc.url,
    thumbnailUrl: doc.thumbnailUrl || null,
    caption: doc.caption || '',
    altText: doc.altText || '',
    sortOrder: doc.sortOrder || 0,
    cover: Boolean(doc.cover),
    visibility: 'public',
    watermark: doc.watermark?.enabled ? { enabled: true, text: doc.watermark.text || '' } : { enabled: false },
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
