import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import AnalyticsRounded from '@mui/icons-material/AnalyticsRounded';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { LogoMark } from '../premium/LogoMark';
import { useSite } from '../../context/SiteContext';
import '../../../styles/login-premium.css';

type AuthExperienceProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export default function AuthExperience({ eyebrow, title, description, children }: AuthExperienceProps) {
  const { data } = useSite();
  const location = useLocation();
  const formColumnRef = useRef<HTMLDivElement | null>(null);
  const settings = data.settings || {};
  const supportEmail = settings.contact?.email || settings.contact?.supportEmail;
  const titleParts = title.split(/(smarter)/i);

  // The desktop auth column is deliberately scrollable for shorter viewports.
  // React keeps that element mounted while its route content changes, so reset
  // its offset before paint to keep a mode switch from visibly jumping upward.
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
        <Box className="sa-auth-hero">
          <Box className="sa-auth-hero-overlay" />
          <Box className="sa-auth-sky-glow" />
          <Box className="sa-auth-building" aria-hidden="true">
            <Box className="sa-auth-building-edge" />
            <Box className="sa-auth-balcony sa-auth-balcony-one" />
            <Box className="sa-auth-balcony sa-auth-balcony-two" />
            <Box className="sa-auth-balcony sa-auth-balcony-three" />
            <Box className="sa-auth-window-grid">
              {Array.from({ length: 18 }).map((_, index) => <Box key={index} className="sa-auth-window" />)}
            </Box>
          </Box>
          <Box className="sa-auth-skyline" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => <Box key={index} className={`sa-auth-skyline-building sa-auth-skyline-building-${(index % 6) + 1}`} />)}
          </Box>

          <Box className="sa-auth-hero-content">
            <Box className="sa-auth-hero-logo"><LogoMark light /></Box>
            <Typography className="sa-auth-eyebrow">{eyebrow}</Typography>
            <Typography component="h1" className="sa-login-brand-title">
              {titleParts.map((part, index) => part.toLowerCase() === 'smarter'
                ? <Box key={`${part}-${index}`} component="span" className="sa-auth-title-accent">{part}</Box>
                : <Box key={`${part}-${index}`} component="span">{part}</Box>)}
            </Typography>
            <Typography className="sa-login-brand-description">{description}</Typography>

            <Stack className="sa-auth-feature-row" direction="row">
              <Box className="sa-auth-feature">
                <VerifiedUserRounded />
                <Box><Typography>Secure</Typography><Typography>Assets</Typography></Box>
              </Box>
              <Box className="sa-auth-feature">
                <ApartmentRounded />
                <Box><Typography>Simpler</Typography><Typography>Management</Typography></Box>
              </Box>
              <Box className="sa-auth-feature">
                <GroupsRounded />
                <Box><Typography>Trusted</Typography><Typography>Professionals</Typography></Box>
              </Box>
            </Stack>
          </Box>

          <Box className="sa-auth-floating-card sa-auth-records-card" aria-hidden="true">
            <Typography className="sa-auth-floating-title">Property Records</Typography>
            <Stack spacing={1.05}>
              {['Title & ownership', 'Compliance documents', 'Inspection reports', 'Tenancy agreements'].map((item) => (
                <Stack key={item} direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <Stack direction="row" alignItems="center" gap={.8}><DescriptionRounded /><Typography>{item}</Typography></Stack>
                  <VerifiedUserRounded className="sa-auth-floating-check" />
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box className="sa-auth-shield-orb" aria-hidden="true"><VerifiedUserRounded /></Box>

          <Box className="sa-auth-floating-card sa-auth-vault-card" aria-hidden="true">
            <Stack direction="row" alignItems="center" gap={1}>
              <LockRounded />
              <Typography className="sa-auth-floating-title">Document Vault</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" className="sa-auth-vault-items">
              <Box><DescriptionRounded /><Typography>Contracts</Typography></Box>
              <Box><DescriptionRounded /><Typography>Certificates</Typography></Box>
              <Box><DescriptionRounded /><Typography>Reports</Typography></Box>
              <Box><DescriptionRounded /><Typography>Plans</Typography></Box>
            </Stack>
          </Box>

          <Box className="sa-auth-metrics">
            <Box><ApartmentRounded /><Typography component="strong">50K+</Typography><Typography>Properties managed</Typography></Box>
            <Divider orientation="vertical" flexItem />
            <Box><GroupsRounded /><Typography component="strong">100K+</Typography><Typography>Trusted users</Typography></Box>
            <Divider orientation="vertical" flexItem />
            <Box><AnalyticsRounded /><Typography component="strong">99.9%</Typography><Typography>Platform uptime</Typography></Box>
          </Box>
        </Box>

        <Box ref={formColumnRef} className="sa-login-premium-form-column">
          <Box className="sa-login-premium-card">
            {children}
            <Box className="sa-auth-protection-note">
              <VerifiedUserRounded />
              <Box>
                <Typography className="sa-auth-protection-title">Protected access for your assets</Typography>
                <Typography className="sa-auth-protection-copy">Secure for landlords, tenants, surveyors and administrators.</Typography>
              </Box>
            </Box>
            {supportEmail && <Typography className="sa-auth-support-copy">Need help? Contact {supportEmail}</Typography>}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
