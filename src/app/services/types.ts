export type ObjectId = string;
export type UserRole = 'admin' | 'manager' | 'landlord' | 'tenant' | 'user' | 'surveyor'; // user is legacy; new accounts are tenants
export type KycStatus = 'not_started' | 'incomplete' | 'submitted' | 'under_review' | 'changes_required' | 'verified' | 'rejected' | 'expired' | 'suspended' | 'pending';
export type PropertyType = string;
export type PropertyStatus = 'draft' | 'pending_approval' | 'available' | 'partially_occupied' | 'occupied' | 'reserved' | 'rented' | 'sold' | 'leased' | 'maintenance' | 'unavailable' | 'inactive' | 'archived' | 'pending';

export interface User {
  _id: ObjectId;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  status: 'pending_verification' | 'active' | 'suspended' | 'locked';
  kycStatus: KycStatus;
  region?: string;
  country?: string;
  state?: string;
  city?: string;
  assignedProperties?: Array<ObjectId | Property>;
  customPermissions?: string[];
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string | null;
  isActive?: boolean;
  landlordEnabled?: boolean;
  landlordSubscriptionExpiresAt?: string;
  surveyorEnabled?: boolean;
  surveyorSubscriptionExpiresAt?: string;
  activeMode?: 'regular' | 'landlord' | 'surveyor';
  deviceUnlockEnabled?: boolean;
}

export interface Property {
  _id: ObjectId;
  slug?: string;
  title: string;
  code?: string;
  description: string;
  type: PropertyType;
  status: PropertyStatus;
  price: number;
  isSale: boolean;
  listingType?: 'rent' | 'sale' | 'lease';
  purpose?: 'rent' | 'sale' | 'lease';
  listingKind?: 'property' | 'space';
  propertyId?: ObjectId;
  spaceId?: ObjectId | null;
  visibility?: 'private' | 'public';
  publicationStatus?: 'draft' | 'published' | 'archived';
  roomCounts?: { rooms?: number; balconies?: number; bathrooms?: number; toilets?: number; kitchens?: number; bedrooms?: number; diningRooms?: number; masterBedrooms?: number; livingRooms?: number };
  roomDetails?: Record<string, number>;
  pricing?: Record<string, number | boolean>;
  startingMonthlyRent?: number;
  availableRoomCount?: number;
  rentalSummary?: { totalUnits?: number; availableUnits?: number; occupiedUnits?: number; startingMonthlyRent?: number };
  areas?: Record<string, number | string | undefined>;
  occupancyRules?: Record<string, number | boolean>;
  map?: { latitude?: number; longitude?: number; googleMapsLocation?: string; locality?: string; landmark?: string; district?: string; nearbyPlaces?: Array<Record<string, unknown>> };
  locationPrivacy?: 'exact_public' | 'approximate_public' | 'after_application' | 'after_visit_approval' | 'selected_users';
  promotion?: Record<string, unknown>;
  galleryCover?: string;
  urgentType?: string;
  areaUnit?: string;
  listingDetails?: Record<string, unknown>;
  specifications?: Record<string, unknown>;
  parking?: Record<string, unknown>;
  utilities?: Record<string, unknown>;
  amenityDetails?: Record<string, boolean>;
  legalDetails?: Record<string, unknown>;
  contactInformation?: Record<string, unknown>;
  publicContact?: Record<string, unknown>;
  nearbyFacilities?: Record<string, string>;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number;
  address?: { line1?: string; line2?: string; locality?: string; landmark?: string; district?: string; city?: string; state?: string; country?: string; postalCode?: string };
  location: string | { type: 'Point'; coordinates: number[] };
  city: string;
  country: string;
  images: string[];
  amenities: string[];
  owner?: (User & { verified?: boolean; trusted?: boolean }) | ObjectId;
  manager?: User | ObjectId;
  landlordId?: ObjectId | null;
  tenantId?: ObjectId | null;
  totalUnits?: number;
  occupiedUnits?: number;
  isVerified: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  _id: ObjectId;
  user?: User;
  userId?: ObjectId;
  property?: Property;
  propertyId?: ObjectId;
  unit?: Record<string, unknown>;
  rentAmount?: number;
  securityDeposit?: number;
  leaseStart?: string;
  leaseEnd?: string;
  status: string;
  documents?: ObjectId[];
}

export interface Payment {
  _id: ObjectId;
  invoiceNumber?: string;
  payer?: User;
  tenant?: Tenant;
  tenantId?: ObjectId;
  property?: Property;
  propertyId?: ObjectId;
  amount: number;
  paidAmount?: number;
  status: string;
  dueDate: string;
  paidAt?: string | null;
  paidDate?: string | null;
  method?: string | null;
  notes?: string;
}

export interface Document {
  _id: ObjectId;
  name: string;
  type: string;
  url: string;
  driveFile?: ObjectId;
  sizeBytes?: number;
  sizeKb?: number;
  owner?: User;
  ownerId?: ObjectId;
  property?: Property;
  propertyId?: ObjectId | null;
  createdAt?: string;
  uploadedAt?: string;
}

export interface ApiResponse<T> { success: boolean; data: T; message?: string; developmentOtp?: string; }
export interface PaginatedResponse<T> { success: boolean; data: T[]; total: number; page: number; limit: number; totalPages: number; pagination?: Pagination; }
export interface Pagination { total: number; page: number; limit: number; totalPages: number; }
export interface ResourceList<T = Record<string, unknown>> { success: boolean; data: T[]; pagination: Pagination; }
// Browser sessions are HttpOnly cookies. accessToken remains optional only so
// an older bundle can coexist during a rolling deployment; v98 never stores a
// bearer credential in browser persistence.
export interface AuthSession { accessToken?: string; token?: string; user: User; sessionId?: string; sessionExpiresAt?: string; absoluteExpiresAt?: string; expiresIn?: string; expiresAt?: string; }
export interface TwoFactorChallenge { requiresTwoFactor: true; challengeToken: string; user: { email: string; name: string }; }
export type AuthResult = AuthSession | TwoFactorChallenge;
export interface OtpSendRequest { identifier?: string; phone?: string; email?: string; }
export interface OtpVerifyRequest extends OtpSendRequest { otp: string; }
export interface RegistrationChallenge { requiresOtpVerification: true; identifier: string; maskedMobile: string; message?: string; developmentOtp?: string; }
export interface Fast2SmsWhatsAppTemplate { key: string; messageId: string; category: string; variableCount: number; variables: string[]; description: string; }
export interface Fast2SmsSettings {
  enabled: boolean; endpoint: string; route: string; senderId: string; messageId: string; variablesTemplate: string; scheduleTime: string;
  whatsappEnabled: boolean; whatsappEndpoint: string; whatsappPhoneNumberId: string; whatsappTemplates: Fast2SmsWhatsAppTemplate[];
  authorizationConfigured: boolean; status: string; lastCheckedAt?: string | null; lastError?: string;
}

export interface MapsSettings {
  enabled: boolean;
  provider: 'google';
  publicApiKey: string;
  publicApiKeyConfigured: boolean;
  browserApiKeyValid?: boolean;
  serverApiKeyConfigured: boolean;
  serverCredentialConfigured?: boolean;
  geocodingApiKeyConfigured: boolean;
  directionsApiKeyConfigured: boolean;
  placesApiKeyConfigured: boolean;
  routesApiKeyConfigured: boolean;
  elevationApiKeyConfigured: boolean;
  roadsApiKeyConfigured: boolean;
  addressValidationApiKeyConfigured: boolean;
  groundingLiteApiKeyConfigured: boolean;
  navigationConnectConfigured: boolean;
  routeOptimizationConfigured: boolean;
  streetViewPublishConfigured: boolean;
  services?: Record<string, boolean>;
  navigationEnabled: boolean;
  locationPickerEnabled: boolean;
  reverseGeocodeEnabled: boolean;
  directionsEnabled: boolean;
  serverRoutesEnabled: boolean;
  routesEnabled: boolean;
  placesEnabled: boolean;
  placesUiKitEnabled: boolean;
  addressValidationEnabled: boolean;
  elevationEnabled: boolean;
  roadsEnabled: boolean;
  routeOptimizationEnabled: boolean;
  navigationConnectEnabled: boolean;
  groundingLiteEnabled: boolean;
  streetViewPublishEnabled: boolean;
  useTraffic: boolean;
  routeRefreshSeconds: number;
  locationUpdateSeconds: number;
  maxRouteWaypoints: number;
  cloudProjectId: string;
  regionCode: string;
  languageCode: string;
  units: 'METRIC' | 'IMPERIAL';
  navigationConnectAndroidAppId?: string;
  navigationConnectIosAppId?: string;
  mapId: string;
  defaultLatitude: number;
  defaultLongitude: number;
  defaultZoom: number;
  travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
  status: string;
  lastCheckedAt?: string | null;
  lastError?: string;
}

export interface DashboardOverview {
  kpis: {
    totalProperties: number; totalUnits: number; occupiedUnits: number; vacantUnits: number; totalTenants: number; activeUsers: number;
    pendingApplications: number; pendingSurveys: number; monthlyRentCollection: number; outstandingDues: number; openComplaints: number;
    expiringLeases: number; pendingApprovals: number;
  };
  occupancyRate: number;
  revenueTrend: Array<{ month: string; amount: number }>;
  surveyStatus: Array<{ name: string; value: number }>;
  complaintStatus: Array<{ name: string; value: number }>;
  recentActivities: Array<Record<string, any>>;
  todayAssignments?: number;
  completedSurveys?: number;
  nextPayment?: Payment;
  activeLease?: Record<string, any>;
  latestApplication?: Record<string, any>;
}

export interface DashboardStats {
  totalProperties: number; activeTenantsCount: number; monthlyRevenue: number; kycPending: number;
  occupancyRate: number; overduePayments: number; totalDocuments: number; revenueGrowth: number;
}

export interface PropertyFilters {
  type?: PropertyType | 'all'; level?: string | 'all'; status?: PropertyStatus | 'all'; city?: string; state?: string; country?: string; address?: string; minPrice?: number; maxPrice?: number;
  minBedrooms?: number; isSale?: boolean; listingType?: 'rent' | 'sale' | 'lease' | 'all'; search?: string; landlord?: string; verified?: boolean; trustedSeller?: boolean; page?: number; limit?: number;
}

export type PublicSearchResultType = 'property' | 'verified_rental' | 'surveyor' | 'trusted_seller' | 'landlord' | 'location';
export interface PublicSearchResult {
  type: PublicSearchResultType; id: string; title: string; subtitle?: string; description?: string; image?: string | null; badge?: string; href: string; verified?: boolean; featured?: boolean; metadata?: Record<string, any>;
}
export interface PublicSearchPayload { query: string; results: PublicSearchResult[]; counts: Partial<Record<PublicSearchResultType, number>>; }
export type WishlistListingKind = 'property' | 'space';
export interface WishlistItem {
  _id?: string;
  listingId: string;
  listingKind: WishlistListingKind;
  addedAt?: string;
  listing: Property;
}
