import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;
const objectId = (ref, required = false) => ({ type: Schema.Types.ObjectId, ref, required });
const timestamps = { timestamps: true };

const PropertyTypeFieldSchema = new Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  type: { type: String, required: true, trim: true },
  required: { type: Boolean, default: false },
  options: [String],
  group: String,
  sortOrder: { type: Number, default: 0 },
}, { _id: false });

const HEX_COLOUR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const colourToken = (defaultValue) => ({ type: String, default: defaultValue, trim: true, match: HEX_COLOUR });
const gradientToken = { type: String, default: '', trim: true, maxlength: 240, validate: { validator: (value) => !value || /^(?:linear|radial)-gradient\([#0-9a-fA-F(),.%\s-]+\)$/.test(value), message: 'Gradient must be a bounded linear or radial gradient token.' } };
const boundedNumber = (defaultValue, min, max) => ({ type: Number, default: defaultValue, min, max });

const ButtonTokenSchema = new Schema({
  background: colourToken('#0B5270'), text: colourToken('#FFFFFF'), border: colourToken('#0B5270'), hoverBackground: colourToken('#083C51'), hoverText: colourToken('#FFFFFF'), activeBackground: colourToken('#062F40'),
  disabledBackground: colourToken('#B9C7C9'), disabledText: colourToken('#6C7B7E'), focusRing: colourToken('#0B5270'), gradient: gradientToken,
  widthMode: { type: String, enum: ['auto', 'fixed', 'full'], default: 'auto' }, minWidth: boundedNumber(0, 0, 640), height: boundedNumber(40, 28, 88), paddingX: boundedNumber(16, 0, 48), paddingY: boundedNumber(9, 0, 32), iconGap: boundedNumber(8, 0, 24), radius: boundedNumber(12, 0, 40), fontSize: boundedNumber(13, 10, 24), fontWeight: boundedNumber(780, 400, 900),
  shadow: { type: String, enum: ['none', 'subtle', 'soft'], default: 'subtle' }, iconPosition: { type: String, enum: ['start', 'end'], default: 'start' }, animation: { type: String, enum: ['none', 'lift', 'scale', 'glow'], default: 'lift' },
}, { _id: false });
const NavigationDesignItemSchema = new Schema({ key: { type: String, required: true, trim: true, maxlength: 64 }, label: { type: String, required: true, trim: true, maxlength: 80 }, path: { type: String, required: true, trim: true, maxlength: 240 }, icon: { type: String, default: 'DashboardRounded', trim: true, maxlength: 80 }, section: { type: String, default: 'workspace', trim: true, maxlength: 48 }, order: boundedNumber(0, 0, 9999), enabled: { type: Boolean, default: true }, mobilePrimary: { type: Boolean, default: false }, placement: { type: String, enum: ['sidebar', 'header', 'bottom', 'both'], default: 'sidebar' }, badge: { type: String, default: '', trim: true, maxlength: 24 }, roles: { type: [String], default: [] }, loginRequired: { type: Boolean, default: true }, external: { type: Boolean, default: false }, parentKey: { type: String, default: '', trim: true, maxlength: 64 } }, { _id: false });
const PageDesignTokenSchema = new Schema({
  key: { type: String, required: true, trim: true, maxlength: 64 }, label: { type: String, required: true, trim: true, maxlength: 96 }, path: { type: String, required: true, trim: true, maxlength: 240 }, enabled: { type: Boolean, default: true }, background: colourToken('#F7F7F5'), surface: colourToken('#FFFFFF'), headerVariant: { type: String, enum: ['default', 'minimal', 'hero'], default: 'default' }, footerVariant: { type: String, enum: ['default', 'minimal', 'hidden'], default: 'default' }, maxWidth: boundedNumber(1580, 640, 1920), padding: boundedNumber(32, 0, 96), cardRadius: boundedNumber(18, 0, 40), buttonRadius: boundedNumber(12, 0, 40), density: { type: String, enum: ['compact', 'comfortable', 'spacious'], default: 'comfortable' },
  desktop: { columns: boundedNumber(12, 1, 24), gap: boundedNumber(24, 0, 96), padding: boundedNumber(32, 0, 96) }, tablet: { columns: boundedNumber(8, 1, 16), gap: boundedNumber(20, 0, 72), padding: boundedNumber(24, 0, 72) }, mobile: { columns: boundedNumber(4, 1, 8), gap: boundedNumber(16, 0, 48), padding: boundedNumber(16, 0, 48) },
}, { _id: false });
const ComponentVariantSchema = new Schema({ key: { type: String, required: true, maxlength: 32 }, background: colourToken('#FFFFFF'), text: colourToken('#152225'), border: colourToken('#E6E9E6'), opacity: { type: Number, default: 1, min: 0.2, max: 1 }, scale: { type: Number, default: 1, min: 0.8, max: 1.2 } }, { _id: false });
const ComponentMasterSchema = new Schema({ enabled: { type: Boolean, default: true }, radius: boundedNumber(12, 0, 40), height: boundedNumber(40, 20, 120), padding: boundedNumber(16, 0, 64), shadow: { type: String, enum: ['none', 'subtle', 'soft'], default: 'subtle' }, variants: { type: [ComponentVariantSchema], default: [] } }, { _id: false });
const CanvasLayerStyleSchema = new Schema({
  backgroundColor: colourToken('#FFFFFF'), backgroundImage: { type: String, default: '', trim: true, maxlength: 500, validate: { validator: (value) => value === '' || /^(?:https?:\/\/|\/)/i.test(value), message: 'backgroundImage must be an HTTPS or local asset path.' } }, overlayColor: { type: String, default: '', trim: true, validate: { validator: (value) => value === '' || HEX_COLOUR.test(value), message: 'overlayColor must be a hex colour or empty.' } }, opacity: { type: Number, default: 1, min: .2, max: 1 }, color: colourToken('#152225'),
  borderColor: colourToken('#E6E9E6'), borderWidth: boundedNumber(1, 0, 4), borderStyle: { type: String, enum: ['none', 'solid', 'dashed', 'dotted'], default: 'solid' }, borderRadius: boundedNumber(12, 0, 80),
  boxShadow: { type: String, enum: ['none', 'subtle', 'soft', 'raised', 'floating'], default: 'subtle' }, padding: boundedNumber(16, 0, 120), margin: boundedNumber(0, -120, 120), fontSize: boundedNumber(14, 10, 64),
  fontFamily: { type: String, default: 'Open Sans', maxlength: 120 }, fontWeight: boundedNumber(700, 400, 900), textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
  display: { type: String, enum: ['block', 'flex', 'grid'], default: 'flex' }, flexDirection: { type: String, enum: ['row', 'column'], default: 'column' }, justifyContent: { type: String, enum: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'], default: 'center' }, alignItems: { type: String, enum: ['flex-start', 'center', 'flex-end', 'stretch'], default: 'stretch' }, gap: boundedNumber(8, 0, 96),
  widthMode: { type: String, enum: ['fixed', 'auto', 'fill'], default: 'fixed' }, heightMode: { type: String, enum: ['fixed', 'auto', 'fill'], default: 'fixed' }, minWidth: boundedNumber(0, 0, 1920), maxWidth: boundedNumber(1920, 40, 1920), minHeight: boundedNumber(0, 0, 1200), maxHeight: boundedNumber(1200, 24, 1200),
  position: { type: String, enum: ['absolute', 'relative', 'fixed', 'sticky'], default: 'absolute' }, overflow: { type: String, enum: ['visible', 'hidden', 'clip'], default: 'hidden' }, objectFit: { type: String, enum: ['cover', 'contain', 'fill'], default: 'cover' }, objectPosition: { type: String, enum: ['center', 'top', 'right', 'bottom', 'left'], default: 'center' },
  cropTop: boundedNumber(0, 0, 100), cropRight: boundedNumber(0, 0, 100), cropBottom: boundedNumber(0, 0, 100), cropLeft: boundedNumber(0, 0, 100), frame: { type: String, enum: ['none', 'section', 'card', 'modal', 'toolbar'], default: 'card' }, erased: { type: Boolean, default: false },
}, { _id: false });
const CanvasLayerSchema = new Schema({ id: { type: String, required: true, maxlength: 64 }, pageKey: { type: String, required: true, maxlength: 64 }, type: { type: String, default: 'component', maxlength: 32 }, label: { type: String, default: 'Layer', maxlength: 96 }, x: boundedNumber(40, -2000, 4000), y: boundedNumber(0, -2000, 4000), width: boundedNumber(320, 40, 1920), height: boundedNumber(120, 24, 1200), zIndex: boundedNumber(0, 0, 9999), visible: { type: Boolean, default: true }, locked: { type: Boolean, default: false }, parentId: { type: String, default: '', maxlength: 64 }, component: { type: String, default: 'card', maxlength: 64 }, dataBinding: { type: String, default: '', maxlength: 160 }, interaction: { type: String, default: '', maxlength: 160 }, style: { type: CanvasLayerStyleSchema, default: () => ({}) } }, { _id: false });
const IconAssetValue = { type: String, default: '', trim: true, maxlength: 500, validate: { validator: (value) => value === '' || /^(?:https?:\/\/|\/)/i.test(value), message: 'Icon assets must be HTTPS or local asset paths.' } };
const IconAssetsSchema = new Schema({
  globalShare: IconAssetValue,
  bottomAppBar: { type: Map, of: IconAssetValue, default: () => ({}) },
  quickAccess: { type: Map, of: IconAssetValue, default: () => ({}) },
}, { _id: false });

const DesignSystemSchema = new Schema({
  preset: { type: String, default: 'secureasset', trim: true, maxlength: 48 },
  colors: {
    appBackground: colourToken('#F7F7F5'), paper: colourToken('#FFFFFF'), textPrimary: colourToken('#152225'), textSecondary: colourToken('#68777A'), border: colourToken('#E6E9E6'),
    navigation: colourToken('#0B5270'), navigationText: colourToken('#FFFFFF'), primary: colourToken('#0B5270'), secondary: colourToken('#E46F4F'), success: colourToken('#238062'),
    submit: colourToken('#66752D'), edit: colourToken('#D97706'), danger: colourToken('#C74343'), icon: colourToken('#0B5270'),
  },
  typography: {
    fontFamily: { type: String, default: 'Open Sans', trim: true, maxlength: 120 }, baseSize: boundedNumber(14, 12, 20),
    headingWeight: boundedNumber(850, 600, 900), lineHeight: { type: Number, default: 1.5, min: 1.2, max: 2 },
  },
  layout: {
    density: { type: String, enum: ['compact', 'comfortable', 'spacious'], default: 'comfortable' }, contentMaxWidth: boundedNumber(1580, 960, 1920),
    appBarHeight: boundedNumber(76, 56, 96), sidebarWidth: boundedNumber(286, 220, 420), collapsedSidebarWidth: boundedNumber(86, 64, 120),
    pagePadding: boundedNumber(32, 12, 56), mobilePagePadding: boundedNumber(16, 10, 32),
  },
  borders: {
    width: boundedNumber(1, 0, 4), style: { type: String, enum: ['solid', 'dashed', 'dotted'], default: 'solid' }, cardRadius: boundedNumber(18, 0, 40),
    buttonRadius: boundedNumber(12, 0, 40), inputRadius: boundedNumber(13, 0, 32), navigationRadius: boundedNumber(12, 0, 32),
    modalRadius: boundedNumber(0, 0, 32), modalBorderWidth: boundedNumber(0, 0, 4),
  },
  shadows: {
    card: { type: String, enum: ['none', 'subtle', 'soft', 'raised', 'floating'], default: 'soft' },
    modal: { type: String, enum: ['none', 'soft', 'raised', 'floating'], default: 'floating' },
    navigation: { type: String, enum: ['none', 'subtle', 'soft'], default: 'none' }, button: { type: String, enum: ['none', 'subtle', 'soft'], default: 'subtle' },
  },
  icons: { size: boundedNumber(20, 14, 32), navSize: boundedNumber(18, 14, 28), color: colourToken('#0B5270'), rounded: { type: Boolean, default: true } },
  effects: { enableHoverLift: { type: Boolean, default: true }, enableGlassNavigation: { type: Boolean, default: true }, cardPadding: boundedNumber(24, 12, 48), buttonHeight: boundedNumber(40, 32, 64) },
  branding: { primary: colourToken('#0B5270'), secondary: colourToken('#0F172A'), accent: colourToken('#238062'), logoUrl: { type: String, default: '', maxlength: 500 }, logoLightUrl: { type: String, default: '', maxlength: 500 }, faviconUrl: { type: String, default: '', maxlength: 500 }, fontFamily: { type: String, default: 'Open Sans', maxlength: 120 } },
  buttons: { primary: { type: ButtonTokenSchema, default: () => ({}) }, secondary: { type: ButtonTokenSchema, default: () => ({}) }, submit: { type: ButtonTokenSchema, default: () => ({}) }, edit: { type: ButtonTokenSchema, default: () => ({}) }, accept: { type: ButtonTokenSchema, default: () => ({}) }, danger: { type: ButtonTokenSchema, default: () => ({}) }, outlined: { type: ButtonTokenSchema, default: () => ({}) } },
  bottomAppBar: { enabled: { type: Boolean, default: true }, background: colourToken('#FFFFFF'), textColor: colourToken('#68777A'), activeColor: colourToken('#0B5270'), inactiveColor: colourToken('#68777A'), indicatorColor: colourToken('#0B5270'), activeIndicator: { type: String, enum: ['pill', 'line', 'none'], default: 'line' }, height: boundedNumber(66, 48, 104), iconSize: boundedNumber(22, 14, 36), labelSize: boundedNumber(10.5, 8, 16), itemGap: boundedNumber(2, 0, 24), radius: boundedNumber(0, 0, 40), shadow: { type: String, enum: ['none', 'subtle', 'soft', 'floating'], default: 'soft' }, blur: boundedNumber(12, 0, 32), opacity: { type: Number, default: .96, min: .5, max: 1 }, position: { type: String, enum: ['fixed', 'floating'], default: 'fixed' }, safeArea: boundedNumber(12, 0, 48), desktopVisible: { type: Boolean, default: false }, mobileVisible: { type: Boolean, default: true } },
  iconLibrary: { style: { type: String, enum: ['outline', 'filled', 'rounded', 'sharp', 'two-tone'], default: 'rounded' }, tone: { type: String, enum: ['monochrome', 'colorful'], default: 'monochrome' }, defaultColor: colourToken('#0B5270'), size: boundedNumber(20, 12, 64), strokeWidth: { type: Number, default: 1.8, min: .5, max: 4 }, opacity: { type: Number, default: 1, min: .2, max: 1 }, favorites: { type: [String], default: [] }, recent: { type: [String], default: [] } },
  iconAssets: { type: IconAssetsSchema, default: () => ({}) },
  navigation: { type: [NavigationDesignItemSchema], default: [], validate: { validator: (value) => value.length <= 120, message: 'navigation cannot contain more than 120 items.' } }, pageDesigns: { type: [PageDesignTokenSchema], default: [], validate: { validator: (value) => value.length <= 400, message: 'pageDesigns cannot contain more than 400 pages.' } },
  componentLibrary: { type: Map, of: ComponentMasterSchema, default: () => ({}) },
  profiles: { public: { type: String, default: 'secureasset', maxlength: 48 }, authentication: { type: String, default: 'secureasset', maxlength: 48 }, dashboard: { type: String, default: 'secureasset', maxlength: 48 }, admin: { type: String, default: 'secureasset', maxlength: 48 }, theme: { type: String, enum: ['light', 'dark', 'high-contrast', 'campaign'], default: 'light' } },
  motion: { duration: boundedNumber(160, 0, 1200), easing: { type: String, enum: ['standard', 'emphasized', 'spring'], default: 'standard' }, reducedMotion: { type: Boolean, default: false }, gridSpacing: boundedNumber(8, 2, 64), zIndexBase: boundedNumber(1000, 0, 10000) },
  canvas: { snapToGrid: { type: Boolean, default: true }, rulers: { type: Boolean, default: true }, guides: { type: Boolean, default: true }, gridSize: boundedNumber(8, 2, 64), zoom: { type: Number, default: 1, min: .25, max: 2 }, layers: { type: [CanvasLayerSchema], default: [], validate: { validator: (value) => value.length <= 1600, message: 'canvas cannot contain more than 1600 layers.' } } },
}, { _id: false });

const SiteSettingSchema = new Schema({
  key: { type: String, default: 'default', unique: true, index: true },
  siteTitle: { type: String, default: 'SecureAsset' },
  shortTitle: { type: String, default: 'SecureAsset' },
  tagline: { type: String, default: 'Property, tenancy and survey management in one secure platform.' },
  description: String,
  logoUrl: String,
  logoLightUrl: String,
  faviconUrl: String,
  defaultOgImageUrl: String,
  brand: {
    primaryColor: { type: String, default: '#0B5270' }, secondaryColor: { type: String, default: '#0f172a' },
    accentColor: { type: String, default: '#22c55e' }, fontFamily: { type: String, default: 'Open Sans' },
  },
  design: { type: DesignSystemSchema, default: () => ({}) },
  contact: { email: String, phone: String, whatsapp: String, address: String, supportHours: String },
  social: { facebook: String, instagram: String, x: String, linkedin: String, youtube: String },
  map: {
    provider: { type: String, enum: ['google'], default: 'google' },
    publicApiKey: String,
    enabled: { type: Boolean, default: false },
    navigationEnabled: { type: Boolean, default: true },
    locationPickerEnabled: { type: Boolean, default: true },
    reverseGeocodeEnabled: { type: Boolean, default: true },
    directionsEnabled: { type: Boolean, default: true },
    serverRoutesEnabled: { type: Boolean, default: true },
    routesEnabled: { type: Boolean, default: true },
    placesEnabled: { type: Boolean, default: true },
    placesUiKitEnabled: { type: Boolean, default: true },
    addressValidationEnabled: { type: Boolean, default: true },
    elevationEnabled: { type: Boolean, default: true },
    roadsEnabled: { type: Boolean, default: true },
    routeOptimizationEnabled: { type: Boolean, default: false },
    navigationConnectEnabled: { type: Boolean, default: false },
    groundingLiteEnabled: { type: Boolean, default: false },
    streetViewPublishEnabled: { type: Boolean, default: false },
    useTraffic: { type: Boolean, default: true },
    routeRefreshSeconds: { type: Number, default: 10, min: 5, max: 120 },
    locationUpdateSeconds: { type: Number, default: 5, min: 1, max: 60 },
    maxRouteWaypoints: { type: Number, default: 25, min: 0, max: 25 },
    cloudProjectId: String,
    regionCode: { type: String, default: 'IN' },
    languageCode: { type: String, default: 'en-US' },
    units: { type: String, enum: ['METRIC', 'IMPERIAL'], default: 'METRIC' },
    navigationConnectAndroidAppId: String,
    navigationConnectIosAppId: String,
    mapId: String,
    defaultLatitude: Number,
    defaultLongitude: Number,
    defaultZoom: Number,
    travelMode: { type: String, enum: ['DRIVING', 'WALKING', 'BICYCLING', 'TRANSIT'], default: 'DRIVING' },
  },
  seo: { titleTemplate: { type: String, default: '%s | SecureAsset' }, defaultTitle: String, defaultDescription: String, keywords: [String], robots: { type: String, default: 'index,follow' }, canonicalBaseUrl: String, googleSiteVerification: String },
  homepage: { heroEnabled: { type: Boolean, default: true }, featuredPropertiesEnabled: { type: Boolean, default: true }, featuredSurveyorsEnabled: { type: Boolean, default: true }, statsEnabled: { type: Boolean, default: true } },
  authentication: {
    badge: { type: String, default: 'Enterprise property operations' },
    headline: { type: String, default: 'Every property workflow. One secure platform.' },
    description: { type: String, default: 'Manage properties, tenants, payments, surveys, legal records and communication with secure role-based access.' },
    features: { type: [String], default: ['Role-based access', 'Encrypted document vault', 'Real-time messaging', 'Automated billing', 'Audit trails'] },
    footerText: { type: String, default: 'Enterprise property, tenancy and survey operations' },
    loginTitle: { type: String, default: 'Welcome back' }, loginSubtitle: { type: String, default: 'Sign in with your organisation account.' },
    registerTitle: { type: String, default: 'Create your account' }, registerSubtitle: { type: String, default: 'Create your account and verify your registered mobile number with OTP.' },
    otpTitle: { type: String, default: 'Passwordless login' }, otpSubtitle: { type: String, default: 'Use a secure one-time password sent to your registered mobile.' },
    forgotTitle: { type: String, default: 'Reset password' }, forgotSubtitle: { type: String, default: 'Enter your registered email or mobile number. The reset OTP is sent to your registered mobile.' },
    allowRegistration: { type: Boolean, default: true }, allowPasswordLogin: { type: Boolean, default: true }, allowOtpLogin: { type: Boolean, default: true },
    showDemoAccounts: { type: Boolean, default: false },
  },
  maintenance: { enabled: { type: Boolean, default: false }, message: String, allowedIps: [String] },
  legal: { privacyUrl: String, termsUrl: String, cookieUrl: String },
  footer: {
    description: String,
    navigation: [{ heading: String, links: [{ label: String, path: String, external: { type: Boolean, default: false } }] }],
    legalLinks: [{ label: String, path: String, external: { type: Boolean, default: false } }],
    callback: { label: { type: String, default: 'Request a callback' }, path: { type: String, default: '/callback' } },
  },
  updatedBy: objectId('User'),
}, timestamps);

const SeoPageSchema = new Schema({
  path: { type: String, required: true, unique: true, trim: true, index: true },
  title: { type: String, required: true }, description: String, keywords: [String],
  canonicalUrl: String, robots: { type: String, default: 'index,follow' },
  ogTitle: String, ogDescription: String, ogImageUrl: String, ogType: { type: String, default: 'website' },
  twitterCard: { type: String, default: 'summary_large_image' },
  structuredData: Schema.Types.Mixed,
  active: { type: Boolean, default: true, index: true },
  updatedBy: objectId('User'),
}, timestamps);

const HomeCarouselSchema = new Schema({
  title: { type: String, required: true }, subtitle: String, eyebrow: String,
  imageUrl: String, mobileImageUrl: String, altText: String,
  primaryCta: { label: String, url: String }, secondaryCta: { label: String, url: String },
  overlay: { enabled: { type: Boolean, default: true }, opacity: { type: Number, default: 0.35, min: 0, max: 1 } },
  textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
  sortOrder: { type: Number, default: 0, index: true },
  startsAt: Date, endsAt: Date, active: { type: Boolean, default: true, index: true },
  audience: { type: String, enum: ['all', 'tenant', 'landlord', 'surveyor'], default: 'all' },
  updatedBy: objectId('User'),
}, timestamps);
HomeCarouselSchema.index({ active: 1, sortOrder: 1, startsAt: 1, endsAt: 1 });

const HomeSectionSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['stats', 'features', 'featured_properties', 'featured_surveyors', 'locations', 'testimonials', 'cta', 'custom'], required: true },
  title: String, subtitle: String, content: Schema.Types.Mixed,
  sortOrder: { type: Number, default: 0, index: true }, active: { type: Boolean, default: true, index: true },
  background: { color: String, imageUrl: String }, updatedBy: objectId('User'),
}, timestamps);

const LandlordPlanSchema = new Schema({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true }, description: String, rank: { type: Number, default: 0 }, active: { type: Boolean, default: true, index: true },
  prices: { monthly: { type: Number, default: 0 }, yearly: { type: Number, default: 0 }, currency: { type: String, default: 'INR' } },
  limits: {
    properties: { type: Number, default: 1 }, buildings: { type: Number, default: 1 }, apartments: { type: Number, default: 5 },
    rooms: { type: Number, default: 20 }, beds: { type: Number, default: 20 }, publicListings: { type: Number, default: 2 },
    activeTenants: { type: Number, default: 20 }, storageMB: { type: Number, default: 5120, min: 200, max: 10485760 }, teamMembers: { type: Number, default: 1 },
  },
  features: {
    rentAutomation: Boolean, advancedReports: Boolean, propertyPromotions: Boolean, tenantInterviews: Boolean,
    utilityBilling: Boolean, multipleBranches: Boolean, customRoles: Boolean, apiAccess: Boolean, prioritySupport: Boolean,
  },
  graceDays: { type: Number, default: 7 }, featured: Boolean, updatedBy: objectId('User'),
}, timestamps);

const PropertyTypeConfigSchema = new Schema({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true }, label: { type: String, required: true },
  category: { type: String, enum: ['residential', 'commercial', 'land', 'hospitality', 'event', 'other'], default: 'residential' },
  hierarchyMode: { type: String, enum: ['simple', 'building', 'apartment_building', 'pg_hostel', 'commercial', 'land'], default: 'simple' },
  fields: [PropertyTypeFieldSchema],
  allowedPurposes: [{ type: String, enum: ['rent', 'sale', 'lease'] }],
  active: { type: Boolean, default: true, index: true }, sortOrder: { type: Number, default: 0 }, updatedBy: objectId('User'),
}, timestamps);

const AreaUnitSchema = new Schema({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true }, label: { type: String, required: true }, symbol: String,
  region: { country: String, state: String, city: String, district: String }, squareMetreFactor: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true, index: true }, sortOrder: { type: Number, default: 0 }, updatedBy: objectId('User'),
}, timestamps);

const PropertySpaceSchema = new Schema({
  property: { ...objectId('Property', true), index: true }, owner: { ...objectId('User', true), index: true }, parent: { ...objectId('PropertySpace'), index: true },
  level: { type: String, enum: ['building', 'floor', 'apartment', 'room', 'bed', 'office', 'shop', 'showroom', 'warehouse_unit', 'plot', 'other'], required: true, index: true },
  name: { type: String, required: true, trim: true }, code: { type: String, trim: true }, roomNumber: String, flatNumber: String, apartmentNumber: String, galleryScope: { type: String, enum: ['property','apartment','room'], default: 'room' }, floorNumber: String, sortOrder: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'available', 'reserved', 'occupied', 'rented', 'sold', 'sold_out', 'leased', 'maintenance', 'inactive', 'archived'], default: 'draft', index: true },
  rentable: { type: Boolean, default: false }, sellable: { type: Boolean, default: false }, purpose: { type: String, enum: ['rent', 'sale', 'lease'], default: 'rent' },
  visibility: { type: String, enum: ['private', 'public'], default: 'private', index: true }, publicationStatus: { type: String, enum: ['draft', 'pending_approval', 'published', 'paused', 'archived'], default: 'draft', index: true },
  price: Number, securityDeposit: Number, maintenanceCharge: Number, area: { value: Number, unit: String },
  roomDetails: Schema.Types.Mixed, furnishing: Schema.Types.Mixed, amenities: [String],
  occupancyRules: { maxTotal: Number, maxAdults: Number, maxChildren: Number, maxPerRoom: Number, familyAllowed: Boolean, bachelorsAllowed: Boolean, studentsAllowed: Boolean, professionalsAllowed: Boolean, sharedOccupancyAllowed: Boolean, petsAllowed: Boolean, additionalOccupantsRequireApproval: Boolean },
  availableFrom: Date, coverImage: String, description: String,
  promotion: { featured: Boolean, topListing: Boolean, urgentType: String, startsAt: Date, endsAt: Date },
  metrics: { views: { type: Number, default: 0 }, clicks: { type: Number, default: 0 }, enquiries: { type: Number, default: 0 }, applications: { type: Number, default: 0 }, siteVisits: { type: Number, default: 0 } },
  createdBy: objectId('User'), updatedBy: objectId('User'), deletedAt: Date,
}, timestamps);
PropertySpaceSchema.index({ property: 1, parent: 1, level: 1, sortOrder: 1 });
PropertySpaceSchema.index({ visibility: 1, publicationStatus: 1, purpose: 1, status: 1 });
PropertySpaceSchema.index({ name: 'text', code: 'text', description: 'text', amenities: 'text' }, { name: 'property_space_search_text', weights: { name: 10, code: 8, amenities: 4, description: 2 } });

const PropertyMediaSchema = new Schema({
  property: { ...objectId('Property', true), index: true }, space: { ...objectId('PropertySpace'), index: true }, owner: { ...objectId('User', true), index: true },
  category: { type: String, required: true, index: true }, mediaType: { type: String, enum: ['image', 'video', '360', 'document'], default: 'image' },
  url: { type: String, required: true }, document: objectId('Document'), driveFile: objectId('DriveFile'), thumbnailUrl: String, caption: String, altText: String,
  sortOrder: { type: Number, default: 0 }, cover: { type: Boolean, default: false }, visibility: { type: String, enum: ['private', 'public', 'tenant', 'manager', 'surveyor', 'legal'], default: 'private', index: true },
  watermark: { enabled: Boolean, text: String }, compressed: Boolean, uploadedBy: objectId('User'), deletedAt: Date,
}, timestamps);
PropertyMediaSchema.index({ property: 1, space: 1, category: 1, sortOrder: 1 });

const TenantProfileSchema = new Schema({
  user: { ...objectId('User', true), unique: true, index: true }, profileImage: String, profileVisibility: { type: String, enum: ['private', 'applications', 'landlords'], default: 'applications' },
  dateOfBirth: Date, gender: String, currentAddress: Schema.Types.Mixed, permanentAddress: Schema.Types.Mixed,
  occupation: String, employerInstitution: String, monthlyIncome: Number, emergencyContact: Schema.Types.Mixed,
  identityDocuments: [objectId('DriveFile')], addressProofs: [objectId('DriveFile')], employmentProofs: [objectId('DriveFile')],
  references: [{ name: String, phone: String, relation: String, verified: Boolean }],
  preferences: { locations: [String], propertyTypes: [String], minBudget: Number, maxBudget: Number, moveInDate: Date },
  completedPercent: { type: Number, default: 0 }, updatedBy: objectId('User'),
}, timestamps);

const TenantKycSchema = new Schema({
  user: { ...objectId('User', true), unique: true, index: true },
  status: { type: String, enum: ['not_started', 'incomplete', 'submitted', 'under_review', 'changes_required', 'verified', 'rejected', 'expired', 'suspended'], default: 'not_started', index: true },
  governmentIdentity: { documentType: String, documentId: String, frontFile: objectId('DriveFile'), backFile: objectId('DriveFile') },
  addressProofDetails: { documentType: String, documentId: String, frontFile: objectId('DriveFile'), backFile: objectId('DriveFile') },
  passportPhoto: { file: objectId('DriveFile'), requirementsAccepted: Boolean },
  governmentId: objectId('DriveFile'), addressProof: objectId('DriveFile'), profilePhoto: objectId('DriveFile'), selfie: objectId('DriveFile'), employmentProof: objectId('DriveFile'),
  phoneVerified: Boolean, emailVerified: Boolean, emergencyContactVerified: Boolean, employmentVerified: Boolean,
  submittedAt: Date, reviewedAt: Date, verifiedAt: Date, expiresAt: Date, reviewer: objectId('User'), reason: String, notes: String,
  history: [{ status: String, reason: String, by: objectId('User'), at: { type: Date, default: Date.now } }],
}, timestamps);

const OccupantSchema = new Schema({
  tenant: { ...objectId('User', true), index: true }, application: { ...objectId('Application'), index: true }, tenancy: { ...objectId('Tenancy'), index: true },
  fullName: { type: String, required: true }, age: Number, gender: String, relationship: String, occupation: String,
  identityDocument: objectId('DriveFile'), phone: String,
  kycStatus: { type: String, enum: ['not_started', 'submitted', 'verified', 'rejected'], default: 'not_started' },
  sensitive: { type: Boolean, default: true }, createdBy: objectId('User'), updatedBy: objectId('User'),
}, timestamps);

const TenantInterviewSchema = new Schema({
  application: { ...objectId('Application', true), index: true }, property: { ...objectId('Property', true), index: true }, space: objectId('PropertySpace'), rentalUnit: objectId('RentalUnit'),
  landlord: { ...objectId('User', true), index: true }, tenant: { ...objectId('User', true), index: true },
  scheduledAt: Date, type: { type: String, enum: ['online', 'in_person', 'phone'], default: 'online' }, location: String, meetingUrl: String,
  questions: [{ question: String, answer: String, score: Number }], privateNotes: String, rating: Number,
  status: { type: String, enum: ['requested', 'scheduled', 'rescheduled', 'completed', 'cancelled', 'tenant_absent', 'landlord_absent'], default: 'requested', index: true },
  decision: { type: String, enum: ['pending', 'shortlist', 'approve', 'reject', 'waiting_list'], default: 'pending' }, followUpAt: Date,
  createdBy: objectId('User'), updatedBy: objectId('User'),
}, timestamps);

const PropertyVisitSchema = new Schema({
  property: { ...objectId('Property', true), index: true }, space: objectId('PropertySpace'), rentalUnit: objectId('RentalUnit'), requester: { ...objectId('User', true), index: true }, landlord: { ...objectId('User', true), index: true }, assignedTo: objectId('User'),
  preferredStart: Date, proposedStart: Date, confirmedStart: Date, visitorCount: Number, contact: Schema.Types.Mixed, purpose: String, message: String, accessibilitySupport: String,
  status: { type: String, enum: ['requested', 'pending_approval', 'approved', 'rescheduled', 'confirmed', 'visitor_arrived', 'visit_in_progress', 'completed', 'customer_absent', 'landlord_absent', 'cancelled', 'rejected'], default: 'requested', index: true },
  instructions: String, meetingPoint: String, attendance: Schema.Types.Mixed, feedback: Schema.Types.Mixed, interest: { type: String, enum: ['unknown', 'interested', 'not_interested'], default: 'unknown' },
  createdBy: objectId('User'), updatedBy: objectId('User'),
}, timestamps);

const TenancySchema = new Schema({
  tenancyNumber: { type: String, unique: true, sparse: true, trim: true, uppercase: true },
  tenant: { ...objectId('User', true), index: true }, landlord: { ...objectId('User', true), index: true }, property: { ...objectId('Property', true), index: true }, space: objectId('PropertySpace'), rentalUnit: objectId('RentalUnit'), application: objectId('Application'), agreement: objectId('AgreementRequest'), lease: objectId('Lease'),
  status: { type: String, enum: ['reserved', 'application_pending', 'deposit_pending', 'agreement_pending', 'payment_pending', 'active', 'notice', 'notice_period', 'vacating', 'move_out', 'move_out_inspection', 'final_calculation', 'landlord_review', 'final_payment', 'deposit_settlement', 'closed', 'completed', 'cancelled'], default: 'reserved', index: true },
  startDate: Date, endDate: Date, monthlyRent: Number, securityDeposit: Number,
  maintenanceCharge: { type: Number, min: 0, default: 0 }, bookingAmount: { type: Number, min: 0, default: 0 },
  pricingSnapshot: { type: Schema.Types.Mixed, default: {} },
  dueDay: { type: Number, min: 1, max: 31, default: 1 },
  // Stored as HH:mm in the application/server timezone. The billing runner is
  // invoked every minute, so this becomes the exact recurring invoice deadline.
  dueTime: { type: String, default: '09:00', match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Due time must use HH:mm (24-hour) format'] },
  occupants: [objectId('Occupant')],
  moveInChecklist: [{ label: String, completed: Boolean, file: objectId('DriveFile') }], moveOutChecklist: [{ label: String, completed: Boolean, file: objectId('DriveFile') }],
  moveInInspection: { completedAt: Date, completedBy: objectId('User'), notes: String, evidence: [objectId('DriveFile')] },
  moveOutInspection: { completedAt: Date, completedBy: objectId('User'), notes: String, evidence: [objectId('DriveFile')] },
  evidence: [{ file: objectId('DriveFile'), category: String, caption: String, recordedAt: { type: Date, default: Date.now }, recordedBy: objectId('User') }],
  notices: [{ type: String, title: String, message: String, servedAt: Date, effectiveAt: Date, file: objectId('DriveFile'), createdBy: objectId('User') }],
  moveOutSettlement: { outstandingAmount: Number, deductions: [{ label: String, amount: Number }], depositAmount: Number, refundAmount: Number, finalPaymentAmount: Number, status: { type: String, enum: ['not_started', 'calculated', 'reviewed', 'payment_pending', 'deposit_settled', 'closed'], default: 'not_started' }, settledAt: Date, settlementDocument: objectId('DriveFile') },
  statusHistory: [{ from: String, to: String, reason: String, changedBy: objectId('User'), changedAt: { type: Date, default: Date.now } }],
  closedAt: Date, closedBy: objectId('User'),
  createdBy: objectId('User'), updatedBy: objectId('User'),
}, timestamps);
TenancySchema.index({ rentalUnit: 1, createdAt: -1 }, { name: 'tenancy_rental_unit_history' });
TenancySchema.index(
  { rentalUnit: 1 },
  {
    unique: true,
    name: 'tenancy_one_live_record_per_rental_unit',
    partialFilterExpression: {
      rentalUnit: { $type: 'objectId' },
      status: { $in: ['reserved', 'application_pending', 'deposit_pending', 'agreement_pending', 'payment_pending', 'active', 'notice', 'notice_period', 'vacating', 'move_out', 'move_out_inspection', 'final_calculation', 'landlord_review', 'final_payment', 'deposit_settlement'] },
    },
  },
);

const RentalInvoiceSchema = new Schema({
  invoiceNumber: { type: String, required: true, unique: true, index: true }, tenancy: { ...objectId('Tenancy', true), index: true }, rentCycle: objectId('RentCycle'), tenant: { ...objectId('User', true), index: true }, landlord: { ...objectId('User', true), index: true }, property: { ...objectId('Property', true), index: true }, space: objectId('PropertySpace'), rentalUnit: { ...objectId('RentalUnit'), index: true },
  billingMonth: { type: String, required: true, index: true }, cycleStartsAt: { type: Date, index: true }, cycleEndsAt: { type: Date, index: true }, dueDate: { type: Date, required: true, index: true },
  charges: { baseRent: Number, electricity: Number, water: Number, maintenance: Number, parking: Number, internet: Number, gas: Number, cleaning: Number, commonArea: Number, securityDeposit: Number, lateFee: Number, other: [{ label: String, amount: Number }] },
  discounts: Number, previousBalance: Number, totalAmount: Number, paidAmount: { type: Number, default: 0 }, balanceAmount: Number, paymentCycle: { type: String, enum: ['monthly','quarterly','half_yearly','yearly','custom'], default: 'monthly' }, whatsappReminderEnabled: { type: Boolean, default: false }, legalAgreement: objectId('DriveFile'),
  status: { type: String, enum: ['upcoming', 'pending', 'partially_paid', 'paid', 'overdue', 'failed', 'refunded', 'waived', 'disputed'], default: 'upcoming', index: true },
  payments: [{ payment: objectId('Payment'), amount: Number, method: String, transactionId: String, submittedAt: Date, acceptedAt: Date, paidAt: Date, proof: objectId('DriveFile'), status: String }], receiptFile: objectId('DriveFile'), lastReminderAt: Date,
  rentCycleReminder: {
    key: { type: String, trim: true, maxlength: 180 }, cycleEndsAt: Date, dueAt: Date,
    status: { type: String, enum: ['processing', 'queued', 'failed'] }, attemptedAt: Date, queuedAt: Date,
    lastError: { type: String, trim: true, maxlength: 500 },
  },
  createdBy: objectId('User'), updatedBy: objectId('User'),
}, timestamps);
RentalInvoiceSchema.index({ tenancy: 1, billingMonth: 1 }, { unique: true });

const UtilityReadingSchema = new Schema({
  tenancy: { ...objectId('Tenancy', true), index: true }, property: { ...objectId('Property', true), index: true }, space: objectId('PropertySpace'), rentalUnit: objectId('RentalUnit'), tenant: { ...objectId('User', true), index: true }, landlord: { ...objectId('User', true), index: true },
  utilityType: { type: String, enum: ['electricity', 'water'], required: true, index: true }, billingPeriod: { type: String, required: true, index: true },
  previousReading: Number, currentReading: Number, unitsConsumed: Number, ratePerUnit: Number, fixedCharge: Number, tax: Number, otherCharge: Number, totalAmount: Number,
  allocationMethod: { type: String, enum: ['direct', 'equal_room', 'equal_tenant', 'occupants', 'percentage', 'custom', 'sub_meter'], default: 'direct' }, allocations: [{ space: objectId('PropertySpace'), tenant: objectId('User'), percentage: Number, units: Number, amount: Number }],
  meterPhoto: objectId('DriveFile'), billDocument: objectId('DriveFile'), dueDate: Date, approved: Boolean,
  createdBy: objectId('User'), updatedBy: objectId('User'),
}, timestamps);

const ReminderRuleSchema = new Schema({
  owner: { ...objectId('User', true), index: true }, property: { ...objectId('Property'), index: true },
  eventType: { type: String, required: true, index: true }, offsetsDays: [{ type: Number }], repeatWeeklyUntilPaid: Boolean,
  channels: [{ type: String, enum: ['in_app', 'email', 'sms', 'whatsapp', 'push'] }], template: { subject: String, message: String }, active: { type: Boolean, default: true },
  createdBy: objectId('User'), updatedBy: objectId('User'),
}, timestamps);

const PropertyPromotionSchema = new Schema({
  property: { ...objectId('Property', true), index: true }, space: objectId('PropertySpace'), owner: { ...objectId('User', true), index: true },
  type: { type: String, enum: ['featured', 'top_listing', 'urgent_sale', 'urgent_rent', 'homepage_banner', 'recommended', 'location_sponsored'], required: true, index: true },
  startsAt: Date, endsAt: Date, amount: Number, status: { type: String, enum: ['pending', 'active', 'paused', 'expired', 'cancelled'], default: 'pending', index: true },
  metrics: { views: { type: Number, default: 0 }, clicks: { type: Number, default: 0 }, enquiries: { type: Number, default: 0 }, applications: { type: Number, default: 0 }, siteVisits: { type: Number, default: 0 }, conversions: { type: Number, default: 0 } },
  payment: objectId('Payment'), createdBy: objectId('User'), updatedBy: objectId('User'),
}, timestamps);

const FacilitySchema = new Schema({
  property: { ...objectId('Property', true), index: true },
  owner: { ...objectId('User', true), index: true },
  manager: { ...objectId('User'), index: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  type: { type: String, required: true, trim: true, index: true },
  description: { type: String, default: '', maxlength: 3000 },
  capacity: { type: Number, min: 1, default: 1 },
  visibility: { type: String, enum: ['private', 'tenant', 'public'], default: 'tenant', index: true },
  status: { type: String, enum: ['active', 'maintenance', 'inactive', 'archived'], default: 'active', index: true },
  bookingRequired: { type: Boolean, default: true },
  price: { type: Number, min: 0, default: 0 },
  deposit: { type: Number, min: 0, default: 0 },
  currency: { type: String, default: 'INR' },
  slotMinutes: { type: Number, min: 15, max: 1440, default: 60 },
  minimumNoticeHours: { type: Number, min: 0, default: 1 },
  maximumAdvanceDays: { type: Number, min: 1, default: 90 },
  availableDays: [{ type: String, enum: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] }],
  availableTimeSlots: [{ start: String, end: String }],
  amenities: [String],
  rules: [String],
  images: [String],
  createdBy: objectId('User'), updatedBy: objectId('User'), deletedAt: Date,
}, timestamps);
FacilitySchema.index({ property: 1, status: 1, visibility: 1 });
FacilitySchema.index({ name: 'text', type: 'text', description: 'text', amenities: 'text' }, { name: 'facility_search_text', weights: { name: 10, type: 7, amenities: 4, description: 2 } });

const FacilityBookingSchema = new Schema({
  facility: { ...objectId('Facility', true), index: true },
  property: { ...objectId('Property', true), index: true },
  owner: { ...objectId('User', true), index: true },
  requester: { ...objectId('User', true), index: true },
  startAt: { type: Date, required: true, index: true },
  endAt: { type: Date, required: true, index: true },
  guests: { type: Number, min: 1, default: 1 },
  purpose: { type: String, maxlength: 500 },
  status: { type: String, enum: ['requested', 'approved', 'rescheduled', 'rejected', 'cancelled', 'in_progress', 'completed', 'no_show'], default: 'requested', index: true },
  paymentStatus: { type: String, enum: ['not_required', 'pending', 'paid', 'failed', 'refunded'], default: 'not_required', index: true },
  amount: { type: Number, min: 0, default: 0 },
  deposit: { type: Number, min: 0, default: 0 },
  notes: String,
  decisionNote: String,
  approvedBy: objectId('User'),
  payment: objectId('Payment'),
  createdBy: objectId('User'), updatedBy: objectId('User'), cancelledAt: Date,
}, timestamps);
FacilityBookingSchema.index({ facility: 1, startAt: 1, endAt: 1, status: 1 });
FacilityBookingSchema.index({ requester: 1, createdAt: -1 });


const PlatformModuleSchema = new Schema({
  key: { type: String, required: true, lowercase: true, trim: true },
  label: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  path: { type: String, required: true, trim: true },
  icon: { type: String, default: 'dashboard' },
  scope: { type: String, enum: ['public', 'app'], default: 'app', index: true },
  kind: { type: String, enum: ['page', 'resource', 'system', 'external'], default: 'resource' },
  section: { type: String, default: 'general', index: true },
  sectionOrder: { type: Number, default: 0, index: true },
  roles: [{ type: String, enum: ['admin', 'manager', 'landlord', 'tenant', 'user', 'surveyor'] }],
  modes: [{ type: String, enum: ['regular', 'landlord', 'surveyor'] }],
  accessRules: [{ roles: [{ type: String, enum: ['admin', 'manager', 'landlord', 'tenant', 'user', 'surveyor'] }], modes: [{ type: String, enum: ['regular', 'landlord', 'surveyor'] }] }],
  enabled: { type: Boolean, default: true, index: true },
  mobilePrimary: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0, index: true },
  featureFlag: String,
  badge: { text: String, color: String },
  metadata: { type: Schema.Types.Mixed, default: {} },
  updatedBy: objectId('User'),
}, timestamps);
PlatformModuleSchema.index({ scope: 1, key: 1 }, { unique: true, name: 'platform_module_scope_key_unique' });
PlatformModuleSchema.index({ scope: 1, enabled: 1, section: 1, sortOrder: 1 }, { name: 'platform_module_navigation' });
PlatformModuleSchema.index({ scope: 1, enabled: 1, sectionOrder: 1, section: 1, sortOrder: 1 }, { name: 'platform_module_section_navigation' });

const RolePermissionEntrySchema = new Schema({
  key: { type: String, required: true, lowercase: true, trim: true, maxlength: 140 },
  label: { type: String, required: true, trim: true, maxlength: 180 },
  category: { type: String, default: 'general', trim: true, maxlength: 80 },
  kind: { type: String, enum: ['module', 'resource', 'feature'], default: 'module' },
  enabled: { type: Boolean, default: true },
  actions: [{ type: String, enum: ['view', 'create', 'edit', 'delete', 'approve', 'export', 'download', 'notify'] }],
  scope: { type: String, enum: ['all', 'own', 'assigned', 'public'], default: 'all' },
}, { _id: false });

const RolePermissionSchema = new Schema({
  role: { type: String, enum: ['admin', 'manager', 'landlord', 'tenant', 'user', 'surveyor'], required: true, unique: true, index: true },
  entries: { type: [RolePermissionEntrySchema], default: [] },
  updatedBy: objectId('User'),
}, timestamps);

const ContentPageSchema = new Schema({
  path: { type: String, required: true, unique: true, trim: true, index: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true },
  subtitle: String,
  hero: { eyebrow: String, title: String, subtitle: String, imageUrl: String, align: { type: String, enum: ['left', 'center', 'right'], default: 'left' }, primaryCta: { label: String, url: String }, secondaryCta: { label: String, url: String } },
  sections: [{ key: String, type: { type: String }, title: String, subtitle: String, content: Schema.Types.Mixed, sortOrder: Number, active: { type: Boolean, default: true } }],
  visibility: { type: String, enum: ['public', 'authenticated'], default: 'public', index: true },
  active: { type: Boolean, default: true, index: true },
  updatedBy: objectId('User'),
}, timestamps);
ContentPageSchema.index({ active: 1, visibility: 1, path: 1 }, { name: 'content_page_public_lookup' });

const NotificationPreferenceSchema = new Schema({
  user: { ...objectId('User', true), unique: true, index: true },
  channels: { inApp: { type: Boolean, default: true }, email: { type: Boolean, default: true }, sms: { type: Boolean, default: false }, whatsapp: { type: Boolean, default: false }, push: { type: Boolean, default: false } },
  categories: { payment: { type: Boolean, default: true }, survey: { type: Boolean, default: true }, complaint: { type: Boolean, default: true }, lease: { type: Boolean, default: true }, maintenance: { type: Boolean, default: true }, message: { type: Boolean, default: true }, system: { type: Boolean, default: true } },
  quietHours: { enabled: { type: Boolean, default: false }, start: String, end: String, timezone: { type: String, default: 'Asia/Kolkata' } },
}, timestamps);

const IntegrationSettingSchema = new Schema({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  provider: { type: String, required: true, trim: true },
  category: { type: String, enum: ['payment', 'email', 'sms', 'whatsapp', 'storage', 'maps', 'analytics', 'identity', 'other'], default: 'other', index: true },
  enabled: { type: Boolean, default: false, index: true },
  status: { type: String, enum: ['unconfigured', 'configured', 'healthy', 'degraded', 'error', 'disabled'], default: 'unconfigured', index: true },
  publicConfig: { type: Schema.Types.Mixed, default: {} },
  secureConfig: {
    authorizationEncrypted: { type: String, select: false },
  },
  envRequirements: [String],
  lastCheckedAt: Date,
  lastError: String,
  updatedBy: objectId('User'),
}, timestamps);

const SiteEnquirySchema = new Schema({
  name: String, email: String, phone: String, message: String, property: objectId('Property'), space: objectId('PropertySpace'),
  type: { type: String, enum: ['contact', 'property', 'support', 'callback'], default: 'contact' }, preferredCallbackAt: Date, callbackWindow: String,
  status: { type: String, enum: ['new', 'contacted', 'qualified', 'closed', 'spam'], default: 'new', index: true }, assignedTo: objectId('User'),
}, timestamps);

export const PlatformModule = models.PlatformModule || model('PlatformModule', PlatformModuleSchema);
export const RolePermission = models.RolePermission || model('RolePermission', RolePermissionSchema);
export const ContentPage = models.ContentPage || model('ContentPage', ContentPageSchema);
export const NotificationPreference = models.NotificationPreference || model('NotificationPreference', NotificationPreferenceSchema);
export const IntegrationSetting = models.IntegrationSetting || model('IntegrationSetting', IntegrationSettingSchema);
export const SiteSetting = models.SiteSetting || model('SiteSetting', SiteSettingSchema);
export const SeoPage = models.SeoPage || model('SeoPage', SeoPageSchema);
export const HomeCarousel = models.HomeCarousel || model('HomeCarousel', HomeCarouselSchema);
export const HomeSection = models.HomeSection || model('HomeSection', HomeSectionSchema);
export const LandlordPlan = models.LandlordPlan || model('LandlordPlan', LandlordPlanSchema);
export const PropertyTypeConfig = models.PropertyTypeConfig || model('PropertyTypeConfig', PropertyTypeConfigSchema);
export const AreaUnit = models.AreaUnit || model('AreaUnit', AreaUnitSchema);
export const PropertySpace = models.PropertySpace || model('PropertySpace', PropertySpaceSchema);
export const PropertyMedia = models.PropertyMedia || model('PropertyMedia', PropertyMediaSchema);
export const TenantProfile = models.TenantProfile || model('TenantProfile', TenantProfileSchema);
export const TenantKyc = models.TenantKyc || model('TenantKyc', TenantKycSchema);
export const Occupant = models.Occupant || model('Occupant', OccupantSchema);
export const TenantInterview = models.TenantInterview || model('TenantInterview', TenantInterviewSchema);
export const PropertyVisit = models.PropertyVisit || model('PropertyVisit', PropertyVisitSchema);
export const Tenancy = models.Tenancy || model('Tenancy', TenancySchema);
export const RentalInvoice = models.RentalInvoice || model('RentalInvoice', RentalInvoiceSchema);
export const UtilityReading = models.UtilityReading || model('UtilityReading', UtilityReadingSchema);
export const ReminderRule = models.ReminderRule || model('ReminderRule', ReminderRuleSchema);
export const PropertyPromotion = models.PropertyPromotion || model('PropertyPromotion', PropertyPromotionSchema);
export const SiteEnquiry = models.SiteEnquiry || model('SiteEnquiry', SiteEnquirySchema);
export const Facility = models.Facility || model('Facility', FacilitySchema);
export const FacilityBooking = models.FacilityBooking || model('FacilityBooking', FacilityBookingSchema);
