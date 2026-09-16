import { connectDatabase, disconnectDatabase } from '../config/db.js';
import {
  User, Property, Unit, Tenant, Lease, Survey, Application, Payment, Complaint,
  Approval, Notification, Message, Document, Attendance, Subscription, AuditLog,
  SurveyorPlan, SurveyorSubscription, SurveyorVerification, SurveyorProfile, SurveyService, SurveyJob, SurveyQuotation, SurveyProject,
  SiteVisit, FieldData, SurveyEquipment, SurveyReport, SurveyTeamMember, SurveyClient, SurveyReview, SurveyDispute, SurveyPromotion,
  DriveFolder, DriveFile, DriveFileVersion, DriveShare, DriveActivity, DriveComment, DriveUsage, DriveUploadSession, DriveContentReport, DrivePolicy,
} from '../models/index.js';
import { ensureDefaultSurveyorPlans } from '../services/surveyorSubscription.js';
import { ensurePersonalDrive, createLegalTemplateFolders } from '../services/driveService.js';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DESTRUCTIVE_SEED !== 'YES') {
  console.error('Refusing to run the destructive demo seed in production. Set ALLOW_DESTRUCTIVE_SEED=YES only for a brand-new database.');
  process.exit(1);
}

const models = [DriveContentReport, DriveUploadSession, DriveComment, DriveActivity, DriveShare, DriveFileVersion, DriveFile, DriveFolder, DriveUsage, DrivePolicy, AuditLog, SurveyPromotion, SurveyDispute, SurveyReview, SurveyClient, SurveyTeamMember, SurveyReport, SurveyEquipment, FieldData, SiteVisit, SurveyProject, SurveyQuotation, SurveyJob, SurveyService, SurveyorProfile, SurveyorVerification, SurveyorSubscription, SurveyorPlan, Subscription, Attendance, Message, Notification, Approval, Complaint, Payment, Application, Survey, Lease, Tenant, Unit, Property, Document, User];
const daysFromNow = (days) => new Date(Date.now() + days * 86400000);
const monthsAgo = (months, day = 5) => new Date(new Date().getFullYear(), new Date().getMonth() - months, day);

await connectDatabase();
for (const Model of models) await Model.deleteMany({});

const [admin, manager, tenantUser, applicant, surveyor] = await User.create([
  { name: 'Aarav Mehta', email: 'admin@secureasset.in', phone: '+919876500001', password: 'Demo@123', role: 'admin', kycStatus: 'verified', region: 'All India' },
  { name: 'Priya Sharma', email: 'manager@secureasset.in', phone: '+919876500002', password: 'Demo@123', role: 'manager', kycStatus: 'verified', region: 'Nagaland' },
  { name: 'Rohan Verma', email: 'tenant@secureasset.in', phone: '+919876500003', password: 'Demo@123', role: 'tenant', kycStatus: 'verified', region: 'Dimapur' },
  { name: 'Neha Das', email: 'landlord@secureasset.in', phone: '+919876500004', password: 'Demo@123', role: 'tenant', kycStatus: 'pending', region: 'Kohima' },
  { name: 'Imkong Longkumer', email: 'surveyor@secureasset.in', phone: '+919876500005', password: 'Demo@123', role: 'tenant', kycStatus: 'verified', region: 'Nagaland', activeMode: 'surveyor' },
]);

const properties = await Property.create([
  {
    title: 'Sky Terrace Residences', code: 'PR-DIM-001', description: 'Premium mixed-use residential property with managed facilities and panoramic city views.', type: 'apartment', status: 'partially_occupied', price: 42000, bedrooms: 3, bathrooms: 2, area: 1650,
    address: { line1: 'Circular Road', city: 'Dimapur', state: 'Nagaland', country: 'India', postalCode: '797112' }, location: { type: 'Point', coordinates: [93.7276, 25.9091] },
    images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200'], amenities: ['Parking', 'Power Backup', 'Security', 'Gym'], owner: tenantUser._id, visibility: 'public', publicationStatus: 'published', listingType: 'rent', requiresActiveSubscription: true, publishedAt: new Date(), manager: manager._id, totalUnits: 12, occupiedUnits: 8, isVerified: true, isFeatured: true, createdBy: admin._id,
  },
  {
    title: 'Heritage Garden Villas', code: 'PR-KOH-002', description: 'Quiet gated villa community close to central Kohima with landscaped gardens.', type: 'villa', status: 'partially_occupied', price: 68000, bedrooms: 4, bathrooms: 4, area: 2800,
    address: { line1: 'Jotsoma Road', city: 'Kohima', state: 'Nagaland', country: 'India', postalCode: '797002' }, location: { type: 'Point', coordinates: [94.1086, 25.6751] },
    images: ['https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=1200'], amenities: ['Garden', 'Clubhouse', 'CCTV', 'Water Supply'], owner: admin._id, manager: manager._id, totalUnits: 8, occupiedUnits: 5, isVerified: true, isFeatured: true, createdBy: admin._id,
  },
  {
    title: 'North East Business Centre', code: 'PR-DIM-003', description: 'Modern office suites for growing businesses with high-speed connectivity.', type: 'office', status: 'available', price: 95000, bathrooms: 2, area: 3200,
    address: { line1: 'Purana Bazaar', city: 'Dimapur', state: 'Nagaland', country: 'India', postalCode: '797116' }, location: { type: 'Point', coordinates: [93.7711, 25.8845] },
    images: ['https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200'], amenities: ['Conference Room', 'Parking', 'Lift', 'Generator'], owner: admin._id, manager: manager._id, totalUnits: 6, occupiedUnits: 2, isVerified: true, isFeatured: false, createdBy: admin._id,
  },
  {
    title: 'Dzüko View Apartments', code: 'PR-KOH-004', description: 'Contemporary apartments with convenient access to schools and markets.', type: 'apartment', status: 'available', price: 32000, bedrooms: 2, bathrooms: 2, area: 1200,
    address: { line1: 'Upper Agri Colony', city: 'Kohima', state: 'Nagaland', country: 'India', postalCode: '797001' }, location: { type: 'Point', coordinates: [94.1057, 25.6586] },
    images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200'], amenities: ['Parking', 'Security', 'Balcony'], owner: admin._id, manager: manager._id, totalUnits: 10, occupiedUnits: 0, isVerified: true, isFeatured: false, createdBy: admin._id,
  },
]);
manager.assignedProperties = properties.map((p) => p._id); await manager.save({ validateModifiedOnly: true });
const subscriptionExpiry = daysFromNow(30);
await Subscription.create({ user: tenantUser._id, plan: 'professional', billingCycle: 'monthly', amount: 699, status: 'active', startsAt: new Date(), expiresAt: subscriptionExpiry, limits: { properties: 10, publicListings: 10 }, payment: { method: 'demo', transactionId: 'DEMO-SUB-SEED', gateway: 'local', paidAt: new Date() }, createdBy: tenantUser._id, updatedBy: tenantUser._id });
tenantUser.landlordEnabled = true; tenantUser.landlordSubscriptionExpiresAt = subscriptionExpiry; await tenantUser.save({ validateModifiedOnly: true });


// Same-account Surveyor Mode demo data.
const surveyorPlans = await ensureDefaultSurveyorPlans();
const professionalSurveyorPlan = surveyorPlans.find((plan) => plan.key === 'professional');
const surveyorExpiry = daysFromNow(45);
await SurveyorSubscription.create({
  user: surveyor._id, plan: professionalSurveyorPlan._id, planKey: professionalSurveyorPlan.key,
  planSnapshot: professionalSurveyorPlan, billingCycle: 'monthly', amount: professionalSurveyorPlan.prices.monthly,
  status: 'active', startsAt: new Date(), expiresAt: surveyorExpiry, nextRenewalAt: surveyorExpiry, autoRenew: true,
  usagePeriod: { month: `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}` },
  paymentHistory: [{ status: 'paid', amount: professionalSurveyorPlan.prices.monthly, transactionId: 'DEMO-SURVEYOR-SEED', gateway: 'local', paidAt: new Date() }],
  createdBy: surveyor._id, updatedBy: surveyor._id,
});
surveyor.surveyorEnabled = true; surveyor.surveyorSubscriptionExpiresAt = surveyorExpiry; surveyor.activeMode = 'surveyor'; await surveyor.save({ validateModifiedOnly: true });
const surveyorVerification = await SurveyorVerification.create({
  user: surveyor._id, status: 'verified', legalName: 'Imkong Longkumer', phone: surveyor.phone, email: surveyor.email,
  address: { line1: 'Duncan Basti', city: 'Dimapur', state: 'Nagaland', country: 'India', postalCode: '797112' },
  registrationNumber: 'NSC-SUR-2024-018', licenceNumber: 'NGL-SV-0182', licenceAuthority: 'Demo Survey Registration Authority',
  licenceIssueDate: daysFromNow(-700), licenceExpiryDate: daysFromNow(180), qualifications: ['B.Tech Civil Engineering'],
  certifications: ['Total Station Operations', 'GIS Mapping'], yearsExperience: 8,
  serviceAreas: [{ name: 'Dimapur', radiusKm: 80 }, { name: 'Kohima', radiusKm: 60 }], submittedAt: daysFromNow(-100), reviewedAt: daysFromNow(-98), verifiedAt: daysFromNow(-98), reviewer: admin._id,
  createdBy: surveyor._id, updatedBy: admin._id,
});
const surveyorProfile = await SurveyorProfile.create({
  user: surveyor._id, profileType: 'individual', name: 'Imkong Survey & Mapping', professionalTitle: 'Licensed Land Surveyor & GIS Specialist',
  description: 'Professional land, boundary, property and topographic surveying across Nagaland using total station, GNSS and GIS workflows.',
  yearsExperience: 8, registrationNumber: surveyorVerification.registrationNumber, licenceNumber: surveyorVerification.licenceNumber,
  qualifications: ['B.Tech Civil Engineering'], certifications: ['Total Station Operations', 'GIS Mapping'],
  specialisations: ['land_survey', 'boundary_survey', 'topographic_survey', 'gps_survey', 'gis_mapping'], languages: ['English', 'Nagamese', 'Ao'],
  serviceLocations: [{ city: 'Dimapur', state: 'Nagaland', radiusKm: 80 }, { city: 'Kohima', state: 'Nagaland', radiusKm: 60 }],
  officeAddress: { line1: 'Duncan Basti', city: 'Dimapur', state: 'Nagaland', country: 'India', postalCode: '797112' },
  publicContact: { phone: surveyor.phone, email: surveyor.email }, workingHours: { mondayToSaturday: '08:00-18:00' }, emergencyAvailable: true,
  completedProjects: 126, achievements: ['100+ verified survey projects'], equipmentSummary: ['Total Station', 'GNSS Receiver', 'Auto Level', 'Drone'], teamSize: 2,
  availability: 'available', startingPrice: 7500, averageCompletionDays: 5, visibility: 'public', publicationStatus: 'published',
  publicSlug: 'imkong-survey-mapping', verificationStatus: 'verified', isFeatured: true, rating: { average: 4.8, count: 32 },
  metrics: { views: 1842, enquiries: 94, conversions: 38, responseMinutes: 24 }, createdBy: surveyor._id, updatedBy: surveyor._id,
});
const surveyServices = await SurveyService.create([
  { surveyor: surveyor._id, profile: surveyorProfile._id, title: 'Boundary and Plot Demarcation Survey', category: 'boundary_survey', subtype: 'plot_demarcation', shortDescription: 'Accurate boundary identification and plot marking using total station and GNSS.', description: 'Includes site reconnaissance, control points, boundary measurement, marker placement and a signed measurement summary.', coverageAreas: [{ city: 'Dimapur', state: 'Nagaland', radiusKm: 80 }], startingPrice: 9000, pricingMethod: 'per_plot', estimatedDuration: '2–4 working days', availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], requiredDocuments: ['Ownership deed', 'Previous survey map'], deliverables: ['Boundary coordinates', 'Plot sketch', 'Signed report'], equipment: ['Total Station', 'GNSS Receiver'], teamSizeRequired: 2, travelCharges: '₹20 per km outside Dimapur town', emergencyAvailable: true, onlineConsultation: true, revisionPolicy: 'One factual correction included', cancellationPolicy: '24-hour notice required', visibility: 'public', status: 'published', moderation: { status: 'approved', reviewedBy: admin._id, reviewedAt: new Date() }, isFeatured: true, createdBy: surveyor._id, updatedBy: surveyor._id },
  { surveyor: surveyor._id, profile: surveyorProfile._id, title: 'Topographic and Contour Survey', category: 'topographic_survey', subtype: 'contour_survey', shortDescription: 'Terrain, elevation and contour mapping for design and construction.', description: 'Field survey, reduced levels, contour generation and CAD/GIS-ready deliverables.', coverageAreas: [{ city: 'Kohima', state: 'Nagaland', radiusKm: 60 }], startingPrice: 15000, pricingMethod: 'per_acre', estimatedDuration: '4–7 working days', requiredDocuments: ['Site plan'], deliverables: ['Topographic drawing', 'Contour map', 'Coordinate file'], equipment: ['Total Station', 'Auto Level', 'GNSS Receiver'], teamSizeRequired: 2, visibility: 'public', status: 'published', moderation: { status: 'approved', reviewedBy: admin._id, reviewedAt: new Date() }, createdBy: surveyor._id, updatedBy: surveyor._id },
]);

const units = await Unit.create([
  { property: properties[0]._id, buildingName: 'Tower A', floor: '3', unitNumber: 'A-301', type: '3 BHK', bedrooms: 3, bathrooms: 2, area: 1650, monthlyRent: 42000, securityDeposit: 84000, status: 'occupied', assignedTenant: tenantUser._id, createdBy: manager._id },
  { property: properties[0]._id, buildingName: 'Tower A', floor: '4', unitNumber: 'A-401', type: '3 BHK', bedrooms: 3, bathrooms: 2, area: 1650, monthlyRent: 44000, securityDeposit: 88000, status: 'vacant', createdBy: manager._id },
  { property: properties[1]._id, buildingName: 'Villa Block', floor: 'Ground', unitNumber: 'V-05', type: 'Villa', bedrooms: 4, bathrooms: 4, area: 2800, monthlyRent: 68000, securityDeposit: 136000, status: 'vacant', createdBy: manager._id },
  { property: properties[2]._id, buildingName: 'Block B', floor: '2', unitNumber: 'B-204', type: 'Office', area: 3200, monthlyRent: 95000, securityDeposit: 190000, status: 'vacant', createdBy: manager._id },
  { property: properties[3]._id, buildingName: 'Main', floor: '1', unitNumber: '101', type: '2 BHK', bedrooms: 2, bathrooms: 2, area: 1200, monthlyRent: 32000, securityDeposit: 64000, status: 'vacant', createdBy: manager._id },
]);


const surveyJob = await SurveyJob.create({
  jobNumber: 'SJ-2026-0001', client: applicant._id, title: 'Residential plot boundary verification in Chümoukedima', surveyType: 'boundary_survey', propertyType: 'residential_land',
  addressApproximate: '7th Mile, Chümoukedima, Nagaland', location: { type: 'Point', coordinates: [93.7482, 25.8237] }, exactLocation: { address: 'Private client site, 7th Mile', latitude: 25.8237, longitude: 93.7482 },
  plotNumber: 'P-114', landArea: 0.75, measurementUnit: 'acre', purpose: 'Pre-purchase verification', preferredVisitDate: daysFromNow(4), preferredCompletionDate: daysFromNow(10),
  budget: { min: 12000, max: 22000, currency: 'INR' }, description: 'Verify existing boundary markers and prepare a signed boundary measurement report.', deliverables: ['Boundary coordinates', 'Plot sketch', 'Signed report'],
  urgency: 'priority', visibility: 'public', bookingType: 'quotation', requiredQualification: 'Licensed land surveyor', requiredEquipment: ['Total Station'], status: 'awarded', hiredSurveyor: surveyor._id, quotationCount: 1,
  contact: { name: applicant.name, phone: applicant.phone, email: applicant.email }, createdBy: applicant._id, updatedBy: applicant._id,
});
const surveyQuotation = await SurveyQuotation.create({
  quotationNumber: 'SQ-2026-0001', job: surveyJob._id, surveyor: surveyor._id, client: applicant._id,
  scope: 'Boundary reconnaissance, control point setup, total-station survey, marker verification and signed report.', methodology: 'Closed traverse with GNSS control verification.', deliverables: ['Coordinate schedule', 'Boundary sketch', 'Signed PDF report'],
  charges: { siteVisit: 2500, survey: 12000, travel: 1500, equipment: 1500, tax: 3150, discount: 650 }, totalAmount: 20000, advanceAmount: 8000,
  paymentSchedule: [{ label: 'Advance', amount: 8000, dueAt: new Date(), status: 'paid' }, { label: 'Final', amount: 12000, dueAt: daysFromNow(10), status: 'pending' }],
  estimatedStartDate: daysFromNow(4), estimatedCompletionDate: daysFromNow(9), validUntil: daysFromNow(7), terms: 'Site access and ownership documents must be provided before fieldwork.', digitalSignature: 'DEMO-SIGN-IMKONG', status: 'accepted', submittedAt: daysFromNow(-1), acceptedAt: new Date(), createdBy: surveyor._id, updatedBy: applicant._id,
});
const surveyProject = await SurveyProject.create({
  projectNumber: 'SP-2026-0001', job: surveyJob._id, quotation: surveyQuotation._id, client: applicant._id, surveyor: surveyor._id, surveyCategory: 'boundary_survey',
  propertySite: { ownerName: applicant.name, propertyType: 'Residential land', plotNumber: 'P-114', locality: '7th Mile', district: 'Chümoukedima', state: 'Nagaland', postalCode: '797103', fullAddress: 'Private client site, 7th Mile, Chümoukedima', latitude: 25.8237, longitude: 93.7482, landArea: 0.75, accessRoad: 'Motorable road', terrain: 'Gentle slope', ownershipDocuments: ['Sale deed'] },
  startDate: daysFromNow(4), dueDate: daysFromNow(9), priority: 'high', status: 'scheduled', tasks: [{ title: 'Verify documents', assignee: surveyor._id, status: 'completed', dueAt: daysFromNow(2) }, { title: 'Complete field survey', assignee: surveyor._id, status: 'pending', dueAt: daysFromNow(5) }], milestones: [{ title: 'Site visit', dueAt: daysFromNow(4), status: 'scheduled' }, { title: 'Final report', dueAt: daysFromNow(9), status: 'pending' }], paymentSummary: { total: 20000, paid: 8000, outstanding: 12000 }, createdBy: applicant._id, updatedBy: surveyor._id,
});
const siteVisit = await SiteVisit.create({ project: surveyProject._id, client: applicant._id, surveyor: surveyor._id, requestedStart: daysFromNow(4), confirmedStart: daysFromNow(4), estimatedEnd: new Date(daysFromNow(4).getTime() + 3 * 3600000), status: 'confirmed', route: { origin: 'Duncan Basti, Dimapur', destination: '7th Mile, Chümoukedima', distanceKm: 14, travelMinutes: 35 }, instructions: 'Call the site contact 30 minutes before arrival.', accessContact: { name: applicant.name, phone: applicant.phone }, createdBy: applicant._id, updatedBy: surveyor._id });
const fieldData = await FieldData.create({ project: surveyProject._id, visit: siteVisit._id, surveyor: surveyor._id, offlineId: 'DEMO-FIELD-001', syncStatus: 'synced', observedAt: daysFromNow(-1), weather: 'Clear', teamMembers: ['Imkong Longkumer', 'Aren Jamir'], equipmentUsed: ['Total Station', 'GNSS Receiver'], gpsCoordinates: [{ label: 'Control Point A', latitude: 25.8237, longitude: 93.7482, elevation: 142.3, accuracy: 0.03, capturedAt: daysFromNow(-1) }], boundaryPoints: [{ sequence: 1, latitude: 25.8237, longitude: 93.7482 }, { sequence: 2, latitude: 25.8239, longitude: 93.7486 }, { sequence: 3, latitude: 25.8235, longitude: 93.7488 }, { sequence: 4, latitude: 25.8233, longitude: 93.7484 }], measurements: [{ type: 'distance', label: 'North boundary', value: 52.4, unit: 'm' }], observations: { markers: 'Three existing stones found; one corner requires replacement.' }, validation: { valid: true, errors: [], duplicateWarning: false }, createdBy: surveyor._id, updatedBy: surveyor._id });
await SurveyEquipment.create([
  { surveyor: surveyor._id, name: 'Leica TS07', type: 'total_station', brand: 'Leica', model: 'TS07', serialNumber: 'TS07-DEMO-1082', purchaseDate: daysFromNow(-500), calibrationDate: daysFromNow(-170), nextCalibrationDate: daysFromNow(10), availability: 'available', condition: 'Excellent', createdBy: surveyor._id, updatedBy: surveyor._id },
  { surveyor: surveyor._id, name: 'Emlid Reach RS2+', type: 'gnss_receiver', brand: 'Emlid', model: 'Reach RS2+', serialNumber: 'RS2-DEMO-204', purchaseDate: daysFromNow(-300), calibrationDate: daysFromNow(-60), nextCalibrationDate: daysFromNow(120), availability: 'available', condition: 'Good', createdBy: surveyor._id, updatedBy: surveyor._id },
]);
const teamMember = await SurveyTeamMember.create({ owner: surveyor._id, name: 'Aren Jamir', email: 'aren.field@example.com', phone: '+919876501111', role: 'survey_assistant', permissions: ['view_jobs', 'collect_field_data', 'upload_files'], status: 'active', invitedAt: daysFromNow(-200), joinedAt: daysFromNow(-198), createdBy: surveyor._id, updatedBy: surveyor._id });
await SurveyClient.create({ surveyor: surveyor._id, linkedUser: applicant._id, name: applicant.name, type: 'property_owner', email: applicant.email, phone: applicant.phone, address: 'Chümoukedima, Nagaland', preferredContact: 'WhatsApp', status: 'active', notes: ['Boundary verification project'], createdBy: surveyor._id, updatedBy: surveyor._id });
const surveyReport = await SurveyReport.create({ reportNumber: 'SR-2026-0001', project: surveyProject._id, surveyor: surveyor._id, client: applicant._id, type: 'boundary_survey_report', templateName: 'Boundary Survey Standard v2', title: 'Boundary Verification Report — Plot P-114', sections: { purpose: 'Pre-purchase boundary verification', methodology: 'Closed traverse with GNSS control', observations: 'Three existing boundary stones verified. One marker replacement recommended.', measurements: { northBoundaryMetres: 52.4 }, recommendations: ['Replace the missing south-east marker', 'Register the final coordinate schedule with the relevant authority'] }, digitalSignature: 'DEMO-SIGN-IMKONG', licenceDetails: surveyorVerification.licenceNumber, issueDate: new Date(), revisionNumber: 0, status: 'final', createdBy: surveyor._id, updatedBy: surveyor._id });

const tenant = await Tenant.create({ user: tenantUser._id, property: properties[0]._id, unit: units[0]._id, status: 'active', moveInDate: monthsAgo(8), occupants: [{ name: 'Riya Verma', relation: 'Spouse', authorised: true }], emergencyContact: { name: 'Ajay Verma', phone: '+919876512345', relation: 'Brother' }, createdBy: manager._id });
const lease = await Lease.create({ leaseNumber: 'LS-2026-0001', property: properties[0]._id, unit: units[0]._id, tenant: tenantUser._id, startDate: monthsAgo(8), endDate: daysFromNow(48), monthlyRent: 42000, securityDeposit: 84000, escalationPercent: 5, status: 'expiring', clauses: ['Rent due by the 5th of each month', 'One month notice required'], createdBy: manager._id });

const surveys = await Survey.create([
  { surveyNumber: 'SV-2026-0001', title: 'Annual condition inspection', property: properties[0]._id, unit: units[0]._id, surveyor: surveyor._id, assignedBy: manager._id, priority: 'high', deadline: daysFromNow(1), status: 'assigned', template: { name: 'Residential Annual Survey', version: '2.1' }, createdBy: manager._id },
  { surveyNumber: 'SV-2026-0002', title: 'Vacancy verification', property: properties[1]._id, unit: units[2]._id, surveyor: surveyor._id, assignedBy: manager._id, priority: 'medium', deadline: daysFromNow(3), status: 'in_progress', startedAt: new Date(), template: { name: 'Vacant Unit Verification', version: '1.4' }, gps: { lat: 25.6751, lng: 94.1086, accuracy: 8, verified: true }, createdBy: manager._id },
  { surveyNumber: 'SV-2026-0003', title: 'Office handover survey', property: properties[2]._id, unit: units[3]._id, surveyor: surveyor._id, assignedBy: manager._id, priority: 'urgent', deadline: daysFromNow(-1), status: 'returned', notes: 'Please recapture the electrical panel photographs.', revisions: [{ version: 1, status: 'returned', comment: 'Photo evidence incomplete', changedBy: manager._id }], createdBy: manager._id },
  { surveyNumber: 'SV-2026-0004', title: 'Move-in baseline survey', property: properties[0]._id, unit: units[0]._id, surveyor: surveyor._id, assignedBy: manager._id, priority: 'medium', deadline: daysFromNow(-60), status: 'approved', submittedAt: daysFromNow(-62), approvedAt: daysFromNow(-61), createdBy: manager._id },
]);

const application = await Application.create({ applicationNumber: 'AP-2026-0001', applicant: applicant._id, property: properties[3]._id, unit: units[4]._id, step: 7, status: 'under_review', personal: { dateOfBirth: '1996-05-14', maritalStatus: 'single' }, employment: { employer: 'North East Creative Co.', monthlyIncome: 85000 }, identity: { type: 'Aadhaar', verified: true }, feeAmount: 1500, paymentStatus: 'paid', submittedAt: daysFromNow(-2), createdBy: applicant._id });

const payments = [];
for (let i = 5; i >= 0; i -= 1) {
  payments.push({ invoiceNumber: `INV-2026-${String(6 - i).padStart(4, '0')}`, payer: tenantUser._id, tenant: tenant._id, property: properties[0]._id, unit: units[0]._id, lease: lease._id, type: 'rent', amount: 42000, paidAmount: i === 0 ? 0 : 42000, status: i === 0 ? 'pending' : 'paid', dueDate: monthsAgo(i, 5), paidAt: i === 0 ? undefined : monthsAgo(i, 4), method: 'upi', transactionId: i === 0 ? undefined : `UPI-DEMO-${i}`, createdBy: manager._id });
}
payments.push({ invoiceNumber: 'INV-2026-APP-01', payer: applicant._id, application: application._id, property: properties[3]._id, type: 'application_fee', amount: 1500, paidAmount: 1500, status: 'paid', paidAt: daysFromNow(-2), method: 'gateway', transactionId: 'DEMO-APP-001', createdBy: applicant._id });
await Payment.create(payments);

const complaints = await Complaint.create([
  { complaintNumber: 'CMP-2026-0001', title: 'Kitchen tap leakage', description: 'Continuous leakage below the kitchen sink.', raisedBy: tenantUser._id, property: properties[0]._id, unit: units[0]._id, category: 'plumbing', priority: 'high', status: 'assigned', assignedTo: manager._id, slaDueAt: daysFromNow(1), timeline: [{ status: 'open', note: 'Complaint raised by tenant', user: tenantUser._id }, { status: 'assigned', note: 'Assigned to maintenance team', user: manager._id }], createdBy: tenantUser._id },
  { complaintNumber: 'CMP-2026-0002', title: 'Common corridor light', description: 'Light on the third-floor corridor is not working.', raisedBy: tenantUser._id, property: properties[0]._id, unit: units[0]._id, category: 'electrical', priority: 'medium', status: 'resolved', assignedTo: manager._id, resolutionNote: 'LED driver replaced.', timeline: [{ status: 'resolved', note: 'Repair completed', user: manager._id }], createdBy: tenantUser._id },
]);

await Approval.create([
  { title: 'Lease renewal — A-301', type: 'lease_renewal', requester: manager._id, property: properties[0]._id, amount: 44100, priority: 'high', status: 'pending', stages: [{ name: 'Manager review', approverRole: 'manager', approver: manager._id, status: 'approved', actedAt: daysFromNow(-1) }, { name: 'Admin approval', approverRole: 'admin', approver: admin._id, status: 'pending' }], referenceModel: 'Lease', referenceId: lease._id, createdBy: manager._id },
  { title: 'Plumbing repair estimate', type: 'maintenance_expense', requester: manager._id, property: properties[0]._id, amount: 6500, priority: 'medium', status: 'pending', referenceModel: 'Complaint', referenceId: complaints[0]._id, createdBy: manager._id },
]);

await Notification.create([
  { user: admin._id, title: 'Two approvals need attention', message: 'Lease renewal and maintenance expense requests are pending.', category: 'system', actionUrl: '/app/approvals' },
  { user: manager._id, title: 'Survey submitted', message: 'A field survey is ready for verification.', category: 'survey', actionUrl: '/app/surveys' },
  { user: tenantUser._id, title: 'Rent due soon', message: 'Your next rent invoice of ₹42,000 is due.', category: 'payment', actionUrl: '/app/payments' },
  { user: applicant._id, title: 'Application under review', message: 'Your application for Dzüko View Apartments is being reviewed.', category: 'system', actionUrl: '/app/applications' },
  { user: surveyor._id, title: 'Urgent assignment returned', message: 'Office handover survey requires corrected photographs.', category: 'survey', actionUrl: '/app/surveys' },
]);

await Attendance.create({ user: surveyor._id, date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()), checkInAt: new Date(), checkInGps: { lat: 25.9091, lng: 93.7276, accuracy: 7 }, status: 'field' });
for (const account of [admin, manager, tenantUser, applicant, surveyor]) {
  await ensurePersonalDrive(account._id);
  await createLegalTemplateFolders(account);
}

await AuditLog.create([
  { user: admin._id, role: 'admin', action: 'seed', module: 'system', updatedValue: { message: 'Demo workspace initialised' }, ip: '127.0.0.1', device: 'Seed script' },
  { user: manager._id, role: 'manager', action: 'create', module: 'surveys', recordId: surveys[0]._id, updatedValue: { surveyNumber: surveys[0].surveyNumber }, ip: '127.0.0.1', device: 'Seed script' },
]);

console.log('Seed complete. Demo password for every account: Demo@123');
console.table([
  ['Admin', admin.email], ['Manager', manager.email], ['Tenant + Landlord Mode', tenantUser.email], ['Tenant / Client', applicant.email], ['Tenant + Surveyor Mode', surveyor.email],
]);
await disconnectDatabase();
