import { useLayoutEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import ArrowOutwardRounded from '@mui/icons-material/ArrowOutwardRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import ShieldRounded from '@mui/icons-material/ShieldRounded';
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded';
import { Box, Stack, Typography } from '@mui/material';
import { LogoMark } from '../premium/LogoMark';
import { useSite } from '../../context/SiteContext';
import '../../../styles/login-premium.css';

const accessRoutes = [
  { to: '/auth/login', label: 'Login', paths: ['/auth/login'] },
  { to: '/auth/register', label: 'Register', paths: ['/auth/register'] },
  { to: '/auth/otp-login', label: 'OTP login', paths: ['/auth/otp-login', '/auth/otp_login', '/auth/verify-otp'] },
];

/** A persistent frame for every public-auth route. */
export default function AuthLayout() {
  const { data } = useSite();
  const location = useLocation();
  const formColumnRef = useRef<HTMLDivElement | null>(null);
  const settings = data.settings || {};
  const supportEmail = settings.contact?.email || settings.contact?.supportEmail;

  useLayoutEffect(() => {
    const column = formColumnRef.current;
    if (!column) return;
    column.scrollTop = 0;
    const frame = window.requestAnimationFrame(() => { column.scrollTop = 0; });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  return (
    <Box component="section" className="sa-auth-experience sa-login-premium-shell">
      <Box className="sa-auth-desktop-frame">
        <Box component="aside" className="sa-auth-hero" aria-label="Secure Asset">
          <Box className="sa-auth-hero-orb sa-auth-hero-orb-one" aria-hidden="true" />
          <Box className="sa-auth-hero-orb sa-auth-hero-orb-two" aria-hidden="true" />
          <Box className="sa-auth-hero-grid" aria-hidden="true" />
          <Box className="sa-auth-hero-content">
            <Box className="sa-auth-hero-logo"><LogoMark light /></Box>
            <Typography className="sa-auth-eyebrow">Secure asset platform</Typography>
            <Typography component="h1" className="sa-login-brand-title">Your assets, protected from every angle.</Typography>
            <Typography className="sa-login-brand-description">Property operations, documents and people move together in one trusted workspace.</Typography>
            <Stack className="sa-auth-trust-list" spacing={1.1}>
              {['Role-based access for every workspace', 'Encrypted property and tenancy records', 'Auditable actions at every step'].map((item) => (
                <Stack key={item} direction="row" alignItems="center" gap={1.1}><CheckCircleRounded /><Typography>{item}</Typography></Stack>
              ))}
            </Stack>
          </Box>
          <Box className="sa-auth-hero-product-card" aria-hidden="true">
            <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography>Secure Asset</Typography><ShieldRounded /></Stack>
            <Box className="sa-auth-hero-product-line"><span /><span /><span /></Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography>Protected workspace</Typography><VerifiedUserRounded /></Stack>
          </Box>
          <Box className="sa-auth-hero-proof" aria-hidden="true"><LockRounded /><Typography>Private by design</Typography></Box>
        </Box>

        <Box ref={formColumnRef} className="sa-login-premium-form-column">
          <Box className="sa-login-premium-card">
            <Box className="sa-auth-mobile-logo"><LogoMark /></Box>
            <Box className="sa-auth-route-stage"><Outlet /></Box>
            <Box component="nav" aria-label="Authentication options" className="sa-auth-mode-nav sa-login-mode-nav">
              <Stack direction="row" spacing={1} justifyContent="center" useFlexGap flexWrap="wrap">
                {accessRoutes.map((item) => {
                  const selected = item.paths.includes(location.pathname);
                  return <Box key={item.to} component={Link} to={item.to} aria-current={selected ? 'page' : undefined} className={selected ? 'sa-login-mode-link is-active' : 'sa-login-mode-link'}>{item.label}</Box>;
                })}
              </Stack>
            </Box>
            <Box className="sa-auth-protection-note">
              <VerifiedUserRounded />
              <Box>
                <Typography className="sa-auth-protection-title">Protected access for your assets</Typography>
                <Typography className="sa-auth-protection-copy">Designed for landlords, tenants, surveyors and administrators.</Typography>
              </Box>
              <ArrowOutwardRounded className="sa-auth-protection-arrow" aria-hidden="true" />
            </Box>
            {supportEmail && <Typography className="sa-auth-support-copy">Need help? Contact {supportEmail}</Typography>}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
