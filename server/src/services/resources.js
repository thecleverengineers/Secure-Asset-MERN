import {
  User, Property, Unit, Tenant, Lease, Survey, Application, Payment, Complaint,
  Approval, Notification, NotificationDelivery, Message, Document, Attendance, Subscription, AuditLog,
  SurveyorPlan, SurveyorSubscription, SurveyorVerification, SurveyorProfile, SurveyService, SurveyJob, SurveyQuotation, SurveyProject,
  SiteVisit, FieldData, SurveyEquipment, SurveyReport, SurveyTeamMember, SurveyClient, SurveyReview, SurveyDispute, SurveyPromotion,
  SiteSetting, SeoPage, HomeCarousel, HomeSection, LandlordPlan, PropertyTypeConfig, AreaUnit,
  PropertySpace, PropertyMedia, TenantProfile, TenantKyc, Occupant, TenantInterview, PropertyVisit,
  Tenancy, RentalInvoice, UtilityReading, ReminderRule, PropertyPromotion, SiteEnquiry, Facility, FacilityBooking,
  PlatformModule, ContentPage, NotificationPreference, IntegrationSetting,
} from '../models/index.js';

const allRoles = ['admin', 'manager', 'landlord', 'tenant', 'user', 'surveyor'];

export const resources = {
  users: {
    model: User, readRoles: ['admin', 'manager'], createRoles: ['admin'], updateRoles: ['admin'], deleteRoles: ['admin'],
    search: ['name', 'email', 'phone', 'region', 'country', 'state', 'city'], populate: 'assignedProperties',
    writable: ['name', 'email', 'phone', 'password', 'role', 'avatar', 'status', 'kycStatus', 'country', 'state', 'city', 'region', 'assignedProperties', 'customPermissions'],
  },
  properties: {
    model: Property, readRoles: ['admin', 'manager', 'landlord', 'tenant'], createRoles: ['admin', 'landlord', 'tenant'], updateRoles: ['admin', 'manager', 'landlord', 'tenant'], deleteRoles: ['admin', 'landlord', 'tenant'],
    search: ['title', 'code', 'description', 'address.line1', 'address.locality', 'address.landmark', 'address.city', 'address.state', 'address.country', 'address.postalCode', 'map.googleMapsLocation', 'contactInformation.ownerName', 'contactInformation.agentName'], populate: ['manager', 'owner'],
    writable: ['title', 'code', 'referenceNumber', 'description', 'type', 'customType', 'customAttributes', 'hierarchyMode', 'status', 'price', 'listingType', 'purpose', 'isSale', 'floorManagementEnabled', 'liftAvailable', 'buildingSpecifications', 'commonFacilities', 'rulesAndRestrictions', 'visibility', 'publicationStatus', 'publishedAt', 'requiresActiveSubscription', 'bedrooms', 'bathrooms', 'area', 'roomCounts', 'roomDetails', 'listingDetails', 'pricing', 'areas', 'furnishing', 'ageDetails', 'address', 'location', 'map', 'locationPrivacy', 'occupancyRules', 'specifications', 'parking', 'utilities', 'amenityDetails', 'legalDetails', 'contactInformation', 'nearbyFacilities', 'images', 'amenities', 'documents', 'galleryCover', 'promotion', 'owner', 'manager', 'isVerified', 'isFeatured'],
  },
  units: {
    model: Unit, readRoles: ['admin', 'manager'], createRoles: ['admin', 'manager'], updateRoles: ['admin', 'manager'], deleteRoles: ['admin', 'manager'],
    search: ['unitNumber', 'buildingName', 'floor', 'type'], populate: ['property', 'assignedTenant'],
    writable: ['property', 'buildingName', 'floor', 'unitNumber', 'type', 'bedrooms', 'bathrooms', 'area', 'monthlyRent', 'securityDeposit', 'status', 'amenities', 'meterNumbers', 'assignedTenant'],
  },
  tenants: {
    model: Tenant, readRoles: ['admin', 'manager', 'landlord', 'tenant'], createRoles: ['admin', 'manager'], updateRoles: ['admin', 'manager', 'landlord', 'tenant'], deleteRoles: ['admin', 'landlord'],
    search: ['status'], populate: ['user', 'property', 'unit'],
    writable: ['user', 'name', 'email', 'phone', 'unitName', 'privateNotes', 'property', 'unit', 'status', 'occupants', 'emergencyContact', 'moveInDate', 'moveOutDate', 'documents'],
  },
  leases: {
    model: Lease, readRoles: ['admin', 'manager', 'landlord', 'tenant'], createRoles: ['admin', 'manager', 'landlord'], updateRoles: ['admin', 'manager', 'landlord'], deleteRoles: ['admin', 'landlord'],
    search: ['leaseNumber', 'status'], populate: ['property', 'unit', 'tenant'],
    writable: ['leaseNumber', 'property', 'unit', 'tenant', 'startDate', 'endDate', 'monthlyRent', 'securityDeposit', 'paymentCycle', 'whatsappReminderEnabled', 'legalAgreement', 'escalationPercent', 'paymentDueDay', 'status', 'signature', 'documents', 'clauses'],
  },
  surveys: {
    model: Survey, readRoles: ['admin', 'manager', 'surveyor'], createRoles: ['admin', 'manager'], updateRoles: ['admin', 'manager', 'surveyor'], deleteRoles: ['admin'],
    search: ['surveyNumber', 'title', 'status', 'priority'], populate: ['property', 'unit', 'surveyor', 'assignedBy'],
    writable: ['surveyNumber', 'title', 'property', 'unit', 'surveyor', 'assignedBy', 'priority', 'deadline', 'startedAt', 'submittedAt', 'approvedAt', 'status', 'template', 'responses', 'gps', 'photos', 'signatureUrl', 'notes', 'revisions', 'offlineId', 'syncStatus'],
  },
  applications: {
    model: Application, readRoles: ['admin', 'manager', 'landlord', 'user', 'tenant'], createRoles: ['admin', 'manager', 'user', 'tenant'], updateRoles: ['admin', 'manager', 'landlord', 'user', 'tenant'], deleteRoles: ['admin', 'user', 'tenant'],
    search: ['applicationNumber', 'status'], populate: ['applicant', 'landlord', 'property', 'unit', 'targetSpace', 'rentalUnit', 'occupantIds', 'reviewedBy'],
    writable: ['applicationNumber', 'applicant', 'landlord', 'property', 'unit', 'targetSpace', 'rentalUnit', 'step', 'status', 'personal', 'employment', 'identity', 'documents', 'feeAmount', 'paymentStatus', 'submittedAt', 'reviewedBy', 'remarks', 'occupantSummary', 'occupantIds', 'moveInDate', 'expectedStayMonths', 'monthlyIncome', 'rentalBudget', 'vehicles', 'pets', 'references', 'messageToLandlord', 'interviewScore', 'landlordNotes', 'closedReason'],
  },
  payments: {
    model: Payment, readRoles: ['admin', 'manager', 'landlord', 'tenant', 'user'], createRoles: ['admin', 'manager', 'landlord', 'tenant', 'user'], updateRoles: ['admin', 'manager', 'landlord'], deleteRoles: ['admin'],
    search: ['invoiceNumber', 'status', 'type', 'transactionId'], populate: ['payer', 'payee', 'tenant', 'property', 'unit', 'rentalUnit', 'tenancy', 'lease', 'application', 'surveyProject', 'surveyQuotation', 'facilityBooking', 'rentalInvoice'],
    writable: ['invoiceNumber', 'payer', 'payee', 'tenant', 'property', 'unit', 'rentalUnit', 'tenancy', 'lease', 'application', 'surveyProject', 'surveyQuotation', 'facilityBooking', 'type', 'amount', 'paidAmount', 'status', 'dueDate', 'paidAt', 'method', 'transactionId', 'gateway', 'proofUrl', 'notes', 'taxAmount', 'discountAmount', 'travelAmount', 'platformCommission'],
  },
  complaints: {
    model: Complaint, readRoles: ['admin', 'manager', 'landlord', 'tenant', 'user'], createRoles: ['admin', 'manager', 'landlord', 'tenant', 'user'], updateRoles: ['admin', 'manager', 'landlord', 'tenant', 'user'], deleteRoles: ['admin'],
    search: ['complaintNumber', 'title', 'description', 'status', 'category', 'priority'], populate: ['raisedBy', 'property', 'unit', 'assignedTo'],
    writable: ['complaintNumber', 'title', 'description', 'raisedBy', 'property', 'unit', 'category', 'priority', 'status', 'assignedTo', 'vendor', 'estimatedCost', 'approvedCost', 'slaDueAt', 'attachments', 'beforePhotos', 'afterPhotos', 'timeline', 'tenantConfirmedAt', 'resolutionNote'],
  },
  approvals: {
    model: Approval, readRoles: allRoles, createRoles: allRoles, updateRoles: ['admin', 'manager'], deleteRoles: ['admin'],
    search: ['title', 'type', 'status', 'priority'], populate: ['requester', 'property', 'stages.approver', 'comments.user'],
    writable: ['title', 'type', 'requester', 'property', 'amount', 'priority', 'status', 'currentStage', 'stages', 'referenceModel', 'referenceId', 'documents', 'comments'],
  },
  notifications: {
    model: Notification, readRoles: allRoles, createRoles: ['admin', 'manager'], updateRoles: allRoles, deleteRoles: allRoles,
    search: ['title', 'message', 'category'], populate: 'user',
    writable: ['user', 'title', 'message', 'category', 'readAt', 'actionUrl', 'metadata'],
  },
  'notification-deliveries': {
    model: NotificationDelivery, readRoles: ['admin'], createRoles: [], updateRoles: ['admin'], deleteRoles: ['admin'],
    search: ['channel', 'destination', 'status', 'providerMessageId', 'lastError'], populate: ['notification', 'user'],
    writable: ['status', 'nextAttemptAt', 'lastError', 'metadata'],
  },
  messages: {
    model: Message, readRoles: allRoles, createRoles: allRoles, updateRoles: allRoles, deleteRoles: allRoles,
    search: ['conversationId', 'body'], populate: ['sender', 'recipients', 'readBy.user'],
    writable: ['conversationId', 'sender', 'recipients', 'body', 'attachments', 'readBy', 'reference'],
  },
  documents: {
    model: Document, readRoles: allRoles, createRoles: allRoles, updateRoles: ['admin', 'manager'], deleteRoles: ['admin', 'manager', 'tenant', 'user', 'surveyor'],
    search: ['name', 'type', 'mimeType'], populate: ['owner', 'property', 'uploadedBy'],
    writable: ['name', 'type', 'url', 'mimeType', 'sizeBytes', 'owner', 'property', 'visibility', 'checksum', 'uploadedBy'],
  },
  subscriptions: {
    model: Subscription, readRoles: ['admin', 'tenant'], createRoles: [], updateRoles: ['admin'], deleteRoles: ['admin'],
    search: ['plan', 'status', 'payment.transactionId'], populate: 'user', writable: [],
  },
  attendance: {
    model: Attendance, readRoles: ['admin', 'manager', 'surveyor'], createRoles: ['surveyor'], updateRoles: ['admin', 'manager', 'surveyor'], deleteRoles: ['admin'],
    search: ['date', 'status'], populate: 'user',
    writable: ['user', 'date', 'checkInAt', 'checkOutAt', 'checkInGps', 'checkOutGps', 'status', 'notes'],
  },
  'audit-logs': {
    model: AuditLog, readRoles: ['admin', 'manager'], createRoles: [], updateRoles: [], deleteRoles: [],
    search: ['role', 'action', 'module', 'ip', 'device'], populate: 'user', writable: [],
  },

  'surveyor-plans': {
    model: SurveyorPlan, readRoles: ['admin'], createRoles: ['admin'], updateRoles: ['admin'], deleteRoles: ['admin'],
    search: ['key', 'name', 'description', 'supportLevel'], populate: ['createdBy', 'updatedBy'],
    writable: ['key', 'name', 'description', 'active', 'rank', 'prices', 'limits', 'features', 'graceDays', 'supportLevel'],
  },
  'surveyor-subscriptions': {
    model: SurveyorSubscription, readRoles: ['admin', 'tenant'], createRoles: [], updateRoles: ['admin'], deleteRoles: [],
    search: ['planKey', 'status', 'paymentHistory.transactionId'], populate: ['user', 'plan'], writable: ['status', 'expiresAt', 'graceEndsAt', 'autoRenew', 'cancelAtPeriodEnd', 'planSnapshot'],
  },
  'surveyor-verifications': {
    model: SurveyorVerification, readRoles: ['admin', 'tenant'], createRoles: [], updateRoles: ['admin'], deleteRoles: [],
    search: ['legalName', 'email', 'phone', 'registrationNumber', 'licenceNumber', 'status'], populate: ['user', 'reviewer'],
    writable: ['status', 'reviewerNotes', 'rejectionReason', 'suspensionReason', 'reviewer', 'reviewedAt', 'verifiedAt'],
  },
  'surveyor-profiles': {
    model: SurveyorProfile, readRoles: ['admin', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin', 'tenant'], deleteRoles: ['admin', 'tenant'],
    search: ['name', 'professionalTitle', 'description', 'registrationNumber', 'licenceNumber', 'specialisations', 'languages', 'availability'], populate: ['user'],
    writable: ['profileType', 'name', 'professionalTitle', 'profilePhoto', 'agencyLogo', 'description', 'yearsExperience', 'registrationNumber', 'licenceNumber', 'qualifications', 'certifications', 'specialisations', 'languages', 'serviceLocations', 'officeAddress', 'publicContact', 'workingHours', 'emergencyAvailable', 'portfolio', 'achievements', 'equipmentSummary', 'teamSize', 'availability', 'startingPrice', 'averageCompletionDays', 'terms', 'visibility', 'publicationStatus', 'publicSlug', 'exactCoordinatesPublic', 'isFeatured', 'isRecommended'],
  },
  'survey-services': {
    model: SurveyService, readRoles: ['admin', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin', 'tenant'], deleteRoles: ['admin', 'tenant'],
    search: ['title', 'category', 'subtype', 'shortDescription', 'description', 'status'], populate: ['surveyor', 'profile'],
    writable: ['profile', 'title', 'category', 'subtype', 'shortDescription', 'description', 'coverageAreas', 'startingPrice', 'pricingMethod', 'estimatedDuration', 'availableDays', 'timeSlots', 'requiredDocuments', 'deliverables', 'equipment', 'teamSizeRequired', 'travelCharges', 'emergencyAvailable', 'onlineConsultation', 'revisionPolicy', 'cancellationPolicy', 'terms', 'visibility', 'status', 'moderation', 'isFeatured'],
  },
  'survey-jobs': {
    model: SurveyJob, readRoles: ['admin', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin', 'tenant'], deleteRoles: ['admin', 'tenant'],
    search: ['jobNumber', 'title', 'surveyType', 'propertyType', 'addressApproximate', 'description', 'urgency', 'status'], populate: ['property', 'client', 'hiredSurveyor', 'invitedSurveyors', 'shortlistedSurveyors'],
    writable: ['property', 'title', 'surveyType', 'propertyType', 'addressApproximate', 'location', 'exactLocation', 'plotNumber', 'landArea', 'measurementUnit', 'purpose', 'preferredVisitDate', 'preferredCompletionDate', 'budget', 'description', 'requirements', 'deliverables', 'documents', 'photographs', 'siteAccess', 'contact', 'urgency', 'visibility', 'invitedSurveyors', 'shortlistedSurveyors', 'bookingType', 'requiredQualification', 'requiredEquipment', 'status', 'closesAt'],
  },
  'survey-quotations': {
    model: SurveyQuotation, readRoles: ['admin', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin', 'tenant'], deleteRoles: ['admin', 'tenant'],
    search: ['quotationNumber', 'scope', 'methodology', 'status'], populate: ['job', 'surveyor', 'client'],
    writable: ['job', 'scope', 'methodology', 'deliverables', 'charges', 'distanceKm', 'totalAmount', 'advanceAmount', 'paymentSchedule', 'estimatedStartDate', 'estimatedCompletionDate', 'validUntil', 'exclusions', 'terms', 'attachments', 'digitalSignature', 'status'],
  },
  'survey-projects': {
    model: SurveyProject, readRoles: ['admin', 'tenant'], createRoles: ['admin'], updateRoles: ['admin', 'tenant'], deleteRoles: ['admin'],
    search: ['projectNumber', 'surveyCategory', 'status', 'priority'], populate: ['property', 'job', 'quotation', 'client', 'surveyor', 'teamMembers', 'activeVisit', 'fieldData', 'report', 'finalPayment'],
    writable: ['teamMembers', 'surveyCategory', 'propertySite', 'startDate', 'dueDate', 'priority', 'status', 'tasks', 'milestones', 'documents', 'fieldNotes', 'media', 'paymentSummary'],
  },
  'site-visits': {
    model: SiteVisit, readRoles: ['admin', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin', 'tenant'], deleteRoles: ['admin', 'tenant'],
    search: ['status', 'route.origin', 'route.destination', 'instructions'], populate: ['project', 'client', 'surveyor', 'teamMembers'],
    writable: ['project', 'teamMembers', 'requestedStart', 'confirmedStart', 'estimatedEnd', 'status', 'route', 'instructions', 'accessContact', 'reminders', 'checkIn', 'checkOut', 'cancellationReason'],
  },
  'field-data': {
    model: FieldData, readRoles: ['admin', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin', 'tenant'], deleteRoles: ['admin', 'tenant'],
    search: ['offlineId', 'syncStatus', 'weather'], populate: ['project', 'visit', 'surveyor'],
    writable: ['project', 'visit', 'offlineId', 'syncStatus', 'observedAt', 'weather', 'teamMembers', 'equipmentUsed', 'gpsCoordinates', 'boundaryPoints', 'measurements', 'fieldNotes', 'observations', 'calculations', 'media', 'voiceNotes', 'sketches', 'clientSignature', 'surveyorSignature', 'validation', 'revisions'],
  },
  'survey-equipment': {
    model: SurveyEquipment, readRoles: ['admin', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin', 'tenant'], deleteRoles: ['admin', 'tenant'],
    search: ['name', 'type', 'brand', 'model', 'serialNumber', 'availability', 'condition'], populate: ['surveyor', 'assignedTo'],
    writable: ['name', 'type', 'brand', 'model', 'serialNumber', 'purchaseDate', 'calibrationDate', 'nextCalibrationDate', 'availability', 'assignedTo', 'maintenanceHistory', 'condition', 'certificationDocument'],
  },
  'survey-reports': {
    model: SurveyReport, readRoles: ['admin', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin', 'tenant'], deleteRoles: ['admin', 'tenant'],
    search: ['reportNumber', 'type', 'templateName', 'title', 'status'], populate: ['project', 'surveyor', 'client', 'lockedBy'],
    writable: ['project', 'type', 'templateName', 'title', 'reportFile', 'sections', 'maps', 'drawings', 'images', 'attachments', 'digitalSignature', 'licenceDetails', 'issueDate', 'revisionNumber', 'status', 'exports', 'revisions'],
  },
  'survey-team': {
    model: SurveyTeamMember, readRoles: ['admin', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin', 'tenant'], deleteRoles: ['admin', 'tenant'],
    search: ['name', 'email', 'phone', 'role', 'status'], populate: ['owner', 'memberUser'],
    writable: ['memberUser', 'name', 'email', 'phone', 'role', 'permissions', 'status', 'invitedAt', 'joinedAt'],
  },
  'survey-clients': {
    model: SurveyClient, readRoles: ['admin', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin', 'tenant'], deleteRoles: ['admin', 'tenant'],
    search: ['name', 'type', 'email', 'phone', 'address', 'status'], populate: ['surveyor', 'linkedUser'],
    writable: ['linkedUser', 'name', 'type', 'email', 'phone', 'address', 'preferredContact', 'status', 'properties', 'notes', 'communicationHistory'],
  },
  'survey-reviews': {
    model: SurveyReview, readRoles: ['admin', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin', 'tenant'], deleteRoles: ['admin'],
    search: ['comment', 'moderation.status'], populate: ['project', 'client', 'surveyor'],
    writable: ['project', 'ratings', 'comment', 'response', 'moderation'],
  },
  'survey-disputes': {
    model: SurveyDispute, readRoles: ['admin', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin', 'tenant'], deleteRoles: ['admin'],
    search: ['category', 'description', 'requestedResolution', 'status'], populate: ['project', 'raisedBy', 'against'],
    writable: ['project', 'against', 'category', 'description', 'evidence', 'requestedResolution', 'status', 'messages', 'adminNotes', 'finalDecision'],
  },
  'survey-promotions': {
    model: SurveyPromotion, readRoles: ['admin', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin'], deleteRoles: ['admin'],
    search: ['type', 'status'], populate: ['surveyor', 'service'],
    writable: ['service', 'type', 'startsAt', 'endsAt', 'amount', 'status', 'metrics', 'payment'],
  },

  'site-settings': {
    model: SiteSetting, readRoles: ['admin'], createRoles: ['admin'], updateRoles: ['admin'], deleteRoles: [],
    search: ['siteTitle', 'shortTitle', 'tagline', 'contact.email', 'contact.phone'], populate: ['updatedBy'],
    writable: ['key', 'siteTitle', 'shortTitle', 'tagline', 'description', 'logoUrl', 'logoLightUrl', 'faviconUrl', 'defaultOgImageUrl', 'brand', 'design', 'contact', 'social', 'map', 'seo', 'homepage', 'authentication', 'maintenance', 'legal', 'footer'],
  },
  'seo-pages': {
    model: SeoPage, readRoles: ['admin'], createRoles: ['admin'], updateRoles: ['admin'], deleteRoles: ['admin'],
    search: ['path', 'title', 'description', 'keywords'], populate: ['updatedBy'],
    writable: ['path', 'title', 'description', 'keywords', 'canonicalUrl', 'robots', 'ogTitle', 'ogDescription', 'ogImageUrl', 'ogType', 'twitterCard', 'structuredData', 'active'],
  },
  'home-carousel': {
    model: HomeCarousel, readRoles: ['admin'], createRoles: ['admin'], updateRoles: ['admin'], deleteRoles: ['admin'],
    search: ['title', 'subtitle', 'eyebrow', 'audience'], populate: ['updatedBy'],
    writable: ['title', 'subtitle', 'eyebrow', 'imageUrl', 'mobileImageUrl', 'altText', 'primaryCta', 'secondaryCta', 'overlay', 'textAlign', 'sortOrder', 'startsAt', 'endsAt', 'active', 'audience'],
  },
  'home-sections': {
    model: HomeSection, readRoles: ['admin'], createRoles: ['admin'], updateRoles: ['admin'], deleteRoles: ['admin'],
    search: ['key', 'type', 'title', 'subtitle'], populate: ['updatedBy'],
    writable: ['key', 'type', 'title', 'subtitle', 'content', 'sortOrder', 'active', 'background'],
  },
  'landlord-plans': {
    model: LandlordPlan, readRoles: ['admin'], createRoles: ['admin'], updateRoles: ['admin'], deleteRoles: ['admin'],
    search: ['key', 'name', 'description'], populate: ['updatedBy'],
    writable: ['key', 'name', 'description', 'rank', 'active', 'prices', 'limits', 'features', 'graceDays', 'featured'],
  },
  'property-type-configs': {
    model: PropertyTypeConfig, readRoles: ['admin'], createRoles: ['admin'], updateRoles: ['admin'], deleteRoles: ['admin'],
    search: ['key', 'label', 'category', 'hierarchyMode'], populate: ['updatedBy'],
    writable: ['key', 'label', 'category', 'hierarchyMode', 'fields', 'allowedPurposes', 'active', 'sortOrder'],
  },
  'area-units': {
    model: AreaUnit, readRoles: ['admin'], createRoles: ['admin'], updateRoles: ['admin'], deleteRoles: ['admin'],
    search: ['key', 'label', 'symbol', 'region.country', 'region.state', 'region.city', 'region.district'], populate: ['updatedBy'],
    writable: ['key', 'label', 'symbol', 'region', 'squareMetreFactor', 'active', 'sortOrder'],
  },
  'property-spaces': {
    model: PropertySpace, readRoles: ['admin', 'manager', 'tenant'], createRoles: ['admin', 'manager', 'tenant'], updateRoles: ['admin', 'manager', 'tenant'], deleteRoles: ['admin', 'manager', 'tenant'],
    search: ['name', 'code', 'level', 'roomNumber', 'flatNumber', 'apartmentNumber', 'status', 'description'], populate: ['property', 'owner', 'parent'],
    writable: ['property', 'parent', 'level', 'name', 'code', 'roomNumber', 'flatNumber', 'apartmentNumber', 'galleryScope', 'floorNumber', 'sortOrder', 'status', 'rentable', 'sellable', 'purpose', 'visibility', 'publicationStatus', 'price', 'securityDeposit', 'maintenanceCharge', 'area', 'roomDetails', 'furnishing', 'amenities', 'occupancyRules', 'availableFrom', 'coverImage', 'description', 'promotion'],
  },
  'property-media': {
    model: PropertyMedia, readRoles: ['admin', 'manager', 'tenant'], createRoles: ['admin', 'manager', 'tenant'], updateRoles: ['admin', 'manager', 'tenant'], deleteRoles: ['admin', 'manager', 'tenant'],
    search: ['category', 'mediaType', 'caption', 'altText'], populate: ['property', 'space', 'owner', 'uploadedBy', 'document', 'driveFile'],
    writable: ['property', 'space', 'category', 'mediaType', 'url', 'document', 'driveFile', 'thumbnailUrl', 'caption', 'altText', 'sortOrder', 'cover', 'visibility', 'watermark', 'compressed'],
  },
  'tenant-profiles': {
    model: TenantProfile, readRoles: ['admin', 'manager', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin', 'tenant'], deleteRoles: ['admin'],
    search: ['occupation', 'employerInstitution', 'preferences.locations'], populate: ['user', 'updatedBy'],
    writable: ['profileImage', 'profileVisibility', 'dateOfBirth', 'gender', 'currentAddress', 'permanentAddress', 'occupation', 'employerInstitution', 'monthlyIncome', 'emergencyContact', 'identityDocuments', 'addressProofs', 'employmentProofs', 'references', 'preferences', 'completedPercent'],
  },
  'tenant-kyc': {
    model: TenantKyc, readRoles: ['admin', 'manager', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin', 'manager', 'tenant'], deleteRoles: ['admin'],
    search: ['status', 'reason', 'notes', 'governmentIdentity.documentType', 'governmentIdentity.documentId', 'addressProofDetails.documentType', 'addressProofDetails.documentId'], populate: ['user', 'reviewer', 'governmentIdentity.frontFile', 'governmentIdentity.backFile', 'addressProofDetails.frontFile', 'addressProofDetails.backFile', 'passportPhoto.file', 'governmentId', 'addressProof', 'profilePhoto', 'selfie', 'employmentProof'],
    writable: ['governmentIdentity', 'addressProofDetails', 'passportPhoto', 'governmentId', 'addressProof', 'profilePhoto', 'selfie', 'employmentProof', 'phoneVerified', 'emailVerified', 'emergencyContactVerified', 'employmentVerified', 'status', 'submittedAt', 'reviewedAt', 'verifiedAt', 'expiresAt', 'reviewer', 'reason', 'notes', 'history'],
  },
  occupants: {
    model: Occupant, readRoles: ['admin', 'manager', 'tenant'], createRoles: ['admin', 'manager', 'tenant'], updateRoles: ['admin', 'manager', 'tenant'], deleteRoles: ['admin', 'manager', 'tenant'],
    search: ['fullName', 'gender', 'relationship', 'occupation', 'phone', 'kycStatus'], populate: ['tenant', 'application', 'tenancy'],
    writable: ['application', 'tenancy', 'fullName', 'age', 'gender', 'relationship', 'occupation', 'identityDocument', 'phone', 'kycStatus'],
  },
  'tenant-interviews': {
    model: TenantInterview, readRoles: ['admin', 'manager', 'tenant'], createRoles: ['admin', 'manager', 'tenant'], updateRoles: ['admin', 'manager', 'tenant'], deleteRoles: ['admin', 'manager', 'tenant'],
    search: ['type', 'location', 'status', 'decision', 'privateNotes'], populate: ['application', 'property', 'space', 'landlord', 'tenant'],
    writable: ['application', 'property', 'space', 'scheduledAt', 'type', 'location', 'meetingUrl', 'questions', 'privateNotes', 'rating', 'status', 'decision', 'followUpAt'],
  },
  'property-visits': {
    model: PropertyVisit, readRoles: ['admin', 'manager', 'tenant'], createRoles: ['admin', 'manager', 'tenant'], updateRoles: ['admin', 'manager', 'tenant'], deleteRoles: ['admin', 'manager', 'tenant'],
    search: ['purpose', 'message', 'status', 'meetingPoint'], populate: ['property', 'space', 'requester', 'landlord', 'assignedTo'],
    writable: ['property', 'space', 'preferredStart', 'proposedStart', 'confirmedStart', 'visitorCount', 'contact', 'purpose', 'message', 'accessibilitySupport', 'status', 'instructions', 'meetingPoint', 'attendance', 'feedback', 'interest', 'assignedTo'],
  },
  tenancies: {
    model: Tenancy, readRoles: ['admin', 'manager', 'tenant'], createRoles: ['admin', 'manager', 'tenant'], updateRoles: ['admin', 'manager', 'tenant'], deleteRoles: ['admin'],
    search: ['status'], populate: ['tenant', 'landlord', 'property', 'space', 'rentalUnit', 'application', 'lease', 'occupants'],
    writable: ['tenant', 'landlord', 'property', 'space', 'application', 'lease', 'status', 'startDate', 'endDate', 'monthlyRent', 'securityDeposit', 'dueDay', 'dueTime', 'occupants', 'moveInChecklist', 'moveOutChecklist'],
  },
  'rental-invoices': {
    model: RentalInvoice, readRoles: ['admin', 'manager', 'tenant'], createRoles: ['admin', 'manager', 'tenant'], updateRoles: ['admin', 'manager', 'tenant'], deleteRoles: ['admin'],
    search: ['invoiceNumber', 'billingMonth', 'status'], populate: ['tenancy', 'tenant', 'landlord', 'property', 'space'],
    writable: ['tenancy', 'tenant', 'landlord', 'property', 'space', 'billingMonth', 'dueDate', 'charges', 'discounts', 'previousBalance', 'totalAmount', 'paidAmount', 'balanceAmount', 'paymentCycle', 'whatsappReminderEnabled', 'legalAgreement', 'status', 'payments', 'receiptFile', 'lastReminderAt'],
  },
  'utility-readings': {
    model: UtilityReading, readRoles: ['admin', 'manager', 'tenant'], createRoles: ['admin', 'manager', 'tenant'], updateRoles: ['admin', 'manager', 'tenant'], deleteRoles: ['admin'],
    search: ['utilityType', 'billingPeriod', 'allocationMethod'], populate: ['tenancy', 'property', 'space', 'tenant', 'landlord'],
    writable: ['tenancy', 'property', 'space', 'tenant', 'utilityType', 'billingPeriod', 'previousReading', 'currentReading', 'unitsConsumed', 'ratePerUnit', 'fixedCharge', 'tax', 'otherCharge', 'totalAmount', 'allocationMethod', 'allocations', 'meterPhoto', 'billDocument', 'dueDate', 'approved'],
  },
  'reminder-rules': {
    model: ReminderRule, readRoles: ['admin', 'manager', 'tenant'], createRoles: ['admin', 'manager', 'tenant'], updateRoles: ['admin', 'manager', 'tenant'], deleteRoles: ['admin', 'manager', 'tenant'],
    search: ['eventType', 'template.subject', 'template.message'], populate: ['owner', 'property'],
    writable: ['property', 'eventType', 'offsetsDays', 'repeatWeeklyUntilPaid', 'channels', 'template', 'active'],
  },
  'property-promotions': {
    model: PropertyPromotion, readRoles: ['admin', 'tenant'], createRoles: ['admin', 'tenant'], updateRoles: ['admin', 'tenant'], deleteRoles: ['admin', 'tenant'],
    search: ['type', 'status'], populate: ['property', 'space', 'owner', 'payment'],
    writable: ['property', 'space', 'type', 'startsAt', 'endsAt', 'amount', 'status', 'metrics', 'payment'],
  },
  'site-enquiries': {
    model: SiteEnquiry, readRoles: ['admin', 'manager'], createRoles: ['admin'], updateRoles: ['admin', 'manager'], deleteRoles: ['admin'],
    search: ['name', 'email', 'phone', 'message', 'type', 'status'], populate: ['property', 'space', 'assignedTo'],
    writable: ['name', 'email', 'phone', 'message', 'property', 'space', 'type', 'preferredCallbackAt', 'callbackWindow', 'status', 'assignedTo'],
  },
  facilities: {
    model: Facility, readRoles: ['admin', 'manager', 'tenant'], createRoles: ['admin', 'manager', 'tenant'], updateRoles: ['admin', 'manager', 'tenant'], deleteRoles: ['admin', 'manager', 'tenant'],
    search: ['name', 'type', 'description', 'amenities', 'status'], populate: ['property', 'owner', 'manager'],
    writable: ['property', 'manager', 'name', 'type', 'description', 'capacity', 'visibility', 'status', 'bookingRequired', 'price', 'deposit', 'currency', 'slotMinutes', 'minimumNoticeHours', 'maximumAdvanceDays', 'availableDays', 'availableTimeSlots', 'amenities', 'rules', 'images'],
  },
  'facility-bookings': {
    model: FacilityBooking, readRoles: ['admin', 'manager', 'tenant'], createRoles: ['admin', 'manager', 'tenant'], updateRoles: ['admin', 'manager', 'tenant'], deleteRoles: ['admin'],
    search: ['purpose', 'status', 'paymentStatus', 'decisionNote'], populate: ['facility', 'property', 'owner', 'requester', 'approvedBy', 'payment'],
    writable: ['facility', 'requester', 'startAt', 'endAt', 'guests', 'purpose', 'status', 'paymentStatus', 'amount', 'deposit', 'notes', 'decisionNote', 'approvedBy', 'payment'],
  },

  'platform-modules': {
    model: PlatformModule, readRoles: ['admin'], createRoles: ['admin'], updateRoles: ['admin'], deleteRoles: ['admin'],
    search: ['key', 'label', 'description', 'path', 'section', 'featureFlag'], populate: ['updatedBy'],
    writable: ['key', 'label', 'description', 'path', 'icon', 'scope', 'kind', 'section', 'sectionOrder', 'roles', 'modes', 'accessRules', 'enabled', 'mobilePrimary', 'sortOrder', 'featureFlag', 'badge', 'metadata'],
  },
  'content-pages': {
    model: ContentPage, readRoles: ['admin'], createRoles: ['admin'], updateRoles: ['admin'], deleteRoles: ['admin'],
    search: ['path', 'slug', 'title', 'subtitle'], populate: ['updatedBy'],
    writable: ['path', 'slug', 'title', 'subtitle', 'hero', 'sections', 'visibility', 'footer', 'active'],
  },
  'notification-preferences': {
    model: NotificationPreference, readRoles: allRoles, createRoles: allRoles, updateRoles: allRoles, deleteRoles: [],
    search: ['user'], populate: ['user'], writable: ['channels', 'categories', 'quietHours'],
  },
  'integration-settings': {
    model: IntegrationSetting, readRoles: ['admin'], createRoles: ['admin'], updateRoles: ['admin'], deleteRoles: ['admin'],
    search: ['key', 'provider', 'category', 'status', 'lastError'], populate: ['updatedBy'],
    writable: ['key', 'provider', 'category', 'enabled', 'status', 'publicConfig', 'envRequirements', 'lastCheckedAt', 'lastError'],
  },

};
