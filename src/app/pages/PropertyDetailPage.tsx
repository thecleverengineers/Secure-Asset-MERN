import { useMemo } from 'react';
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
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import { publicPropertyQueryOptions } from '../queries/propertyQueries';
import { useSite } from '../context/SiteContext';
import { useWishlist } from '../context/WishlistContext';
import OptimizedImage from '../components/shared/OptimizedImage';
import InteractivePropertyTour from '../components/property/InteractivePropertyTour';
import PremiumPropertyHero from '../components/property/PremiumPropertyHero';
import { WorkspaceSkeleton } from '../components/shared/PremiumSkeleton';
import { sharePublicListing } from '../utils/publicShare';

const fallback = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85';
const vakhitovskyOverviewSlug = 'vakhitovsky-contemporary-residence-sa-r-rus-kzn-16';
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const sentence = (value: string) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const flatten = (nodes: any[]): any[] => nodes.flatMap((node) => [node, ...flatten(node.children || [])]);

export default function PropertyDetailPage() {
  const { id = '', slug = '' } = useParams();
  const navigate = useNavigate();
  const { data: siteData } = useSite();
  const wishlist = useWishlist();
  const propertyQuery = useQuery(publicPropertyQueryOptions(slug || id));
  const listing = propertyQuery.data?.listing || null;
  const structure = propertyQuery.data?.structure || null;
  const loading = propertyQuery.isPending;
  const error = propertyQuery.error instanceof Error ? propertyQuery.error.message : propertyQuery.error ? 'Could not load this property.' : '';

  const property = structure?.property || listing;
  const useVakhitovskyPremiumDetails = String(slug || '').trim().toLowerCase() === vakhitovskyOverviewSlug;
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
  const detailSectionSx = useVakhitovskyPremiumDetails ? {
    p: { xs: 2, md: 3 },
    borderRadius: '1px',
    border: 0,
    bgcolor: '#FFFFFF',
    boxShadow: 'none',
  } : {
    p: { xs: 2, md: 3 },
    borderRadius: 4,
  };
  const detailTileSx = {
    minHeight: 58,
    px: 1.35,
    py: 1.15,
    border: 0,
    borderRadius: '1px',
    bgcolor: '#FFFFFF',
    boxShadow: 'none',
  };
  const DetailSectionHeader = ({ icon: Icon, title, subtitle, tag }: { icon: any; title: string; subtitle: string; tag?: string }) => (
    !useVakhitovskyPremiumDetails ? <Typography variant="h6" fontWeight={900}>{title}</Typography> :
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1.25}>
      <Stack direction="row" alignItems="center" gap={1.2}>
        <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', flexShrink: 0, color: '#087A70', bgcolor: 'rgba(8, 122, 112, .10)', border: 0, borderRadius: '1px', boxShadow: 'none' }}>
          <Icon sx={{ fontSize: 20 }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={950} sx={{ color: '#0D2D45', lineHeight: 1.15 }}>{title}</Typography>
          <Typography color="text.secondary" sx={{ mt: .35, fontSize: 12.5, lineHeight: 1.35 }}>{subtitle}</Typography>
        </Box>
      </Stack>
      {tag && <Chip label={tag} size="small" sx={{ flexShrink: 0, color: '#087A70', bgcolor: 'rgba(8, 122, 112, .10)', border: 0, boxShadow: 'none', fontWeight: 850, '& .MuiChip-label': { px: 1 } }} />}
    </Stack>
  );
  const renderRows = (rows: Array<[string, unknown]>) => rows.filter(([, value]) => hasValue(value)).map(([label, value]) => {
    const valueLabel = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : sentence(String(value));
    return <Grid size={{ xs: 12, sm: 6 }} key={label}>
      {useVakhitovskyPremiumDetails ? <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1.5} sx={detailTileSx}>
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

  const premiumHero = <PremiumPropertyHero
    title={sentence(shareTitle)}
    purpose={sentence(purpose)}
    propertyType={sentence(selected?.level || property.type)}
    address={address || `${property.address?.city || 'Location'} — exact address available according to owner privacy settings`}
    images={displayImages}
    tourMedia={tourMedia}
    floorPlanMedia={floorPlanMedia}
    price={price}
    priceLabel={heroPriceLabel}
    priceSuffix={isRentListing ? '/ month' : undefined}
    deposit={heroDeposit || undefined}
    availableLabel={heroAvailability}
    verified={Boolean(property.isVerified)}
    urgentLabel={property.promotion?.urgentType && property.promotion.urgentType !== 'none' ? sentence(property.promotion.urgentType) : undefined}
    bedrooms={heroBedrooms !== undefined && heroBedrooms !== null ? String(heroBedrooms) : undefined}
    bathrooms={heroBathrooms !== undefined && heroBathrooms !== null ? String(heroBathrooms) : undefined}
    area={heroAreaValue ? `${Number(heroAreaValue).toLocaleString()} ${heroAreaUnit}` : undefined}
    roomCount={heroRooms !== undefined && heroRooms !== null ? String(heroRooms) : undefined}
    furnishing={heroFurnishing ? sentence(heroFurnishing) : undefined}
    amenities={[...(active.amenities || []), ...(property.amenities || [])].filter((value, index, array) => Boolean(value) && array.indexOf(value) === index)}
    saved={saved}
    onShare={() => void sharePublicListing({ title: shareTitle, imageUrl: shareImage, url: publicUrl })}
    shareAction={<Button data-secureasset-public-property-share="public-listing-share-v200" variant="outlined" size="small" onClick={() => void sharePublicListing({ title: shareTitle, imageUrl: shareImage, url: publicUrl })} aria-label={`Share ${shareTitle}`} sx={{ minHeight: 38, borderColor: '#C9D9E2', color: '#163A54', fontWeight: 850, textTransform: 'none' }}>Share</Button>}
    onToggleSaved={() => void wishlist.toggle(wishlistListing)}
    onBook={() => navigate(`/app/apply_property/${property._id}${selected ? `?space=${selected._id}` : ''}`)}
    bookingLabel="Book Now"
    onScheduleVisit={() => navigate(`/app/schedule_visit/${property._id}${selected ? `?space=${selected._id}` : ''}`)}
    onDirections={() => window.open(directions, '_blank')}
  />;

  return (
    <Box data-secureasset-rent-parent-surface={isRentListing ? 'rooms-only-v184' : 'full-property-v184'} data-secureasset-property-experience={hasInteractiveRoomTour ? 'interactive-tour-v203' : 'premium-property-v203'} sx={{ bgcolor: useVakhitovskyPremiumDetails ? '#FFFFFF' : '#F4F8FA', minHeight: '100vh', pb: { xs: 5, md: 8 } }}>
      <Container
        maxWidth={hasInteractiveRoomTour ? false : 'xl'}
        disableGutters={hasInteractiveRoomTour}
        sx={{ pt: hasInteractiveRoomTour ? 0 : { xs: 1.5, md: 3 } }}
      >
        {!hasInteractiveRoomTour && <Button
          data-secureasset-property-overview-back="marketplace-v201"
          startIcon={<ArrowBackRounded />}
          onClick={() => navigate('/marketplace')}
          sx={{ mb: 1.25, px: .5, color: '#173B55', fontWeight: 900, textTransform: 'none' }}
        >
          Back to Marketplace
        </Button>}
        {hasInteractiveRoomTour && <InteractivePropertyTour
          property={property}
          units={rentalUnits}
          onBack={() => navigate('/marketplace')}
          onView={(unit) => navigate(`/room_details/${unit._id}`)}
          onBook={(unit) => navigate(`/app/apply_property/${property._id}?rentalUnit=${unit._id}`)}
          onShare={() => void sharePublicListing({ title: shareTitle, imageUrl: shareImage, url: publicUrl })}
          saved={saved}
          onToggleSaved={() => void wishlist.toggle(wishlistListing)}
        />}
        {!isRentListing && <Grid container spacing={3} mt={1}>
          <Grid size={{ xs: 12 }}>{premiumHero}</Grid>
        </Grid>}
        {isRentListing && !hasInteractiveRoomTour && premiumHero}

        {rentalUnits.length > 0 && !isRentListing && <Paper id="available-rooms" data-secureasset-public-rental-room-cards="marketplace-style-v184" variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, mt: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1} mb={2}><Box><Typography variant="h5" fontWeight={950}>{structure?.rentalStructureMode === 'floor' ? 'Available Rooms by floor' : 'Available Rooms & room directory'}</Typography><Typography color="text.secondary">Room prices and features are shown here. Locked rooms stay visible for details but cannot be booked.</Typography></Box><Chip color="success" label={`${rentalUnits.length} room${rentalUnits.length === 1 ? '' : 's'} listed`} /></Stack>
          {rentalFloorGroups.map((group) => <Box key={group.key} sx={{ mb: 2.5, '&:last-child': { mb: 0 } }}><Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mb: 1.2 }}><Typography variant="h6" fontWeight={900}>{group.floor ? `Floor ${group.floor.floorNumber} · ${group.floor.floorName}` : 'Rooms without a floor'}</Typography><Typography color="text.secondary" fontSize={13}>{group.units.length} room{group.units.length === 1 ? '' : 's'}</Typography></Stack><Grid container data-secureasset-room-grid="four-desktop-two-mobile-v199" spacing={{ xs: 1, sm: 1.5, md: 2 }}>{group.units.map((unit: any) => <Grid key={unit._id} size={{ xs: 6, sm: 6, md: 3 }}>{renderRentalRoomCard(unit)}</Grid>)}</Grid></Box>)}
        </Paper>}

        <Box
          data-secureasset-property-detail-sections="full-width-premium-v205"
          sx={useVakhitovskyPremiumDetails ? { mt: { xs: 2, md: 3 }, width: '100%', px: { xs: 1.25, sm: 2, md: 3, lg: 4 }, py: { xs: 1.25, md: 2.25 }, border: 0, boxShadow: 'none', bgcolor: '#FFFFFF' } : { mt: { xs: 2, md: 3 } }}
        >
        <Grid container spacing={useVakhitovskyPremiumDetails ? { xs: 1.5, md: 2.5 } : 3}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Paper variant="outlined" sx={detailSectionSx}>
              <DetailSectionHeader icon={HomeWorkRounded} title="About this listing" subtitle="A clear overview of the home, its character and included amenities." tag="Listing overview" />
              <Box sx={useVakhitovskyPremiumDetails ? { mt: 2, p: { xs: 1.35, md: 1.75 }, border: 0, boxShadow: 'none', bgcolor: '#FFFFFF' } : { mt: 1 }}>
                <Typography color="text.secondary" lineHeight={1.82} sx={{ fontSize: { xs: 14, md: 14.5 } }}>{active.description || property.description || 'The owner has not added a description yet.'}</Typography>
              </Box>
              {(active.amenities || property.amenities || []).length > 0 && (
                <>
                  {useVakhitovskyPremiumDetails ? <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} mt={2.5}>
                    <Typography fontWeight={950} sx={{ color: '#0D2D45' }}>Included amenities</Typography>
                    <Typography color="text.secondary" fontSize={12}>Selected property highlights</Typography>
                  </Stack> : <Typography variant="h6" fontWeight={900} mt={3}>Amenities</Typography>}
                  <Stack direction="row" gap={useVakhitovskyPremiumDetails ? .85 : 1} flexWrap="wrap" mt={useVakhitovskyPremiumDetails ? 1.25 : 1.5}>
                    {[...(active.amenities || []), ...(property.amenities || [])]
                      .filter((value, index, array) => array.indexOf(value) === index)
                      .map((item: string) => <Chip key={item} icon={<CheckCircleRounded />} label={item} variant={useVakhitovskyPremiumDetails ? undefined : 'outlined'} sx={useVakhitovskyPremiumDetails ? { color: '#12435B', bgcolor: '#F8FBFC', border: 0, boxShadow: 'none', fontWeight: 750, '& .MuiChip-icon': { color: '#0B8B7E' } } : undefined} />)}
                  </Stack>
                </>
              )}
            </Paper>

            {!isRentListing && (tourMedia.length > 0 || floorPlanMedia.length > 0) && <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, mt: 3 }}>
              <Typography variant="h6" fontWeight={900}>Property media</Typography>
              {tourMedia.length > 0 && <Grid container spacing={2} mt={0.5}>
                {tourMedia.map((item: any) => <Grid size={{ xs: 12, md: 6 }} key={item._id}>
                  <Typography fontWeight={800} fontSize={13} mb={1}>{item.category === 'virtual_360_tour' ? '360° Virtual Tour' : 'Video Tour'}</Typography>
                  {item.mediaType === 'image'
                    ? <Box component="img" src={item.url} alt={item.altText || property.title} sx={{ width: '100%', height: 260, objectFit: 'cover', borderRadius: 3 }} />
                    : <Box component="video" controls preload="metadata" src={item.url} sx={{ width: '100%', height: 260, bgcolor: 'black', borderRadius: 3 }} />}
                </Grid>)}
              </Grid>}
              {floorPlanMedia.length > 0 && <>
                <Typography fontWeight={900} mt={tourMedia.length ? 3 : 1}>Floor plans</Typography>
                <Grid container spacing={2} mt={0.5}>
                  {floorPlanMedia.map((item: any) => <Grid size={{ xs: 12, sm: 6 }} key={item._id}>
                    {item.mediaType === 'image'
                      ? <Box component="img" src={item.url} alt={item.altText || 'Floor plan'} sx={{ width: '100%', height: 260, objectFit: 'contain', bgcolor: 'background.default', borderRadius: 3 }} />
                      : <Button variant="outlined" fullWidth onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}>Open {item.caption || 'floor plan'}</Button>}
                  </Grid>)}
                </Grid>
              </>}
            </Paper>}

            <Paper variant="outlined" sx={{ ...detailSectionSx, mt: useVakhitovskyPremiumDetails ? 2.5 : 3 }}>
              <DetailSectionHeader icon={TuneRounded} title="Property specifications" subtitle="Layout, size and ownership information at a glance." />
              <Grid container spacing={useVakhitovskyPremiumDetails ? 1.15 : 1.5} mt={useVakhitovskyPremiumDetails ? 1.5 : .5}>{renderRows(specificationRows)}</Grid>
              <Box sx={useVakhitovskyPremiumDetails ? { mt: 2.5, pt: 2.25, border: 0, boxShadow: 'none' } : { mt: 3 }}>
                <Typography fontWeight={950} sx={{ color: '#0D2D45' }}>Parking & pricing</Typography>
                {useVakhitovskyPremiumDetails && <Typography color="text.secondary" fontSize={12.5} sx={{ mt: .35 }}>Convenience and cost details for this property.</Typography>}
              </Box>
              <Grid container spacing={useVakhitovskyPremiumDetails ? 1.15 : 1.5} mt={useVakhitovskyPremiumDetails ? 1.2 : .5}>{renderRows([
                ['Car parking spaces', parking.carSpaces], ['Two-wheeler parking spaces', parking.twoWheelerSpaces], ['Visitor parking', parking.visitorParking], ...pricingRows,
              ])}</Grid>
            </Paper>

            <Paper variant="outlined" sx={{ ...detailSectionSx, mt: useVakhitovskyPremiumDetails ? 2.5 : 3 }}>
              <DetailSectionHeader icon={SecurityRounded} title="Utilities & legal details" subtitle="Essential services and document-related facts, presented clearly." />
              <Grid container spacing={useVakhitovskyPremiumDetails ? 1.15 : 1.5} mt={useVakhitovskyPremiumDetails ? 1.5 : .5}>{renderRows([...utilityRows, ...legalRows])}</Grid>
            </Paper>

            {(nearbyRows.length > 0 || publicContact.ownerName || publicContact.agentName) && <Paper variant="outlined" sx={{ ...detailSectionSx, mt: useVakhitovskyPremiumDetails ? 2.5 : 3 }}>
              <DetailSectionHeader icon={LocationOnRounded} title="Nearby facilities" subtitle="Useful places and local conveniences around the property." />
              <Grid container spacing={useVakhitovskyPremiumDetails ? 1.15 : 1.5} mt={useVakhitovskyPremiumDetails ? 1.5 : .5}>{renderRows(nearbyRows)}</Grid>
              {(publicContact.ownerName || publicContact.agentName) && <Alert severity="info" sx={useVakhitovskyPremiumDetails ? { mt: 2, border: 0, borderRadius: '1px', bgcolor: '#F1F8FD', boxShadow: 'none' } : { mt: 2 }}>Listed by {publicContact.agentName || publicContact.ownerName}. Use the application or site-visit flow to share contact details securely.</Alert>}
            </Paper>}

            {property.customAttributes && Object.keys(property.customAttributes).length > 0 && (
              <Paper variant="outlined" sx={{ ...detailSectionSx, mt: useVakhitovskyPremiumDetails ? 2.5 : 3 }}>
                <DetailSectionHeader icon={HomeWorkRounded} title="Property-specific details" subtitle="Additional information supplied for this particular listing." />
                <Grid container spacing={useVakhitovskyPremiumDetails ? 1.15 : 1.5} mt={useVakhitovskyPremiumDetails ? 1.5 : .5}>
                  {Object.entries(property.customAttributes).map(([key, value]) => (
                    <Grid size={{ xs: 12, sm: 6 }} key={key}>
                      {useVakhitovskyPremiumDetails ? <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1.5} sx={detailTileSx}>
                        <Stack direction="row" alignItems="center" gap={.8} sx={{ minWidth: 0 }}>
                          <Box sx={{ width: 6, height: 6, flexShrink: 0, bgcolor: '#0B8B7E', borderRadius: '50%' }} />
                          <Typography color="text.secondary" fontSize={13}>{sentence(key)}</Typography>
                        </Stack>
                        <Typography fontWeight={850} fontSize={13} textAlign="right" sx={{ color: '#153B54' }}>{Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '—')}</Typography>
                      </Stack> : <Stack direction="row" justifyContent="space-between" gap={2} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Typography color="text.secondary" fontSize={13}>{sentence(key)}</Typography>
                        <Typography fontWeight={800} fontSize={13} textAlign="right">{Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '—')}</Typography>
                      </Stack>}
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            )}

            {mapEmbedUrl && (
              <Paper variant="outlined" sx={{ ...detailSectionSx, mt: useVakhitovskyPremiumDetails ? 2.5 : 3, overflow: 'hidden', ...(useVakhitovskyPremiumDetails ? {} : { p: 1 }) }}>
                {useVakhitovskyPremiumDetails && <DetailSectionHeader icon={LocationOnRounded} title="Property location" subtitle={exactPublicLocation ? 'Map location shared publicly by the property owner.' : 'Location details are shared according to the owner’s privacy setting.'} />}
                <Box sx={useVakhitovskyPremiumDetails ? { mt: 2, p: 1, border: 0, borderRadius: '1px', bgcolor: '#FFFFFF', boxShadow: 'none' } : undefined}>
                  <Box component="iframe" title={`${property.title} map`} src={mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" sx={{ border: 0, width: '100%', height: useVakhitovskyPremiumDetails ? { xs: 270, md: 360 } : 360, display: 'block', borderRadius: useVakhitovskyPremiumDetails ? '1px' : 3 }} />
                </Box>
              </Paper>
            )}

            {spaces.length > 0 && (
              <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, mt: 3 }}>
                <Typography variant="h6" fontWeight={900}>Available buildings, apartments, rooms and beds</Typography>
                <Typography color="text.secondary" fontSize={13} mb={2}>Select each public space to view its price, occupancy and room-wise gallery.</Typography>
                <Grid container spacing={1.5}>
                  {spaces.filter((space) => space.rentable || space.sellable).map((space) => (
                    <Grid size={{ xs: 12, sm: 6 }} key={space._id}>
                      <Card variant="outlined" onClick={() => navigate(`/marketplace/${space._id}`)} sx={{ cursor: 'pointer', borderRadius: 3, height: '100%' }}>
                        <CardContent>
                          <Stack direction="row" justifyContent="space-between">
                            <Box>
                              <Typography fontWeight={850}>{space.roomNumber ? `Room ${space.roomNumber}` : space.name}</Typography>
                              <Typography color="text.secondary" fontSize={12}>{sentence(space.level)} · {sentence(space.purpose)}{space.apartmentNumber ? ` · Apartment ${space.apartmentNumber}` : ''}</Typography>
                            </Box>
                            <Typography color="primary" fontWeight={900}>{money(Number(space.price || 0))}</Typography>
                          </Stack>
                          <Stack direction="row" gap={0.7} mt={1.5}>
                            <Chip size="small" label={`${space.occupancyRules?.maxTotal || '—'} max occupants`} />
                            <Chip size="small" label={sentence(space.status)} />
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            )}
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            <Paper variant="outlined" sx={{ ...detailSectionSx, ...(useVakhitovskyPremiumDetails ? { position: { lg: 'sticky' }, top: { lg: 88 } } : { p: 3 }) }}>
              <DetailSectionHeader icon={SecurityRounded} title="Occupancy rules" subtitle="Clear living guidelines set by the property owner." />
              <Stack spacing={useVakhitovskyPremiumDetails ? 1 : 1.2} mt={2}>
                {occupancyRows.map(([label, value]) => (
                  <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1.25} key={label} sx={useVakhitovskyPremiumDetails ? detailTileSx : undefined}>
                    <Typography color="text.secondary" fontSize={13}>{label}</Typography>
                    <Typography fontWeight={useVakhitovskyPremiumDetails ? 850 : 800} fontSize={13} textAlign="right" sx={useVakhitovskyPremiumDetails ? { color: '#153B54' } : undefined}>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? 'Not specified')}</Typography>
                  </Stack>
                ))}
              </Stack>
              {useVakhitovskyPremiumDetails ? <Box sx={{ mt: 2, p: 1.45, color: '#FFFFFF', bgcolor: '#12364D', border: 0, boxShadow: 'none' }}>
                <Typography fontWeight={900} fontSize={12.5}>Privacy protected</Typography>
                <Typography sx={{ mt: .4, color: 'rgba(255,255,255,.78)', fontSize: 12, lineHeight: 1.55 }}>Sensitive owner, tenant and exact-location information remains private until the configured application or site-visit stage.</Typography>
              </Box> : <Alert severity="info" sx={{ mt: 2 }}>Sensitive owner, tenant and exact-location information remains private until the configured application or site-visit stage.</Alert>}
            </Paper>
          </Grid>
        </Grid>
        </Box>
      </Container>
    </Box>
  );
}
