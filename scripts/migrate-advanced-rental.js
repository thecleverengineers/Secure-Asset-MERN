import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import {
  User, Property, Application, SiteSetting, SeoPage, HomeCarousel, HomeSection, LandlordPlan, PropertyTypeConfig, AreaUnit,
  PropertySpace, PropertyMedia, TenantProfile, TenantKyc, Occupant, PropertyVisit, Tenancy, RentalInvoice, ReminderRule, ContentPage,
} from '../server/src/models/index.js';
import { DEFAULT_LANDLORD_PLANS } from '../server/src/services/landlordSubscription.js';
import { buildLegacyTenantKycInsert, buildLegacyTenantProfileInsert, demoRentalDataEnabled } from './lib/migration-safety.js';

const propertyTypes = [
  ['house','House','residential','simple',[{key:'floors',label:'Number of floors',type:'number',group:'Structure',sortOrder:1},{key:'entrances',label:'Entrances',type:'number',group:'Structure',sortOrder:2}]],
  ['apartment','Apartment or Flat','residential','apartment_building',[{key:'buildingName',label:'Building name',type:'text',group:'Apartment',sortOrder:1},{key:'apartmentNumber',label:'Apartment number',type:'text',group:'Apartment',sortOrder:2},{key:'liftAvailable',label:'Lift available',type:'boolean',group:'Facilities',sortOrder:3}]],
  ['villa','Villa','residential','simple',[{key:'floors',label:'Number of floors',type:'number',group:'Structure',sortOrder:1},{key:'privateGarden',label:'Private garden',type:'boolean',group:'Facilities',sortOrder:2}]],
  ['pg_hostel','PG or Hostel','residential','pg_hostel',[{key:'bedInventory',label:'Total bed inventory',type:'number',group:'Inventory',sortOrder:1},{key:'sharedBathroom',label:'Shared bathroom',type:'boolean',group:'Facilities',sortOrder:2},{key:'mealIncluded',label:'Meals included',type:'boolean',group:'Facilities',sortOrder:3}]],
  ['shop','Shop','commercial','commercial',[{key:'frontageFeet',label:'Frontage (feet)',type:'number',group:'Commercial',sortOrder:1},{key:'shutterCount',label:'Shutters',type:'number',group:'Commercial',sortOrder:2}]],
  ['office','Office','commercial','commercial',[{key:'workstationCapacity',label:'Workstation capacity',type:'number',group:'Office',sortOrder:1},{key:'meetingRooms',label:'Meeting rooms',type:'number',group:'Office',sortOrder:2}]],
  ['showroom','Showroom','commercial','commercial',[{key:'frontageFeet',label:'Frontage (feet)',type:'number',group:'Commercial',sortOrder:1},{key:'displayArea',label:'Display area',type:'number',group:'Commercial',sortOrder:2}]],
  ['warehouse','Warehouse','commercial','commercial',[{key:'clearHeightFeet',label:'Clear height (feet)',type:'number',group:'Warehouse',sortOrder:1},{key:'loadingDock',label:'Loading dock',type:'boolean',group:'Warehouse',sortOrder:2},{key:'truckAccess',label:'Truck access',type:'boolean',group:'Warehouse',sortOrder:3}]],
  ['factory','Factory','commercial','commercial',[{key:'powerLoadKva',label:'Power load (kVA)',type:'number',group:'Factory',sortOrder:1},{key:'loadingFacility',label:'Loading facility',type:'boolean',group:'Factory',sortOrder:2}]],
  ['land_plot','Land or Plot','land','land',[{key:'landUse',label:'Permitted land use',type:'select',options:['residential','commercial','agricultural','industrial','mixed'],group:'Land',sortOrder:1},{key:'boundaryDescription',label:'Boundary description',type:'textarea',group:'Land',sortOrder:2},{key:'roadWidthFeet',label:'Access road width (feet)',type:'number',group:'Land',sortOrder:3}]],
  ['farm_land','Farm Land','land','land',[{key:'irrigationAvailable',label:'Irrigation available',type:'boolean',group:'Land',sortOrder:1},{key:'soilType',label:'Soil type',type:'text',group:'Land',sortOrder:2}]],
  ['event_hall','Event Hall','event','simple',[{key:'guestCapacity',label:'Guest capacity',type:'number',group:'Venue',sortOrder:1},{key:'stageAvailable',label:'Stage available',type:'boolean',group:'Venue',sortOrder:2},{key:'cateringAllowed',label:'External catering allowed',type:'boolean',group:'Venue',sortOrder:3}]],
  ['hotel','Hotel','hospitality','building',[{key:'roomInventory',label:'Total room inventory',type:'number',group:'Hotel',sortOrder:1},{key:'roomCategories',label:'Room categories',type:'array',group:'Hotel',sortOrder:2},{key:'starCategory',label:'Hotel category',type:'select',options:['unrated','1_star','2_star','3_star','4_star','5_star'],group:'Hotel',sortOrder:3}]],
  ['other','Other','other','simple',[{key:'customDetails',label:'Additional property details',type:'textarea',group:'Other',sortOrder:1}]],
];
const units = [
  ['sqft','Square feet','sq ft',0.092903],['sqm','Square metre','m²',1],['acre','Acre','acre',4046.8564224],['hectare','Hectare','ha',10000],
  ['bigha','Bigha','bigha',1337.8],['katha','Katha','katha',66.89],['lessa','Lessa','lessa',13.378],['custom','Other configured unit','unit',1],
];
const contentPages = [
  {
    path: '/about', slug: 'about', title: 'About SecureAsset', subtitle: 'One connected platform for property, rental, survey and document operations.',
    hero: { eyebrow: 'ABOUT', title: 'Property operations with clarity, control and trust.', subtitle: 'SecureAsset connects property discovery, tenancy, surveys, payments and protected records in one accountable workflow.' },
    sections: [
      { key: 'about-overview', type: 'rich_text', title: 'Built for the complete property lifecycle', content: { paragraphs: ['SecureAsset helps property owners, tenants, surveyors and operations teams work from a shared, secure source of truth.', 'From public discovery and rental applications to professional surveys, billing and document retention, every workflow is designed to remain traceable and role-aware.'] }, sortOrder: 1, active: true },
      { key: 'about-capabilities', type: 'feature_list', title: 'One connected operating system', content: { items: [{ title: 'Property and rental management', description: 'Listings, applications, tenancy, invoicing and reminders.' }, { title: 'Professional survey workflows', description: 'Verified profiles, quotations, field activity and reports.' }, { title: 'Secure document vault', description: 'Controlled access, version history, retention and audit trails.' }] }, sortOrder: 2, active: true },
    ],
    visibility: 'public', active: true,
  },
  {
    path: '/contact', slug: 'contact', title: 'Contact SecureAsset', subtitle: 'Talk to the platform team about onboarding, support or partnerships.',
    hero: { eyebrow: 'CONTACT', title: 'How can we help?', subtitle: 'Send an enquiry and the appropriate team can follow up.' },
    sections: [], visibility: 'public', active: true,
  },
];

const seoPages = [
  ['/','Property Rental, Tenant and Survey Management','Discover public properties, rooms, beds and professional survey services.'],
  ['/marketplace','Property Marketplace','Browse houses, apartments, rooms, beds, shops, offices, warehouses and land for rent, sale or lease.'],
  ['/surveyors','Surveyor Marketplace','Find verified property, land, building, valuation and technical survey professionals.'],
  ['/pricing','Subscription Plans','Compare Landlord and Surveyor subscription plans.'],['/about','About the Platform','A complete property, tenancy, survey and document-management platform.'],['/contact','Contact','Contact the platform team.'],
];

await connectDatabase();
try {
  const admin = await User.findOne({ role: 'admin' });
  await SiteSetting.updateOne({ key: 'default' }, { $setOnInsert: {
    key:'default',siteTitle:'SecureAsset',shortTitle:'SecureAsset',tagline:'Rent, manage, survey and protect property records in one platform.',
    description:'A complete property rental, tenant management, survey marketplace and secure document platform.',
    brand:{primaryColor:'#0B5270',secondaryColor:'#0f172a',accentColor:'#22c55e',fontFamily:'Open Sans'},
    contact:{email:'hello@secureasset.in',phone:'+91 00000 00000',address:'India'},
    seo:{titleTemplate:'%s | SecureAsset',defaultTitle:'SecureAsset — Property Rental and Management',defaultDescription:'Browse properties and manage rentals, tenants, surveys, bills and legal records.',robots:'index,follow'},
    homepage:{heroEnabled:true,featuredPropertiesEnabled:true,featuredSurveyorsEnabled:true,statsEnabled:true},updatedBy:admin?._id,
  } }, { upsert:true });
  for (const [path,title,description] of seoPages) await SeoPage.updateOne({ path }, { $setOnInsert:{path,title,description,robots:'index,follow',active:true,updatedBy:admin?._id} }, { upsert:true });
  for (const page of contentPages) await ContentPage.updateOne({ path: page.path }, { $setOnInsert: { ...page, updatedBy: admin?._id } }, { upsert: true });
  if (!await HomeCarousel.exists({})) await HomeCarousel.create([
    {title:'Find a home, room or workspace that fits.',subtitle:'Search verified public listings for rent, sale and lease.',eyebrow:'PROPERTY MARKETPLACE',imageUrl:'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=85',primaryCta:{label:'Browse properties',url:'/marketplace'},secondaryCta:{label:'List your property',url:'/pricing'},sortOrder:1,active:true,updatedBy:admin?._id},
    {title:'Professional surveys, from quotation to signed report.',subtitle:'Find verified independent surveyors and technical agencies.',eyebrow:'SURVEYOR MARKETPLACE',imageUrl:'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1800&q=85',primaryCta:{label:'Find surveyors',url:'/surveyors'},sortOrder:2,active:true,updatedBy:admin?._id},
  ]);
  await HomeSection.updateOne({key:'platform-stats'},{$setOnInsert:{key:'platform-stats',type:'stats',title:'One connected property ecosystem',content:{items:[{label:'Public listings',value:'Live'},{label:'Tenant lifecycle',value:'End-to-end'},{label:'Survey workflows',value:'Professional'},{label:'Documents',value:'Secure'}]},sortOrder:1,active:true,updatedBy:admin?._id}},{upsert:true});
  for (const plan of DEFAULT_LANDLORD_PLANS) await LandlordPlan.updateOne({key:plan.key},{$setOnInsert:{...plan,updatedBy:admin?._id}},{upsert:true});
  for (let i=0;i<propertyTypes.length;i+=1){const [key,label,category,hierarchyMode,fields]=propertyTypes[i];await PropertyTypeConfig.updateOne({key},{$setOnInsert:{key,label,category,hierarchyMode,fields,allowedPurposes:['rent','sale','lease'],active:true,sortOrder:i+1,updatedBy:admin?._id}},{upsert:true});await PropertyTypeConfig.updateOne({key,$or:[{fields:{$exists:false}},{fields:{$size:0}}]},{$set:{fields}});}
  for (let i=0;i<units.length;i+=1){const [key,label,symbol,squareMetreFactor]=units[i];await AreaUnit.updateOne({key},{$setOnInsert:{key,label,symbol,squareMetreFactor,region:{country:'India'},active:true,sortOrder:i+1,updatedBy:admin?._id}},{upsert:true});}

  const properties = await Property.find({}).lean();
  for (const old of properties) {
    const purpose = old.purpose || old.listingType || (old.isSale ? 'sale' : 'rent');
    const update = {
      purpose, listingType: purpose, referenceNumber: old.referenceNumber || old.code || `PR-${String(old._id).slice(-8).toUpperCase()}`,
      hierarchyMode: old.hierarchyMode || (old.type === 'apartment' ? 'apartment_building' : ['office','shop','showroom','warehouse'].includes(old.type) ? 'commercial' : old.type === 'land' ? 'land' : 'simple'),
      'pricing.salePrice': old.pricing?.salePrice ?? (purpose === 'sale' ? old.price : undefined), 'pricing.monthlyRent': old.pricing?.monthlyRent ?? (purpose === 'rent' ? old.price : undefined),
      'pricing.leaseAmount': old.pricing?.leaseAmount ?? (purpose === 'lease' ? old.price : undefined), 'areas.total': typeof old.areas?.total === 'number' ? old.areas.total : old.areas?.total?.value ?? old.area,
      'areas.unit': old.areas?.unit || old.areas?.total?.unit || 'sqft', 'roomDetails.bedrooms': old.roomDetails?.bedrooms ?? old.bedrooms ?? old.roomCounts?.bedrooms,
      'roomDetails.bathrooms': old.roomDetails?.bathrooms ?? old.bathrooms ?? old.roomCounts?.bathrooms, locationPrivacy: old.locationPrivacy || 'approximate_public',
    };
    Object.keys(update).forEach((key)=>update[key]===undefined&&delete update[key]);
    await Property.updateOne({_id:old._id},{$set:update});
  }

  const legacyApplications = await Application.find({ $or: [{ landlord: null }, { landlord: { $exists: false } }], property: { $ne: null } }).select('_id property').lean();
  for (const application of legacyApplications) {
    const owner = await Property.findById(application.property).select('owner').lean();
    if (owner?.owner) await Application.updateOne({ _id: application._id }, { $set: { landlord: owner.owner } });
  }

  if (demoRentalDataEnabled()) {
    const landlord = await User.findOne({ role: 'tenant', landlordEnabled: true });
    const demoProperty = landlord ? await Property.findOne({ owner: landlord._id }) : null;
    if (landlord && demoProperty && !await PropertySpace.exists({ property: demoProperty._id })) {
      const building = await PropertySpace.create({property:demoProperty._id,owner:landlord._id,level:'building',name:'Main Building',code:'BLD-A',status:'available',visibility:'public',publicationStatus:'published',createdBy:landlord._id,updatedBy:landlord._id});
      const floor = await PropertySpace.create({property:demoProperty._id,owner:landlord._id,parent:building._id,level:'floor',name:'Third Floor',floorNumber:'3',status:'available',visibility:'public',publicationStatus:'published',createdBy:landlord._id,updatedBy:landlord._id});
      const apartment = await PropertySpace.create({property:demoProperty._id,owner:landlord._id,parent:floor._id,level:'apartment',name:'Apartment A-301',code:'A-301',status:'available',rentable:true,purpose:'rent',visibility:'public',publicationStatus:'published',price:42000,securityDeposit:84000,area:{value:1650,unit:'sqft'},roomDetails:{bedrooms:3,bathrooms:2},occupancyRules:{maxTotal:6,maxAdults:4,maxChildren:3,familyAllowed:true,bachelorsAllowed:true,studentsAllowed:false,professionalsAllowed:true,petsAllowed:true},amenities:['Balcony','Parking','Power backup'],coverImage:demoProperty.images?.[0],createdBy:landlord._id,updatedBy:landlord._id});
      await PropertySpace.create([{property:demoProperty._id,owner:landlord._id,parent:apartment._id,level:'room',name:'Master Bedroom',code:'A301-MBR',status:'available',rentable:true,purpose:'rent',visibility:'public',publicationStatus:'published',price:18000,area:{value:320,unit:'sqft'},roomDetails:{bedrooms:1,bathrooms:1},occupancyRules:{maxTotal:2,bachelorsAllowed:true,professionalsAllowed:true},coverImage:demoProperty.images?.[0],createdBy:landlord._id,updatedBy:landlord._id},{property:demoProperty._id,owner:landlord._id,parent:apartment._id,level:'room',name:'Bedroom 2',code:'A301-R2',status:'available',rentable:true,purpose:'rent',visibility:'public',publicationStatus:'published',price:14000,area:{value:240,unit:'sqft'},roomDetails:{bedrooms:1,bathrooms:0},occupancyRules:{maxTotal:2,bachelorsAllowed:true,professionalsAllowed:true},coverImage:demoProperty.images?.[0],createdBy:landlord._id,updatedBy:landlord._id}]);
      if (demoProperty.images?.[0]) await PropertyMedia.create({property:demoProperty._id,space:apartment._id,owner:landlord._id,category:'apartment',mediaType:'image',url:demoProperty.images[0],caption:'Apartment living area',cover:true,visibility:'public',uploadedBy:landlord._id});
    }

    const tenant = await User.findOne({ role: 'tenant' });
    if (tenant) {
      await TenantProfile.updateOne({ user: tenant._id }, { $setOnInsert: buildLegacyTenantProfileInsert(tenant._id) }, { upsert: true });
      if (!await TenantKyc.exists({ user: tenant._id })) {
        await TenantKyc.create(buildLegacyTenantKycInsert(tenant._id));
        if (tenant.kycStatus === 'verified') await User.updateOne({ _id: tenant._id }, { $set: { kycStatus: 'incomplete' } });
      }
      if (!await Occupant.exists({ tenant: tenant._id })) await Occupant.create({tenant:tenant._id,fullName:'Primary Tenant',relationship:'Self',kycStatus:'not_started',createdBy:tenant._id,updatedBy:tenant._id});
    }
    if (landlord && !await ReminderRule.exists({owner:landlord._id})) await ReminderRule.create({owner:landlord._id,eventType:'rent_due',offsetsDays:[-7,-3,-1,0,1,3,7],repeatWeeklyUntilPaid:true,channels:['in_app'],template:{subject:'Rent payment reminder',message:'Invoice {{invoice}} has ₹{{amount}} {{due}}.'},active:true,createdBy:landlord._id,updatedBy:landlord._id});
    console.log('Optional demo rental records were seeded because SEED_DEMO_RENTAL_DATA=true.');
  } else {
    console.log('Operational demo records skipped (SEED_DEMO_RENTAL_DATA is disabled).');
  }


  console.log('Advanced rental, CMS and marketplace migration completed.');
} finally { await disconnectDatabase(); }
