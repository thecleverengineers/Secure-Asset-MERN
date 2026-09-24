import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, DialogActions, DialogContent, Divider, Grid, IconButton, Menu, MenuItem, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import AssignmentRounded from '@mui/icons-material/AssignmentRounded';
import BadgeRounded from '@mui/icons-material/BadgeRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import EmailRounded from '@mui/icons-material/EmailRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import FolderRounded from '@mui/icons-material/FolderRounded';
import GavelRounded from '@mui/icons-material/GavelRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import KeyRounded from '@mui/icons-material/KeyRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded';
import PhoneRounded from '@mui/icons-material/PhoneRounded';
import RequestQuoteRounded from '@mui/icons-material/RequestQuoteRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';
import { useAuth } from '../../context/AuthContext';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import { downloadReport, getReportCatalog, getResource, updateMe, uploadProfileAvatar } from '../../services/api';
import { moduleLabel } from '../../components/layout/AppShell';

type ProfileDraft = { name: string; phone: string; avatar: string; country: string; state: string; city: string };

const emptyProfile: ProfileDraft = { name: '', phone: '', avatar: '', country: '', state: '', city: '' };

function profileFromUser(user: any): ProfileDraft {
  return {
    name: user?.name || '',
    phone: user?.phone || '',
    avatar: user?.avatar || '',
    country: user?.country || '',
    state: user?.state || '',
    city: user?.city || '',
  };
}

function sameProfile(left: ProfileDraft, right: ProfileDraft) {
  return left.name === right.name && left.avatar === right.avatar && left.country === right.country && left.state === right.state && left.city === right.city;
}

function hasActiveCapability(user: any, capability: 'landlord' | 'surveyor') {
  if (!user?.[`${capability}Enabled`]) return false;
  const expiry = user?.[`${capability}SubscriptionExpiresAt`];
  return !expiry || new Date(expiry).getTime() > Date.now();
}

type ProfileQuickAction = { label: string; detail: string; icon: any; path: string; tone: string };
type KycChipColor = 'default' | 'success' | 'warning' | 'error';

function displayStatus(value: unknown, fallback = 'Not started') {
  const source = String(value || '').trim();
  return source ? source.replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) : fallback;
}

function accountFeatureNames(user: any) {
  const names: string[] = [];
  const role = String(user?.role || '').toLowerCase();
  const primary = role === 'tenant' ? 'Tenant' : role === 'landlord' ? 'Landlord' : role === 'surveyor' ? 'Surveyor' : role === 'admin' ? 'Administrator' : role === 'manager' ? 'Manager' : 'Member';
  names.push(primary);
  if (hasActiveCapability(user, 'landlord') && !names.includes('Landlord')) names.push('Landlord');
  if (hasActiveCapability(user, 'surveyor') && !names.includes('Surveyor')) names.push('Surveyor');
  return names;
}

function kycChipColor(value: unknown): KycChipColor {
  const status = String(value || '').toLowerCase();
  if (status === 'verified') return 'success';
  if (['pending', 'submitted', 'under_review', 'incomplete', 'changes_required'].includes(status)) return 'warning';
  if (['rejected', 'expired', 'suspended'].includes(status)) return 'error';
  return 'default';
}

function profileQuickActions(user: any): ProfileQuickAction[] {
  const vault: ProfileQuickAction = { label: 'Vault', detail: 'Secure files', icon: FolderRounded, path: '/app/documents', tone: '#0B5270' };
  const tenant: ProfileQuickAction[] = [
    { label: 'My Property', detail: 'Home & lease', icon: HomeWorkRounded, path: '/app/my-property', tone: '#66752D' },
    { label: 'Explore', detail: 'Marketplace', icon: StorefrontRounded, path: '/marketplace', tone: '#0F6B78' },
    { label: 'KYC', detail: 'Verification', icon: VerifiedUserRounded, path: '/app/tenant-kyc', tone: '#9B6510' },
    { label: 'Saved', detail: 'Shortlist', icon: FavoriteRounded, path: '/app/wishlist', tone: '#C74343' },
    { label: 'Applications', detail: 'Track status', icon: FactCheckRounded, path: '/app/my-applications', tone: '#506A8A' },
  ];
  const landlord: ProfileQuickAction[] = [
    { label: 'Listings', detail: 'My properties', icon: HomeWorkRounded, path: '/app/my-listings', tone: '#66752D' },
    { label: 'Add Property', detail: 'Create listing', icon: AddRounded, path: '/app/add_property', tone: '#0B5270' },
    { label: 'Payments', detail: 'Transactions', icon: PaymentsRounded, path: '/app/payments', tone: '#9B6510' },
    { label: 'Tenancies', detail: 'Occupancy', icon: ApartmentRounded, path: '/app/tenancies', tone: '#0F6B78' },
    { label: 'Agreements', detail: 'Templates', icon: GavelRounded, path: '/app/agreement-templates', tone: '#506A8A' },
  ];
  const surveyor: ProfileQuickAction[] = [
    { label: 'Projects', detail: 'Fieldwork', icon: AssignmentRounded, path: '/app/survey-projects', tone: '#0F6B78' },
    { label: 'Job Board', detail: 'New jobs', icon: HomeWorkRounded, path: '/app/survey-job-marketplace', tone: '#66752D' },
    { label: 'Quotes', detail: 'Proposals', icon: RequestQuoteRounded, path: '/app/survey-quotations', tone: '#9B6510' },
    { label: 'Verify', detail: 'Credentials', icon: VerifiedUserRounded, path: '/app/surveyor-verification', tone: '#506A8A' },
    { label: 'Professional', detail: 'Profile', icon: BadgeRounded, path: '/app/surveyor-profile', tone: '#0B5270' },
  ];
  const role = String(user?.role || '').toLowerCase();
  if (role === 'surveyor') return [vault, ...surveyor];
  if (role === 'landlord') return [vault, ...landlord];
  if (role === 'tenant' && hasActiveCapability(user, 'landlord')) return [
    { label: 'Vault Security', detail: 'Change 6-digit code', icon: KeyRounded, path: '/app/documents', tone: '#0B5270' },
    { label: 'Security', detail: 'Account access', icon: VerifiedUserRounded, path: '/app/security', tone: '#506A8A' },
    ...landlord,
    ...(hasActiveCapability(user, 'surveyor') ? surveyor : []),
  ];
  if (role === 'tenant') return [vault, ...tenant, ...(hasActiveCapability(user, 'surveyor') ? surveyor : [])];
  return [vault, { label: 'Security', detail: 'Account access', icon: VerifiedUserRounded, path: '/app/security', tone: '#506A8A' }];
}

export default function UtilityPage() {
  const { module = '' } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [related, setRelated] = useState<any[]>([]);
  const [notice, setNotice] = useState('');
  const [profile, setProfile] = useState<ProfileDraft>(emptyProfile);
  const [savedProfile, setSavedProfile] = useState<ProfileDraft>(emptyProfile);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<HTMLElement | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [kycInfoOpen, setKycInfoOpen] = useState(false);
  const [reportModules, setReportModules] = useState<any[]>([]);

  useEffect(() => {
    const nextProfile = profileFromUser(user);
    setProfile(nextProfile);
    setSavedProfile(nextProfile);
    if (module === 'my-property') getResource('tenants', { limit: 10 }).then((r) => setRelated(r.data)).catch(() => {});
    if (module === 'reports') getReportCatalog().then((r) => setReportModules(r.data || [])).catch((error) => setNotice((error as Error).message));
  }, [module, user?._id, user?.name, user?.phone, user?.avatar, user?.country, user?.state, user?.city]);

  const profileDirty = useMemo(() => !sameProfile(profile, savedProfile), [profile, savedProfile]);
  const trimmedName = profile.name.trim().replace(/\s+/g, ' ');
  const profileNameError = trimmedName.length === 0 ? 'Enter your name.' : trimmedName.length < 2 ? 'Name must contain at least 2 characters.' : trimmedName.length > 120 ? 'Name must be 120 characters or fewer.' : '';
  const accountFeatures = useMemo(() => accountFeatureNames(user), [user?._id, user?.role, user?.landlordEnabled, user?.landlordSubscriptionExpiresAt, user?.surveyorEnabled, user?.surveyorSubscriptionExpiresAt]);
  const quickActions = useMemo(() => profileQuickActions(user), [user?._id, user?.role, user?.landlordEnabled, user?.landlordSubscriptionExpiresAt, user?.surveyorEnabled, user?.surveyorSubscriptionExpiresAt]);
  const locationLabel = [profile.city, profile.state, profile.country].map((value) => value.trim()).filter(Boolean).join(' · ') || 'Location not added';
  const kycRouteAvailable = ['tenant', 'admin', 'manager'].includes(String(user?.role || '').toLowerCase());

  if (module === 'profile') {
    async function saveProfile(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (profileNameError) { setProfileError(profileNameError); return; }
      if (!profileDirty) { setProfileMessage('There are no changes to save.'); return; }
      setSavingProfile(true); setProfileError(''); setProfileMessage('');
      try {
        const result = await updateMe({ name: trimmedName, country: profile.country.trim(), state: profile.state.trim(), city: profile.city.trim() });
        const nextProfile = profileFromUser({ ...user, ...result.data });
        setProfile(nextProfile); setSavedProfile(nextProfile);
        await refreshUser(); setProfileMessage(result.message || 'Profile updated.'); setEditProfileOpen(false);
      } catch (error) { setProfileError((error as Error).message || 'Profile update failed.'); }
      finally { setSavingProfile(false); }
    }
    async function chooseAvatar(file?: File) {
      if (!file) return;
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) { setProfileError('Choose a JPG, PNG, WebP, or GIF image.'); return; }
      if (file.size > 8 * 1024 * 1024) { setProfileError('Profile photo must be 8 MB or smaller.'); return; }
      setUploadingAvatar(true); setProfileError(''); setProfileMessage('');
      try {
        const result = await uploadProfileAvatar(file);
        if (!result.data?.url) throw new Error('The profile photo upload did not return an image URL.');
        setProfile((old) => ({ ...old, avatar: result.data.url }));
        setSavedProfile((old) => ({ ...old, avatar: result.data.url }));
        await refreshUser(); setProfileMessage(result.message || 'Profile photo updated.');
      } catch (error) { setProfileError((error as Error).message || 'Profile photo upload failed.'); }
      finally { setUploadingAvatar(false); }
    }
    const personalDetails = [
      { label: 'Verified mobile', value: profile.phone || 'Not added', icon: PhoneRounded, tone: '#0B5270' },
      { label: 'Email address', value: user?.email || 'Not added', icon: EmailRounded, tone: '#506A8A' },
      { label: 'Location', value: locationLabel, icon: LocationOnRounded, tone: '#0F6B78' },
      { label: 'Account feature', value: accountFeatures.join(' · '), icon: WorkspacePremiumRounded, tone: '#66752D' },
      { label: 'KYC status', value: displayStatus(user?.kycStatus), icon: VerifiedUserRounded, tone: '#9B6510' },
    ];
    const openEditProfile = () => {
      setProfile(profileFromUser(user)); setSavedProfile(profileFromUser(user)); setProfileError(''); setProfileMessage(''); setProfileMenuAnchor(null); setEditProfileOpen(true);
    };
    const openKyc = () => {
      setProfileMenuAnchor(null);
      if (kycRouteAvailable) navigate('/app/tenant-kyc');
      else setKycInfoOpen(true);
    };
    return <Box data-secureasset-profile-static-dashboard="mobile-premium-v158" sx={{ maxWidth: 1040, mx: 'auto', px: { xs: 1.2, sm: 2.25, lg: 3.5 }, pb: { xs: 12, md: 5 } }}>
      {!editProfileOpen && profileError && <Alert severity="error" onClose={() => setProfileError('')} sx={{ mb: 1.5, borderRadius: 2.5 }}>{profileError}</Alert>}
      {profileMessage && <Alert severity="success" onClose={() => setProfileMessage('')} sx={{ mb: 1.5, borderRadius: 2.5 }}>{profileMessage}</Alert>}
      <Stack spacing={{ xs: 1.5, sm: 2.1 }}>
        <Card data-secureasset-profile-summary="image-name-feature-menu-v158" elevation={0} sx={{ position: 'relative', overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: { xs: 3, sm: 4 }, boxShadow: '0 12px 30px rgba(11,82,112,.10)' }}>
          <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(11,82,112,.14), rgba(35,128,98,.06) 55%, rgba(255,255,255,.94))', pointerEvents: 'none' }} />
          <Tooltip title="Profile actions"><IconButton data-secureasset-profile-action-menu="edit-kyc-v158" aria-label="Open profile actions" onClick={(event) => setProfileMenuAnchor(event.currentTarget)} sx={{ position: 'absolute', top: { xs: 10, sm: 14 }, right: { xs: 10, sm: 14 }, zIndex: 1, color: 'primary.main', bgcolor: 'rgba(255,255,255,.80)', border: '1px solid rgba(11,82,112,.12)', '&:hover': { bgcolor: '#FFFFFF' } }}><MoreVertRounded /></IconButton></Tooltip>
          <Stack direction="row" alignItems="center" spacing={{ xs: 1.4, sm: 2 }} sx={{ position: 'relative', px: { xs: 1.5, sm: 2.5 }, py: { xs: 2, sm: 2.65 }, pr: { xs: 6.5, sm: 7.5 } }}>
            <Avatar src={profile.avatar || undefined} alt={`${profile.name || 'Account'} profile photo`} sx={{ width: { xs: 76, sm: 94 }, height: { xs: 76, sm: 94 }, flexShrink: 0, bgcolor: 'primary.main', fontSize: { xs: 28, sm: 34 }, border: '4px solid rgba(255,255,255,.88)', boxShadow: '0 10px 24px rgba(11,82,112,.18)' }}>{profile.name?.[0] || user?.name?.[0]}</Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography data-secureasset-profile-name="static-v158" noWrap sx={{ color: '#102D3C', fontSize: { xs: 20, sm: 25 }, fontWeight: 800, lineHeight: 1.16 }}>{profile.name || user?.name || 'SecureAsset member'}</Typography>
              <Typography sx={{ mt: .55, color: 'text.secondary', fontSize: 10, fontWeight: 700, letterSpacing: '.075em', textTransform: 'uppercase' }}>Account feature</Typography>
              <Typography noWrap sx={{ mt: .1, color: 'primary.main', fontSize: { xs: 12, sm: 13 }, fontWeight: 700 }}>{accountFeatures.join(' · ')}</Typography>
              <Chip data-secureasset-profile-kyc-status="static-v158" size="small" color={kycChipColor(user?.kycStatus)} icon={<VerifiedUserRounded />} label={`KYC ${displayStatus(user?.kycStatus)}`} sx={{ mt: 1, height: 25, bgcolor: 'rgba(255,255,255,.74)', '& .MuiChip-label': { px: .85, fontSize: 10.5, fontWeight: 700 } }} />
            </Box>
          </Stack>
        </Card>

        <Card data-secureasset-profile-quick-actions="four-visible-slider-v158" elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: { xs: 3, sm: 4 } }}>
          <CardContent sx={{ p: { xs: 1.45, sm: 2.25 } }}>
            <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1.15 }}><Box><Typography sx={{ color: '#102D3C', fontSize: { xs: 15.5, sm: 17 }, fontWeight: 800 }}>Quick Actions</Typography><Typography color="text.secondary" sx={{ mt: .15, fontSize: 10.5 }}>Swipe for your available workspace tools</Typography></Box><Typography sx={{ color: 'primary.main', fontSize: 10, fontWeight: 750 }}>{quickActions.length} tools</Typography></Stack>
            <Box data-secureasset-profile-quick-action-track="four-up-slide-v158" sx={{ display: 'flex', gap: .75, overflowX: 'auto', overscrollBehaviorX: 'contain', scrollSnapType: 'x mandatory', scrollPaddingInline: 2, pb: .65, px: .1, '&::-webkit-scrollbar': { height: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(11,82,112,.22)', borderRadius: 9 } }}>
              {quickActions.map((action) => { const Icon = action.icon; return <Button data-secureasset-profile-quick-action={action.label.toLowerCase().replaceAll(' ', '-')} key={`${action.label}-${action.path}`} onClick={() => navigate(action.path)} aria-label={`Open ${action.label}`} sx={{ flex: '0 0 calc((100% - 24px) / 4)', minWidth: 0, minHeight: { xs: 91, sm: 104 }, p: { xs: .65, sm: .9 }, scrollSnapAlign: 'start', border: '1px solid', borderColor: 'divider', borderRadius: 2.25, color: 'text.primary', bgcolor: '#FFFFFF', textTransform: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: .45, '&:hover': { borderColor: action.tone, bgcolor: 'rgba(11,82,112,.035)', transform: 'translateY(-1px)' } }}><Box sx={{ width: { xs: 31, sm: 36 }, height: { xs: 31, sm: 36 }, borderRadius: 2, display: 'grid', placeItems: 'center', color: action.tone, bgcolor: `${action.tone}12` }}><Icon sx={{ fontSize: { xs: 18, sm: 21 } }} /></Box><Typography noWrap sx={{ maxWidth: '100%', fontSize: { xs: 9.2, sm: 10.4 }, fontWeight: 800, lineHeight: 1.1 }}>{action.label}</Typography><Typography noWrap sx={{ maxWidth: '100%', color: 'text.secondary', fontSize: { xs: 7.8, sm: 8.7 }, lineHeight: 1.1 }}>{action.detail}</Typography></Button>; })}
            </Box>
          </CardContent>
        </Card>

        <Card data-secureasset-profile-personal-details="icon-aligned-v158" elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: { xs: 3, sm: 4 } }}>
          <CardContent sx={{ p: { xs: 1.45, sm: 2.25 } }}>
            <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1.2 }}><Box><Typography sx={{ color: '#102D3C', fontSize: { xs: 15.5, sm: 17 }, fontWeight: 800 }}>Personal Details</Typography><Typography color="text.secondary" sx={{ mt: .15, fontSize: 10.5 }}>Your account information in one place</Typography></Box><VerifiedUserRounded sx={{ color: 'primary.main', fontSize: 19 }} /></Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: .85 }}>
              {personalDetails.map((detail) => { const Icon = detail.icon; return <Stack data-secureasset-profile-detail={detail.label.toLowerCase().replaceAll(' ', '-')} key={detail.label} direction="row" alignItems="center" spacing={1.05} sx={{ minWidth: 0, p: { xs: 1, sm: 1.2 }, border: '1px solid', borderColor: 'divider', borderRadius: 2.25, bgcolor: 'rgba(247,247,245,.72)' }}><Box sx={{ width: 33, height: 33, flexShrink: 0, borderRadius: 1.8, display: 'grid', placeItems: 'center', color: detail.tone, bgcolor: `${detail.tone}12` }}><Icon sx={{ fontSize: 18 }} /></Box><Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ color: 'text.secondary', fontSize: 9.3, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{detail.label}</Typography><Typography noWrap title={detail.value} sx={{ mt: .2, color: 'text.primary', fontSize: { xs: 11.4, sm: 12.3 }, fontWeight: 700 }}>{detail.value}</Typography></Box></Stack>; })}
            </Box>
          </CardContent>
        </Card>
      </Stack>

      <Menu data-secureasset-profile-action-items="edit-profile-kyc-v158" anchorEl={profileMenuAnchor} open={Boolean(profileMenuAnchor)} onClose={() => setProfileMenuAnchor(null)} PaperProps={{ sx: { minWidth: 192, mt: .6, border: '1px solid', borderColor: 'divider', borderRadius: 2.25, overflow: 'hidden' } }}>
        <MenuItem onClick={openEditProfile}><EditRounded fontSize="small" sx={{ mr: 1.1, color: 'primary.main' }} />Edit profile</MenuItem>
        <Divider />
        <MenuItem onClick={openKyc}><VerifiedUserRounded fontSize="small" sx={{ mr: 1.1, color: 'primary.main' }} />KYC</MenuItem>
      </Menu>

      <ProfessionalDialog open={editProfileOpen} onClose={() => !savingProfile && setEditProfileOpen(false)} fullWidth maxWidth="sm" enableMinimize={false} enableMaximize={false} professionalTitle="Edit profile" professionalSubtitle="Update your visible account details. Your mobile number remains protected." PaperProps={{ sx: { borderRadius: { xs: 3, sm: 4 } } }}>
        <Box component="form" noValidate onSubmit={saveProfile} data-secureasset-profile-edit-dialog="functional-v158">
          <DialogContent dividers sx={{ py: 2 }}>
            {profileError && <Alert severity="error" onClose={() => setProfileError('')} sx={{ mb: 1.75, borderRadius: 2 }}>{profileError}</Alert>}
            <Stack direction="row" spacing={1.35} alignItems="center" sx={{ mb: 2 }}><Avatar src={profile.avatar || undefined} alt={`${profile.name || 'Account'} profile photo`} sx={{ width: 62, height: 62, bgcolor: 'primary.main', fontSize: 22 }}>{profile.name?.[0] || user?.name?.[0]}</Avatar><Box><Button component="label" size="small" variant="outlined" startIcon={<PhotoCameraRounded />} disabled={uploadingAvatar}>{uploadingAvatar ? 'Uploading…' : 'Change photo'}<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; void chooseAvatar(file); }} /></Button><Typography color="text.secondary" sx={{ mt: .5, fontSize: 10.5 }}>JPG, PNG, WebP or GIF · maximum 8 MB</Typography></Box></Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.35 }}>
              <TextField label="Name" value={profile.name} onChange={(event) => setProfile((old) => ({ ...old, name: event.target.value }))} error={Boolean(profileNameError)} helperText={profileNameError || 'Used on records and messages.'} inputProps={{ maxLength: 120 }} required autoComplete="name" />
              <TextField label="Verified mobile" value={profile.phone} InputProps={{ readOnly: true }} helperText="Mobile changes require OTP verification." />
              <TextField label="Email" value={user?.email || ''} InputProps={{ readOnly: true }} />
              <TextField label="Country" value={profile.country} onChange={(event) => setProfile((old) => ({ ...old, country: event.target.value }))} autoComplete="country-name" />
              <TextField label="State / Province" value={profile.state} onChange={(event) => setProfile((old) => ({ ...old, state: event.target.value }))} autoComplete="address-level1" />
              <TextField label="City" value={profile.city} onChange={(event) => setProfile((old) => ({ ...old, city: event.target.value }))} autoComplete="address-level2" />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: { xs: 1.4, sm: 1.8 }, gap: .65 }}><Button type="button" onClick={() => { setProfile(savedProfile); setProfileError(''); setProfileMessage('Changes discarded.'); setEditProfileOpen(false); }} disabled={savingProfile || uploadingAvatar}>Discard changes</Button><Button type="submit" variant="contained" startIcon={<SaveRounded />} disabled={savingProfile || uploadingAvatar || !profileDirty || Boolean(profileNameError)}>{savingProfile ? 'Saving…' : 'Save profile'}</Button></DialogActions>
        </Box>
      </ProfessionalDialog>

      <ProfessionalDialog open={kycInfoOpen} onClose={() => setKycInfoOpen(false)} fullWidth maxWidth="xs" enableMinimize={false} enableMaximize={false} professionalTitle="KYC status" professionalSubtitle="Compliance information for this account." PaperProps={{ sx: { borderRadius: 3 } }}><DialogContent><Stack spacing={1.25}><Chip color={kycChipColor(user?.kycStatus)} icon={<VerifiedUserRounded />} label={displayStatus(user?.kycStatus)} sx={{ alignSelf: 'flex-start' }} /><Typography color="text.secondary" fontSize={13}>KYC submission is available to tenant accounts. This {accountFeatures.join(' · ')} workspace currently keeps its compliance status managed by the platform.</Typography></Stack></DialogContent><DialogActions><Button onClick={() => setKycInfoOpen(false)}>Close</Button></DialogActions></ProfessionalDialog>
    </Box>;
  }

  if (module === 'reports') return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5 }}><Typography variant="h4" sx={{ fontWeight: 900 }}>Reports & Analytics</Typography><Typography color="text.secondary" sx={{ mt: .5, mb: 3 }}>Download live, permission-scoped MongoDB records as CSV, Excel or PDF.</Typography><Grid container spacing={2}>{reportModules.map((report: any) => <Grid size={{ xs: 12, sm: 6, md: 4 }} key={report.key}><Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}><CardContent><Stack direction="row" justifyContent="space-between" gap={1}><Typography sx={{ fontWeight: 850 }}>{report.label || moduleLabel(report.key)}</Typography><Chip size="small" label={`${Number(report.count || 0).toLocaleString()} records`} /></Stack><Typography color="text.secondary" sx={{ fontSize: 12, my: 1.5 }}>{report.description || 'Permission-scoped MongoDB records.'}</Typography><Stack direction="row" gap={1} flexWrap="wrap">{(report.formats || ['csv','xlsx','pdf']).map((format: 'csv'|'xlsx'|'pdf') => <Button key={format} startIcon={<DownloadRounded />} variant="outlined" size="small" onClick={() => downloadReport(report.key, format).catch((e) => setNotice(e.message))}>{format === 'xlsx' ? 'Excel' : format.toUpperCase()}</Button>)}</Stack></CardContent></Card></Grid>)}</Grid>{notice && <Alert severity="error" sx={{ mt: 2 }}>{notice}</Alert>}</Box>;

  if (module === 'my-property') return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5 }}><Typography variant="h4" sx={{ fontWeight: 900, mb: 3 }}>My Property</Typography>{related.length ? related.map((tenant) => <Card key={tenant._id} elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', maxWidth: 900 }}><CardContent><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}><Box><Chip label={tenant.status} color="success" size="small" /><Typography sx={{ mt: 1.5, fontSize: 24, fontWeight: 900 }}>{tenant.property?.title || 'Assigned property'}</Typography><Typography color="text.secondary">{tenant.property?.address?.line1}, {tenant.property?.address?.city}</Typography><Typography sx={{ mt: 1, fontWeight: 700 }}>Unit {tenant.unit?.unitNumber || '—'}</Typography></Box><Box><Typography color="text.secondary" sx={{ fontSize: 12 }}>MOVE-IN DATE</Typography><Typography sx={{ fontWeight: 800 }}>{tenant.moveInDate ? new Date(tenant.moveInDate).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '—'}</Typography></Box></Stack></CardContent></Card>) : <Alert severity="info">No active property allocation was found.</Alert>}</Box>;

  if (module === 'saved-properties') return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5 }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2} sx={{ mb: 3 }}><Box><Typography variant="h4" sx={{ fontWeight: 900 }}>Saved Properties</Typography><Typography color="text.secondary">Shortlisted public listings for rent, lease, and purchase review.</Typography></Box><Button variant="contained" href="/marketplace">Browse Properties</Button></Stack><Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, border: '1px solid', borderColor: 'divider', maxWidth: 920 }}><Stack spacing={1.5}><Chip label="Tenant workspace" sx={{ alignSelf: 'flex-start' }} /><Typography sx={{ fontWeight: 850, fontSize: 20 }}>Your saved shortlist is ready for property discovery.</Typography><Typography color="text.secondary">Open the marketplace to review public rent, lease, and sale listings. Saved-list synchronisation can be connected to a dedicated shortlist collection when the tenant preference model is enabled.</Typography><Stack direction="row" gap={1} flexWrap="wrap"><Button variant="outlined" href="/marketplace?listingType=rent">Rent Properties</Button><Button variant="outlined" href="/marketplace?listingType=lease">Lease Properties</Button><Button variant="outlined" href="/marketplace?listingType=sale">Sale Properties</Button></Stack></Stack></Paper></Box>;

  return <Box sx={{ px: 4, py: 6 }}><Alert severity="info">{moduleLabel(module)} is not available for this account or has not been enabled by an administrator.</Alert></Box>;
}
