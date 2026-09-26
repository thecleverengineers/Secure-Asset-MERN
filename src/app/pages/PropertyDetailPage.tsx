import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowBackIosNewRounded from '@mui/icons-material/ArrowBackIosNewRounded';
import ArrowForwardIosRounded from '@mui/icons-material/ArrowForwardIosRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import BedRounded from '@mui/icons-material/BedRounded';
import BathtubRounded from '@mui/icons-material/BathtubRounded';
import WeekendRounded from '@mui/icons-material/WeekendRounded';
import GridViewRounded from '@mui/icons-material/GridViewRounded';
import WifiRounded from '@mui/icons-material/WifiRounded';
import WaterDropRounded from '@mui/icons-material/WaterDropRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import DirectionsCarRounded from '@mui/icons-material/DirectionsCarRounded';
import ViewInArRounded from '@mui/icons-material/ViewInArRounded';
import PlayCircleFilledRounded from '@mui/icons-material/PlayCircleFilledRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import RuleRounded from '@mui/icons-material/RuleRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import AnalyticsRounded from '@mui/icons-material/AnalyticsRounded';
import SquareFootRounded from '@mui/icons-material/SquareFootRounded';
import LayersRounded from '@mui/icons-material/LayersRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import LocalParkingRounded from '@mui/icons-material/LocalParkingRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import ArticleRounded from '@mui/icons-material/ArticleRounded';
import ExploreRounded from '@mui/icons-material/ExploreRounded';
import KeyRounded from '@mui/icons-material/KeyRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import AppsRounded from '@mui/icons-material/AppsRounded';
import ChairRounded from '@mui/icons-material/ChairRounded';
import { publicPropertyQueryOptions } from '../queries/propertyQueries';
import { useSite } from '../context/SiteContext';
import { useWishlist } from '../context/WishlistContext';
import OptimizedImage from '../components/shared/OptimizedImage';
import InteractivePropertyTour from '../components/property/InteractivePropertyTour';
import PremiumPropertyHero from '../components/property/PremiumPropertyHero';
import { WorkspaceSkeleton } from '../components/shared/PremiumSkeleton';
import { sharePublicListing } from '../utils/publicShare';

const fallback = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85';
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const sentence = (value: string) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const flatten = (nodes: any[]): any[] => nodes.flatMap((node) => [node, ...flatten(node.children || [])]);

export default function PropertyDetailPage() {
  const { id = '', slug = '' } = useParams();
  const navigate = useNavigate();
  const { data: siteData } = useSite();
  const wishlist = useWishlist();
  const [detailsTab, setDetailsTab] = useState(0);
  const [tourExpanded, setTourExpanded] = useState(false);
  const [roomSlideIndex, setRoomSlideIndex] = useState(0);
  const propertyQuery = useQuery(publicPropertyQueryOptions(slug || id));
  const listing = propertyQuery.data?.listing || null;
  const structure = propertyQuery.data?.structure || null;
  const loading = propertyQuery.isPending;
  const error = propertyQuery.error instanceof Error ? propertyQuery.error.message : propertyQuery.error ? 'Could not load this property.' : '';

  const property = structure?.property || listing;
  // Keep the public property overview experience consistent for every listing.
  const usePremiumPropertyDetails = true;
  const selected = structure?.selectedSpace || ((listing as any)?.listingKind === 'space' ? listing : null);
  const spaces = useMemo(() => flatten(structure?.spaces || []), [structure]);
  const rentalUnits = structure?.rentalUnits || [];
  const selectedRentalUnit = structure?.selectedRentalUnit || null;
  const rentalFloorGroups = useMemo(() => {
    const groups = new Map<string, { key: string; floor: any; units: any[] }>();
    rentalUnits.forEach((unit: any) => {
      const floor = unit.floor || null;
      const key = floor?._id ? String(floor._id) : 'unassigned';
      if (!groups.has(key)) groups.set(key, { key, floor, units: [] });
      groups.get(key)?.units.push(unit);
    });
    return [...groups.values()].sort((left, right) => {
      if (!left.floor) return 1;
      if (!right.floor) return -1;
      return Number(left.floor.floorNumber || 0) - Number(right.floor.floorNumber || 0);
    });
  }, [rentalUnits]);
  const media = useMemo(() => {
    const all = [...(structure?.media || [])];
    spaces.forEach((space) => all.push(...(space.media || [])));
    return all.filter((item, index, array) => array.findIndex((other) => other._id === item._id) === index);
  }, [structure, spaces]);

  if (loading) return <WorkspaceSkeleton rows={3} />;
  if (error || !property) return <Container sx={{ py: 10 }}><Alert severity="error">{error || 'Listing not found'}</Alert></Container>;

  const purpose = String(selected?.purpose || listing?.listingType || property.purpose || property.listingType || 'rent').trim().toLowerCase();
  const normalizedPurpose = purpose.replace(/[\s-]+/g, '_');
  const isRentListing = ['rent', 'rental', 'for_rent', 'forrent'].includes(normalizedPurpose) || rentalUnits.length > 0;
  const images = media.filter((item: any) => (item.mediaType === 'image' || !item.mediaType) && item.category !== 'floor_plan');
  const tourMedia = media.filter((item: any) => ['video_tour', 'virtual_360_tour'].includes(item.category));
  const floorPlanMedia = media.filter((item: any) => item.category === 'floor_plan');
  const roomImages = selectedRentalUnit ? [selectedRentalUnit.primaryImage?.url, ...(selectedRentalUnit.gallery || []).map((item: any) => item.url)].filter(Boolean) : [];
  const displayImages = roomImages.length ? roomImages : images.length
    ? images.map((item: any) => item.url)
    : [...(listing?.images || []), property.galleryCover].filter(Boolean);
  const active: any = selectedRentalUnit || selected || property;
  const price = Number(
    selectedRentalUnit?.pricing?.monthlyRent
    || selected?.price
    || listing?.price
    || property.pricing?.salePrice
    || property.pricing?.monthlyRent
    || property.pricing?.leaseAmount
    || property.price
    || 0,
  );
  const mapSettings = siteData.settings?.map || {};
  const exactPublicLocation = property.locationPrivacy === 'exact_public';
  const lat = exactPublicLocation ? property.map?.latitude : undefined;
  const lng = exactPublicLocation ? property.map?.longitude : undefined;
  const address = [property.address?.line1, property.address?.locality, property.address?.city, property.address?.district, property.address?.state].filter(Boolean).join(', ');
  const areaLocation = [property.address?.locality, property.address?.city, property.address?.district, property.address?.state, property.address?.country].filter(Boolean).join(', ');
  const locationSummary = exactPublicLocation ? (address || areaLocation) : areaLocation;
  const directions = lat && lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const mapQuery = lat && lng ? `${lat},${lng}` : address;
  const mapEmbedUrl = mapSettings.enabled !== false && mapSettings.provider === 'google' && mapSettings.publicApiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapSettings.publicApiKey)}&q=${encodeURIComponent(mapQuery)}`
    : '';
  const publicUrl = window.location.href;
  const shareTitle = active.name ? `${active.name} · ${property.title}` : property.title;
  const shareImage = displayImages[0] || property.galleryCover || listing?.images?.[0] || property.images?.[0] || fallback;
  const wishlistListing: any = listing || property;
  const wishlistKind = listing?.listingKind === 'space' ? 'space' : 'property';
  const wishlistId = String(wishlistListing?._id || property._id);
  const saved = wishlist.isWishlisted(wishlistId, wishlistKind);
  const hasInteractiveRoomTour = isRentListing && rentalUnits.length > 0;
  const heroBedrooms = active.specifications?.bedroomCount ?? active.roomDetails?.bedrooms ?? listing?.bedrooms ?? property.roomDetails?.bedrooms ?? property.roomCounts?.bedrooms ?? property.specifications?.bedrooms ?? property.bedrooms;
  const heroBathrooms = active.specifications?.bathroomCount ?? active.roomDetails?.bathrooms ?? listing?.bathrooms ?? property.roomDetails?.bathrooms ?? property.roomCounts?.bathrooms ?? property.specifications?.bathrooms ?? property.bathrooms;
  const heroAreaValue = active.area?.value || listing?.area || property.areas?.total || property.area || 0;
  const heroAreaUnit = active.area?.unit || listing?.areaUnit || property.areas?.unit || 'sqft';
  const heroRooms = active.specifications?.rooms ?? property.specifications?.rooms ?? property.roomCounts?.rooms ?? property.roomDetails?.totalRooms;
  const heroFurnishing = active.specifications?.furnishingStatus || property.specifications?.furnishingStatus || property.furnishing?.status;
  const heroPriceLabel = normalizedPurpose === 'sale' ? 'Sale price' : isRentListing ? 'Monthly rent' : 'Lease amount';
  const heroAvailability = sentence(active.availabilityStatus || active.status || property.status || 'available now');
  const heroDeposit = Number(active.securityDeposit || property.pricing?.securityDeposit || 0);

  const occupancyRows: Array<[string, unknown]> = [
    ['Maximum occupants', active.specifications?.maximumOccupants ?? active.occupancyRules?.maxTotal ?? property.occupancyRules?.maxTotal],
    ['Maximum adults', active.occupancyRules?.maxAdults ?? property.occupancyRules?.maxAdults],
    ['Maximum children', active.occupancyRules?.maxChildren ?? property.occupancyRules?.maxChildren],
    ['Family allowed', active.occupancyRules?.familyAllowed ?? property.occupancyRules?.familyAllowed],
    ['Bachelors allowed', active.occupancyRules?.bachelorsAllowed ?? property.occupancyRules?.bachelorsAllowed],
    ['Students allowed', active.occupancyRules?.studentsAllowed ?? property.occupancyRules?.studentsAllowed],
    ['Pets allowed', active.occupancyRules?.petsAllowed ?? property.occupancyRules?.petsAllowed],
  ];

  const specifications: any = property.specifications || {};
  const parking: any = property.parking || {};
  const utilities: any = property.utilities || {};
  const legal: any = property.legalDetails || {};
  const nearby: any = property.nearbyFacilities || {};
  const publicContact: any = property.publicContact || {};
  const specificationRows: Array<[string, unknown]> = [
    ['Bedrooms (BHK)', specifications.bedrooms ?? property.bedrooms], ['Bathrooms', specifications.bathrooms ?? property.bathrooms],
    ['Balconies', specifications.balconies], ['Rooms', specifications.rooms], ['Number of floors', specifications.numberOfFloors],
    ['Floor number', specifications.floorNumber], ['Total floors in building', specifications.totalFloorsInBuilding],
    ['Kitchen attached', specifications.kitchenAttached === true ? 'Yes' : specifications.kitchenAttached === false ? 'No' : undefined],
    ['Built-up area', property.areas?.builtUpSqft ? `${property.areas.builtUpSqft} sq. ft. / ${property.areas.builtUpSqm || '—'} sq. meter` : property.areas?.builtUp ? `${property.areas.builtUp} ${property.areas?.unit || 'sqft'}` : undefined],
    ['Carpet area', property.areas?.carpetSqft ? `${property.areas.carpetSqft} sq. ft. / ${property.areas.carpetSqm || '—'} sq. meter` : property.areas?.carpet ? `${property.areas.carpet} ${property.areas?.unit || 'sqft'}` : undefined],
    ['Plot area', property.areas?.plot ? `${property.areas.plot} ${property.areas?.unit || 'sqft'}` : undefined],
    ['Super built-up area', property.areas?.superBuiltUp ? `${property.areas.superBuiltUp} ${property.areas?.unit || 'sqft'}` : undefined],
    ['Facing', specifications.facing], ['Property age', specifications.propertyAge !== undefined ? `${specifications.propertyAge} years` : undefined],
    ['Furnishing', specifications.furnishingStatus], ['Ownership type', specifications.ownershipType],
    ['Available from', specifications.availableFrom ? new Date(String(specifications.availableFrom)).toLocaleDateString('en-IN') : undefined],
  ];
  const pricingRows: Array<[string, unknown]> = isRentListing ? [] : [
    ['Sale price', property.pricing?.salePrice ? money(Number(property.pricing.salePrice)) : undefined],
    ['Monthly rent', property.pricing?.monthlyRent ? money(Number(property.pricing.monthlyRent)) : undefined],
    ['Lease amount', property.pricing?.leaseAmount ? money(Number(property.pricing.leaseAmount)) : undefined],
    ['Security deposit', property.pricing?.securityDeposit ? money(Number(property.pricing.securityDeposit)) : undefined],
    ['Maintenance charges', property.pricing?.maintenanceCharge ? money(Number(property.pricing.maintenanceCharge)) : undefined],
    ['Price per sq. ft.', property.pricing?.pricePerUnitArea ? money(Number(property.pricing.pricePerUnitArea)) : undefined],
    ['Tax', property.pricing?.tax || property.pricing?.propertyTax ? money(Number(property.pricing.tax ?? property.pricing.propertyTax)) : undefined],
  ];
  const parkingPricingRows: Array<[string, unknown]> = [
    ['Car parking spaces', parking.carSpaces], ['Two-wheeler parking spaces', parking.twoWheelerSpaces], ['Visitor parking', parking.visitorParking], ...pricingRows,
  ];
  const utilityRows: Array<[string, unknown]> = [
    ['Water supply', utilities.waterSupply], ['Electricity connection', utilities.electricityConnection], ['Power backup', utilities.powerBackup],
    ['Internet availability', utilities.internetAvailability], ['Gas connection', utilities.gasConnection], ['Sewage connection', utilities.sewageConnection],
  ];
  const legalRows: Array<[string, unknown]> = [
    ['RERA number', legal.reraNumber], ['Title clear', legal.titleClear], ['Loan approved', legal.loanApproved],
    ['Occupancy certificate', legal.occupancyCertificate], ['Completion certificate', legal.completionCertificate],
  ];
  const nearbyRows = Object.entries(nearby).map(([key, value]) => [sentence(key), value] as [string, unknown]);
  const hasValue = (value: unknown) => value !== undefined && value !== null && value !== '';
  const detailSectionSx = usePremiumPropertyDetails ? {
    p: { xs: 2, md: 3 },
    borderRadius: '1px',
    borderColor: 'rgba(17, 62, 83, .16)',
    bgcolor: '#FFFFFF',
    boxShadow: '0 10px 24px rgba(18, 54, 74, .055)',
  } : {
    p: { xs: 2, md: 3 },
    borderRadius: 4,
  };
  const detailTileSx = {
    minHeight: 58,
    px: 1.35,
    py: 1.15,
    border: '1px solid rgba(17, 62, 83, .11)',
    borderRadius: '1px',
    bgcolor: '#F8FBFC',
  };
  const DetailSectionHeader = ({ icon: Icon, title, subtitle, tag }: { icon: any; title: string; subtitle: string; tag?: string }) => (
    !usePremiumPropertyDetails ? <Typography variant="h6" fontWeight={900}>{title}</Typography> :
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1.25}>
      <Stack direction="row" alignItems="center" gap={1.2}>
        <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', flexShrink: 0, color: '#087A70', bgcolor: 'rgba(8, 122, 112, .10)', border: '1px solid rgba(8, 122, 112, .17)', borderRadius: '1px' }}>
          <Icon sx={{ fontSize: 20 }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={950} sx={{ color: '#0D2D45', lineHeight: 1.15 }}>{title}</Typography>
          <Typography color="text.secondary" sx={{ mt: .35, fontSize: 12.5, lineHeight: 1.35 }}>{subtitle}</Typography>
        </Box>
      </Stack>
      {tag && <Chip label={tag} size="small" sx={{ flexShrink: 0, color: '#087A70', bgcolor: 'rgba(8, 122, 112, .10)', border: '1px solid rgba(8, 122, 112, .18)', fontWeight: 850, '& .MuiChip-label': { px: 1 } }} />}
    </Stack>
  );
  const propertyLocationSection = (
    <Paper variant="outlined" sx={{ ...detailSectionSx, mt: usePremiumPropertyDetails ? 2.5 : 3, overflow: 'hidden', ...(usePremiumPropertyDetails ? {} : { p: 1 }) }}>
      {usePremiumPropertyDetails && <DetailSectionHeader icon={LocationOnRounded} title="Property location" subtitle={exactPublicLocation ? 'Map location shared publicly by the property owner.' : 'Location details are shared according to the owner’s privacy setting.'} />}
      {mapEmbedUrl ? <Box sx={usePremiumPropertyDetails ? { mt: 2, p: 1, border: '1px solid rgba(17, 62, 83, .12)', borderRadius: '1px', bgcolor: '#F8FBFC' } : undefined}>
        <Box component="iframe" title={`${property.title} map`} src={mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" sx={{ border: 0, width: '100%', height: usePremiumPropertyDetails ? { xs: 270, md: 360 } : 360, display: 'block', borderRadius: usePremiumPropertyDetails ? '1px' : 3 }} />
      </Box> : <Stack direction="row" alignItems="flex-start" gap={1.25} sx={usePremiumPropertyDetails ? { mt: 2, p: { xs: 1.35, md: 1.65 }, border: '1px solid rgba(17, 62, 83, .12)', borderRadius: '1px', bgcolor: '#F8FBFC' } : { p: 1.25 }}>
        <Box sx={{ width: 36, height: 36, display: 'grid', placeItems: 'center', flexShrink: 0, color: '#087A70', bgcolor: 'rgba(8, 122, 112, .10)', borderRadius: '1px' }}><LocationOnRounded sx={{ fontSize: 20 }} /></Box>
        <Box>
          <Typography fontWeight={usePremiumPropertyDetails ? 700 : 800} sx={{ color: '#153B54' }}>{locationSummary || 'Location details are available on request.'}</Typography>
          <Typography color="text.secondary" fontSize={13} sx={{ mt: .35, lineHeight: 1.5 }}>{exactPublicLocation ? 'The property owner has made this location available publicly.' : 'Exact address details remain protected until the configured application or site-visit stage.'}</Typography>
        </Box>
      </Stack>}
    </Paper>
  );
  const renderRows = (rows: Array<[string, unknown]>) => rows.filter(([, value]) => hasValue(value)).map(([label, value]) => {
    const valueLabel = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : sentence(String(value));
    return <Grid size={{ xs: 12, sm: 6 }} key={label}>
      {usePremiumPropertyDetails ? <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1.5} sx={detailTileSx}>
        <Stack direction="row" alignItems="center" gap={.8} sx={{ minWidth: 0 }}>
          <Box sx={{ width: 6, height: 6, flexShrink: 0, bgcolor: '#0B8B7E', borderRadius: '50%' }} />
          <Typography color="text.secondary" fontSize={13}>{label}</Typography>
        </Stack>
        <Typography fontWeight={850} fontSize={13} textAlign="right" sx={{ color: '#153B54' }}>{valueLabel}</Typography>
      </Stack> : <Stack direction="row" justifyContent="space-between" gap={2} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography color="text.secondary" fontSize={13}>{label}</Typography>
        <Typography fontWeight={800} fontSize={13} textAlign="right">{valueLabel}</Typography>
      </Stack>}
    </Grid>;
  });

  const renderRentalRoomCard = (unit: any) => {
    const canBook = unit.canBook !== false && !unit.isLocked;
    const locked = !canBook;
    const roomTitle = unit.name || `Room ${unit.roomNumber}`;
    const roomImage = unit.primaryImage?.url || unit.gallery?.find((image: any) => image?.url)?.url || fallback;
    const features = [
      unit.specifications?.roomType ? sentence(unit.specifications.roomType) : '',
      unit.specifications?.furnishingStatus ? sentence(unit.specifications.furnishingStatus) : '',
      Number(unit.specifications?.bathroomCount) > 0 ? `${unit.specifications.bathroomCount} bathroom${unit.specifications.bathroomCount === 1 ? '' : 's'}` : '',
      Number(unit.specifications?.toiletCount) > 0 ? `${unit.specifications.toiletCount} toilet${unit.specifications.toiletCount === 1 ? '' : 's'}` : '',
      unit.specifications?.kitchenAvailable ? 'Kitchen' : '', unit.specifications?.balcony ? 'Balcony' : '',
      unit.specifications?.diningHall ? 'Dining hall' : '', unit.specifications?.livingRoom ? 'Living room' : '',
    ].filter(Boolean);
    return <Card
      variant="outlined"
      key={unit._id}
      role="link"
      tabIndex={0}
      aria-label={`${locked ? 'View locked details for' : 'View details for'} ${roomTitle}`}
      onClick={() => navigate(`/room_details/${unit._id}`)}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/room_details/${unit._id}`); } }}
      className="sa-rental-room-card-v199"
      sx={{ height: '100%', borderRadius: '30px', overflow: 'hidden', borderColor: locked ? 'rgba(245, 158, 11, .62)' : 'rgba(255,255,255,.3)', bgcolor: '#071b1c', cursor: 'pointer', boxShadow: locked ? '0 10px 24px rgba(91, 61, 18, .16)' : '0 12px 28px rgba(7, 27, 28, .22)', transition: 'transform .22s ease, box-shadow .22s ease, border-color .22s ease', '&:hover': { transform: 'translateY(-5px)', borderColor: locked ? 'warning.main' : 'rgba(255,255,255,.72)', boxShadow: locked ? '0 18px 34px rgba(91, 61, 18, .24)' : '0 20px 42px rgba(7, 27, 28, .32)' }, '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.light', outlineOffset: 3 } }}
    >
      <Box sx={{ position: 'relative', height: { xs: 320, sm: 370 }, color: '#FFFFFF' }}>
        <OptimizedImage src={roomImage} alt={unit.primaryImage?.name || roomTitle} width={720} height={980} sizes="(max-width: 900px) 50vw, 25vw" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', filter: locked ? 'grayscale(.45) saturate(.72)' : 'none', transition: 'transform .35s ease' }} />
        <Box sx={{ position: 'absolute', inset: 0, background: locked ? 'linear-gradient(180deg, rgba(10, 22, 22, .04) 24%, rgba(10, 22, 22, .28) 46%, rgba(10, 22, 22, .97) 100%)' : 'linear-gradient(180deg, rgba(10, 22, 22, .03) 22%, rgba(10, 22, 22, .16) 43%, rgba(10, 22, 22, .96) 100%)' }} />
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={.7} sx={{ position: 'absolute', top: 12, left: 12, right: 12 }}>
          <Chip size="small" label={locked ? 'Locked' : unit.availabilityLabel || 'Available'} color={locked ? 'warning' : unit.applicationInProgress ? 'info' : 'success'} sx={{ color: locked ? '#4A2A00' : undefined, fontWeight: 850, backdropFilter: 'blur(10px)', boxShadow: '0 3px 10px rgba(0,0,0,.16)' }} />
          <Chip size="small" label={`Room ${unit.roomNumber}`} sx={{ color: '#FFFFFF', bgcolor: 'rgba(8, 30, 30, .58)', border: '1px solid rgba(255,255,255,.28)', fontWeight: 750, backdropFilter: 'blur(10px)' }} />
        </Stack>
        <Box sx={{ position: 'absolute', left: 14, right: 14, bottom: 14 }}>
          <Typography fontWeight={950} noWrap title={roomTitle} sx={{ fontSize: { xs: 17, sm: 19 }, letterSpacing: '-.02em', textShadow: '0 2px 12px rgba(0,0,0,.32)' }}>{roomTitle}</Typography>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={1} sx={{ mt: .55 }}>
            <Typography fontWeight={950} sx={{ fontSize: { xs: 18, sm: 21 }, lineHeight: 1 }}>{money(Number(unit.pricing?.monthlyRent || 0))}<Typography component="span" sx={{ ml: .35, color: 'rgba(255,255,255,.78)', fontSize: 11, fontWeight: 700 }}>/ month</Typography></Typography>
            <Typography sx={{ color: 'rgba(255,255,255,.76)', fontSize: 11, textAlign: 'right' }}>{features.slice(0, 2).join(' · ') || 'Room details'}</Typography>
          </Stack>
          <Stack direction="row" gap={.7} sx={{ mt: 1.35 }}>
            <Button fullWidth size="small" variant="outlined" onClick={(event) => { event.stopPropagation(); navigate(`/room_details/${unit._id}`); }} sx={{ minHeight: 34, color: '#FFFFFF', borderColor: 'rgba(255,255,255,.6)', bgcolor: 'rgba(255,255,255,.08)', '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,.16)' } }}>View details</Button>
            <Button fullWidth size="small" variant="contained" disabled={!canBook} onClick={(event) => { event.stopPropagation(); navigate(`/app/apply_property/${property._id}?rentalUnit=${unit._id}`); }} sx={{ minHeight: 34, fontWeight: 900, '&.Mui-disabled': { color: 'rgba(255,255,255,.65)', bgcolor: 'rgba(255,255,255,.18)' } }}>{locked ? 'Locked' : 'Book now'}</Button>
          </Stack>
        </Box>
      </Box>
    </Card>;
  };

  const amenityNames = [...new Set([...(active.amenities || []), ...(property.amenities || [])].filter(Boolean).map((item: any) => String(item)))];
  const heroFacts = [
    { label: 'Bedrooms', value: String(heroBedrooms ?? '—'), kind: 'bed' as const },
    { label: 'Bathrooms', value: String(heroBathrooms ?? '—'), kind: 'bath' as const },
    { label: 'Living Room', value: String(active.specifications?.livingRoomCount ?? specifications.livingRooms ?? (heroRooms ? 1 : '—')), kind: 'living' as const },
    { label: 'Kitchen', value: specifications.kitchenAttached === false ? 'No' : '1', kind: 'kitchen' as const },
    { label: 'Balcony', value: String(specifications.balconies ?? active.specifications?.balconyCount ?? '—'), kind: 'balcony' as const },
    { label: 'Car Parking', value: String(parking.carSpaces ?? (amenityNames.some((item) => /parking/i.test(item)) ? 1 : '—')), kind: 'parking' as const },
    { label: 'Lift Available', value: amenityNames.some((item) => /lift|elevator/i.test(item)) ? 'Yes' : '—', kind: 'lift' as const },
  ];

  const premiumHero = <PremiumPropertyHero
    title={sentence(shareTitle)}
    purpose={sentence(purpose)}
    propertyType={sentence(selected?.level || property.type || 'Residential Apartment')}
    address={locationSummary || address || 'Location shared according to owner privacy settings'}
    images={displayImages}
    tourMedia={tourMedia}
    floorPlanMedia={floorPlanMedia}
    price={price}
    priceLabel={heroPriceLabel}
    priceSuffix={isRentListing ? '/ month' : undefined}
    deposit={heroDeposit || undefined}
    availableLabel={isRentListing ? 'Available for Rent' : heroAvailability}
    verified={Boolean(property.isVerified)}
    urgentLabel={property.promotion?.urgentType && property.promotion.urgentType !== 'none' ? sentence(property.promotion.urgentType) : undefined}
    bedrooms={heroBedrooms !== undefined && heroBedrooms !== null ? String(heroBedrooms) : undefined}
    bathrooms={heroBathrooms !== undefined && heroBathrooms !== null ? String(heroBathrooms) : undefined}
    area={heroAreaValue ? `${Number(heroAreaValue).toLocaleString()} ${heroAreaUnit}` : undefined}
    roomCount={heroRooms !== undefined && heroRooms !== null ? String(heroRooms) : undefined}
    furnishing={heroFurnishing ? sentence(heroFurnishing) : undefined}
    amenities={amenityNames}
    facts={heroFacts}
    contactName={publicContact.agentName || publicContact.ownerName || undefined}
    saved={saved}
    onShare={() => void sharePublicListing({ title: shareTitle, imageUrl: shareImage, url: publicUrl })}
    shareAction={<Button data-secureasset-public-property-share="public-listing-share-v214" variant="outlined" size="small" onClick={() => void sharePublicListing({ title: shareTitle, imageUrl: shareImage, url: publicUrl })} aria-label={`Share ${shareTitle}`} sx={{ minHeight: 34, borderColor: '#D8E2EA', color: '#173B55', fontWeight: 700, textTransform: 'none', borderRadius: 2 }}>Share</Button>}
    onToggleSaved={() => void wishlist.toggle(wishlistListing)}
    onBook={() => navigate(`/app/apply_property/${property._id}${selected ? `?space=${selected._id}` : ''}`)}
    bookingLabel={isRentListing ? 'Book Room / Apply' : 'Apply Now'}
    onScheduleVisit={() => navigate(`/app/schedule_visit/${property._id}${selected ? `?space=${selected._id}` : ''}`)}
    onDirections={() => window.open(directions, '_blank')}
    onEnquiry={() => navigate(`/app/schedule_visit/${property._id}${selected ? `?space=${selected._id}` : ''}`)}
  />;

  const overviewHighlights = [
    ['Modern Architecture', 'Stylish and contemporary design'],
    ['Prime Location', 'Well connected area'],
    ['Verified Property', property.isVerified ? 'Surveyor verified' : 'Verification available'],
    ['Spacious Rooms', heroAreaValue ? `${Number(heroAreaValue).toLocaleString()} ${heroAreaUnit}` : 'Comfortable layouts'],
    ['Quality Construction', 'Premium property presentation'],
    ['Peaceful Neighborhood', 'Safe and secure locality'],
  ];

  const premiumAmenityItems = [
    utilities.internetAvailability ? ['Wi-Fi Internet', <WifiRounded />] : null,
    utilities.powerBackup ? ['Power Backup', <BoltRounded />] : null,
    amenityNames.some((item) => /lift|elevator/i.test(item)) ? ['Lift', <HomeWorkRounded />] : null,
    (parking.carSpaces || amenityNames.some((item) => /parking/i.test(item))) ? ['Car Parking', <DirectionsCarRounded />] : null,
    ['Security', <SecurityRounded />],
    utilities.waterSupply ? ['Water Supply', <WaterDropRounded />] : null,
    specifications.kitchenAttached !== false ? ['Modular Kitchen', <HomeWorkRounded />] : null,
    amenityNames.some((item) => /ac|air condition/i.test(item)) ? ['AC Provision', <HomeWorkRounded />] : null,
    Number(specifications.balconies || 0) > 0 ? ['Balcony', <HomeWorkRounded />] : null,
    ['Fire Safety', <CheckCircleRounded />],
  ].filter(Boolean) as Array<[string, any]>;

  const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const roomPreviewUnits = rentalUnits;
  const roomSlideCount = Math.max(1, roomPreviewUnits.length);
  const roomSlideItems = roomPreviewUnits.length
    ? [roomPreviewUnits[roomSlideIndex % roomSlideCount], roomPreviewUnits[(roomSlideIndex + 1) % roomSlideCount]].filter(Boolean)
    : [];
  const showPreviousRoom = () => setRoomSlideIndex((current) => roomPreviewUnits.length ? (current - 1 + roomPreviewUnits.length) % roomPreviewUnits.length : 0);
  const showNextRoom = () => setRoomSlideIndex((current) => roomPreviewUnits.length ? (current + 1) % roomPreviewUnits.length : 0);
  const compactDetails: Array<[string, unknown]> = [
    ['Property Type', sentence(selected?.level || property.type || 'Residential Apartment')],
    ['BHK', heroBedrooms ? `${heroBedrooms} BHK` : undefined],
    ['Furnishing', heroFurnishing ? sentence(heroFurnishing) : undefined],
    ['Total Area', heroAreaValue ? `${Number(heroAreaValue).toLocaleString()} ${heroAreaUnit}` : undefined],
    ['Floor', specifications.floorNumber !== undefined ? sentence(String(specifications.floorNumber)) : undefined],
    ['Total Floors', specifications.totalFloorsInBuilding ?? specifications.numberOfFloors],
    ['Age of Property', specifications.propertyAge !== undefined ? `${specifications.propertyAge} Years` : undefined],
    ['Availability', heroAvailability],
  ];

  const sectionCard = {
    border: '1px solid #e5ebf0',
    borderRadius: '12px',
    bgcolor: '#fff',
    boxShadow: '0 8px 24px rgba(20,49,72,.035)',
  } as const;

  const additionalValue = (value: unknown, fallbackValue = 'Not specified') => {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    if (value === undefined || value === null || value === '') return fallbackValue;
    return String(value);
  };
  const totalAreaLabel = heroAreaValue ? `${Number(heroAreaValue).toLocaleString()} ${heroAreaUnit === 'sqft' ? 'sq.ft' : heroAreaUnit}` : 'Not specified';
  const carpetAreaLabel = property.areas?.carpetSqft
    ? `${Number(property.areas.carpetSqft).toLocaleString()} sq.ft`
    : property.areas?.carpet ? `${Number(property.areas.carpet).toLocaleString()} ${property.areas?.unit || 'sqft'}` : 'Not specified';
  const configurationLabel = heroBedrooms ? `${heroBedrooms} BHK` : 'Not specified';
  const parkingLabel = parking.carSpaces !== undefined && parking.carSpaces !== null
    ? `${parking.carSpaces}${Number(parking.carSpaces) > 0 ? ' (Covered/Assigned)' : ''}`
    : 'Not specified';
  const possessionLabel = specifications.availableFrom
    ? new Date(String(specifications.availableFrom)).toLocaleDateString('en-IN')
    : /ready|available/i.test(String(heroAvailability || '')) ? 'Immediate' : additionalValue(heroAvailability);
  const securityDepositLabel = heroDeposit
    ? `${money(heroDeposit)}${price > 0 ? ` (${Math.max(1, Math.round(heroDeposit / price))} Months)` : ''}`
    : 'Not specified';

  const additionalSnapshot = [
    { label: 'Property Type', value: sentence(selected?.level || property.type || 'Residential Apartment'), Icon: HomeWorkRounded, bg: '#EAF9F1', color: '#0A9A67' },
    { label: 'Total Area', value: totalAreaLabel, Icon: SquareFootRounded, bg: '#FFF4E7', color: '#F08B19' },
    { label: 'Configuration', value: configurationLabel, Icon: WeekendRounded, bg: '#F5EDFF', color: '#7C3AED' },
    { label: isRentListing ? 'Expected Rent' : 'Property Value', value: price > 0 ? money(price) : 'On request', Icon: PaymentsRounded, bg: '#EAF9F1', color: '#0A9A67' },
  ];

  const additionalSpecificationCards = [
    { label: 'Property Type', value: sentence(selected?.level || property.type || 'Residential Apartment'), Icon: HomeWorkRounded },
    { label: 'Configuration (BHK)', value: configurationLabel, Icon: BedRounded },
    { label: 'Furnishing', value: heroFurnishing ? sentence(heroFurnishing) : 'Not specified', Icon: ChairRounded },
    { label: 'Total Area', value: totalAreaLabel, Icon: SquareFootRounded },
    { label: 'Carpet Area', value: carpetAreaLabel, Icon: SquareFootRounded },
    { label: 'Floor', value: specifications.floorNumber !== undefined ? sentence(String(specifications.floorNumber)) : 'Not specified', Icon: LayersRounded },
    { label: 'Total Floors', value: additionalValue(specifications.totalFloorsInBuilding ?? specifications.numberOfFloors), Icon: ApartmentRounded },
    { label: 'Age of Property', value: specifications.propertyAge !== undefined ? `${specifications.propertyAge} Years` : 'Not specified', Icon: CalendarMonthRounded },
    { label: 'Availability', value: heroAvailability || 'Not specified', Icon: CalendarMonthRounded },
    { label: 'Parking Spaces', value: parkingLabel, Icon: LocalParkingRounded },
    { label: isRentListing ? 'Monthly Rent' : 'Price', value: price > 0 ? money(price) : 'On request', Icon: PaymentsRounded },
    { label: 'Security Deposit', value: securityDepositLabel, Icon: SecurityRounded },
    { label: 'Water Supply', value: additionalValue(utilities.waterSupply), Icon: WaterDropRounded },
    { label: 'Power Backup', value: additionalValue(utilities.powerBackup), Icon: BoltRounded },
    { label: 'RERA Number', value: additionalValue(legal.reraNumber), Icon: ArticleRounded },
    { label: 'Title Clear', value: additionalValue(legal.titleClear), Icon: VerifiedRounded },
    { label: 'Facing', value: additionalValue(specifications.facing), Icon: ExploreRounded },
    { label: 'Property Ownership', value: additionalValue(specifications.ownershipType), Icon: KeyRounded },
    { label: 'Approved By', value: legal.reraNumber ? 'RERA Registered' : additionalValue(legal.loanApproved ? 'Approved' : undefined), Icon: AccountBalanceRounded },
    { label: 'Possession Date', value: possessionLabel, Icon: CalendarMonthRounded },
  ];

  const additionalParkingCards = [
    { label: 'Car Parking Spaces', value: additionalValue(parking.carSpaces), Icon: LocalParkingRounded },
    { label: 'Two-Wheeler Spaces', value: additionalValue(parking.twoWheelerSpaces), Icon: LocalParkingRounded },
    { label: 'Visitor Parking', value: additionalValue(parking.visitorParking), Icon: DirectionsCarRounded },
    { label: 'Monthly Rent', value: property.pricing?.monthlyRent ? money(Number(property.pricing.monthlyRent)) : (isRentListing && price > 0 ? money(price) : 'Not specified'), Icon: PaymentsRounded },
    { label: 'Security Deposit', value: securityDepositLabel, Icon: SecurityRounded },
    { label: 'Maintenance Charges', value: property.pricing?.maintenanceCharge ? money(Number(property.pricing.maintenanceCharge)) : 'Not specified', Icon: PaymentsRounded },
    { label: 'Sale Price', value: property.pricing?.salePrice ? money(Number(property.pricing.salePrice)) : 'Not specified', Icon: PaymentsRounded },
    { label: 'Lease Amount', value: property.pricing?.leaseAmount ? money(Number(property.pricing.leaseAmount)) : 'Not specified', Icon: PaymentsRounded },
    { label: 'Price / sq.ft', value: property.pricing?.pricePerUnitArea ? money(Number(property.pricing.pricePerUnitArea)) : 'Not specified', Icon: SquareFootRounded },
    { label: 'Property Tax', value: property.pricing?.tax || property.pricing?.propertyTax ? money(Number(property.pricing.tax ?? property.pricing.propertyTax)) : 'Not specified', Icon: AccountBalanceRounded },
  ];

  const additionalUtilityCards = [
    { label: 'Water Supply', value: additionalValue(utilities.waterSupply), Icon: WaterDropRounded },
    { label: 'Electricity Connection', value: additionalValue(utilities.electricityConnection), Icon: BoltRounded },
    { label: 'Power Backup', value: additionalValue(utilities.powerBackup), Icon: BoltRounded },
    { label: 'Internet Availability', value: additionalValue(utilities.internetAvailability), Icon: WifiRounded },
    { label: 'Gas Connection', value: additionalValue(utilities.gasConnection), Icon: SettingsRounded },
    { label: 'Sewage Connection', value: additionalValue(utilities.sewageConnection), Icon: SettingsRounded },
    { label: 'RERA Number', value: additionalValue(legal.reraNumber), Icon: ArticleRounded },
    { label: 'Title Clear', value: additionalValue(legal.titleClear), Icon: VerifiedRounded },
    { label: 'Loan Approved', value: additionalValue(legal.loanApproved), Icon: AccountBalanceRounded },
    { label: 'Occupancy Certificate', value: additionalValue(legal.occupancyCertificate), Icon: DescriptionRounded },
    { label: 'Completion Certificate', value: additionalValue(legal.completionCertificate), Icon: DescriptionRounded },
  ];

  const additionalCustomCards = property.customAttributes && Object.keys(property.customAttributes).length
    ? Object.entries(property.customAttributes).map(([key, value], index) => ({
        label: sentence(key),
        value: Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : additionalValue(value),
        Icon: index % 2 ? AppsRounded : SettingsRounded,
      }))
    : [{ label: 'Property-Specific Details', value: 'No additional custom attributes have been added.', Icon: AppsRounded }];

  const additionalPanels = [
    { title: 'Property Specifications', subtitle: 'Core details and specifications of this property.', cards: additionalSpecificationCards },
    { title: 'Parking & Pricing', subtitle: 'Parking availability, rent, deposits, charges, and property pricing.', cards: additionalParkingCards },
    { title: 'Utilities & Legal Details', subtitle: 'Essential services, utilities, registrations, and legal property records.', cards: additionalUtilityCards },
    { title: 'Property-Specific Details', subtitle: 'Additional information supplied specifically for this listing.', cards: additionalCustomCards },
  ];
  const additionalPanel = additionalPanels[detailsTab] || additionalPanels[0];
  const additionalTones = [
    { bg: '#EAF3FF', color: '#2878E8' },
    { bg: '#EAF9F1', color: '#0A9A67' },
    { bg: '#FFF4E7', color: '#F08B19' },
    { bg: '#F5EDFF', color: '#7C3AED' },
  ];

  return <Box data-secureasset-property-overview="approved-premium-v214" sx={{
    bgcolor: '#f7fafc', minHeight: '100vh', pb: { xs: 7, md: 5 },
    fontFamily: '"Open Sans", Arial, sans-serif',
    '& .MuiTypography-root, & .MuiButton-root, & .MuiChip-root, & .MuiTab-root': { fontFamily: '"Open Sans", Arial, sans-serif' },
  }}>
    <Container maxWidth={false} sx={{ maxWidth: '1880px', px: { xs: 1.25, sm: 2, md: 3.5, xl: 5 }, pt: { xs: 1.25, md: 2 } }}>
      {premiumHero}

      <Paper elevation={0} sx={{ ...sectionCard, mt: 1.5, px: { xs: .5, sm: 1 }, py: .35, overflowX: 'auto' }}>
        <Stack direction="row" alignItems="center" spacing={.3} sx={{ minWidth: 'max-content' }}>
          {[
            ['overview','Overview',HomeWorkRounded],
            ['rooms','Rooms & Floor Plan',GridViewRounded],
            ['amenities','Amenities',CheckCircleRounded],
            ['location','Location',LocationOnRounded],
            ['rules','Rules',RuleRounded],
            ['nearby','Nearby Places',LocationOnRounded],
            ['tour','Property Tour',ViewInArRounded],
            ['reviews','Reviews',StarRounded],
          ].map(([id,labelText,Icon]: any, index) => <Button key={id} startIcon={<Icon sx={{ fontSize: '17px !important' }} />} onClick={() => scrollToSection(id)} sx={{
            minHeight: 42, px: { xs: 1.15, md: 1.8 }, color: index === 0 ? '#087f5b' : '#405a70',
            borderRadius: 0, borderBottom: index === 0 ? '2px solid #10a374' : '2px solid transparent',
            textTransform: 'none', fontSize: 11.5, fontWeight: index === 0 ? 800 : 650,
          }}>{labelText}</Button>)}
        </Stack>
      </Paper>

      <Grid container spacing={1.5} sx={{ mt: .2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={1.5}>
            <Paper id="overview" elevation={0} sx={{ ...sectionCard, p: { xs: 1.6, md: 2 } }}>
              <Typography sx={{ color: '#102a43', fontSize: 16, fontWeight: 800 }}>About This Property</Typography>
              <Typography sx={{ mt: .75, color: '#5f7285', fontSize: 12.5, lineHeight: 1.65 }}>{active.description || property.description || 'A premium property presented through Secure Asset with verified details, transparent room information and secure application workflows.'}</Typography>
              <Button size="small" sx={{ mt: .55, px: 0, color: '#1473e6', textTransform: 'none', fontSize: 10.5, fontWeight: 700 }}>Read More</Button>

              <Typography sx={{ mt: 1.65, color: '#102a43', fontSize: 14, fontWeight: 800 }}>Property Highlights</Typography>
              <Grid container spacing={.9} sx={{ mt: .25 }}>
                {overviewHighlights.map(([titleText,desc], index) => <Grid key={titleText} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Stack direction="row" spacing={.9} alignItems="center" sx={{ p: 1, borderRadius: 2, bgcolor: '#fbfcfd', border: '1px solid #edf1f4', height: '100%' }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: index % 3 === 0 ? '#e8faf2' : index % 3 === 1 ? '#eef5ff' : '#fff5e9', color: index % 3 === 0 ? '#079455' : index % 3 === 1 ? '#3478da' : '#df7b13', flexShrink: 0 }}><CheckCircleRounded sx={{ fontSize: 18 }} /></Box>
                    <Box><Typography sx={{ fontSize: 11.5, fontWeight: 800, color: '#183a55' }}>{titleText}</Typography><Typography sx={{ mt: .15, fontSize: 9.5, color: '#8492a0' }}>{desc}</Typography></Box>
                  </Stack>
                </Grid>)}
              </Grid>
            </Paper>

            <Paper id="amenities" elevation={0} sx={{ ...sectionCard, p: { xs: 1.6, md: 2 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ color: '#102a43', fontSize: 15, fontWeight: 800 }}>Amenities</Typography>
                <Button size="small" sx={{ textTransform: 'none', fontSize: 10.5 }}>View All Amenities →</Button>
              </Stack>
              <Grid container spacing={1} sx={{ mt: .25 }}>
                {premiumAmenityItems.slice(0,10).map(([name,icon]) => <Grid key={name} size={{ xs: 4, sm: 3, md: 2.4 }}>
                  <Stack alignItems="center" spacing={.55} sx={{ py: .8 }}>
                    <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: '#eaf8f3', color: '#079455', '& svg': { fontSize: 19 } }}>{icon}</Box>
                    <Typography sx={{ fontSize: 10.5, color: '#304d64', textAlign: 'center' }}>{name}</Typography>
                  </Stack>
                </Grid>)}
              </Grid>
            </Paper>

            <Paper id="rooms" elevation={0} sx={{ ...sectionCard, p: { xs: 1.6, md: 2 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ color: '#102a43', fontSize: 15, fontWeight: 800 }}>Rooms & Floor Plan</Typography>
                {rentalUnits.length > 0 && <Button size="small" onClick={() => roomPreviewUnits[0] && navigate(`/room_details/${roomPreviewUnits[0]._id}`)} sx={{ textTransform: 'none', fontSize: 10.5 }}>View All Rooms →</Button>}
              </Stack>
              <Box sx={{ mt: .65 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: .75 }}>
                  <Typography sx={{ fontSize: 10.5, color: '#7A8D9E' }}>
                    {roomPreviewUnits.length ? `${roomSlideIndex + 1} of ${roomPreviewUnits.length} rooms` : 'Room previews'}
                  </Typography>
                  <Stack direction="row" spacing={.55}>
                    <IconButton
                      aria-label="Previous room"
                      onClick={showPreviousRoom}
                      disabled={roomPreviewUnits.length <= 1}
                      size="small"
                      sx={{
                        width: 32, height: 32, border: '1px solid #DCE5EC', borderRadius: '50%',
                        color: '#173B55', bgcolor: '#fff', boxShadow: '0 3px 10px rgba(25,55,80,.04)',
                        '&:hover': { bgcolor: '#F6F9FB', borderColor: '#C8D7E2' },
                      }}
                    >
                      <ArrowBackIosNewRounded sx={{ fontSize: 15 }} />
                    </IconButton>
                    <IconButton
                      aria-label="Next room"
                      onClick={showNextRoom}
                      disabled={roomPreviewUnits.length <= 1}
                      size="small"
                      sx={{
                        width: 32, height: 32, border: '1px solid #DCE5EC', borderRadius: '50%',
                        color: '#173B55', bgcolor: '#fff', boxShadow: '0 3px 10px rgba(25,55,80,.04)',
                        '&:hover': { bgcolor: '#F6F9FB', borderColor: '#C8D7E2' },
                      }}
                    >
                      <ArrowForwardIosRounded sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Stack>
                </Stack>

                <Grid container spacing={{ xs: .85, sm: 1 }}>
                  {roomSlideItems.length ? roomSlideItems.map((unit: any, slidePosition: number) => {
                    const roomImage = unit.primaryImage?.url || unit.gallery?.find((item: any) => item?.url)?.url || shareImage;
                    const rawStatus = String(unit.availabilityStatus || '').toUpperCase();
                    const available = unit.canBook !== false && !unit.isLocked && !unit.applicationInProgress && !['OCCUPIED','BLOCKED','ARCHIVED'].includes(rawStatus);
                    const statusLabel = unit.availabilityLabel || (unit.isLocked ? 'Occupied' : unit.applicationInProgress ? 'Application Pending' : rawStatus ? sentence(rawStatus) : 'Available');
                    const statusTone = available
                      ? { bg: '#EAF9F1', color: '#087443', dot: '#12B76A' }
                      : unit.applicationInProgress || ['APPLICATION_PENDING','AGREEMENT_PENDING','PAYMENT_PENDING','NOTICE_PERIOD','VACATING'].includes(rawStatus)
                        ? { bg: '#FFF7E6', color: '#B54708', dot: '#F79009' }
                        : { bg: '#FEECEC', color: '#B42318', dot: '#F04438' };
                    const floorText = unit.floor?.floorName || (unit.floor?.floorNumber !== undefined ? `Floor ${unit.floor.floorNumber}` : '');
                    const roomType = sentence(unit.specifications?.roomType || unit.roomType || 'Private room');
                    const roomSize = unit.specifications?.roomSize?.value
                      ? `${unit.specifications.roomSize.value} ${unit.specifications.roomSize.unit || 'sqft'}`
                      : '';
                    return <Grid
                      key={`${unit._id}-${slidePosition}`}
                      size={{ xs: 12, sm: 6 }}
                      sx={{ display: slidePosition === 1 ? { xs: 'none', sm: 'block' } : 'block' }}
                    >
                      <Paper
                        component="button"
                        type="button"
                        onClick={() => navigate(`/room_details/${unit._id}`)}
                        elevation={0}
                        sx={{
                          width: '100%', height: { xs: 102, sm: 108 }, p: .7,
                          display: 'flex', alignItems: 'stretch', gap: .9,
                          textAlign: 'left', border: '1px solid #E3E9EE', borderRadius: 2,
                          bgcolor: '#fff', cursor: 'pointer', overflow: 'hidden',
                          boxShadow: '0 4px 13px rgba(25,55,80,.025)',
                          transition: 'transform .18s ease, box-shadow .18s ease, opacity .18s ease',
                          '&:hover': { transform: 'translateY(-1px)', borderColor: '#CBD8E2', boxShadow: '0 8px 20px rgba(25,55,80,.07)' },
                        }}
                      >
                        <Box sx={{
                          width: { xs: 108, sm: 120 }, minWidth: { xs: 108, sm: 120 },
                          height: '100%', overflow: 'hidden', bgcolor: '#EDF2F5',
                          borderRadius: '5px', flexShrink: 0,
                        }}>
                          <OptimizedImage
                            src={roomImage}
                            alt={unit.name || `Room ${unit.roomNumber}`}
                            width={360}
                            height={280}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '5px', display: 'block' }}
                          />
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 0, py: .1, pr: .15, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <Box>
                            <Stack direction="row" justifyContent="space-between" spacing={.55} alignItems="flex-start">
                              <Typography noWrap sx={{ minWidth: 0, flex: 1, fontSize: { xs: 11.3, sm: 12.2 }, lineHeight: 1.15, fontWeight: 800, color: '#173B55' }}>
                                {unit.name || `Room ${unit.roomNumber}`}
                              </Typography>
                              <Chip
                                size="small"
                                label={<Stack component="span" direction="row" spacing={.4} alignItems="center"><Box component="span" sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: statusTone.dot }} />{statusLabel}</Stack>}
                                sx={{
                                  height: 20, maxWidth: 120, flexShrink: 0, bgcolor: statusTone.bg, color: statusTone.color,
                                  fontSize: 8.2, fontWeight: 800, '& .MuiChip-label': { px: .65, overflow: 'hidden', textOverflow: 'ellipsis' },
                                }}
                              />
                            </Stack>
                            <Typography noWrap sx={{ mt: .35, fontSize: 9.1, color: '#75889A' }}>{[roomType, floorText].filter(Boolean).join(' · ')}</Typography>
                            {roomSize && <Typography noWrap sx={{ mt: .2, fontSize: 8.9, color: '#8A98A6' }}>Approx. {roomSize}</Typography>}
                          </Box>

                          <Stack direction="row" justifyContent="space-between" alignItems="flex-end" spacing={.7}>
                            <Box>
                              <Typography sx={{ fontSize: { xs: 11.8, sm: 12.7 }, lineHeight: 1, fontWeight: 800, color: '#087F5B' }}>{money(Number(unit.pricing?.monthlyRent || 0))}</Typography>
                              <Typography sx={{ mt: .1, fontSize: 8, color: '#8A98A6' }}>per month</Typography>
                            </Box>
                            <Typography sx={{ pb: .05, fontSize: 8.5, color: '#4E6A80', fontWeight: 700 }}>View →</Typography>
                          </Stack>
                        </Box>
                      </Paper>
                    </Grid>;
                  }) : displayImages.slice(1,3).map((image:string,index:number) => <Grid key={image} size={{ xs: 12, sm: 6 }} sx={{ display: index === 1 ? { xs: 'none', sm: 'block' } : 'block' }}>
                    <Paper elevation={0} sx={{ height: { xs: 102, sm: 108 }, p: .7, display: 'flex', gap: .9, alignItems: 'stretch', border: '1px solid #E3E9EE', borderRadius: 2, bgcolor: '#fff' }}>
                      <Box sx={{ width: { xs: 108, sm: 120 }, minWidth: { xs: 108, sm: 120 }, height: '100%', overflow: 'hidden', borderRadius: '5px', bgcolor: '#EDF2F5' }}>
                        <OptimizedImage src={image} alt={`Room ${index+1}`} width={360} height={280} style={{ width:'100%',height:'100%',objectFit:'cover',borderRadius:'5px',display:'block' }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0, py: .2 }}>
                        <Stack direction="row" justifyContent="space-between" spacing={.5}><Typography sx={{ fontSize:11.5,fontWeight:800,color:'#173B55' }}>Room {index+1}</Typography><Chip size="small" label="Available" sx={{ height:20,bgcolor:'#EAF9F1',color:'#087443',fontSize:8.2,fontWeight:800 }} /></Stack>
                        <Typography sx={{ mt:.4,fontSize:9,color:'#8291A0' }}>Property interior</Typography>
                      </Box>
                    </Paper>
                  </Grid>)}
                </Grid>

                {roomPreviewUnits.length > 1 && <Stack direction="row" justifyContent="center" spacing={.55} sx={{ mt: .8 }}>
                  {roomPreviewUnits.map((unit: any, index: number) => <Box
                    component="button"
                    type="button"
                    aria-label={`Show ${unit.name || `Room ${unit.roomNumber || index + 1}`}`}
                    key={unit._id || index}
                    onClick={() => setRoomSlideIndex(index)}
                    sx={{
                      width: roomSlideIndex === index ? 18 : 6, height: 6, p: 0, border: 0, borderRadius: 99,
                      bgcolor: roomSlideIndex === index ? '#087F5B' : '#CFD9E1', cursor: 'pointer',
                      transition: 'width .18s ease, background-color .18s ease',
                    }}
                  />)}
                </Stack>}
              </Box>

              <Paper elevation={0} sx={{ mt: 1.1, border: '1px solid #E2E9EF', borderRadius: 2.5, overflow: 'hidden', p: { xs: 1.1, sm: 1.3 }, bgcolor: '#FBFCFD' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ sm: 'center' }}>
                  <Box sx={{ width: { xs: '100%', sm: 210 }, height: { xs: 145, sm: 120 }, borderRadius: 2, overflow: 'hidden', bgcolor: '#F1F4F6', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {floorPlanMedia[0]?.url ? <OptimizedImage src={floorPlanMedia[0].url} alt="Floor plan" width={520} height={320} style={{ width:'100%',height:'100%',objectFit:'contain' }} /> : <GridViewRounded sx={{ fontSize: 44, color: '#9AABB9' }} />}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: '#173B55' }}>{heroBedrooms ? `${heroBedrooms} BHK Floor Plan` : 'Floor Plan'}</Typography>
                    <Typography sx={{ mt: .35, fontSize: 10, color: '#8291A0' }}>Review the available layout and room positioning before applying.</Typography>
                    <Button size="small" startIcon={<GridViewRounded />} onClick={() => floorPlanMedia[0]?.url ? window.open(floorPlanMedia[0].url, '_blank', 'noopener,noreferrer') : undefined} disabled={!floorPlanMedia[0]?.url} sx={{ mt: .7, px: 0, textTransform: 'none', fontSize: 10.5, fontWeight: 700 }}>View Floor Plan</Button>
                  </Box>
                </Stack>
              </Paper>
            </Paper>

            <Paper id="nearby" elevation={0} sx={{ ...sectionCard, p: { xs: 1.6, md: 2 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography sx={{ color: '#102a43', fontSize: 15, fontWeight: 800 }}>Nearby Places</Typography><Button size="small" sx={{ textTransform:'none', fontSize:10.5 }}>View All →</Button></Stack>
              <Stack direction="row" spacing={.8} sx={{ mt: 1, overflowX: 'auto', pb: .35 }}>
                {(nearbyRows.length ? nearbyRows : [['Supermarket','Nearby'],['School','Nearby'],['Hospital','Nearby'],['Metro Station','Nearby'],['Restaurant','Nearby']]).slice(0,7).map(([name,value],index) => <Box key={String(name)} sx={{ flex:'0 0 145px', border:'1px solid #e8edf1', borderRadius:2, overflow:'hidden', bgcolor:'#fff' }}>
                  <Box sx={{ height:58, bgcolor:'#eef3f5', overflow:'hidden' }}>{displayImages[index % Math.max(1,displayImages.length)] && <OptimizedImage src={displayImages[index % displayImages.length]} alt="" width={320} height={150} style={{width:'100%',height:'100%',objectFit:'cover'}} />}</Box>
                  <Box sx={{ p:.7 }}><Typography sx={{ fontSize:10.5,fontWeight:800,color:'#183a55' }}>{String(name)}</Typography><Typography sx={{ fontSize:9.2,color:'#8190a0' }}>{String(value || 'Nearby')}</Typography></Box>
                </Box>)}
              </Stack>
            </Paper>

            <Paper id="reviews" elevation={0} sx={{ ...sectionCard, p: { xs:1.6, md:2 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography sx={{ color:'#102a43',fontSize:15,fontWeight:800 }}>Reviews</Typography><Stack direction="row" spacing={.25} alignItems="center"><StarRounded sx={{fontSize:17,color:'#f59e0b'}}/><Typography sx={{fontSize:12,fontWeight:800}}>Verified stays only</Typography></Stack></Stack>
              <Typography sx={{mt:.8,fontSize:11.5,color:'#758698'}}>Tenant feedback appears here after completed and verified rental experiences.</Typography>
            </Paper>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={1.5}>
            <Paper id="tour" elevation={0} sx={{ ...sectionCard, p: 1.4 }}>
              <Stack direction="row" spacing={.65} alignItems="center"><ViewInArRounded sx={{ fontSize:18,color:'#087f5b' }}/><Typography sx={{fontSize:14,fontWeight:800,color:'#102a43'}}>Interactive Property Tour</Typography></Stack>
              <Box sx={{ mt:1, position:'relative', height:210, borderRadius:2, overflow:'hidden', bgcolor:'#edf2f5' }}>
                <OptimizedImage src={displayImages[1] || shareImage} alt="Interactive property tour" width={700} height={430} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                <Box sx={{position:'absolute',inset:0,display:'grid',placeItems:'center',bgcolor:'rgba(8,29,42,.08)'}}>
                  <Button onClick={() => { setTourExpanded(true); setTimeout(() => scrollToSection('full-tour'), 50); }} variant="contained" startIcon={<PlayCircleFilledRounded />} sx={{bgcolor:'rgba(8,29,42,.82)',borderRadius:99,textTransform:'none',fontWeight:800,'&:hover':{bgcolor:'#0a2f49'}}}>Start 3D Tour</Button>
                </Box>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ ...sectionCard, p:1.6 }}>
              <Typography sx={{fontSize:14,fontWeight:800,color:'#102a43'}}>Property Details</Typography>
              <Stack sx={{mt:.8}}>{compactDetails.filter(([,value])=>hasValue(value)).map(([name,value]) => <Stack key={name} direction="row" justifyContent="space-between" spacing={2} sx={{py:.72,borderBottom:'1px solid #eef2f5','&:last-child':{borderBottom:0}}}><Typography sx={{fontSize:10.5,color:'#748597'}}>{name}</Typography><Typography sx={{fontSize:10.5,fontWeight:700,color:'#29465d',textAlign:'right'}}>{String(value)}</Typography></Stack>)}</Stack>
            </Paper>

            <Paper id="location" elevation={0} sx={{ ...sectionCard, p:1.4 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography sx={{fontSize:14,fontWeight:800,color:'#102a43'}}>Location</Typography><Button size="small" onClick={() => window.open(directions,'_blank')} sx={{textTransform:'none',fontSize:10}}>View on Map →</Button></Stack>
              {mapEmbedUrl ? <Box component="iframe" title={`${property.title} map`} src={mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" sx={{mt:.85,border:0,width:'100%',height:235,display:'block',borderRadius:2}} /> : <Box sx={{mt:.85,height:190,borderRadius:2,bgcolor:'#eef3f5',display:'grid',placeItems:'center'}}><LocationOnRounded sx={{fontSize:46,color:'#10a374'}}/></Box>}
              <Stack direction="row" spacing={.6} alignItems="flex-start" sx={{mt:.85}}><LocationOnRounded sx={{fontSize:16,color:'#5f7285',mt:.1}}/><Typography sx={{fontSize:10.5,color:'#61758a'}}>{locationSummary || 'Exact location is protected by owner privacy settings.'}</Typography></Stack>
              <Button variant="outlined" fullWidth onClick={() => window.open(directions,'_blank')} sx={{mt:1,borderColor:'#d5dee6',color:'#173B55',borderRadius:2,textTransform:'none',fontSize:10.5,fontWeight:700}}>Get Directions</Button>
            </Paper>

            <Paper id="rules" elevation={0} sx={{ ...sectionCard, p:1.4 }}>
              <Typography sx={{fontSize:14,fontWeight:800,color:'#102a43'}}>Property Rules</Typography>
              <Grid container spacing={.7} sx={{mt:.45}}>{occupancyRows.slice(0,6).map(([name,value]) => <Grid key={name} size={{xs:4,sm:3,lg:4}}><Stack alignItems="center" spacing={.45} sx={{p:.65,borderRadius:2,bgcolor:'#f8fafc',height:'100%'}}><RuleRounded sx={{fontSize:18,color:'#566f84'}}/><Typography sx={{fontSize:8.8,color:'#687b8d',textAlign:'center',lineHeight:1.15}}>{name}</Typography><Typography sx={{fontSize:9.2,fontWeight:800,color:'#1c3a52',textAlign:'center'}}>{typeof value==='boolean'?(value?'Yes':'No'):String(value ?? 'Not specified')}</Typography></Stack></Grid>)}</Grid>
            </Paper>
          </Stack>
        </Grid>
      </Grid>

      {tourExpanded && hasInteractiveRoomTour && <Box id="full-tour" sx={{mt:1.5}}><InteractivePropertyTour property={property} units={rentalUnits} onBack={() => setTourExpanded(false)} onView={(unit) => navigate(`/room_details/${unit._id}`)} onBook={(unit) => navigate(`/app/apply_property/${property._id}?rentalUnit=${unit._id}`)} onShare={() => void sharePublicListing({ title: shareTitle, imageUrl: shareImage, url: publicUrl })} saved={saved} onToggleSaved={() => void wishlist.toggle(wishlistListing)} /></Box>}

      <Paper
        elevation={0}
        data-secureasset-property-additional-details="approved-premium-v215"
        sx={{
          mt: 1.5, p: { xs: 1.35, sm: 1.8, md: 2.6 }, overflow: 'hidden',
          border: '1px solid #E4EBF2', borderRadius: { xs: '18px', md: '24px' },
          bgcolor: '#FFFFFF', boxShadow: '0 18px 54px rgba(36,72,110,.07)',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-start' }} spacing={1.2}>
          <Box>
            <Typography sx={{ color: '#10234A', fontSize: { xs: 24, md: 31 }, lineHeight: 1.08, letterSpacing: '-.025em', fontWeight: 800 }}>Additional Property Information</Typography>
            <Typography sx={{ mt: .55, color: '#607594', fontSize: { xs: 12.5, md: 15 }, lineHeight: 1.45 }}>Detailed specifications, pricing, utilities, legal details, and listing attributes.</Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<DescriptionRounded />}
            onClick={() => floorPlanMedia[0]?.url ? window.open(floorPlanMedia[0].url, '_blank', 'noopener,noreferrer') : scrollToSection('rooms')}
            sx={{ minHeight: 44, px: 1.8, borderColor: '#D8E5F1', color: '#174A91', borderRadius: 2.5, textTransform: 'none', fontWeight: 750, alignSelf: { xs: 'stretch', sm: 'auto' } }}
          >
            View Property Brochure
          </Button>
        </Stack>

        <Box sx={{
          mt: { xs: 1.6, md: 2.2 }, p: { xs: 1.2, md: 1.7 }, border: '1px solid #E2EAF2', borderRadius: 3,
          display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'minmax(225px,1.25fr) repeat(4,minmax(145px,1fr))' },
          bgcolor: '#FFFFFF', boxShadow: '0 7px 24px rgba(31,72,114,.035)',
        }}>
          <Stack direction="row" spacing={1.15} alignItems="center" sx={{ px: { xs: .4, md: .7 }, py: { xs: .65, md: .25 }, gridColumn: { xs: '1 / -1', md: 'auto' }, borderRight: { md: '1px solid #E4EBF2' } }}>
            <Box sx={{ width: 48, height: 48, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: '#EAF3FF', color: '#2878E8', flexShrink: 0 }}><AnalyticsRounded sx={{ fontSize: 26 }} /></Box>
            <Box><Typography sx={{ color: '#10234A', fontSize: 14.5, fontWeight: 800 }}>Quick Snapshot</Typography><Typography sx={{ mt: .2, color: '#667B98', fontSize: 11.5 }}>Key highlights at a glance</Typography></Box>
          </Stack>
          {additionalSnapshot.map(({ label, value, Icon, bg, color }, index) => <Stack key={label} direction="row" spacing={1} alignItems="center" sx={{
            minWidth: 0, px: { xs: .4, md: 1.2 }, py: { xs: 1, md: .25 },
            borderRight: { md: index < additionalSnapshot.length - 1 ? '1px solid #E4EBF2' : 'none' },
          }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2.4, display: 'grid', placeItems: 'center', bgcolor: bg, color, flexShrink: 0 }}><Icon sx={{ fontSize: 23 }} /></Box>
            <Box sx={{ minWidth: 0 }}><Typography noWrap title={value} sx={{ color: '#10234A', fontSize: { xs: 12, md: 14 }, fontWeight: 800 }}>{value}</Typography><Typography sx={{ mt: .25, color: '#667B98', fontSize: { xs: 9.5, md: 10.5 } }}>{label}</Typography></Box>
          </Stack>)}
        </Box>

        <Tabs
          value={detailsTab}
          onChange={(_, value) => setDetailsTab(value)}
          variant="scrollable"
          scrollButtons={false}
          aria-label="Additional property information categories"
          sx={{
            mt: { xs: 1.6, md: 2.2 }, minHeight: 62, borderBottom: '1px solid #E2EAF2',
            '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0', bgcolor: '#16A36F' },
            '& .MuiTab-root': { minHeight: 62, minWidth: { xs: 54, sm: 150, md: 190 }, px: { xs: 1, md: 2.2 }, textTransform: 'none', color: '#415D82', fontWeight: 700 },
            '& .Mui-selected': { color: '#07874F !important' },
          }}
        >
          {[
            ['Specifications', DescriptionRounded],
            ['Parking & Pricing', LocalParkingRounded],
            ['Utilities & Legal', SettingsRounded],
            ['Property-Specific', AppsRounded],
          ].map(([labelText, Icon]: any, index) => <Tab
            key={labelText}
            icon={<Icon sx={{ fontSize: 24 }} />}
            iconPosition="start"
            label={<Typography sx={{ display: { xs: detailsTab === index ? 'block' : 'none', sm: 'block' }, fontSize: { xs: 11.5, md: 14 }, fontWeight: detailsTab === index ? 800 : 700, whiteSpace: 'nowrap' }}>{labelText}</Typography>}
            sx={{ minWidth: { xs: detailsTab === index ? 145 : 54, sm: 150, md: 190 }, transition: 'min-width .2s ease' }}
          />)}
        </Tabs>

        <Box sx={{ pt: { xs: 1.6, md: 2.1 } }}>
          <Typography sx={{ color: '#10234A', fontSize: { xs: 18, md: 20 }, fontWeight: 800 }}>{additionalPanel.title}</Typography>
          <Typography sx={{ mt: .3, color: '#667B98', fontSize: { xs: 11.5, md: 12.5 } }}>{additionalPanel.subtitle}</Typography>

          <Grid container spacing={{ xs: .85, sm: 1.05, md: 1.2 }} sx={{ mt: .8 }}>
            {additionalPanel.cards.map((item: any, index: number) => {
              const tone = additionalTones[index % additionalTones.length];
              const Icon = item.Icon || DescriptionRounded;
              return <Grid key={`${item.label}-${index}`} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <Stack direction="row" spacing={1.1} alignItems="center" sx={{
                  minHeight: { xs: 70, md: 78 }, px: { xs: 1.1, md: 1.3 }, py: 1,
                  border: '1px solid #DFE8F1', borderRadius: 2.5, bgcolor: '#FFFFFF',
                  boxShadow: '0 5px 16px rgba(35,74,112,.025)',
                  transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
                  '&:hover': { transform: 'translateY(-1px)', borderColor: '#CDDCE9', boxShadow: '0 9px 22px rgba(35,74,112,.07)' },
                }}>
                  <Box sx={{ width: 46, height: 46, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: tone.bg, color: tone.color, flexShrink: 0 }}><Icon sx={{ fontSize: 23 }} /></Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: '#667B98', fontSize: { xs: 10.5, md: 11 }, lineHeight: 1.15 }}>{item.label}</Typography>
                    <Typography title={String(item.value)} sx={{ mt: .35, color: '#10234A', fontSize: { xs: 13, md: 13.5 }, lineHeight: 1.25, fontWeight: 800, overflowWrap: 'anywhere' }}>{item.value}</Typography>
                  </Box>
                </Stack>
              </Grid>;
            })}
          </Grid>
        </Box>
      </Paper>

      <Box sx={{display:{xs:'block',md:'none'},position:'fixed',left:0,right:0,bottom:0,zIndex:40,p:1,bgcolor:'rgba(255,255,255,.96)',borderTop:'1px solid #e3e9ee',backdropFilter:'blur(14px)'}}>
        <Button fullWidth variant="contained" onClick={() => navigate(`/app/apply_property/${property._id}${selected ? `?space=${selected._id}` : ''}`)} sx={{minHeight:48,bgcolor:'#087f5b',borderRadius:2,textTransform:'none',fontWeight:800}}>Book Room / Apply</Button>
      </Box>
    </Container>
  </Box>;
}
