import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, FormHelperText, MenuItem, Paper, Stack, Step, StepLabel,
  Stepper, Switch, TextField, Typography,
} from '@mui/material';
import ProfessionalDialog from '../shared/ProfessionalDialog';
import LocationFields from '../shared/LocationFields';
import GooglePropertyLocationPicker from './GooglePropertyLocationPicker';
import AddPhotoAlternateRounded from '@mui/icons-material/AddPhotoAlternateRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CloudUploadRounded from '@mui/icons-material/CloudUploadRounded';
import MyLocationRounded from '@mui/icons-material/MyLocationRounded';
import NavigateBeforeRounded from '@mui/icons-material/NavigateBeforeRounded';
import NavigateNextRounded from '@mui/icons-material/NavigateNextRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import UploadFileRounded from '@mui/icons-material/UploadFileRounded';
import { createResource, getResource, reverseGeocodeLocation, updateResource, uploadDocument, validateMapAddress } from '../../services/api';
import { useSite } from '../../context/SiteContext';

const steps = ['Property Details', 'Utilities & Amenities', 'Legal Details', 'Media & Contact'];
const listingTypes = ['rent', 'sale', 'lease'];
const statuses = ['draft', 'pending_approval', 'available', 'partially_occupied', 'occupied', 'reserved', 'rented', 'sold', 'leased', 'maintenance', 'unavailable', 'archived'];
const numberOptions = Array.from({ length: 11 }, (_, index) => String(index));
const floorOptions = Array.from({ length: 81 }, (_, index) => String(index));
const furnishingOptions = ['unfurnished', 'semi_furnished', 'fully_furnished'];
const ownershipOptions = ['freehold', 'leasehold', 'cooperative_society', 'power_of_attorney', 'ancestral', 'other'];
const preferredContactOptions = ['phone', 'email', 'whatsapp', 'phone_or_email'];

const amenityFields = [
  ['lift', 'Lift'], ['security', 'Security'], ['cctv', 'CCTV'], ['gatedCommunity', 'Gated Community'],
  ['garden', 'Garden'], ['swimmingPool', 'Swimming Pool'], ['gym', 'Gym'], ['clubhouse', 'Clubhouse'],
  ['childrenPlayArea', "Children's Play Area"], ['joggingTrack', 'Jogging Track'], ['communityHall', 'Community Hall'],
  ['terrace', 'Terrace'], ['balcony', 'Balcony'], ['airConditioning', 'Air Conditioning'],
  ['modularKitchen', 'Modular Kitchen'], ['storeRoom', 'Store Room'], ['servantRoom', 'Servant Room'],
  ['wheelchairAccess', 'Wheelchair Access'],
] as const;

const nearbyFields = [
  ['school', 'School'], ['hospital', 'Hospital'], ['market', 'Market'], ['busStop', 'Bus Stop'],
  ['railwayStation', 'Railway Station'], ['airport', 'Airport'], ['shoppingMall', 'Shopping Mall'],
  ['park', 'Park'], ['bank', 'Bank'], ['pharmacy', 'Pharmacy'],
] as const;

const emptyFiles = {
  propertyImage: null as File | null,
  propertyPhotos: [] as File[],
  floorPlans: [] as File[],
  videoTour: null as File | null,
  virtualTour: null as File | null,
  propertyDocuments: [] as File[],
};

function getPath(source: any, path: string, fallback: any = '') {
  const value = path.split('.').reduce((current, key) => current?.[key], source);
  return value ?? fallback;
}

function hasAnyValue(values: unknown[]) {
  return values.some((value) => value !== undefined && value !== null && value !== '' && value !== false);
}

function boolFromAmenity(property: any, key: string, label: string) {
  const direct = getPath(property, `amenityDetails.${key}`, undefined);
  if (direct !== undefined) return Boolean(direct);
  return Array.isArray(property?.amenities) && property.amenities.includes(label);
}

function initialValues(property: any, propertyTypes: any[]) {
  const firstConfig = propertyTypes.find((item) => item.active !== false);
  const firstType = firstConfig?.key || '';
  const firstListingType = firstConfig?.allowedPurposes?.[0] || 'rent';
  const specifications = property?.specifications || {};
  const parking = property?.parking || {};
  const nearby = property?.nearbyFacilities || {};
  const specificationValues = [
    specifications.bedrooms, specifications.bathrooms, specifications.balconies, specifications.floorNumber,
    specifications.kitchenAttached, property?.areas?.builtUp, specifications.propertyAge, specifications.furnishingStatus,
    specifications.ownershipType, specifications.availableFrom,
  ];
  const parkingValues = [parking.carSpaces, parking.twoWheelerSpaces, parking.visitorParking];
  const storedLatitude = property?.map?.latitude ?? property?.location?.coordinates?.[1] ?? '';
  const storedLongitude = property?.map?.longitude ?? property?.location?.coordinates?.[0] ?? '';
  const values: Record<string, any> = {
    title: property?.title || '',
    type: property?.type || firstType,
    listingType: property?.purpose || property?.listingType || firstListingType,
    description: property?.description || '',
    status: statuses.includes(property?.status) ? property.status : 'available',
    // A new landlord listing keeps the existing default (public), while an
    // edit always reflects the stored value so Private/Public can be changed
    // without the wizard silently restoring the previous visibility.
    visibility: property?._id ? (property?.visibility === 'public' ? 'public' : 'private') : 'public',
    country: getPath(property, 'address.country', 'India'),
    state: getPath(property, 'address.state'),
    city: getPath(property, 'address.city'),
    locality: getPath(property, 'address.locality', getPath(property, 'map.locality')),
    landmark: getPath(property, 'address.landmark', getPath(property, 'map.landmark')),
    fullAddress: getPath(property, 'address.line1'),
    pinCode: getPath(property, 'address.postalCode'),
    latitude: storedLatitude,
    longitude: storedLongitude,
    googleMapsLocation: getPath(property, 'map.googleMapsLocation', [storedLatitude, storedLongitude].filter((v) => v !== '').join(',')),
    enableSpecifications: property?._id ? hasAnyValue(specificationValues) : false,
    bedrooms: specifications.bedrooms ?? getPath(property, 'roomDetails.bedrooms', getPath(property, 'bedrooms')),
    bathrooms: specifications.bathrooms ?? getPath(property, 'roomDetails.bathrooms', getPath(property, 'bathrooms')),
    balconies: specifications.balconies ?? getPath(property, 'roomDetails.balconies'),
    floorNumber: specifications.floorNumber ?? getPath(property, 'listingDetails.floor'),
    numberOfFloors: specifications.numberOfFloors ?? '',
    floorManagementEnabled: property?.floorManagementEnabled !== false,
    liftAvailable: Boolean(property?.liftAvailable),
    commonFacilities: Array.isArray(property?.commonFacilities) ? property.commonFacilities.join(', ') : '',
    rulesAndRestrictions: Array.isArray(property?.rulesAndRestrictions) ? property.rulesAndRestrictions.join('\n') : '',
    kitchenAttached: Boolean(specifications.kitchenAttached ?? (Number(getPath(property, 'roomDetails.kitchens', 0)) > 0)),
    builtUpArea: getPath(property, 'areas.builtUp', specifications.builtUpAreaSqft),
    propertyAge: specifications.propertyAge ?? getPath(property, 'listingDetails.propertyAgeYears'),
    furnishingStatus: specifications.furnishingStatus ?? getPath(property, 'furnishing.status', ''),
    ownershipType: specifications.ownershipType ?? '',
    availableFrom: specifications.availableFrom ? String(specifications.availableFrom).slice(0, 10) : getPath(property, 'ageDetails.availableFrom') ? String(getPath(property, 'ageDetails.availableFrom')).slice(0, 10) : '',
    enableParking: property?._id ? hasAnyValue(parkingValues) : false,
    carParkingSpaces: parking.carSpaces ?? getPath(property, 'roomDetails.coveredParking'),
    twoWheelerParkingSpaces: parking.twoWheelerSpaces,
    visitorParking: Boolean(parking.visitorParking),
    salePrice: getPath(property, 'pricing.salePrice'),
    monthlyRent: getPath(property, 'pricing.monthlyRent'),
    leaseAmount: getPath(property, 'pricing.leaseAmount'),
    securityDeposit: getPath(property, 'pricing.securityDeposit'),
    maintenanceCharges: getPath(property, 'pricing.maintenanceCharge'),
    pricePerSqFt: getPath(property, 'pricing.pricePerUnitArea'),
    tax: getPath(property, 'pricing.tax', getPath(property, 'pricing.propertyTax')),
    waterSupply: getPath(property, 'utilities.waterSupply'),
    electricityConnection: getPath(property, 'utilities.electricityConnection'),
    powerBackup: getPath(property, 'utilities.powerBackup'),
    internetAvailability: Boolean(getPath(property, 'utilities.internetAvailability', false)),
    gasConnection: Boolean(getPath(property, 'utilities.gasConnection', false)),
    sewageConnection: Boolean(getPath(property, 'utilities.sewageConnection', false)),
    reraNumber: getPath(property, 'legalDetails.reraNumber'),
    titleClear: Boolean(getPath(property, 'legalDetails.titleClear', false)),
    loanApproved: Boolean(getPath(property, 'legalDetails.loanApproved', false)),
    occupancyCertificate: Boolean(getPath(property, 'legalDetails.occupancyCertificate', false)),
    completionCertificate: Boolean(getPath(property, 'legalDetails.completionCertificate', false)),
    ownerName: getPath(property, 'contactInformation.ownerName'),
    agentName: getPath(property, 'contactInformation.agentName'),
    phoneNumber: getPath(property, 'contactInformation.phoneNumber'),
    emailAddress: getPath(property, 'contactInformation.emailAddress'),
    preferredContactMethod: getPath(property, 'contactInformation.preferredContactMethod', 'phone_or_email'),
  };
  amenityFields.forEach(([key, label]) => { values[`amenity.${key}`] = boolFromAmenity(property, key, label); });
  nearbyFields.forEach(([key]) => { values[`nearby.${key}`] = nearby[key] || ''; });
  return values;
}

function numberOrUndefined(value: any) {
  if (value === '' || value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sqftToSqm(value: any) {
  const sqft = numberOrUndefined(value);
  return sqft === undefined ? undefined : Math.round(sqft * 0.092903 * 100) / 100;
}

function parseMapLocation(value: string) {
  const text = String(value || '').trim();
  if (!text) return {};
  const direct = text.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  const at = text.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  const query = text.match(/[?&](?:q|query|destination)=(-?\d{1,3}(?:\.\d+)?)(?:%2C|,)(-?\d{1,3}(?:\.\d+)?)/i);
  const match = direct || at || query;
  if (!match) return { googleMapsLocation: text };
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return { googleMapsLocation: text };
  return { googleMapsLocation: text, latitude, longitude };
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  available: 'Available',
  partially_occupied: 'Partially Occuped',
  occupied: 'Occupied',
  reserved: 'Reserved',
  rented: 'Rented',
  sold: 'Sold',
  leased: 'Leased',
  maintenance: 'Maintenance',
  unavailable: 'Unavailable',
  archived: 'Archidved',
};

function sentence(value: string) {
  const raw = String(value || '');
  return statusLabels[raw] || raw.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return <Paper className="sa-surface-card" elevation={0} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 4 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-start' }} gap={1}>
      <Box>
        <Typography sx={{ fontWeight: 900, fontSize: 16 }}>{title}</Typography>
        {subtitle && <Typography color="text.secondary" sx={{ fontSize: 12.5, mt: .35 }}>{subtitle}</Typography>}
      </Box>
      {action}
    </Stack>
    <Divider sx={{ my: 2 }} />
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1.6 }}>{children}</Box>
  </Paper>;
}

function FilePicker({ label, value, multiple, accept, onChange, helper, required }: { label: string; value: File | File[] | null; multiple?: boolean; accept?: string; onChange: (files: File[]) => void; helper?: string; required?: boolean }) {
  const [dragging, setDragging] = useState(false);
  const count = Array.isArray(value) ? value.length : value ? 1 : 0;
  const names = Array.isArray(value) ? value.slice(0, 2).map((file) => file.name).join(', ') : value?.name;
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const selected = Array.from(event.dataTransfer.files || []);
    onChange(multiple ? selected : selected.slice(0, 1));
  };
  return <Box onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
    <Button
      component="label"
      variant={dragging ? 'contained' : 'outlined'}
      startIcon={count ? <CheckCircleRounded /> : accept?.includes('image') ? <AddPhotoAlternateRounded /> : <CloudUploadRounded />}
      fullWidth
      sx={{ minHeight: 66, justifyContent: 'flex-start', textAlign: 'left', borderStyle: 'dashed' }}
    >
      <Box>
        <Typography sx={{ fontSize: 13, fontWeight: 850 }}>{count ? `${label}: ${names}${count > 2 ? ` +${count - 2}` : ''}` : `${label}${required ? ' *' : ''}`}</Typography>
        <Typography sx={{ fontSize: 11, opacity: 0.75 }}>Drag & drop or click to upload</Typography>
      </Box>
      <input hidden type="file" multiple={multiple} accept={accept} onChange={(event) => onChange(Array.from(event.target.files || []))} />
    </Button>
    {helper && <FormHelperText>{helper}</FormHelperText>}
  </Box>;
}

function Field({ values, setValues, name, label, type = 'text', required, multiline, select, options = [], helper, inputProps, disabled }: any) {
  const isBooleanSelect = select && typeof options?.[0]?.value === 'boolean';
  return <TextField
    fullWidth size="small" name={name} label={label} type={type} required={required} multiline={multiline} disabled={disabled}
    rows={multiline ? 4 : undefined} select={select} value={isBooleanSelect ? String(Boolean(values[name])) : values[name] ?? ''}
    onChange={(event) => setValues((current: any) => ({ ...current, [name]: isBooleanSelect ? event.target.value === 'true' : event.target.value }))}
    helperText={helper} InputLabelProps={type === 'date' ? { shrink: true } : undefined} inputProps={inputProps}
    sx={{ gridColumn: multiline ? '1 / -1' : undefined }}
  >
    {select && options.map((option: any) => <MenuItem key={String(option.value)} value={String(option.value)}>{option.label}</MenuItem>)}
  </TextField>;
}

const yesNo = [{ value: false, label: 'No' }, { value: true, label: 'Yes' }];

export default function PropertyFormWizard({ open = true, mode, property, propertyTypes, onClose, onSaved, layout = 'dialog' }: {
  open?: boolean;
  mode: 'create' | 'edit';
  property?: any;
  propertyTypes: any[];
  onClose: () => void;
  onSaved: (message: string) => void;
  layout?: 'dialog' | 'page';
}) {
  const { data: siteData } = useSite();
  const activeTypes = useMemo(() => propertyTypes.filter((item) => item.active !== false && (item.key !== 'other' || property?.type === 'other')), [propertyTypes, property?.type]);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, any>>(() => initialValues(property, activeTypes));
  const [files, setFiles] = useState(emptyFiles);
  const [existingMedia, setExistingMedia] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [validatingAddress, setValidatingAddress] = useState(false);
  const [addressValidation, setAddressValidation] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const selected = activeTypes.find((item) => item.key === values.type);
    if (selected?.allowedPurposes?.length && !selected.allowedPurposes.includes(values.listingType)) {
      setValues((current) => ({ ...current, listingType: selected.allowedPurposes[0] }));
    }
  }, [activeTypes, values.type, values.listingType]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setValues(initialValues(property, activeTypes));
    setFiles({ ...emptyFiles, propertyPhotos: [], floorPlans: [], propertyDocuments: [] });
    setAddressValidation(null);
    setError('');
    if (property?._id) getResource('property-media', { property: property._id, limit: 100 }).then((result) => setExistingMedia(result.data)).catch(() => setExistingMedia([]));
    else setExistingMedia([]);
  }, [open, property?._id, activeTypes]);

  function validateStep(currentStep: number) {
    const missing: string[] = [];
    if (currentStep === 0) {
      [['title', 'Property title'], ['type', 'Property type'], ['listingType', 'Listing type'], ['description', 'Property description'], ['status', 'Property status'], ['country', 'Country'], ['state', 'State/Province'], ['city', 'City'], ['locality', 'Locality'], ['pinCode', 'PIN code'], ['fullAddress', 'Full address']].forEach(([key, label]) => { if (!String(values[key] || '').trim()) missing.push(label); });
      const parsedCoordinates = parseMapLocation(values.googleMapsLocation);
      const latitude = numberOrUndefined(values.latitude) ?? parsedCoordinates.latitude;
      const longitude = numberOrUndefined(values.longitude) ?? parsedCoordinates.longitude;
      if (latitude === undefined || longitude === undefined) missing.push('Exact Google map pin (latitude and longitude)');
      else if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Enter valid latitude and longitude values');
      if (mode === 'create' && !files.propertyImage) missing.push('Property profile image');
      if (values.listingType !== 'rent') {
        const priceField = values.listingType === 'sale' ? 'salePrice' : 'leaseAmount';
        if (!numberOrUndefined(values[priceField]) || Number(values[priceField]) <= 0) missing.push(values.listingType === 'sale' ? 'Sale price' : 'Lease amount');
      }
    }
    if (currentStep === 3) {
      if (!String(values.ownerName || values.agentName || '').trim()) missing.push('Owner name or agent name');
      if (!String(values.phoneNumber || values.emailAddress || '').trim()) missing.push('Phone number or email address');
      if (values.emailAddress && !/^\S+@\S+\.\S+$/.test(String(values.emailAddress))) throw new Error('Enter a valid email address');
      if (values.phoneNumber && String(values.phoneNumber).replace(/\D/g, '').length < 7) throw new Error('Enter a valid phone number');
    }
    if (missing.length) throw new Error(`Complete the following fields: ${missing.join(', ')}`);
  }

  function next() {
    try { validateStep(step); setError(''); setStep((current) => Math.min(current + 1, steps.length - 1)); }
    catch (cause) { setError((cause as Error).message); }
  }

  async function applyCoordinateLocation(latitude: number, longitude: number) {
    const googleMapsLocation = `https://www.google.com/maps?q=${latitude},${longitude}`;
    setValues((current) => ({ ...current, latitude, longitude, googleMapsLocation }));
    setDetectingLocation(true);
    try {
      const response = await reverseGeocodeLocation(latitude, longitude);
      const data: any = response.data || {};
      setValues((current) => ({
        ...current,
        latitude,
        longitude,
        country: data.country || current.country,
        state: data.state || current.state,
        city: data.city || current.city,
        locality: data.locality || current.locality,
        landmark: data.landmark || current.landmark,
        pinCode: data.pinCode || current.pinCode,
        fullAddress: data.fullAddress || current.fullAddress,
        googleMapsLocation: data.googleMapsLocation || googleMapsLocation,
      }));
    } catch {
      setError('Exact coordinates were captured, but address auto-fill could not be completed. Please review the address fields.');
    } finally { setDetectingLocation(false); }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { setError('Geolocation is not supported by this browser'); return; }
    setDetectingLocation(true); setError('');
    navigator.geolocation.getCurrentPosition((position) => {
      void applyCoordinateLocation(position.coords.latitude, position.coords.longitude);
    }, () => { setDetectingLocation(false); setError('Location permission was not granted'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  async function validateAddressFields() {
    const addressLines = [values.fullAddress, values.locality, values.city, values.state].map((value) => String(value || '').trim()).filter(Boolean);
    if (!addressLines.length) { setError('Enter a property address before validating it.'); return; }
    setValidatingAddress(true); setError(''); setAddressValidation(null);
    try {
      const result = await validateMapAddress({ addressLines, regionCode: String(siteData.settings?.map?.regionCode || 'IN').slice(0, 8), locality: String(values.city || ''), administrativeArea: String(values.state || ''), postalCode: String(values.pinCode || ''), languageCode: String(siteData.settings?.map?.languageCode || 'en-US') });
      const verdict = result.data?.verdict || {};
      const complete = Boolean(verdict.addressComplete ?? verdict.hasUnconfirmedComponents === false);
      setAddressValidation({ ok: complete, message: complete ? 'Google Address Validation confirmed this address.' : 'Google returned the address with components that need review. The exact pin remains authoritative.' });
    } catch (cause) { setAddressValidation({ ok: false, message: (cause as Error).message || 'Address validation is not configured yet.' }); }
    finally { setValidatingAddress(false); }
  }

  function propertyPayload() {
    const parsedMapValues = parseMapLocation(values.googleMapsLocation);
    const latitude = numberOrUndefined(values.latitude) ?? parsedMapValues.latitude;
    const longitude = numberOrUndefined(values.longitude) ?? parsedMapValues.longitude;
    const mapValues = {
      ...parsedMapValues,
      ...(latitude !== undefined && longitude !== undefined ? {
        latitude,
        longitude,
        googleMapsLocation: parsedMapValues.googleMapsLocation || `https://www.google.com/maps?q=${latitude},${longitude}`,
      } : {}),
    };
    const amenityDetails = Object.fromEntries(amenityFields.map(([key]) => [key, Boolean(values[`amenity.${key}`])]));
    const amenities = amenityFields.filter(([key]) => Boolean(values[`amenity.${key}`])).map(([, label]) => label);
    const nearbyFacilities = Object.fromEntries(nearbyFields.map(([key]) => [key, String(values[`nearby.${key}`] || '').trim()]).filter(([, value]) => value));
    const nearbyPlaces = nearbyFields.map(([key, label]) => ({ type: key, name: label, distance: String(values[`nearby.${key}`] || '').trim() })).filter((item) => item.distance);
    const listingType = values.listingType;
    const price = listingType === 'rent' ? 0 : numberOrUndefined(listingType === 'sale' ? values.salePrice : values.leaseAmount) || 0;
    const unit = getPath(property, 'areas.unit', 'sqft');
    const enableSpecifications = Boolean(values.enableSpecifications);
    const enableParking = Boolean(values.enableParking);
    const builtUpArea = numberOrUndefined(values.builtUpArea);
    const base: Record<string, any> = {
      title: String(values.title).trim(), type: values.type, purpose: listingType, listingType, description: String(values.description).trim(), status: values.status,
      visibility: values.visibility === 'public' ? 'public' : 'private',
      publicationStatus: values.visibility === 'public' ? (property?.publicationStatus || 'published') : 'draft',
      locationPrivacy: property?.locationPrivacy || 'approximate_public',
      price,
      floorManagementEnabled: listingType === 'rent' ? Boolean(values.floorManagementEnabled) : Boolean(property?.floorManagementEnabled),
      liftAvailable: Boolean(values.liftAvailable),
      commonFacilities: String(values.commonFacilities || '').split(',').map((item) => item.trim()).filter(Boolean),
      rulesAndRestrictions: String(values.rulesAndRestrictions || '').split(/\n|,/).map((item) => item.trim()).filter(Boolean),
      ...(listingType === 'rent' ? { specifications: { ...getPath(property, 'specifications', {}), numberOfFloors: numberOrUndefined(values.numberOfFloors) } } : {}),
      address: {
        country: String(values.country).trim(), state: String(values.state).trim(), city: String(values.city).trim(), locality: String(values.locality || '').trim(),
        landmark: String(values.landmark || '').trim(), line1: String(values.fullAddress).trim(), postalCode: String(values.pinCode).trim(),
      },
      map: { ...getPath(property, 'map', {}), ...mapValues, locality: String(values.locality || '').trim(), landmark: String(values.landmark || '').trim(), nearbyPlaces },
      ...(mapValues.latitude !== undefined && mapValues.longitude !== undefined ? { location: { type: 'Point', coordinates: [mapValues.longitude, mapValues.latitude] } } : {}),
      pricing: {
        salePrice: listingType === 'sale' ? numberOrUndefined(values.salePrice) : null,
        monthlyRent: null,
        leaseAmount: listingType === 'lease' ? numberOrUndefined(values.leaseAmount) : null,
        securityDeposit: listingType === 'rent' ? null : numberOrUndefined(values.securityDeposit), maintenanceCharge: listingType === 'rent' ? null : numberOrUndefined(values.maintenanceCharges),
        pricePerUnitArea: numberOrUndefined(values.pricePerSqFt), propertyTax: numberOrUndefined(values.tax), tax: numberOrUndefined(values.tax),
      },
      amenities, amenityDetails,
      utilities: {
        waterSupply: String(values.waterSupply || '').trim(), electricityConnection: String(values.electricityConnection || '').trim(), powerBackup: String(values.powerBackup || '').trim(),
        internetAvailability: Boolean(values.internetAvailability), gasConnection: Boolean(values.gasConnection), sewageConnection: Boolean(values.sewageConnection),
      },
      legalDetails: {
        reraNumber: String(values.reraNumber || '').trim(), titleClear: Boolean(values.titleClear), loanApproved: Boolean(values.loanApproved),
        occupancyCertificate: Boolean(values.occupancyCertificate), completionCertificate: Boolean(values.completionCertificate),
      },
      contactInformation: {
        ownerName: String(values.ownerName || '').trim(), agentName: String(values.agentName || '').trim(), phoneNumber: String(values.phoneNumber || '').trim(),
        emailAddress: String(values.emailAddress || '').trim().toLowerCase(), preferredContactMethod: values.preferredContactMethod,
      },
      nearbyFacilities,
    };

    if (enableSpecifications) {
      base.bedrooms = numberOrUndefined(values.bedrooms);
      base.bathrooms = numberOrUndefined(values.bathrooms);
      base.area = builtUpArea;
      base.specifications = {
        ...(getPath(property, 'specifications', {})),
        bedrooms: numberOrUndefined(values.bedrooms), bathrooms: numberOrUndefined(values.bathrooms), balconies: numberOrUndefined(values.balconies),
        numberOfFloors: listingType === 'rent' ? numberOrUndefined(values.numberOfFloors) : getPath(property, 'specifications.numberOfFloors'),
        floorNumber: numberOrUndefined(values.floorNumber), kitchenAttached: Boolean(values.kitchenAttached), builtUpAreaSqft: builtUpArea, builtUpAreaSqm: sqftToSqm(values.builtUpArea),
        propertyAge: numberOrUndefined(values.propertyAge), furnishingStatus: values.furnishingStatus || undefined,
        ownershipType: String(values.ownershipType || '').trim(), availableFrom: values.availableFrom || undefined, areaUnit: 'sqft',
      };
      base.roomDetails = {
        ...getPath(property, 'roomDetails', {}), bedrooms: numberOrUndefined(values.bedrooms), bathrooms: numberOrUndefined(values.bathrooms), balconies: numberOrUndefined(values.balconies),
        kitchens: values.kitchenAttached ? 1 : 0,
      };
      base.listingDetails = {
        ...getPath(property, 'listingDetails', {}), floor: numberOrUndefined(values.floorNumber), propertyAgeYears: numberOrUndefined(values.propertyAge),
        availableFrom: values.availableFrom || undefined,
      };
      base.areas = { unit, builtUp: builtUpArea, total: builtUpArea };
      base.furnishing = { status: values.furnishingStatus || undefined };
      base.ageDetails = { ...getPath(property, 'ageDetails', {}), availableFrom: values.availableFrom || undefined };
    }

    if (enableParking) {
      base.parking = {
        carSpaces: numberOrUndefined(values.carParkingSpaces),
        twoWheelerSpaces: numberOrUndefined(values.twoWheelerParkingSpaces),
        visitorParking: Boolean(values.visitorParking),
      };
      base.roomDetails = { ...getPath(property, 'roomDetails', {}), ...(base.roomDetails || {}), coveredParking: numberOrUndefined(values.carParkingSpaces) };
      base.listingDetails = { ...getPath(property, 'listingDetails', {}), ...(base.listingDetails || {}), parkingSpaces: numberOrUndefined(values.carParkingSpaces) };
    }

    return base;
  }

  async function uploadMedia(propertyId: string, file: File, category: string, mediaType: 'image' | 'video' | '360' | 'document', cover = false, visibility: 'public' | 'legal' = 'public') {
    try {
      const upload = await uploadDocument(file, {
        property: propertyId, type: category, category: visibility === 'legal' ? 'legal' : mediaType === 'document' ? 'document' : mediaType === 'video' || mediaType === '360' ? 'video' : 'image', visibility: visibility === 'public' ? 'public' : 'private',
      });
      const media = await createResource('property-media', {
        property: propertyId, category, mediaType, url: upload.data.url, document: upload.data._id, driveFile: (upload.data as any).driveFile,
        caption: file.name, altText: file.name, cover, visibility,
      });
      return { media: media.data as any, documentId: upload.data._id };
    } catch (cause) {
      throw new Error(`Upload failed for ${file.name}: ${(cause as Error).message}`);
    }
  }

  async function save() {
    try {
      validateStep(0); validateStep(3);
      setSaving(true); setError('');
      const payload = propertyPayload();
      const result = mode === 'edit' && property?._id ? await updateResource('properties', property._id, payload) : await createResource('properties', payload);
      const propertyId = String((result.data as any)._id);
      const imageUrls: string[] = [];
      const documentIds: string[] = [];
      if (files.propertyImage) {
        const uploaded = await uploadMedia(propertyId, files.propertyImage, 'property_image', 'image', true, 'public');
        imageUrls.push(uploaded.media.url);
      }
      for (const file of files.propertyPhotos) { const uploaded = await uploadMedia(propertyId, file, 'property_photo', 'image', false, 'public'); imageUrls.push(uploaded.media.url); }
      for (const file of files.floorPlans) { const uploaded = await uploadMedia(propertyId, file, 'floor_plan', file.type.startsWith('image/') ? 'image' : 'document', false, 'public'); if (uploaded.media.mediaType === 'image') imageUrls.push(uploaded.media.url); }
      if (files.videoTour) await uploadMedia(propertyId, files.videoTour, 'video_tour', 'video', false, 'public');
      if (files.virtualTour) await uploadMedia(propertyId, files.virtualTour, 'virtual_360_tour', '360', false, 'public');
      for (const file of files.propertyDocuments) { const uploaded = await uploadMedia(propertyId, file, 'property_document', 'document', false, 'legal'); documentIds.push(uploaded.documentId); }
      // The property-media API updates galleryCover/images/documents after it
      // verifies the parent property. Avoid a second scoped property lookup,
      // which incorrectly reported "Record not found" for new listings.
      onSaved(`${mode === 'edit' ? 'Property updated' : 'Property added'} successfully${imageUrls.length || documentIds.length ? ' with uploaded media' : ''}`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally { setSaving(false); }
  }

  const selectedType = activeTypes.find((item) => item.key === values.type);
  const allowedListingTypes = selectedType?.allowedPurposes?.length ? listingTypes.filter((item) => selectedType.allowedPurposes.includes(item)) : listingTypes;
  const typeOptions = activeTypes.map((item) => ({ value: item.key, label: item.label }));
  const priceField = values.listingType === 'sale' ? 'salePrice' : values.listingType === 'lease' ? 'leaseAmount' : 'monthlyRent';
  const existingMediaSummary = existingMedia.reduce((counts: Record<string, number>, item) => ({ ...counts, [item.category]: (counts[item.category] || 0) + 1 }), {});
  const parsedPickerLocation = parseMapLocation(values.googleMapsLocation);
  const pickerLatitude = numberOrUndefined(values.latitude) ?? parsedPickerLocation.latitude;
  const pickerLongitude = numberOrUndefined(values.longitude) ?? parsedPickerLocation.longitude;
  const pickerCoordinates = pickerLatitude !== undefined && pickerLongitude !== undefined ? { latitude: pickerLatitude, longitude: pickerLongitude } : null;
  const mapProvider = String(siteData.settings?.map?.provider || 'google');
  const locationPickerApiKey = siteData.settings?.map?.enabled === false
    || siteData.settings?.map?.locationPickerEnabled === false
    || mapProvider !== 'google'
    ? ''
    : String(siteData.settings?.map?.publicApiKey || '');

  const formContent = <>
    <DialogTitle sx={{ pb: 1.25, pt: { xs: 2.2, md: 2.6 } }}>
      <Typography className="sa-page-kicker" sx={{ mb: .8 }}>Property workflow · Step {step + 1} of {steps.length}</Typography>
      <Typography sx={{ fontWeight: 950, fontSize: { xs: 21, md: 25 }, letterSpacing: '-.03em' }}>{mode === 'edit' ? 'Edit property' : 'Add property'}</Typography>
      <Typography color="text.secondary" sx={{ fontSize: 13, mt: .4 }}>Landlords can add, edit and manage only their own properties within the active Landlord subscription limits.</Typography>
    </DialogTitle>
    <Box sx={{ mx: { xs: 2, md: 3 }, mb: 1.2, p: { xs: 1.1, sm: 1.45 }, borderRadius: 3.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}><Stepper activeStep={step} alternativeLabel sx={{ '& .MuiStepLabel-label': { fontSize: { xs: 9.5, sm: 11.3 }, fontWeight: 700, mt: .55 }, '& .MuiStepIcon-root.Mui-active': { color: 'primary.main' }, '& .MuiStepIcon-root.Mui-completed': { color: 'success.main' }, '& .MuiStepConnector-line': { borderColor: 'divider' } }}>{steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper></Box>
    <DialogContent dividers sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.default', borderColor: 'divider' }}>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {step === 0 && <Stack spacing={2}>
        <Section title="A) Basic Information" subtitle="This information is visible to tenants on the public marketplace.">
          <Field values={values} setValues={setValues} name="title" label="Property Title" required />
          <Field values={values} setValues={setValues} name="type" label="Property Type" required select options={typeOptions} />
          <Field values={values} setValues={setValues} name="listingType" label="Listing Type" required select options={allowedListingTypes.map((value) => ({ value, label: sentence(value) }))} />
          <Field values={values} setValues={setValues} name="status" label="Property Status" required select options={statuses.map((value) => ({ value, label: sentence(value) }))} />
          <Field
            values={values}
            setValues={setValues}
            name="visibility"
            label="Listing Visibility"
            required
            select
            options={[
              { value: 'private', label: 'Private — owner workspace only' },
              { value: 'public', label: 'Public — visible on marketplace' },
            ]}
            helper={values.visibility === 'public' ? 'Public listings can be discovered by tenants.' : 'Private listings stay hidden from the public marketplace.'}
          />
          <Field values={values} setValues={setValues} name="description" label="Property Description" required multiline />
          <FilePicker label={mode === 'edit' && property?.galleryCover ? 'Replace Property Profile Image' : 'Property Profile Image'} value={files.propertyImage} accept="image/*" required={mode === 'create'} onChange={(selected) => setFiles((current) => ({ ...current, propertyImage: selected[0] || null }))} helper={property?.galleryCover ? 'Current cover image remains unless replaced.' : 'Drag & drop the main profile/cover image for this listing.'} />
        </Section>
        <Section title="B) Property Location" subtitle="Country, state/province and city are loaded from worldwide location data. Current location can auto-fill the full address." action={<Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button variant="outlined" startIcon={detectingLocation ? <CircularProgress size={16} /> : <MyLocationRounded />} onClick={useCurrentLocation} disabled={detectingLocation || validatingAddress}>{detectingLocation ? 'Detecting…' : 'Use Current Location'}</Button><Button variant="outlined" onClick={() => void validateAddressFields()} disabled={detectingLocation || validatingAddress}>{validatingAddress ? 'Validating…' : 'Validate address'}</Button></Stack>}>
          <LocationFields
            value={{ country: values.country, state: values.state, city: values.city }}
            required={{ country: true, state: true, city: true }}
            onChange={(location) => setValues((current) => ({ ...current, ...location }))}
          />
          <Field values={values} setValues={setValues} name="locality" label="Locality" required />
          <Field values={values} setValues={setValues} name="landmark" label="Landmark" />
          <Field values={values} setValues={setValues} name="pinCode" label="PIN Code" required inputProps={{ inputMode: 'numeric' }} />
          <Field values={values} setValues={setValues} name="fullAddress" label="Full Address" required multiline />
          <GooglePropertyLocationPicker
            apiKey={locationPickerApiKey}
            value={pickerCoordinates}
            defaultCenter={{ latitude: Number(siteData.settings?.map?.defaultLatitude || 20.5937), longitude: Number(siteData.settings?.map?.defaultLongitude || 78.9629) }}
            mapId={String(siteData.settings?.map?.mapId || '')}
            placesUiKitEnabled={siteData.settings?.map?.placesUiKitEnabled !== false}
            onChange={(coordinates) => { void applyCoordinateLocation(coordinates.latitude, coordinates.longitude); }}
          />
          <Field values={values} setValues={setValues} name="latitude" label="Exact latitude" type="number" required inputProps={{ min: -90, max: 90, step: 'any' }} helper="Actual north/south coordinate from the selected Google pin." />
          <Field values={values} setValues={setValues} name="longitude" label="Exact longitude" type="number" required inputProps={{ min: -180, max: 180, step: 'any' }} helper="Actual east/west coordinate from the selected Google pin." />
          <Field values={values} setValues={setValues} name="googleMapsLocation" label="Google Map URL" helper="The saved navigation link is generated from the exact latitude and longitude." />
          {addressValidation && <Alert severity={addressValidation.ok ? 'success' : 'warning'} sx={{ gridColumn: '1 / -1' }}>{addressValidation.message}</Alert>}
        </Section>
        {values.listingType === 'rent' && <Section title="C) Rental property structure" subtitle="Create the building now. Configure and price each rentable room afterward from My Listings → Manage Rooms.">
          <Field values={values} setValues={setValues} name="numberOfFloors" label="Number of Floors" type="number" inputProps={{ min: 0, max: 300 }} />
          <FormControlLabel control={<Switch checked={Boolean(values.floorManagementEnabled)} onChange={(event) => setValues((current) => ({ ...current, floorManagementEnabled: event.target.checked }))} />} label="Enable floor-wise room management" />
          <FormControlLabel control={<Switch checked={Boolean(values.liftAvailable)} onChange={(event) => setValues((current) => ({ ...current, liftAvailable: event.target.checked }))} />} label="Lift available" />
          <Field values={values} setValues={setValues} name="commonFacilities" label="Common Facilities" helper="Comma-separated, for example lobby, terrace, laundry" />
          <Field values={values} setValues={setValues} name="rulesAndRestrictions" label="Rules and Restrictions" multiline helper="One rule per line" />
          <Alert severity="info" sx={{ gridColumn: '1 / -1' }}>Monthly rent, deposit, maintenance and booking amounts belong to individual rooms. They are intentionally not requested for this parent property.</Alert>
        </Section>}
        <Section title="C) Property Specifications" subtitle="Optional. Enable this only when the details are available." action={<FormControlLabel control={<Switch checked={Boolean(values.enableSpecifications)} onChange={(event) => setValues((current) => ({ ...current, enableSpecifications: event.target.checked }))} />} label="Enable Property Specifications" />}>
          {!values.enableSpecifications ? <Typography sx={{ gridColumn: '1 / -1' }} color="text.secondary">Specifications are disabled for this property. Tenants will only see the basic property details and pricing.</Typography> : <>
            <Field values={values} setValues={setValues} name="bedrooms" label="Number of Bedrooms" select options={numberOptions.map((value) => ({ value, label: value }))} />
            <Field values={values} setValues={setValues} name="bathrooms" label="Number of Bathrooms" select options={numberOptions.map((value) => ({ value, label: value }))} />
            <Field values={values} setValues={setValues} name="balconies" label="Number of Balconies" select options={numberOptions.map((value) => ({ value, label: value }))} />
            <Field values={values} setValues={setValues} name="floorNumber" label="Floor Number" select options={[{ value: '', label: 'Not specified' }, ...floorOptions.map((value) => ({ value, label: value === '0' ? 'Ground Floor' : value }))]} />
            <Field values={values} setValues={setValues} name="kitchenAttached" label="Kitchen Attached" select options={yesNo} />
            <Field values={values} setValues={setValues} name="builtUpArea" label="Area in sq. feet" type="number" inputProps={{ min: 0, step: 'any' }} />
            <Field values={values} setValues={setValues} name="propertyAge" label="Property Age (years)" type="number" inputProps={{ min: 0, step: 'any' }} />
            <Field values={values} setValues={setValues} name="furnishingStatus" label="Furnishing Status" select options={[{ value: '', label: 'Not specified' }, ...furnishingOptions.map((value) => ({ value, label: sentence(value) }))]} />
            <Field values={values} setValues={setValues} name="ownershipType" label="Ownership Type" select options={[{ value: '', label: 'Not specified' }, ...ownershipOptions.map((value) => ({ value, label: sentence(value) }))]} />
            <Field values={values} setValues={setValues} name="availableFrom" label="Available From" type="date" />
          </>}
        </Section>
        <Section title="D) Parking" subtitle="Optional. Enable only if parking details are applicable." action={<FormControlLabel control={<Switch checked={Boolean(values.enableParking)} onChange={(event) => setValues((current) => ({ ...current, enableParking: event.target.checked }))} />} label="Enable Parking Details" />}>
          {!values.enableParking ? <Typography sx={{ gridColumn: '1 / -1' }} color="text.secondary">Parking details are disabled for this property.</Typography> : <>
            <Field values={values} setValues={setValues} name="carParkingSpaces" label="Car Parking Spaces" type="number" inputProps={{ min: 0 }} />
            <Field values={values} setValues={setValues} name="twoWheelerParkingSpaces" label="Two Wheeler Parking Spaces" type="number" inputProps={{ min: 0 }} />
            <Field values={values} setValues={setValues} name="visitorParking" label="Visitor Parking" select options={yesNo} />
          </>}
        </Section>
        {values.listingType !== 'rent' && <Section title="E) Pricing" subtitle="The main price field changes automatically according to Listing Type.">
          <Field values={values} setValues={setValues} name={priceField} label={values.listingType === 'sale' ? 'Sale Price' : values.listingType === 'lease' ? 'Lease Amount' : 'Monthly Rent'} type="number" required inputProps={{ min: 0, step: 'any' }} />
          <Field values={values} setValues={setValues} name="securityDeposit" label="Security Deposit" type="number" inputProps={{ min: 0, step: 'any' }} />
          <Field values={values} setValues={setValues} name="maintenanceCharges" label="Maintenance Charges" type="number" inputProps={{ min: 0, step: 'any' }} />
          <Field values={values} setValues={setValues} name="pricePerSqFt" label="Price per sq. feet" type="number" inputProps={{ min: 0, step: 'any' }} />
          <Field values={values} setValues={setValues} name="tax" label="Tax" type="number" inputProps={{ min: 0, step: 'any' }} />
        </Section>}
      </Stack>}
      {step === 1 && <Stack spacing={2}>
        <Section title="Utilities">
          <Field values={values} setValues={setValues} name="waterSupply" label="Water Supply" helper="Example: Municipal, borewell, both" />
          <Field values={values} setValues={setValues} name="electricityConnection" label="Electricity Connection" />
          <Field values={values} setValues={setValues} name="powerBackup" label="Power Backup" helper="Example: Full, partial, none" />
          <Field values={values} setValues={setValues} name="internetAvailability" label="Internet Availability" select options={yesNo} />
          <Field values={values} setValues={setValues} name="gasConnection" label="Gas Connection" select options={yesNo} />
          <Field values={values} setValues={setValues} name="sewageConnection" label="Sewage Connection" select options={yesNo} />
        </Section>
        <Section title="Amenities">
          {amenityFields.map(([key, label]) => <Field key={key} values={values} setValues={setValues} name={`amenity.${key}`} label={label} select options={yesNo} />)}
        </Section>
      </Stack>}
      {step === 2 && <Section title="Legal Details" subtitle="Only include details you can support with valid records.">
        <Field values={values} setValues={setValues} name="reraNumber" label="RERA Number (if applicable)" />
        <Field values={values} setValues={setValues} name="titleClear" label="Title Clear" select options={yesNo} />
        <Field values={values} setValues={setValues} name="loanApproved" label="Loan Approved" select options={yesNo} />
        <Field values={values} setValues={setValues} name="occupancyCertificate" label="Occupancy Certificate" select options={yesNo} />
        <Field values={values} setValues={setValues} name="completionCertificate" label="Completion Certificate" select options={yesNo} />
      </Section>}
      {step === 3 && <Stack spacing={2}>
        <Section title="Media" subtitle="Uploads are stored in SecureAsset Vault and linked to this property.">
          <FilePicker label="Property Photos" value={files.propertyPhotos} multiple accept="image/*" onChange={(selected) => setFiles((current) => ({ ...current, propertyPhotos: selected }))} />
          <FilePicker label="Floor Plan" value={files.floorPlans} multiple accept="image/*,.pdf" onChange={(selected) => setFiles((current) => ({ ...current, floorPlans: selected }))} />
          <FilePicker label="Video Tour" value={files.videoTour} accept="video/*" onChange={(selected) => setFiles((current) => ({ ...current, videoTour: selected[0] || null }))} />
          <FilePicker label="360° Virtual Tour" value={files.virtualTour} accept="video/*,image/*" onChange={(selected) => setFiles((current) => ({ ...current, virtualTour: selected[0] || null }))} />
          <FilePicker label="Property Documents" value={files.propertyDocuments} multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(selected) => setFiles((current) => ({ ...current, propertyDocuments: selected }))} helper="Documents are stored as legal/private records and are not exposed publicly." />
          {existingMedia.length > 0 && <Box sx={{ gridColumn: '1 / -1' }}><Typography color="text.secondary" sx={{ fontSize: 12, mb: 1 }}>Existing media</Typography><Stack direction="row" flexWrap="wrap" gap={1}>{Object.entries(existingMediaSummary).map(([category, count]) => <Chip key={category} size="small" icon={<UploadFileRounded />} label={`${category.replaceAll('_', ' ')} · ${count}`} />)}</Stack></Box>}
        </Section>
        <Section title="Contact Information">
          <Field values={values} setValues={setValues} name="ownerName" label="Owner Name" />
          <Field values={values} setValues={setValues} name="agentName" label="Agent Name" />
          <Field values={values} setValues={setValues} name="phoneNumber" label="Phone Number" />
          <Field values={values} setValues={setValues} name="emailAddress" label="Email Address" type="email" />
          <Field values={values} setValues={setValues} name="preferredContactMethod" label="Preferred Contact Method" select options={preferredContactOptions.map((value) => ({ value, label: sentence(value) }))} />
        </Section>
        <Section title="Nearby Facilities" subtitle="Enter distance or a short note, for example “1.2 km” or “5-minute walk”.">
          {nearbyFields.map(([key, label]) => <Field key={key} values={values} setValues={setValues} name={`nearby.${key}`} label={label} />)}
        </Section>
      </Stack>}
    </DialogContent>
    <DialogActions sx={{ p: { xs: 1.6, md: 2 }, justifyContent: 'space-between', gap: 1, position: 'sticky', bottom: 0, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
      <Button onClick={step === 0 ? onClose : () => setStep((current) => current - 1)} disabled={saving} startIcon={step === 0 ? undefined : <NavigateBeforeRounded />}>{step === 0 ? 'Cancel' : 'Back'}</Button>
      {step < steps.length - 1 ? <Button variant="contained" onClick={next} endIcon={<NavigateNextRounded />}>Continue</Button> : <Button variant="contained" onClick={save} disabled={saving} startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveRounded />}>{saving ? 'Saving property…' : mode === 'edit' ? 'Update Property' : 'Add Property'}</Button>}
    </DialogActions>
  </>;

  if (layout === 'page') {
    return <Paper className="sa-surface-card" elevation={0} sx={{ borderRadius: { xs: 0, sm: 5 }, overflow: 'hidden', bgcolor: 'background.paper', boxShadow: { xs: 'none', md: '0 24px 70px rgba(15,23,42,.08)' } }}>
      {formContent}
    </Paper>;
  }

  return <ProfessionalDialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="lg" PaperProps={{ sx: { borderRadius: { xs: 0, sm: 4 }, minHeight: { xs: '100dvh', sm: 'auto' } } }}>
    {formContent}
  </ProfessionalDialog>;
}
