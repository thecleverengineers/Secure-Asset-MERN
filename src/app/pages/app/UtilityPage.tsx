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

    const openEditProfile = () => {
      setProfile(profileFromUser(user));
      setSavedProfile(profileFromUser(user));
      setProfileError('');
      setProfileMessage('');
      setProfileMenuAnchor(null);
      setEditProfileOpen(true);
    };
    const openKyc = () => {
      setProfileMenuAnchor(null);
      if (kycRouteAvailable) navigate('/app/tenant-kyc');
      else setKycInfoOpen(true);
    };
    const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const accountRole = accountFeatures.join(' · ');
    const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const lastLogin = user?.lastLogin ? new Date(user.lastLogin).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Current session';
    const details = [
      { label: 'Full Name', value: profile.name || user?.name || 'SecureAsset member', icon: BadgeRounded },
      { label: 'Email Address', value: user?.email || 'Not added', icon: EmailRounded },
      { label: 'Mobile Number', value: profile.phone || 'Not added', icon: PhoneRounded, verified: Boolean(profile.phone) },
      { label: 'Account Role', value: accountRole, icon: WorkspacePremiumRounded },
      { label: 'Location', value: locationLabel, icon: LocationOnRounded },
      { label: 'KYC Status', value: displayStatus(user?.kycStatus), icon: VerifiedUserRounded, verified: String(user?.kycStatus || '').toLowerCase() === 'verified' },
    ];
    const tools = [
      { label: 'Vault', detail: 'Secure files', icon: FolderRounded, tone: '#0A6AE8', action: () => navigate('/app/documents') },
      { label: 'Security', detail: 'Account access', icon: VerifiedUserRounded, tone: '#6558D8', action: () => navigate('/app/security') },
      { label: 'Preferences', detail: 'App settings', icon: WorkspacePremiumRounded, tone: '#16A36F', action: () => scrollToSection('profile-preferences') },
      { label: 'Activity', detail: 'Login history', icon: AssignmentRounded, tone: '#F28B23', action: () => scrollToSection('profile-activity') },
    ];

    const cardSx = {
      border: '1px solid rgba(31,85,120,.10)',
      borderRadius: { xs: '18px', md: '20px' },
      bgcolor: 'rgba(255,255,255,.94)',
      boxShadow: '0 16px 42px rgba(18,55,82,.08)',
      overflow: 'hidden',
    };

    return <Box data-secureasset-profile-premium="reference-match-v159" sx={{ width: '100%', maxWidth: 1320, mx: 'auto', px: { xs: 1.25, sm: 2, lg: 2.5 }, pb: { xs: 12, md: 5 }, fontFamily: '"Open Sans", sans-serif' }}>
      {!editProfileOpen && profileError && <Alert severity="error" onClose={() => setProfileError('')} sx={{ mb: 1.5, borderRadius: 2.5 }}>{profileError}</Alert>}
      {profileMessage && <Alert severity="success" onClose={() => setProfileMessage('')} sx={{ mb: 1.5, borderRadius: 2.5 }}>{profileMessage}</Alert>}

      <Box sx={{ ...cardSx, position: 'relative', minHeight: { xs: 300, md: 250 }, color: '#fff', backgroundImage: 'linear-gradient(90deg, rgba(1,35,63,.96) 0%, rgba(0,72,103,.90) 48%, rgba(2,62,86,.72) 100%), url("https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=85")', backgroundSize: 'cover', backgroundPosition: 'center 48%', mb: 1.8 }}>
        <Box sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 76% 18%, rgba(79,210,255,.18), transparent 26%), linear-gradient(180deg, transparent 35%, rgba(0,29,48,.16))' }} />
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ position: 'relative', px: { xs: 2, md: 3.5 }, pt: { xs: 1.8, md: 2.2 } }}>
          <Box>
            <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 800, lineHeight: 1.1 }}>Profile</Typography>
            <Typography sx={{ mt: .45, color: 'rgba(255,255,255,.72)', fontSize: 12 }}>Home&nbsp;&nbsp;›&nbsp;&nbsp;Profile</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button onClick={openEditProfile} variant="outlined" startIcon={<EditRounded />} sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: '#fff', borderColor: 'rgba(255,255,255,.38)', bgcolor: 'rgba(255,255,255,.06)', borderRadius: '12px', px: 1.6, textTransform: 'none', fontWeight: 700, '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.12)' } }}>Edit Profile</Button>
            <IconButton onClick={(event) => setProfileMenuAnchor(event.currentTarget)} sx={{ color: '#fff', border: '1px solid rgba(255,255,255,.32)', bgcolor: 'rgba(255,255,255,.08)', borderRadius: '12px', '&:hover': { bgcolor: 'rgba(255,255,255,.16)' } }}><MoreVertRounded /></IconButton>
          </Stack>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'center', md: 'flex-end' }} spacing={{ xs: 1.2, md: 2.4 }} sx={{ position: 'absolute', left: { xs: 0, md: 34 }, right: { xs: 0, md: 34 }, bottom: { xs: 24, md: 26 }, textAlign: { xs: 'center', md: 'left' }, px: { xs: 2, md: 0 } }}>
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <Avatar src={profile.avatar || undefined} alt={(profile.name || 'Account') + ' profile photo'} sx={{ width: { xs: 94, md: 112 }, height: { xs: 94, md: 112 }, bgcolor: '#07506F', fontSize: { xs: 38, md: 44 }, border: '4px solid #fff', boxShadow: '0 16px 34px rgba(0,0,0,.22)' }}>{profile.name?.[0] || user?.name?.[0]}</Avatar>
            <Box sx={{ position: 'absolute', right: -2, bottom: 5, width: 34, height: 34, bgcolor: '#fff', color: '#0B5270', borderRadius: '50%', display: 'grid', placeItems: 'center', border: '1px solid rgba(11,82,112,.12)' }}><PhotoCameraRounded sx={{ fontSize: 18 }} /></Box>
          </Box>
          <Box sx={{ minWidth: 0, pb: { md: .8 } }}>
            <Stack direction="row" spacing={.8} alignItems="center" justifyContent={{ xs: 'center', md: 'flex-start' }}>
              <Typography sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.08 }}>{profile.name || user?.name || 'SecureAsset member'}</Typography>
              <VerifiedUserRounded sx={{ fontSize: 20, color: '#65B9FF' }} />
            </Stack>
            <Typography sx={{ mt: .55, fontSize: { xs: 13, md: 15 }, color: 'rgba(255,255,255,.90)' }}>{accountRole}</Typography>
            <Chip size="small" icon={<VerifiedUserRounded />} label={'KYC ' + displayStatus(user?.kycStatus)} sx={{ mt: 1, height: 27, color: '#0B7A47', bgcolor: '#DDF7E9', '& .MuiChip-icon': { color: '#159B5F' }, '& .MuiChip-label': { px: .9, fontWeight: 700, fontSize: 11 } }} />
          </Box>
          <Box sx={{ flex: 1 }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: .55, sm: 2 }} sx={{ pb: { md: .9 }, maxWidth: { xs: '100%', md: 520 } }}>
            <Stack direction="row" spacing={.7} alignItems="center"><EmailRounded sx={{ fontSize: 16, color: 'rgba(255,255,255,.65)' }} /><Typography noWrap sx={{ fontSize: 12.5, color: 'rgba(255,255,255,.88)' }}>{user?.email || 'Email not added'}</Typography></Stack>
            <Stack direction="row" spacing={.7} alignItems="center"><PhoneRounded sx={{ fontSize: 16, color: 'rgba(255,255,255,.65)' }} /><Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,.88)' }}>{profile.phone || 'Mobile not added'}</Typography></Stack>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ ...cardSx, mb: 1.8, px: { xs: .6, sm: 1 }, py: .7, overflowX: 'auto' }}>
        <Stack direction="row" spacing={.25} sx={{ minWidth: 'max-content' }}>
          {[
            { label: 'Profile', icon: BadgeRounded, action: () => scrollToSection('profile-overview') },
            { label: 'Personal Details', icon: FactCheckRounded, action: () => scrollToSection('profile-personal') },
            { label: 'Security', icon: VerifiedUserRounded, action: () => navigate('/app/security') },
            { label: 'KYC & Verification', icon: WorkspacePremiumRounded, action: openKyc },
            { label: 'Activity', icon: AssignmentRounded, action: () => scrollToSection('profile-activity') },
          ].map((tab, index) => {
            const TabIcon = tab.icon;
            return <Button key={tab.label} onClick={tab.action} startIcon={<TabIcon sx={{ fontSize: 18 }} />} sx={{ minHeight: 45, px: { xs: 1.2, sm: 2 }, borderRadius: '12px', textTransform: 'none', fontSize: { xs: 11, sm: 12 }, fontWeight: index === 0 ? 800 : 600, color: index === 0 ? '#064F86' : '#566F81', bgcolor: index === 0 ? '#EEF6FF' : 'transparent', borderBottom: index === 0 ? '2px solid #0A66C2' : '2px solid transparent', '&:hover': { bgcolor: '#F5F9FC' } }}>{tab.label}</Button>;
          })}
        </Stack>
      </Box>

      <Box id="profile-overview" sx={{ scrollMarginTop: 90 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.65fr) minmax(280px, .75fr)' }, gap: 1.8 }}>
          <Box id="profile-personal" sx={{ ...cardSx, p: { xs: 1.8, sm: 2.2 }, scrollMarginTop: 90 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.3 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 38, height: 38, borderRadius: '12px', bgcolor: '#EAF3FF', color: '#0A66C2', display: 'grid', placeItems: 'center' }}><BadgeRounded sx={{ fontSize: 21 }} /></Box>
                <Box><Typography sx={{ fontSize: 17, fontWeight: 800, color: '#112E41' }}>Personal Information</Typography><Typography sx={{ mt: .2, fontSize: 11, color: '#708494' }}>Your account information in one place</Typography></Box>
              </Stack>
              <Button size="small" onClick={openEditProfile} startIcon={<EditRounded />} sx={{ minWidth: 0, px: 1.2, border: '1px solid #D8E6F0', borderRadius: '11px', textTransform: 'none', fontWeight: 700 }}>Edit</Button>
            </Stack>
            <Stack divider={<Divider flexItem />}>
              {details.map((detail) => {
                const DetailIcon = detail.icon;
                return <Stack key={detail.label} direction="row" alignItems="center" spacing={1.15} sx={{ minHeight: 58, py: .75 }}>
                  <Box sx={{ width: 30, height: 30, borderRadius: '10px', bgcolor: '#F2F7FA', color: '#58768B', display: 'grid', placeItems: 'center', flexShrink: 0 }}><DetailIcon sx={{ fontSize: 17 }} /></Box>
                  <Typography sx={{ width: { xs: 104, sm: 150 }, flexShrink: 0, color: '#708494', fontSize: 11.5 }}>{detail.label}</Typography>
                  <Typography sx={{ minWidth: 0, flex: 1, color: '#102D3C', fontSize: { xs: 11.5, sm: 12.5 }, fontWeight: 700, overflowWrap: 'anywhere' }}>{detail.value}</Typography>
                  {detail.verified && <Chip size="small" color="success" icon={<VerifiedUserRounded />} label="Verified" sx={{ display: { xs: 'none', sm: 'inline-flex' }, height: 23, '& .MuiChip-label': { px: .65, fontSize: 9.5, fontWeight: 700 } }} />}
                </Stack>;
              })}
            </Stack>
          </Box>

          <Stack spacing={1.8}>
            <Box sx={{ ...cardSx, p: { xs: 1.8, sm: 2.2 }, textAlign: 'center' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ textAlign: 'left', mb: 1.5 }}><Box sx={{ width: 34, height: 34, borderRadius: '11px', bgcolor: '#EEF4FF', color: '#486EE8', display: 'grid', placeItems: 'center' }}><PhotoCameraRounded sx={{ fontSize: 19 }} /></Box><Box><Typography sx={{ fontWeight: 800, color: '#112E41' }}>Profile Picture</Typography><Typography sx={{ color: '#708494', fontSize: 10.5 }}>Update your profile photo</Typography></Box></Stack>
              <Avatar src={profile.avatar || undefined} sx={{ width: 96, height: 96, mx: 'auto', mb: 1.3, bgcolor: '#07506F', fontSize: 36 }}>{profile.name?.[0] || user?.name?.[0]}</Avatar>
              <Typography sx={{ color: '#708494', fontSize: 10.5, mb: 1.15 }}>Upload a clear profile photo<br />JPG, PNG, WebP or GIF · up to 8 MB</Typography>
              <Button component="label" fullWidth variant="contained" startIcon={<PhotoCameraRounded />} disabled={uploadingAvatar} sx={{ borderRadius: '11px', textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}>{uploadingAvatar ? 'Uploading…' : 'Change Photo'}<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; void chooseAvatar(file); }} /></Button>
            </Box>

            <Box sx={{ ...cardSx, p: { xs: 1.8, sm: 2.2 } }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.15 }}><Box sx={{ width: 34, height: 34, borderRadius: '11px', bgcolor: '#EFF4FF', color: '#1D64C8', display: 'grid', placeItems: 'center' }}><WorkspacePremiumRounded sx={{ fontSize: 19 }} /></Box><Box><Typography sx={{ fontWeight: 800, color: '#112E41' }}>Account Summary</Typography><Typography sx={{ color: '#708494', fontSize: 10.5 }}>Account membership and status</Typography></Box></Stack>
              <Stack spacing={1}>
                {[['Role', accountRole], ['Member Since', memberSince], ['Last Login', lastLogin], ['Account Status', 'Active']].map(([label, value], index) => <Stack key={label} direction="row" alignItems="center" justifyContent="space-between" spacing={1}><Typography sx={{ color: '#708494', fontSize: 11 }}>{label}</Typography><Stack direction="row" alignItems="center" spacing={.55}>{index === 3 && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#23B26D' }} />}<Typography noWrap sx={{ maxWidth: 170, color: '#102D3C', fontSize: 11.5, fontWeight: 700 }}>{value}</Typography></Stack></Stack>)}
              </Stack>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.25fr) minmax(320px, .95fr)' }, gap: 1.8, mt: 1.8 }}>
          <Box id="profile-preferences" sx={{ ...cardSx, p: { xs: 1.8, sm: 2.2 }, scrollMarginTop: 90 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.4 }}><Box sx={{ width: 38, height: 38, borderRadius: '12px', bgcolor: '#ECFAFF', color: '#047DA2', display: 'grid', placeItems: 'center' }}><FactCheckRounded sx={{ fontSize: 21 }} /></Box><Box><Typography sx={{ fontSize: 17, fontWeight: 800, color: '#112E41' }}>Quick Actions</Typography><Typography sx={{ mt: .2, color: '#708494', fontSize: 10.5 }}>Access your important tools quickly</Typography></Box></Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: { xs: .7, sm: 1 } }}>
              {tools.map((tool) => {
                const ToolIcon = tool.icon;
                return <Button key={tool.label} onClick={tool.action} sx={{ minWidth: 0, minHeight: { xs: 105, sm: 118 }, p: { xs: .65, sm: 1 }, border: '1px solid #E2EDF4', borderRadius: '14px', bgcolor: '#fff', color: '#102D3C', textTransform: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: .55, '&:hover': { bgcolor: '#F8FBFD', borderColor: tool.tone } }}>
                  <Box sx={{ width: { xs: 38, sm: 44 }, height: { xs: 38, sm: 44 }, borderRadius: '50%', bgcolor: tool.tone + '18', color: tool.tone, display: 'grid', placeItems: 'center' }}><ToolIcon sx={{ fontSize: { xs: 20, sm: 23 } }} /></Box>
                  <Typography noWrap sx={{ maxWidth: '100%', fontWeight: 800, fontSize: { xs: 10, sm: 11.5 } }}>{tool.label}</Typography>
                  <Typography noWrap sx={{ maxWidth: '100%', color: '#7B8E9B', fontSize: { xs: 8, sm: 9.5 } }}>{tool.detail}</Typography>
                </Button>;
              })}
            </Box>
          </Box>

          <Box sx={{ ...cardSx, p: { xs: 1.8, sm: 2.2 } }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}><Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 38, height: 38, borderRadius: '12px', bgcolor: '#EEF4FF', color: '#1F66D6', display: 'grid', placeItems: 'center' }}><VerifiedUserRounded sx={{ fontSize: 21 }} /></Box><Box><Typography sx={{ fontSize: 17, fontWeight: 800, color: '#112E41' }}>Security Status</Typography><Typography sx={{ mt: .2, color: '#708494', fontSize: 10.5 }}>Your account security overview</Typography></Box></Stack><Button onClick={() => navigate('/app/security')} size="small" sx={{ textTransform: 'none', fontWeight: 700 }}>Manage</Button></Stack>
            <Box sx={{ borderRadius: '14px', p: 1.35, bgcolor: '#EAF8F0', border: '1px solid #D3F0DF', mb: 1.25 }}>
              <Stack direction="row" spacing={1} alignItems="flex-start"><VerifiedUserRounded sx={{ color: '#18A35F', mt: .1 }} /><Box><Typography sx={{ color: '#087A43', fontSize: 12, fontWeight: 800 }}>Your account is secure</Typography><Typography sx={{ mt: .2, color: '#5B7D68', fontSize: 9.5 }}>All essential security measures are active and up to date.</Typography></Box></Stack>
            </Box>
            <Stack spacing={.75}>
              {[
                ['Email verified', Boolean(user?.email)],
                ['Mobile number verified', Boolean(profile.phone)],
                ['KYC completed', String(user?.kycStatus || '').toLowerCase() === 'verified'],
                ['Strong account protection', true],
              ].map(([label, ok]) => <Stack key={String(label)} direction="row" spacing={.8} alignItems="center"><VerifiedUserRounded sx={{ fontSize: 16, color: ok ? '#18A35F' : '#A8B6C0' }} /><Typography sx={{ color: '#486173', fontSize: 10.8 }}>{String(label)}</Typography></Stack>)}
            </Stack>
          </Box>
        </Box>

        <Box id="profile-activity" sx={{ ...cardSx, mt: 1.8, p: { xs: 1.8, sm: 2.2 }, scrollMarginTop: 90 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}><Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 38, height: 38, borderRadius: '12px', bgcolor: '#EDF7FF', color: '#0A66C2', display: 'grid', placeItems: 'center' }}><AssignmentRounded sx={{ fontSize: 21 }} /></Box><Box><Typography sx={{ fontSize: 17, fontWeight: 800, color: '#112E41' }}>Recent Activity</Typography><Typography sx={{ mt: .2, color: '#708494', fontSize: 10.5 }}>Latest activity related to your account</Typography></Box></Stack><Button size="small" onClick={() => navigate('/app/security')} sx={{ textTransform: 'none', fontWeight: 700 }}>View all</Button></Stack>
          <Stack divider={<Divider flexItem />}>
            {[
              ['Profile ready', 'Your SecureAsset profile is active.', 'Current'],
              ['Login successful', 'Current signed-in session is active.', lastLogin],
              ['KYC status', 'Identity verification status: ' + displayStatus(user?.kycStatus) + '.', displayStatus(user?.kycStatus)],
            ].map(([title, description, meta], index) => <Stack key={title} direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: .35, sm: 1 }} alignItems={{ sm: 'center' }} sx={{ py: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}><Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: index === 0 ? '#0A66C2' : '#22AA66', flexShrink: 0 }} /><Box sx={{ minWidth: 0 }}><Typography sx={{ color: '#102D3C', fontSize: 11.5, fontWeight: 700 }}>{title}</Typography><Typography sx={{ color: '#7A8C99', fontSize: 9.8 }}>{description}</Typography></Box></Stack>
              <Typography sx={{ color: '#6D8292', fontSize: 9.8, pl: { xs: 2.1, sm: 0 } }}>{meta}</Typography>
            </Stack>)}
          </Stack>
        </Box>
      </Box>

      <Menu anchorEl={profileMenuAnchor} open={Boolean(profileMenuAnchor)} onClose={() => setProfileMenuAnchor(null)} PaperProps={{ sx: { minWidth: 192, mt: .6, border: '1px solid', borderColor: 'divider', borderRadius: 2.25, overflow: 'hidden' } }}>
        <MenuItem onClick={openEditProfile}><EditRounded fontSize="small" sx={{ mr: 1.1, color: 'primary.main' }} />Edit profile</MenuItem>
        <Divider />
        <MenuItem onClick={openKyc}><VerifiedUserRounded fontSize="small" sx={{ mr: 1.1, color: 'primary.main' }} />KYC & Verification</MenuItem>
      </Menu>

      <ProfessionalDialog open={editProfileOpen} onClose={() => !savingProfile && setEditProfileOpen(false)} fullWidth maxWidth="sm" enableMinimize={false} enableMaximize={false} professionalTitle="Edit profile" professionalSubtitle="Update your visible account details. Your mobile number remains protected." PaperProps={{ sx: { borderRadius: { xs: 3, sm: 4 } } }}>
        <Box component="form" noValidate onSubmit={saveProfile}>
          <DialogContent dividers sx={{ py: 2 }}>
            {profileError && <Alert severity="error" onClose={() => setProfileError('')} sx={{ mb: 1.75, borderRadius: 2 }}>{profileError}</Alert>}
            <Stack direction="row" spacing={1.35} alignItems="center" sx={{ mb: 2 }}><Avatar src={profile.avatar || undefined} alt={(profile.name || 'Account') + ' profile photo'} sx={{ width: 62, height: 62, bgcolor: 'primary.main', fontSize: 22 }}>{profile.name?.[0] || user?.name?.[0]}</Avatar><Box><Button component="label" size="small" variant="outlined" startIcon={<PhotoCameraRounded />} disabled={uploadingAvatar}>{uploadingAvatar ? 'Uploading…' : 'Change photo'}<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; void chooseAvatar(file); }} /></Button><Typography color="text.secondary" sx={{ mt: .5, fontSize: 10.5 }}>JPG, PNG, WebP or GIF · maximum 8 MB</Typography></Box></Stack>
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

      <ProfessionalDialog open={kycInfoOpen} onClose={() => setKycInfoOpen(false)} fullWidth maxWidth="xs" enableMinimize={false} enableMaximize={false} professionalTitle="KYC status" professionalSubtitle="Compliance information for this account." PaperProps={{ sx: { borderRadius: 3 } }}><DialogContent><Stack spacing={1.25}><Chip color={kycChipColor(user?.kycStatus)} icon={<VerifiedUserRounded />} label={displayStatus(user?.kycStatus)} sx={{ alignSelf: 'flex-start' }} /><Typography color="text.secondary" fontSize={13}>KYC submission is available to tenant accounts. This {accountRole} workspace currently keeps its compliance status managed by the platform.</Typography></Stack></DialogContent><DialogActions><Button onClick={() => setKycInfoOpen(false)}>Close</Button></DialogActions></ProfessionalDialog>
    </Box>;
  }

  if (module === 'reports') return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5 }}><Typography variant="h4" sx={{ fontWeight: 900 }}>Reports & Analytics</Typography><Typography color="text.secondary" sx={{ mt: .5, mb: 3 }}>Download live, permission-scoped MongoDB records as CSV, Excel or PDF.</Typography><Grid container spacing={2}>{reportModules.map((report: any) => <Grid size={{ xs: 12, sm: 6, md: 4 }} key={report.key}><Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}><CardContent><Stack direction="row" justifyContent="space-between" gap={1}><Typography sx={{ fontWeight: 850 }}>{report.label || moduleLabel(report.key)}</Typography><Chip size="small" label={`${Number(report.count || 0).toLocaleString()} records`} /></Stack><Typography color="text.secondary" sx={{ fontSize: 12, my: 1.5 }}>{report.description || 'Permission-scoped MongoDB records.'}</Typography><Stack direction="row" gap={1} flexWrap="wrap">{(report.formats || ['csv','xlsx','pdf']).map((format: 'csv'|'xlsx'|'pdf') => <Button key={format} startIcon={<DownloadRounded />} variant="outlined" size="small" onClick={() => downloadReport(report.key, format).catch((e) => setNotice(e.message))}>{format === 'xlsx' ? 'Excel' : format.toUpperCase()}</Button>)}</Stack></CardContent></Card></Grid>)}</Grid>{notice && <Alert severity="error" sx={{ mt: 2 }}>{notice}</Alert>}</Box>;

  if (module === 'my-property') return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5 }}><Typography variant="h4" sx={{ fontWeight: 900, mb: 3 }}>My Property</Typography>{related.length ? related.map((tenant) => <Card key={tenant._id} elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', maxWidth: 900 }}><CardContent><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}><Box><Chip label={tenant.status} color="success" size="small" /><Typography sx={{ mt: 1.5, fontSize: 24, fontWeight: 900 }}>{tenant.property?.title || 'Assigned property'}</Typography><Typography color="text.secondary">{tenant.property?.address?.line1}, {tenant.property?.address?.city}</Typography><Typography sx={{ mt: 1, fontWeight: 700 }}>Unit {tenant.unit?.unitNumber || '—'}</Typography></Box><Box><Typography color="text.secondary" sx={{ fontSize: 12 }}>MOVE-IN DATE</Typography><Typography sx={{ fontWeight: 800 }}>{tenant.moveInDate ? new Date(tenant.moveInDate).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '—'}</Typography></Box></Stack></CardContent></Card>) : <Alert severity="info">No active property allocation was found.</Alert>}</Box>;

  if (module === 'saved-properties') return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5 }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2} sx={{ mb: 3 }}><Box><Typography variant="h4" sx={{ fontWeight: 900 }}>Saved Properties</Typography><Typography color="text.secondary">Shortlisted public listings for rent, lease, and purchase review.</Typography></Box><Button variant="contained" href="/marketplace">Browse Properties</Button></Stack><Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, border: '1px solid', borderColor: 'divider', maxWidth: 920 }}><Stack spacing={1.5}><Chip label="Tenant workspace" sx={{ alignSelf: 'flex-start' }} /><Typography sx={{ fontWeight: 850, fontSize: 20 }}>Your saved shortlist is ready for property discovery.</Typography><Typography color="text.secondary">Open the marketplace to review public rent, lease, and sale listings. Saved-list synchronisation can be connected to a dedicated shortlist collection when the tenant preference model is enabled.</Typography><Stack direction="row" gap={1} flexWrap="wrap"><Button variant="outlined" href="/marketplace?listingType=rent">Rent Properties</Button><Button variant="outlined" href="/marketplace?listingType=lease">Lease Properties</Button><Button variant="outlined" href="/marketplace?listingType=sale">Sale Properties</Button></Stack></Stack></Paper></Box>;

  return <Box sx={{ px: 4, py: 6 }}><Alert severity="info">{moduleLabel(module)} is not available for this account or has not been enabled by an administrator.</Alert></Box>;
}
