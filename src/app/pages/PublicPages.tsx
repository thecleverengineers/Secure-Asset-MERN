import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Avatar, Box, Button, Card, CardContent, Chip, Container, Divider, Grid, IconButton, LinearProgress, Skeleton, Snackbar, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import EngineeringRounded from '@mui/icons-material/EngineeringRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import FolderRounded from '@mui/icons-material/FolderRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import MailOutlineRounded from '@mui/icons-material/MailOutlineRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import PhoneRounded from '@mui/icons-material/PhoneRounded';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import SmartphoneRounded from '@mui/icons-material/SmartphoneRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded';
import { useSite } from '../context/SiteContext';
import { getProperties, getSurveyorPlans, submitSiteEnquiry } from '../services/api';
import { safeRecordArray } from '../utils/runtimeData';
import { propertyOverviewPath } from '../utils/propertyUrl';
import OptimizedImage from '../components/shared/OptimizedImage';
import { UniversalSearchField } from '../components/public/UniversalSearch';

const iconMap: Record<string, any> = {
  verifieduser: VerifiedUserRounded, verified_user: VerifiedUserRounded, apartment: ApartmentRounded, payments: PaymentsRounded,
  folder: FolderRounded, engineering: EngineeringRounded, smartphone: SmartphoneRounded, security: SecurityRounded, description: DescriptionOutlined,
};
const normalize = (value = '') => value.toLowerCase().replace(/[^a-z0-9_]/g, '');

function SectionHeading({ title, subtitle }: { title?: string; subtitle?: string }) {
  return <Box sx={{ textAlign: 'center', mb: 6 }}><Typography sx={{ fontWeight: 950, fontSize: { xs: '2rem', md: '2.8rem' }, letterSpacing: '-.04em' }}>{title}</Typography>{subtitle && <Typography sx={{ color: 'text.secondary', maxWidth: 720, mx: 'auto', mt: 1.5, lineHeight: 1.7 }}>{subtitle}</Typography>}</Box>;
}

function PublicEnquiryForm({ section, callback = false }: { section: any; callback?: boolean }) {
  const { data } = useSite();
  const primary = data.settings?.design?.colors?.primary || data.settings?.brand?.primaryColor || '#0B5270';
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', preferredDate: '', preferredTime: '', callbackWindow: '' });
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true); setNotice(null);
    try {
      const preferredCallbackAt = callback && form.preferredDate
        ? new Date(`${form.preferredDate}T${form.preferredTime || '09:00'}`).toISOString()
        : undefined;
      await submitSiteEnquiry({
        name: form.name, email: form.email, phone: form.phone, message: form.message,
        type: callback ? 'callback' : section.content?.enquiryType || 'contact', preferredCallbackAt, callbackWindow: form.callbackWindow,
      });
      setForm({ name: '', email: '', phone: '', message: '', preferredDate: '', preferredTime: '', callbackWindow: '' });
      setNotice({ severity: 'success', message: section.content?.successMessage || (callback ? 'Your callback request has been submitted.' : 'Your message has been submitted.') });
    } catch (error) {
      setNotice({ severity: 'error', message: (error as Error).message || 'We could not submit your request. Please try again.' });
    } finally { setSending(false); }
  }

  return <Card elevation={0} sx={{ maxWidth: 760, mx: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 4 }}><CardContent sx={{ p: { xs: 3, md: 4 } }}>
    <Typography sx={{ fontWeight: 950, fontSize: '1.35rem' }}>{section.title || (callback ? 'Request a callback' : 'Send a message')}</Typography>
    {section.subtitle && <Typography color="text.secondary" sx={{ mt: .75, lineHeight: 1.7 }}>{section.subtitle}</Typography>}
    {notice && <Alert severity={notice.severity} sx={{ mt: 2 }}>{notice.message}</Alert>}
    <Box component="form" onSubmit={submit} sx={{ mt: 3 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="Full name" value={form.name} onChange={(event) => update('name', event.target.value)} /></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required={callback} label="Phone" inputMode="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} /></Grid>
        <Grid size={12}><TextField fullWidth required={!callback} type="email" label="Email" value={form.email} onChange={(event) => update('email', event.target.value)} helperText={callback ? 'Optional, for callback confirmation.' : 'Provide an email address or phone number.'} /></Grid>
        {callback && <><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="date" label="Preferred date" InputLabelProps={{ shrink: true }} value={form.preferredDate} onChange={(event) => update('preferredDate', event.target.value)} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="time" label="Preferred time" InputLabelProps={{ shrink: true }} value={form.preferredTime} onChange={(event) => update('preferredTime', event.target.value)} /></Grid><Grid size={12}><TextField fullWidth label="Preferred callback window" placeholder="For example, weekdays 10:00–16:00" value={form.callbackWindow} onChange={(event) => update('callbackWindow', event.target.value)} /></Grid></>}
        <Grid size={12}><TextField fullWidth required={!callback} multiline rows={callback ? 3 : 5} label={callback ? 'What would you like to discuss? (optional)' : 'Message'} value={form.message} onChange={(event) => update('message', event.target.value)} /></Grid>
        <Grid size={12}><Button disabled={sending} type="submit" variant="contained" size="large" sx={{ bgcolor: primary, '&:hover': { bgcolor: primary } }}>{sending ? 'Submitting…' : section.content?.buttonLabel || (callback ? 'Request a callback' : 'Send message')}</Button></Grid>
      </Grid>
    </Box>
  </CardContent></Card>;
}

function DynamicSections({ sections }: { sections: any[] }) {
  const { data } = useSite(); const navigate = useNavigate(); const primary = data.settings?.design?.colors?.primary || data.settings?.brand?.primaryColor || '#0B5270';
  return <>{safeRecordArray(sections).filter((section) => section.active !== false).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).map((section) => {
    const items = Array.isArray(section.content?.items) ? section.content.items : [];
    if (section.type === 'rich_text') return <Container key={section.key} maxWidth="md" sx={{ py: 7 }}><Typography variant="h3" sx={{ fontWeight: 950, letterSpacing: '-.04em' }}>{section.title}</Typography>{section.subtitle && <Typography color="text.secondary" sx={{ mt: 1 }}>{section.subtitle}</Typography>}<Stack spacing={2} sx={{ mt: 3 }}>{(section.content?.paragraphs || []).map((paragraph: string, index: number) => <Typography key={index} sx={{ lineHeight: 1.85, color: 'text.secondary', fontSize: '1.02rem' }}>{paragraph}</Typography>)}</Stack></Container>;
    if (section.type === 'contact_form' || section.type === 'callback_form') return <Container key={section.key} maxWidth="md" sx={{ py: { xs: 6, md: 8 } }}><PublicEnquiryForm section={section} callback={section.type === 'callback_form'} /></Container>;
    if (section.type === 'feature_list' || section.type === 'features') return <Container key={section.key} maxWidth="lg" sx={{ py: 8 }}><SectionHeading title={section.type === 'features' ? 'Core features' : section.title} subtitle={section.type === 'features' ? undefined : section.subtitle} /><Grid container spacing={2.5}>{items.map((item: any, index: number) => { const object = typeof item === 'string' ? { title: item } : item; const Icon = iconMap[normalize(object.icon)] || AutoAwesomeRounded; return <Grid size={{ xs: 12, sm: 6, md: 4 }} key={`${object.title}-${index}`}><Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 4 }}><CardContent sx={{ p: 3.5 }}><Box sx={{ width: 48, height: 48, display: 'grid', placeItems: 'center', bgcolor: `${primary}12`, color: primary, borderRadius: 3, mb: 2 }}><Icon /></Box><Typography sx={{ fontWeight: 850 }}>{object.title}</Typography>{(object.description || object.desc) && <Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>{object.description || object.desc}</Typography>}</CardContent></Card></Grid>; })}</Grid></Container>;
    if (section.type === 'stats') return <Box key={section.key} sx={{ bgcolor: primary, color: 'white', py: 4 }}><Container maxWidth="lg"><Grid container spacing={2}>{items.map((item: any, index: number) => <Grid size={{ xs: 6, md: 3 }} key={`${item.label}-${index}`}><Box sx={{ textAlign: 'center' }}><Typography sx={{ fontWeight: 950, fontSize: { xs: '1.3rem', md: '1.8rem' } }}>{item.value}</Typography><Typography sx={{ opacity: .72, fontSize: '.78rem' }}>{item.label}</Typography></Box></Grid>)}</Grid></Container></Box>;
    if (section.type === 'featured_properties') return <Box key={section.key} sx={{ bgcolor: '#f5f7fa', py: { xs: 4, md: 5.5 } }}><Container maxWidth="xl"><Stack direction="row" justifyContent="space-between" alignItems="end" gap={2} sx={{ mb: 2 }}><Box><Typography component="h2" sx={{ color: '#102d3c', fontSize: { xs: 21, md: 24 }, fontWeight: 900, letterSpacing: '-.04em' }}>{section.title || 'Featured properties'}</Typography><Typography color="text.secondary" sx={{ mt: .35, fontSize: { xs: 12, md: 12.5 } }}>{section.subtitle || 'Explore public listings from verified property owners.'}</Typography></Box><Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => navigate('/marketplace')} sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 850 }}>View all</Button></Stack><Grid container spacing={{ xs: 1.1, sm: 1.5, lg: 1.8 }}>{(data.featuredProperties || []).slice(0, Number(section.content?.limit || 6)).map((property: any) => <Grid size={{ xs: 12, sm: 6, md: 3, xl: 2 }} key={property._id}><Card onClick={() => navigate(propertyOverviewPath(property))} elevation={0} sx={{ height: '100%', p: .75, cursor: 'pointer', border: '1px solid rgba(13, 73, 96, .14)', borderRadius: '20px', bgcolor: '#fff', boxShadow: '0 5px 16px rgba(19, 56, 77, .07)', transition: 'transform .2s, box-shadow .2s, border-color .2s', '&:hover': { transform: 'translateY(-4px)', borderColor: `${primary}66`, boxShadow: '0 14px 28px rgba(19, 56, 77, .13)' } }}><Box sx={{ height: { xs: 190, md: 156, lg: 166 }, overflow: 'hidden', borderRadius: '16px', bgcolor: 'action.hover' }}><OptimizedImage src={property.galleryCover || property.images?.[0] || '/placeholder-property.svg'} alt={property.title} width={640} height={360} sizes="(max-width: 600px) 100vw, (max-width: 1200px) 25vw, 16.67vw" style={{ objectFit: 'cover', borderRadius: '16px' }} /></Box><CardContent sx={{ p: .7, pt: 1.05, '&:last-child': { pb: .45 } }}><Stack direction="row" justifyContent="space-between" gap={.7}><Typography sx={{ minWidth: 0, flex: 1, fontSize: { xs: 13, md: 13.5 }, fontWeight: 900, lineHeight: 1.3, minHeight: 35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{property.title}</Typography><Chip size="small" label={property.purpose || property.listingType || 'rent'} sx={{ height: 21, textTransform: 'capitalize', '& .MuiChip-label': { px: .7, fontSize: 9 } }} /></Stack><Stack direction="row" alignItems="center" gap={.4} sx={{ mt: .55 }}><LocationOnOutlined sx={{ fontSize: 14, color: 'text.disabled' }} /><Typography noWrap color="text.secondary" sx={{ fontSize: 10.75 }}>{property.address?.city || property.map?.locality || 'Location available on request'}</Typography></Stack><Typography sx={{ mt: 1.25, color: primary, fontSize: 18, fontWeight: 950 }}>₹{Number(property.price || property.pricing?.monthlyRent || property.pricing?.salePrice || 0).toLocaleString('en-IN')}</Typography></CardContent></Card></Grid>)}{!data.featuredProperties?.length && <Grid size={12}><Alert severity="info">Featured properties will appear here when administrators or eligible landlords publish promotions.</Alert></Grid>}</Grid></Container></Box>;
    if (section.type === 'featured_surveyors') return <Container key={section.key} maxWidth="xl" sx={{ py: 8 }}><SectionHeading title={section.title} subtitle={section.subtitle} /><Grid container spacing={2.5}>{(data.featuredSurveyors || []).slice(0, Number(section.content?.limit || 6)).map((profile: any) => <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={profile._id}><Card onClick={() => navigate(`/surveyors/${profile.publicSlug || profile._id}`)} elevation={0} sx={{ cursor: 'pointer', height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 4 }}><CardContent sx={{ p: 3 }}><Stack direction="row" gap={2}><Avatar src={profile.profilePhoto} sx={{ width: 64, height: 64 }}>{profile.name?.[0]}</Avatar><Box><Stack direction="row" gap={1} alignItems="center"><Typography sx={{ fontWeight: 900 }}>{profile.name}</Typography>{profile.verificationStatus === 'verified' && <VerifiedUserRounded color="primary" fontSize="small" />}</Stack><Typography color="text.secondary">{profile.professionalTitle || profile.profileType}</Typography><Typography sx={{ mt: 1, fontWeight: 750 }}>From ₹{Number(profile.startingPrice || 0).toLocaleString('en-IN')}</Typography></Box></Stack></CardContent></Card></Grid>)}{!data.featuredSurveyors?.length && <Grid size={12}><Alert severity="info">Verified public surveyor profiles will appear here.</Alert></Grid>}</Grid></Container>;
    if (section.type === 'cta') {
      const primaryLabel = section.content?.primaryLabel || 'Get started';
      const primaryUrl = section.content?.primaryUrl || (String(primaryLabel).toLowerCase().includes('create') ? '/login?mode=register' : '/login');
      return <Box key={section.key} sx={{ py: 8, bgcolor: 'action.hover' }}><Container maxWidth="md" sx={{ textAlign: 'center' }}><Typography variant="h3" sx={{ fontWeight: 950 }}>{section.title}</Typography><Typography color="text.secondary" sx={{ mt: 1.5 }}>{section.subtitle}</Typography><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" gap={1.5} sx={{ mt: 3 }}><Button variant="contained" href={primaryUrl}>{primaryLabel}</Button>{section.content?.secondaryLabel && <Button variant="outlined" href={section.content?.secondaryUrl || '/marketplace'}>{section.content.secondaryLabel}</Button>}</Stack></Container></Box>;
    }
    return null;
  })}</>;
}

const DESKTOP_PROPERTY_CARD_WIDTH = 286;

function DesktopHomeCarousel({ slides, primary }: { slides: any[]; primary: string }) {
  const navigate = useNavigate();
  const carouselSlides = slides.length ? slides : [{
    eyebrow: 'SecureAsset',
    title: 'Find your next property',
    subtitle: 'Search verified homes, commercial spaces and public listings in one place.',
    primaryCta: { label: 'Browse listings', url: '/marketplace' },
    secondaryCta: { label: 'Get started', url: '/login?mode=register' },
  }];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (carouselSlides.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % carouselSlides.length), 7000);
    return () => window.clearInterval(timer);
  }, [carouselSlides.length]);
  useEffect(() => setIndex((current) => current >= carouselSlides.length ? 0 : current), [carouselSlides.length]);

  const slide = carouselSlides[index] || carouselSlides[0];
  const imageUrl = slide?.imageUrl || slide?.mobileImageUrl;

  return <Box component="section" className="sa-desktop-home-carousel" sx={{ position: 'relative', width: '100%', m: 0, minHeight: { md: 440, lg: 478 }, overflow: 'hidden', borderRadius: { md: '0 0 28px 28px', lg: '0 0 32px 32px' }, bgcolor: '#102d3c', color: '#fff' }}>
    <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#102d3c' }}>
      {imageUrl && <Box component="img" src={imageUrl} alt={slide?.altText || slide?.title || 'SecureAsset homepage'} width={1920} height={720} loading="eager" fetchPriority="high" decoding="async" sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', borderRadius: 'inherit' }} />}
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(8, 38, 52, .76) 0%, rgba(8, 38, 52, .58) 50%, rgba(8, 38, 52, .76) 100%)' }} />
    </Box>
    <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1, minHeight: { md: 440, lg: 478 }, display: 'flex', alignItems: 'center', justifyContent: 'center', py: { md: 4.5, lg: 5.5 } }}>
      <Stack alignItems="center" sx={{ width: '100%', textAlign: 'center', mx: 'auto' }}>
        <Box sx={{ maxWidth: 700, mx: 'auto' }}>
          <Typography sx={{ color: 'rgba(255,255,255,.82)', fontSize: 11, fontWeight: 850, letterSpacing: '.13em', textTransform: 'uppercase' }}>{slide?.eyebrow || 'SecureAsset'}</Typography>
          <Typography component="h1" sx={{ mt: 1, maxWidth: 660, fontSize: { md: 37, lg: 46 }, lineHeight: 1.05, fontWeight: 950, letterSpacing: '-.055em' }}>{slide?.title || 'Find your next property'}</Typography>
          <Typography sx={{ mt: 1.25, maxWidth: 610, color: 'rgba(255,255,255,.86)', fontSize: { md: 15, lg: 16 }, lineHeight: 1.65 }}>{slide?.subtitle || 'Search verified homes, commercial spaces and public listings in one place.'}</Typography>
        </Box>
        <Stack direction="row" justifyContent="center" gap={1.1} sx={{ mt: 2.25 }}>
          <Button variant="contained" onClick={() => navigate(slide?.primaryCta?.url || '/marketplace')} sx={{ bgcolor: primary, borderRadius: 2.5, textTransform: 'none', fontWeight: 850, '&:hover': { bgcolor: primary, filter: 'brightness(.92)' } }}>{slide?.primaryCta?.label || 'Browse listings'}</Button>
          <Button className="sa-light-button" variant="contained" onClick={() => navigate(slide?.secondaryCta?.url || '/login?mode=register')} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 850 }}>{slide?.secondaryCta?.label || 'Get started'}</Button>
        </Stack>
        <Box sx={{ mt: 2.3, width: { md: 380, lg: 480 } }}><UniversalSearchField placeholder="Search by property, area or city" /></Box>
        <Box sx={{ display: 'flex', gap: .85, flexWrap: 'wrap', justifyContent: 'center', mt: 1.5 }}>
          <Chip clickable component="a" href="/marketplace" icon={<StorefrontRounded />} label="All properties" sx={{ height: 32, color: '#fff', bgcolor: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.2)', fontWeight: 800 }} />
          <Chip clickable component="a" href="/marketplace?listingType=rent" icon={<HomeWorkRounded />} label="For rent" sx={{ height: 32, color: '#fff', bgcolor: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.2)', fontWeight: 800 }} />
          <Chip clickable component="a" href="/marketplace?listingType=sale" icon={<ApartmentRounded />} label="For sale" sx={{ height: 32, color: '#fff', bgcolor: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.2)', fontWeight: 800 }} />
          <Chip clickable component="a" href="/surveyors" icon={<EngineeringRounded />} label="Survey services" sx={{ height: 32, color: '#fff', bgcolor: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.2)', fontWeight: 800 }} />
        </Box>
        {carouselSlides.length > 1 && <Stack direction="row" alignItems="center" gap={.75} sx={{ mt: 2 }}>
          <IconButton aria-label="Previous carousel slide" onClick={() => setIndex((current) => (current + carouselSlides.length - 1) % carouselSlides.length)} size="small" sx={{ color: '#fff', border: '1px solid rgba(255,255,255,.34)' }}><ArrowBackRounded fontSize="small" /></IconButton>
          {carouselSlides.map((_item, dot) => <Box key={dot} onClick={() => setIndex(dot)} sx={{ width: dot === index ? 22 : 7, height: 7, borderRadius: 9, cursor: 'pointer', bgcolor: dot === index ? '#fff' : 'rgba(255,255,255,.48)', transition: 'width .2s ease' }} />)}
          <IconButton aria-label="Next carousel slide" onClick={() => setIndex((current) => (current + 1) % carouselSlides.length)} size="small" sx={{ color: '#fff', border: '1px solid rgba(255,255,255,.34)' }}><ArrowForwardRounded fontSize="small" /></IconButton>
        </Stack>}
      </Stack>
    </Container>
  </Box>;
}

function DesktopPropertyRailCard({ property, primary, onOpen }: { property: any; primary: string; onOpen: () => void }) {
  const price = Number(property.price || property.pricing?.monthlyRent || property.pricing?.salePrice || property.pricing?.leaseAmount || 0);
  const listingType = String(property.purpose || property.listingType || 'rent').replaceAll('_', ' ');
  const location = [property.address?.city, property.map?.locality, property.address?.state].filter(Boolean).join(', ') || 'Location available on request';

  return <Card onClick={onOpen} elevation={0} sx={{ flex: `0 0 ${DESKTOP_PROPERTY_CARD_WIDTH}px`, width: DESKTOP_PROPERTY_CARD_WIDTH, minWidth: DESKTOP_PROPERTY_CARD_WIDTH, scrollSnapAlign: 'start', p: .75, cursor: 'pointer', border: '1px solid rgba(13, 73, 96, .14)', borderRadius: '20px', bgcolor: '#fff', boxShadow: '0 5px 16px rgba(19, 56, 77, .07)', transition: 'transform .2s, box-shadow .2s, border-color .2s', '&:hover': { transform: 'translateY(-4px)', borderColor: `${primary}66`, boxShadow: '0 14px 28px rgba(19, 56, 77, .13)' } }}>
    <Box sx={{ position: 'relative', height: 178, overflow: 'hidden', borderRadius: '16px', bgcolor: 'action.hover' }}>
      <OptimizedImage src={property.galleryCover || property.images?.[0] || '/placeholder-property.svg'} alt={property.title} width={640} height={360} sizes="286px" style={{ objectFit: 'cover', borderRadius: '16px' }} />
      {property.isVerified && <Chip icon={<VerifiedUserRounded sx={{ fontSize: '14px !important' }} />} size="small" label="Verified" sx={{ position: 'absolute', top: 9, left: 9, height: 24, bgcolor: 'rgba(255,255,255,.94)', color: primary, fontWeight: 850, '& .MuiChip-label': { px: .55, fontSize: 10 } }} />}
    </Box>
    <CardContent sx={{ p: .7, pt: 1.05, '&:last-child': { pb: .45 } }}>
      <Stack direction="row" justifyContent="space-between" gap={.7} alignItems="start"><Typography className="open-sans-property-title" sx={{ minWidth: 0, flex: 1, fontFamily: '"Open Sans", Arial, sans-serif', fontOpticalSizing: 'auto', fontSize: 14, fontStyle: 'normal', fontVariationSettings: '"wdth" 100', lineHeight: 1.3, minHeight: 36, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{property.title}</Typography><Chip size="small" label={listingType} sx={{ height: 21, textTransform: 'capitalize', flexShrink: 0, '& .MuiChip-label': { px: .7, fontSize: 9 } }} /></Stack>
      <Stack direction="row" alignItems="center" gap={.4} sx={{ mt: .55 }}><LocationOnOutlined sx={{ fontSize: 14, color: 'text.disabled' }} /><Typography noWrap color="text.secondary" sx={{ fontSize: 10.75 }}>{location}</Typography></Stack>
      <Typography sx={{ mt: 1.25, color: primary, fontSize: 18, fontWeight: 950 }}>₹{price.toLocaleString('en-IN')}</Typography>
    </CardContent>
  </Card>;
}

function DesktopPropertyRail({ title, subtitle, properties, loading }: { title: string; subtitle: string; properties: any[]; loading: boolean }) {
  const navigate = useNavigate();
  const { data } = useSite();
  const railRef = useRef<HTMLDivElement>(null);
  const primary = data.settings?.design?.colors?.primary || data.settings?.brand?.primaryColor || '#0B5270';
  const slide = (direction: number) => railRef.current?.scrollBy({ left: direction * (DESKTOP_PROPERTY_CARD_WIDTH + 18) * 2, behavior: 'smooth' });

  return <Box component="section" sx={{ mb: 4.5 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="end" gap={2} sx={{ mb: 1.65 }}>
      <Box><Typography component="h2" sx={{ color: '#102d3c', fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>{title}</Typography><Typography color="text.secondary" sx={{ mt: .35, fontSize: 12.5 }}>{subtitle}</Typography></Box>
      <Stack direction="row" alignItems="center" gap={.55} sx={{ flexShrink: 0 }}>
        <IconButton aria-label={`Previous ${title}`} onClick={() => slide(-1)} size="small" sx={{ border: '1px solid rgba(13, 73, 96, .18)', bgcolor: '#fff' }}><ArrowBackRounded fontSize="small" /></IconButton>
        <IconButton aria-label={`Next ${title}`} onClick={() => slide(1)} size="small" sx={{ border: '1px solid rgba(13, 73, 96, .18)', bgcolor: '#fff' }}><ArrowForwardRounded fontSize="small" /></IconButton>
        <Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => navigate('/marketplace')} sx={{ ml: .25, textTransform: 'none', fontWeight: 850 }}>View all</Button>
      </Stack>
    </Stack>
    <Box ref={railRef} sx={{ display: 'flex', gap: 1.8, overflowX: 'auto', overflowY: 'visible', scrollSnapType: 'x mandatory', scrollBehavior: 'smooth', pb: 1.25, pr: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
      {loading && Array.from({ length: 4 }).map((_, index) => <Box key={index} sx={{ flex: `0 0 ${DESKTOP_PROPERTY_CARD_WIDTH}px`, width: DESKTOP_PROPERTY_CARD_WIDTH, minWidth: DESKTOP_PROPERTY_CARD_WIDTH, p: .75, border: '1px solid rgba(13, 73, 96, .1)', borderRadius: '20px', bgcolor: '#fff' }}><Skeleton variant="rounded" height={178} sx={{ borderRadius: '16px' }} /><Skeleton sx={{ mt: 1.25 }} /><Skeleton width="62%" /><Skeleton width="38%" sx={{ mt: 1 }} /></Box>)}
      {!loading && properties.map((property: any) => <DesktopPropertyRailCard key={property._id} property={property} primary={primary} onOpen={() => navigate(propertyOverviewPath(property))} />)}
      {!loading && !properties.length && <Alert severity="info" sx={{ minWidth: 420 }}>Properties will appear here when public listings are available.</Alert>}
    </Box>
  </Box>;
}

export function Home() {
  const { data, loading } = useSite();
  const featuredPropertiesQuery = useQuery({ queryKey: ['home-desktop-featured-properties'], queryFn: () => getProperties({ limit: 18 }), staleTime: 30_000 });
  const discoveredProperties = featuredPropertiesQuery.data?.data || [];
  const featuredProperties = data.featuredProperties?.length ? data.featuredProperties : discoveredProperties.slice(0, 12);
  const { coreFeatureSections, surveyorSections, trailingHomeSections } = useMemo(() => {
    const sections = safeRecordArray(data.sections || []);
    const sectionType = (section: any) => String(section.type || '');
    return {
      coreFeatureSections: sections.filter((section) => ['features', 'feature_list'].includes(sectionType(section))),
      surveyorSections: sections.filter((section) => sectionType(section) === 'featured_surveyors'),
      trailingHomeSections: sections.filter((section) => !['features', 'feature_list', 'featured_properties', 'featured_surveyors'].includes(sectionType(section))),
    };
  }, [data.sections]);
  return <Box sx={{ bgcolor: '#f5f7fa', minHeight: '100vh' }}>
    <MobileDiscoverHome />
    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
      {loading && <LinearProgress />}
      <DesktopHomeCarousel slides={data.carousel || []} primary={data.settings?.design?.colors?.primary || data.settings?.brand?.primaryColor || '#0B5270'} />
      <DynamicSections sections={coreFeatureSections} />
      <Container maxWidth="xl" sx={{ py: 3.25 }}>
        <DesktopPropertyRail title="Featured properties" subtitle="Hand-picked public listings from trusted owners." properties={featuredProperties} loading={featuredPropertiesQuery.isPending && !featuredProperties.length} />
      </Container>
      <DynamicSections sections={surveyorSections} />
      <DynamicSections sections={trailingHomeSections} />
    </Box>
  </Box>;
}

const mobileCoreFeatures = [
  { title: 'Document Vault', description: 'Keep property, tenancy and identity records protected in one secure vault.', icon: 'folder', path: '/app/documents' },
  { title: 'Verified tenant journeys', description: 'Apply, visit, sign and manage approved tenancy journeys with confidence.', icon: 'verifieduser', path: '/app/my-property' },
  { title: 'Flexible property hierarchy', description: 'Manage buildings, apartments, rooms, beds and property spaces clearly.', icon: 'apartment', path: '/app/properties' },
  { title: 'Rent and utility automation', description: 'Track rent, bills, due dates, receipts and payment activity together.', icon: 'payments', path: '/app/rentals' },
  { title: 'Surveyor marketplace', description: 'Find verified survey professionals and request the right field service.', icon: 'engineering', path: '/surveyors' },
  { title: 'Mobile field operations', description: 'Coordinate site visits, exact locations, evidence and survey reports.', icon: 'smartphone', path: '/app/survey-projects' },
];

function MobileHomeCarousel({ slides, primary }: { slides: any[]; primary: string }) {
  const navigate = useNavigate();
  const carouselSlides = slides.length ? slides : [{
    eyebrow: 'SecureAsset',
    title: 'Find your next property',
    subtitle: 'Search verified homes, commercial spaces and public listings in one place.',
    primaryCta: { label: 'Browse listings', url: '/marketplace' },
    secondaryCta: { label: 'Get started', url: '/login?mode=register' },
  }];
  const [index, setIndex] = useState(0);
  useEffect(() => { if (carouselSlides.length < 2) return; const timer = window.setInterval(() => setIndex((value) => (value + 1) % carouselSlides.length), 6000); return () => window.clearInterval(timer); }, [carouselSlides.length]);
  useEffect(() => setIndex((current) => current >= carouselSlides.length ? 0 : current), [carouselSlides.length]);
  const slide = carouselSlides[index] || carouselSlides[0];
  const imageUrl = slide?.imageUrl || slide?.mobileImageUrl;
  return <Box component="section" className="sa-mobile-home-carousel" sx={{ position: 'relative', width: '100%', m: 0, minHeight: { xs: 470, sm: 500 }, overflow: 'hidden', borderRadius: '0 0 24px 24px', bgcolor: '#102d3c', color: '#fff' }}>
    <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#102d3c' }}>
      {imageUrl && <Box component="picture" sx={{ display: 'block', width: '100%', height: '100%' }}>{slide?.mobileImageUrl && <source media="(max-width: 899px)" srcSet={slide.mobileImageUrl} />}<Box component="img" src={slide?.imageUrl || slide?.mobileImageUrl} alt={slide?.altText || slide?.title || 'SecureAsset homepage'} width={900} height={760} loading="eager" fetchPriority="high" decoding="async" sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', borderRadius: 'inherit' }} /></Box>}
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8, 38, 52, .68) 0%, rgba(8, 38, 52, .78) 100%)' }} />
    </Box>
    <Stack alignItems="center" sx={{ position: 'relative', zIndex: 1, minHeight: { xs: 470, sm: 500 }, px: { xs: 2, sm: 4 }, py: { xs: 4, sm: 5 }, textAlign: 'center' }}>
      <Box sx={{ maxWidth: 520 }}><Typography sx={{ color: 'rgba(255,255,255,.82)', fontSize: 10.5, fontWeight: 850, letterSpacing: '.1em', textTransform: 'uppercase' }}>{slide?.eyebrow || 'SecureAsset'}</Typography><Typography component="h1" sx={{ mt: .65, fontSize: { xs: 29, sm: 36 }, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-.05em' }}>{slide?.title || 'Find your next property'}</Typography><Typography sx={{ mt: .85, color: 'rgba(255,255,255,.88)', fontSize: { xs: 12.5, sm: 14 }, lineHeight: 1.55 }}>{slide?.subtitle || 'Search verified homes, commercial spaces and public listings in one place.'}</Typography></Box>
      <Stack direction="row" justifyContent="center" gap={1} sx={{ mt: 1.8, flexWrap: 'wrap' }}><Button size="small" variant="contained" onClick={() => navigate(slide?.primaryCta?.url || '/marketplace')} sx={{ bgcolor: primary, borderRadius: 2, textTransform: 'none', fontWeight: 850, '&:hover': { bgcolor: primary, filter: 'brightness(.92)' } }}>{slide?.primaryCta?.label || 'Browse listings'}</Button><Button className="sa-light-button" size="small" variant="contained" onClick={() => navigate(slide?.secondaryCta?.url || '/login?mode=register')} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 850 }}>{slide?.secondaryCta?.label || 'Get started'}</Button></Stack>
      <Box sx={{ mt: 2, width: '100%', maxWidth: 440 }}><UniversalSearchField placeholder="Start your search: property, area or city" /></Box>
      <Box sx={{ display: 'flex', gap: .7, flexWrap: 'wrap', justifyContent: 'center', mt: 1.25 }}><Chip clickable component="a" href="/marketplace" icon={<StorefrontRounded />} label="All properties" sx={{ height: 30, color: '#fff', bgcolor: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.2)', fontWeight: 800, '& .MuiChip-label': { fontSize: 10.5 } }} /><Chip clickable component="a" href="/marketplace?listingType=rent" icon={<HomeWorkRounded />} label="For rent" sx={{ height: 30, color: '#fff', bgcolor: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.2)', fontWeight: 800, '& .MuiChip-label': { fontSize: 10.5 } }} /><Chip clickable component="a" href="/marketplace?listingType=sale" icon={<ApartmentRounded />} label="For sale" sx={{ height: 30, color: '#fff', bgcolor: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.2)', fontWeight: 800, '& .MuiChip-label': { fontSize: 10.5 } }} /><Chip clickable component="a" href="/surveyors" icon={<EngineeringRounded />} label="Survey services" sx={{ height: 30, color: '#fff', bgcolor: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.2)', fontWeight: 800, '& .MuiChip-label': { fontSize: 10.5 } }} /></Box>
      {carouselSlides.length > 1 && <Stack direction="row" alignItems="center" gap={.7} sx={{ mt: 1.55 }}><IconButton aria-label="Previous carousel slide" onClick={() => setIndex((current) => (current + carouselSlides.length - 1) % carouselSlides.length)} size="small" sx={{ color: '#fff', border: '1px solid rgba(255,255,255,.34)' }}><ArrowBackRounded fontSize="small" /></IconButton>{carouselSlides.map((_item, dot) => <Box key={dot} onClick={() => setIndex(dot)} sx={{ width: dot === index ? 20 : 7, height: 7, borderRadius: 9, cursor: 'pointer', bgcolor: dot === index ? '#fff' : 'rgba(255,255,255,.48)', transition: 'width .2s ease' }} />)}<IconButton aria-label="Next carousel slide" onClick={() => setIndex((current) => (current + 1) % carouselSlides.length)} size="small" sx={{ color: '#fff', border: '1px solid rgba(255,255,255,.34)' }}><ArrowForwardRounded fontSize="small" /></IconButton></Stack>}
    </Stack>
  </Box>;
}

function MobileCoreFeatures({ sections }: { sections: any[] }) {
  const navigate = useNavigate();
  const adminSection = sections.find((section) => ['feature_list', 'features'].includes(section.type) && section.active !== false);
  const items = Array.isArray(adminSection?.content?.items) && adminSection.content.items.length ? adminSection.content.items : mobileCoreFeatures;
  return <Box className="sa-mobile-core-features" sx={{ px: 1.3, pt: 3.3 }}><Box sx={{ mb: 1.3, textAlign: 'center' }}><Typography sx={{ fontSize: 22, fontWeight: 950, letterSpacing: '-.045em' }}>Core features</Typography></Box><Grid container spacing={1.1}>{items.slice(0, 6).map((item: any, index: number) => { const object = typeof item === 'string' ? { title: item } : item; const feature = mobileCoreFeatures.find((candidate) => candidate.title.toLowerCase() === String(object.title || '').toLowerCase()); const Icon = iconMap[normalize(object.icon || feature?.icon)] || AutoAwesomeRounded; const path = object.path || object.url || feature?.path || '/marketplace'; return <Grid size={{ xs: 6 }} key={`${object.title}-${index}`}><Card onClick={() => navigate(path)} sx={{ height: '100%', cursor: 'pointer', border: '1px solid', borderColor: 'rgba(11,82,112,.13)', borderRadius: 2.5, boxShadow: '0 5px 16px rgba(15,23,42,.06)', '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' }, transition: 'transform .18s ease, border-color .18s ease' }}><CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}><Box sx={{ width: 34, height: 34, display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: 'rgba(11,82,112,.09)', borderRadius: 2, mb: 1 }}><Icon fontSize="small" /></Box><Typography sx={{ fontSize: 12.2, lineHeight: 1.2, fontWeight: 900 }}>{object.title}</Typography><Typography sx={{ mt: .6, color: 'text.secondary', fontSize: 10.5, lineHeight: 1.4 }}>{object.description || object.desc || feature?.description}</Typography></CardContent></Card></Grid>; })}</Grid></Box>;
}

function MobileFeaturedProperties({ listings }: { listings: any[] }) {
  const navigate = useNavigate();
  return <Box sx={{ mt: 3.4, px: 1.3 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.1 }}><Box><Typography sx={{ color: '#102d3c', fontSize: 19, fontWeight: 950, letterSpacing: '-.04em' }}>Featured properties</Typography><Typography sx={{ mt: .2, color: 'text.secondary', fontSize: 10.5 }}>Current public listings from verified owners.</Typography></Box><IconButton size="small" onClick={() => navigate('/marketplace')} sx={{ bgcolor: 'rgba(11, 82, 112, .07)' }}><ArrowForwardRounded fontSize="small" /></IconButton></Stack><Grid container spacing={1.1}>{listings.slice(0, 6).map((property) => <Grid size={{ xs: 6 }} key={property._id}><Card onClick={() => navigate(propertyOverviewPath(property))} sx={{ height: '100%', p: .5, cursor: 'pointer', border: '1px solid rgba(13, 73, 96, .14)', borderRadius: '16px', bgcolor: '#fff', boxShadow: '0 4px 12px rgba(19, 56, 77, .06)' }}><Box sx={{ height: 112, overflow: 'hidden', borderRadius: '12px', bgcolor: 'action.hover' }}><OptimizedImage src={property.images?.[0] || property.galleryCover || '/placeholder-property.svg'} alt={property.title || 'Property'} width={420} height={260} sizes="50vw" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} /></Box><CardContent sx={{ p: .65, pt: .85, '&:last-child': { pb: .45 } }}><Typography className="open-sans-property-title" noWrap sx={{ fontFamily: '"Open Sans", Arial, sans-serif', fontOpticalSizing: 'auto', fontSize: 11.5, fontStyle: 'normal', fontVariationSettings: '"wdth" 100' }}>{property.title || property.name || 'Property'}</Typography><Typography noWrap sx={{ mt: .25, color: 'text.secondary', fontSize: 9.8 }}>{property.address?.city || property.map?.locality || 'Location available'}</Typography><Typography sx={{ mt: .55, color: 'primary.main', fontSize: 11.5, fontWeight: 900 }}>₹{Number(property.price || property.pricing?.monthlyRent || property.pricing?.salePrice || 0).toLocaleString('en-IN')}</Typography></CardContent></Card></Grid>)}</Grid>{!listings.length && <Typography color="text.secondary" sx={{ fontSize: 12 }}>Featured properties will appear here soon.</Typography>}</Box>;
}

function MobileVerifiedSurveyors({ profiles }: { profiles: any[] }) {
  const navigate = useNavigate();
  return <Box sx={{ mt: 3.4, px: 1.3 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.1 }}><Typography sx={{ fontSize: 19, fontWeight: 950, letterSpacing: '-.04em' }}>Verified survey professionals</Typography><IconButton size="small" onClick={() => navigate('/surveyors')} sx={{ bgcolor: 'action.hover' }}><ArrowForwardRounded fontSize="small" /></IconButton></Stack><Box sx={{ display: 'flex', gap: 1.1, overflowX: 'auto', pb: .6 }}>{profiles.slice(0, 6).map((profile) => <Card key={profile._id} onClick={() => navigate(`/surveyors/${profile.publicSlug || profile._id}`)} sx={{ flex: '0 0 220px', cursor: 'pointer', border: '1px solid', borderColor: 'divider', borderRadius: 2.5, boxShadow: 'none' }}><CardContent sx={{ p: 1.3, '&:last-child': { pb: 1.3 } }}><Stack direction="row" spacing={1.1} alignItems="center"><Avatar src={profile.profilePhoto} sx={{ width: 40, height: 40 }}>{profile.name?.[0]}</Avatar><Box sx={{ minWidth: 0 }}><Stack direction="row" spacing={.4} alignItems="center"><Typography noWrap sx={{ fontSize: 12, fontWeight: 900 }}>{profile.name}</Typography>{profile.verificationStatus === 'verified' && <VerifiedUserRounded color="primary" sx={{ fontSize: 14 }} />}</Stack><Typography noWrap sx={{ color: 'text.secondary', fontSize: 10.5 }}>{profile.professionalTitle || profile.profileType || 'Survey professional'}</Typography></Box></Stack></CardContent></Card>)}</Box>{!profiles.length && <Typography color="text.secondary" sx={{ fontSize: 12 }}>Verified professionals will appear here soon.</Typography>}</Box>;
}

function MobileAccountCta() {
  const navigate = useNavigate();
  return <Box sx={{ mx: 1.3, mt: 3.4, mb: 2, p: 2.2, borderRadius: 3, bgcolor: '#0B5270', color: '#fff' }}><Typography sx={{ fontSize: 11, letterSpacing: '.12em', fontWeight: 850, textTransform: 'uppercase', opacity: .75 }}>One secure workspace</Typography><Typography sx={{ mt: .5, fontSize: 22, lineHeight: 1.1, fontWeight: 950, letterSpacing: '-.04em' }}>Manage everything from one account</Typography><Button className="sa-light-button" onClick={() => navigate('/login?mode=register')} variant="contained" sx={{ mt: 1.5, bgcolor: '#fff', color: '#0B5270', '&:hover': { bgcolor: '#f4f8fa' } }}>Create account</Button></Box>;
}

function MobileDiscoverHome() {
  const navigate = useNavigate();
  const { data } = useSite();
  const listingsQuery = useQuery({ queryKey: ['mobile-discover-properties'], queryFn: () => getProperties({ listingType: 'rent', limit: 12 }), staleTime: 30_000 });
  const listings = listingsQuery.data?.data || [];
  return <Box className="sa-mobile-discover-home" sx={{ display: { xs: 'block', md: 'none' }, minHeight: '100%', pb: 8, bgcolor: '#f5f7fa' }}>
    <MobileHomeCarousel slides={data.carousel || []} primary={data.settings?.design?.colors?.primary || '#0B5270'} />
    <Box className="sa-mobile-category-rail" sx={{ display: 'flex', gap: 1, overflowX: 'auto', px: 1.3, py: 1.3 }}>
      {[['All', '/marketplace', <StorefrontRounded key="all" />], ['Homes', '/marketplace?listingType=rent', <HomeWorkRounded key="homes" />], ['For sale', '/marketplace?listingType=sale', <ApartmentRounded key="sale" />], ['Services', '/surveyors', <EngineeringRounded key="services" />]].map(([label, path, icon]) => <Chip key={String(label)} clickable onClick={() => navigate(String(path))} icon={icon as any} label={label as string} variant="outlined" sx={{ flex: '0 0 auto', height: 38, px: .5, borderColor: 'rgba(21,34,37,.16)', bgcolor: 'background.paper', boxShadow: '0 4px 10px rgba(15,23,42,.08)', '& .MuiChip-label': { fontSize: 13, fontWeight: 700 } }} />)}
    </Box>
    <MobileCoreFeatures sections={data.sections || []} />
    <MobileFeaturedProperties listings={listings} />
    <MobileVerifiedSurveyors profiles={data.featuredSurveyors || []} />
    <MobileAccountCta />
    {listingsQuery.error && <Alert severity="warning" sx={{ mx: 2, mt: 2 }}>Property discovery is temporarily unavailable.</Alert>}
  </Box>;
}

function prettyPlanLabel(value: string) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

function planValue(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Included' : 'Not included';
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 999999) return 'Unlimited';
  return String(value ?? '—');
}

function planHighlights(plan: Record<string, any>) {
  const limits = Object.entries(plan.limits || {})
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .map(([label, value]) => ({ label: prettyPlanLabel(label), value: planValue(value) }));
  const features = Object.entries(plan.features || {})
    .filter(([, value]) => typeof value === 'boolean' && value)
    .map(([label]) => ({ label: prettyPlanLabel(label), value: 'Included' }));
  return [...limits, ...features].slice(0, 8);
}

function PricingPlanCard({ plan, primary }: { plan: Record<string, any>; primary: string }) {
  const featured = Boolean(plan.featured);
  const highlights = planHighlights(plan);
  const isCustom = plan.key === 'enterprise' || (!Number(plan.prices?.monthly) && !Number(plan.prices?.yearly));
  return <Card
    elevation={0}
    sx={{
      height: '100%',
      minHeight: { xs: 0, md: 560 },
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      borderRadius: '20px',
      border: '1px solid',
      borderColor: featured ? primary : 'divider',
      bgcolor: 'background.paper',
      transition: 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
      '&:hover': { transform: 'translateY(-4px)', borderColor: primary, boxShadow: '0 18px 42px rgba(15, 23, 42, .12)' },
    }}
  >
    <CardContent sx={{ p: { xs: 2.6, md: 3.2 }, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', flex: 1, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
      {featured && <Chip label="Recommended" size="small" sx={{ mb: 2, bgcolor: primary, color: 'common.white', fontWeight: 800, '& .MuiChip-label': { px: 1.6 } }} />}
      {!featured && <Box sx={{ height: 28, mb: 1 }} aria-hidden="true" />}
      <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.18rem', md: '1.28rem' }, lineHeight: 1.25, minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', overflowWrap: 'anywhere' }}>{plan.name}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, minHeight: 66, maxWidth: 285, lineHeight: 1.55, fontSize: '.92rem', overflowWrap: 'anywhere' }}>{plan.description || 'A focused plan for secure property operations.'}</Typography>
      <Box sx={{ mt: 2, minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '100%' }}>
        <Typography component="div" sx={{ color: primary, fontWeight: 950, fontSize: { xs: '2rem', md: '2.2rem' }, lineHeight: 1.1, overflowWrap: 'anywhere' }}>
          {isCustom ? 'Custom' : `₹${Number(plan.prices?.monthly || 0).toLocaleString('en-IN')}`}
          {!isCustom && <Typography component="span" color="text.secondary" sx={{ ml: .5, fontSize: '.82rem', fontWeight: 650 }}>/month</Typography>}
        </Typography>
      </Box>
      <Divider sx={{ width: '100%', my: 2.4 }} />
      <Accordion disableGutters elevation={0} sx={{ width: '100%', maxWidth: 280, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: '12px !important', overflow: 'hidden', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreRounded />} aria-controls={`plan-includes-${plan.key}`} id={`plan-includes-heading-${plan.key}`} sx={{ minHeight: 48, px: 1.5, '& .MuiAccordionSummary-content': { my: 1 }, '& .MuiAccordionSummary-content.Mui-expanded': { my: 1 } }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 850, letterSpacing: '.12em' }}>Plan includes</Typography>
        </AccordionSummary>
        <AccordionDetails id={`plan-includes-${plan.key}`} sx={{ pt: 0, px: 1.5, pb: 1.5 }}>
          <Stack spacing={1.05} sx={{ width: '100%', alignItems: 'stretch' }}>
            {highlights.map((item) => <Box key={`${item.label}-${item.value}`} sx={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr)', columnGap: 1, alignItems: 'start', textAlign: 'left', minWidth: 0 }}>
              <CheckRounded sx={{ color: primary, fontSize: 18, mt: .1 }} />
              <Typography sx={{ minWidth: 0, fontSize: '.83rem', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{item.label}: <Box component="span" sx={{ fontWeight: 800 }}>{item.value}</Box></Typography>
            </Box>)}
            {!highlights.length && <Typography color="text.secondary" sx={{ fontSize: '.84rem' }}>Configured for your operating needs.</Typography>}
          </Stack>
        </AccordionDetails>
      </Accordion>
      <Button href="/login?mode=register" fullWidth variant={featured ? 'contained' : 'outlined'} sx={{ mt: 'auto', pt: 1.2, pb: 1.2, minHeight: 46, fontWeight: 850, borderRadius: 2, borderColor: featured ? primary : 'divider', color: featured ? 'common.white' : primary, bgcolor: featured ? primary : 'transparent', '&:hover': { bgcolor: featured ? primary : `${primary}10`, borderColor: primary } }}>
        {isCustom ? 'Contact sales' : 'Choose plan'}
      </Button>
    </CardContent>
  </Card>;
}

export function Pricing() {
  const { data } = useSite();
  const [tab, setTab] = useState<'landlord' | 'surveyor'>('landlord');
  const primary = data.settings?.design?.colors?.primary || data.settings?.brand?.primaryColor || '#0B5270';
  const surveyorPlansQuery = useQuery({
    queryKey: ['public-surveyor-subscription-plans'],
    queryFn: async () => (await getSurveyorPlans()).data || [],
    enabled: tab === 'surveyor',
    staleTime: 60_000,
    retry: 1,
  });
  const plans = tab === 'landlord' ? (data.landlordPlans || []) : (surveyorPlansQuery.data || []);
  const heading = tab === 'landlord' ? (data.page?.hero?.title || data.page?.title || 'Landlord subscription plans') : 'Surveyors subscription plans';
  const subtitle = tab === 'landlord' ? (data.page?.hero?.subtitle || 'Flexible capacity for secure property operations.') : 'Professional tools for verified surveyors, field teams and growing practices.';
  const loading = tab === 'surveyor' && surveyorPlansQuery.isPending;
  return <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', fontFamily: '"Open Sans", Arial, sans-serif', fontOpticalSizing: 'auto', fontStyle: 'normal', fontVariationSettings: '"wdth" 100' }}>
    <Box sx={{ bgcolor: primary, py: { xs: 5.5, md: 7.5 }, textAlign: 'center', color: 'common.white' }}>
      <Container maxWidth="md">
        <Typography sx={{ fontWeight: 950, fontSize: { xs: '2rem', md: '3rem' }, letterSpacing: '-.045em', lineHeight: 1.08 }}>{heading}</Typography>
        <Typography sx={{ mt: 1.5, opacity: .8, lineHeight: 1.7 }}>{subtitle}</Typography>
      </Container>
    </Box>
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 7 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 4, md: 6 } }}>
        <Tabs
          value={tab}
          onChange={(_event, value: 'landlord' | 'surveyor') => setTab(value)}
          variant="fullWidth"
          aria-label="Subscription plan categories"
          sx={{ width: '100%', maxWidth: 760, minHeight: 56, p: .6, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper', '& .MuiTabs-indicator': { height: '100%', borderRadius: 2, bgcolor: primary, zIndex: 0 }, '& .MuiTab-root': { position: 'relative', zIndex: 1, minHeight: 46, px: { xs: 1, sm: 3 }, color: 'text.secondary', fontWeight: 850, fontSize: { xs: '.76rem', sm: '.9rem' }, textTransform: 'none' }, '& .MuiTab-root.Mui-selected': { color: '#fff' } }}
        >
          <Tab value="landlord" label="Landlord Subscription plan" />
          <Tab value="surveyor" label="Surveyors Subscription plan" />
        </Tabs>
      </Box>
      {loading && <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 220 }}><LinearProgress sx={{ width: 'min(100%, 420px)', bgcolor: `${primary}18`, '& .MuiLinearProgress-bar': { bgcolor: primary } }} /></Box>}
      {!loading && surveyorPlansQuery.error && tab === 'surveyor' && <Alert severity="warning" sx={{ mb: 4 }}>Surveyor plans are temporarily unavailable. Please try again shortly.</Alert>}
      {!loading && !surveyorPlansQuery.error && <Grid container spacing={{ xs: 1.5, md: 2 }} alignItems="stretch">{plans.map((plan: Record<string, any>) => <Grid size={{ xs: 6, md: 3 }} key={plan.key}><PricingPlanCard plan={plan} primary={primary} /></Grid>)}{!plans.length && <Grid size={12}><Alert severity="info">{tab === 'landlord' ? 'Landlord plans are being configured.' : 'Surveyor plans are being configured.'}</Alert></Grid>}</Grid>}
    </Container>
  </Box>;
}

export function DynamicContentPage() {
  const { data, loading } = useSite(); const page = data.page; const primary = data.settings?.design?.colors?.primary || data.settings?.brand?.primaryColor || '#0B5270';
  if (loading) return <LinearProgress />;
  if (!page) return <Container maxWidth="md" sx={{ py: 12 }}><Alert severity="warning">This page is not published.</Alert></Container>;
  return <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}><Box sx={{ bgcolor: primary, color: 'white', py: { xs: 7, md: 10 } }}><Container maxWidth="md"><Chip label={page.hero?.eyebrow || page.subtitle || page.title} sx={{ mb: 2, bgcolor: 'rgba(255,255,255,.15)', color: 'white' }} /><Typography sx={{ fontWeight: 950, fontSize: { xs: '2.2rem', md: '3.4rem' }, letterSpacing: '-.04em' }}>{page.hero?.title || page.title}</Typography>{(page.hero?.subtitle || page.subtitle) && <Typography sx={{ mt: 2, opacity: .78, fontSize: '1.05rem', lineHeight: 1.7 }}>{page.hero?.subtitle || page.subtitle}</Typography>}</Container></Box><DynamicSections sections={page.sections || []} /></Box>;
}
export const About = DynamicContentPage;

export function Contact() {
  const { data } = useSite(); const settings = data.settings || {}; const page = data.page; const primary = settings.design?.colors?.primary || settings.brand?.primaryColor || '#0B5270'; const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' }); const [sending, setSending] = useState(false); const [notice, setNotice] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setSending(true); try { await submitSiteEnquiry(form); setNotice('Your message has been submitted.'); setForm({ name: '', email: '', phone: '', message: '' }); } catch (error) { setNotice((error as Error).message); } finally { setSending(false); } }
  const contactItems = useMemo(() => [{ icon: MailOutlineRounded, label: 'Email', value: settings.contact?.email }, { icon: PhoneRounded, label: 'Phone', value: settings.contact?.phone }, { icon: LocationOnOutlined, label: 'Address', value: settings.contact?.address }].filter((item) => item.value), [settings.contact]);
  return <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}><Box sx={{ bgcolor: primary, color: 'white', py: { xs: 7, md: 9 } }}><Container maxWidth="md"><Typography sx={{ fontWeight: 950, fontSize: { xs: '2.2rem', md: '3.1rem' } }}>{page?.hero?.title || page?.title || 'Contact'}</Typography><Typography sx={{ mt: 1.5, opacity: .75 }}>{page?.hero?.subtitle || page?.subtitle}</Typography></Container></Box><Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}><Grid container spacing={6}><Grid size={{ xs: 12, md: 5 }}><Stack spacing={3}>{contactItems.map((item) => <Stack direction="row" spacing={2} key={item.label}><Box sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: `${primary}12`, color: primary, display: 'grid', placeItems: 'center' }}><item.icon /></Box><Box><Typography variant="overline" color="text.secondary">{item.label}</Typography><Typography sx={{ fontWeight: 750 }}>{item.value}</Typography></Box></Stack>)}</Stack></Grid><Grid size={{ xs: 12, md: 7 }}><Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4 }}><CardContent sx={{ p: { xs: 3, md: 4 } }}><Box component="form" onSubmit={submit}><Grid container spacing={2}><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Grid><Grid size={12}><TextField fullWidth label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Grid><Grid size={12}><TextField fullWidth required multiline rows={5} label="Message" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></Grid><Grid size={12}><Button disabled={sending} type="submit" variant="contained" size="large">{sending ? 'Submitting…' : 'Send message'}</Button></Grid></Grid></Box></CardContent></Card></Grid></Grid></Container><Snackbar open={Boolean(notice)} autoHideDuration={5000} onClose={() => setNotice('')}><Alert severity={notice.includes('submitted') ? 'success' : 'error'}>{notice}</Alert></Snackbar></Box>;
}
