import type { ReactNode } from 'react';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import SupportAgentRounded from '@mui/icons-material/SupportAgentRounded';
import { Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import { useSite } from '../../context/SiteContext';

type AuthExperienceProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

const defaultFeatures = [
  'Verified access for every role',
  'Private records and payment history',
  'Clear activity and audit trails',
];

/**
 * The public header and footer are supplied by FrontLayout. This component
 * gives every account journey the same polished, brand-led centre section
 * without turning an authentication form into an isolated software screen.
 */
export default function AuthExperience({ eyebrow, title, description, children }: AuthExperienceProps) {
  const { data } = useSite();
  const settings = data.settings || {};
  const design = settings.design || {};
  const navigation = design.colors?.navigation || '#0B5270';
  const navigationText = design.colors?.navigationText || '#FFFFFF';
  const surface = design.colors?.paper || '#FFFFFF';
  const icon = design.colors?.icon || '#0B5270';
  const authentication = settings.authentication || {};
  const features = Array.isArray(authentication.features) && authentication.features.length
    ? authentication.features.slice(0, 4)
    : defaultFeatures;
  const supportEmail = settings.contact?.email || settings.contact?.supportEmail;

  return (
    <Box
      component="section"
      className="sa-auth-experience"
      sx={{
        flex: 1,
        width: '100%',
        minWidth: 0,
        display: 'flex',
        alignItems: 'stretch',
        minHeight: { xs: 'calc(100dvh - 132px)', md: 'calc(100dvh - 72px)' },
        py: 0,
        px: 0,
        bgcolor: surface,
      }}
    >
      <Box sx={{ width: '100%', minWidth: 0, maxWidth: 'none' }}>
        <Paper
          elevation={0}
          className="sa-auth-surface"
          sx={{
            width: '100%',
            minHeight: '100%',
            overflow: 'hidden',
            border: 0,
            borderRadius: 0,
            boxShadow: 'none',
          }}
        >
          <Box sx={{ display: 'grid', minHeight: '100%', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, .94fr) minmax(440px, 1.06fr)' } }}>
            <Box
              sx={{
                position: 'relative',
                overflow: 'hidden',
                bgcolor: navigation,
                color: navigationText,
                p: { xs: 3.25, sm: 4.5, md: 6 },
                minHeight: { md: 610 },
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ position: 'absolute', width: 310, height: 310, right: -145, top: -155, border: '1px solid rgba(255,255,255,.18)', borderRadius: '50%' }} />
              <Box sx={{ position: 'absolute', width: 220, height: 220, right: -62, top: -58, border: '1px solid rgba(255,255,255,.12)', borderRadius: '50%' }} />
              <Box sx={{ position: 'absolute', width: 220, height: 220, left: -135, bottom: -145, bgcolor: 'rgba(102,117,45,.32)', transform: 'rotate(28deg)' }} />

              <Stack spacing={2.1} sx={{ position: 'relative', zIndex: 1 }}>
                <Chip
                  label={eyebrow}
                  sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(255,255,255,.13)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,.2)', fontWeight: 850 }}
                />
                <Box>
                  <Typography sx={{ maxWidth: 480, fontSize: { xs: '2rem', md: '2.75rem' }, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-.055em' }}>
                    {title}
                  </Typography>
                  <Typography sx={{ maxWidth: 460, mt: 2, color: 'rgba(255,255,255,.76)', fontSize: { xs: 14, md: 15 }, lineHeight: 1.78 }}>
                    {description}
                  </Typography>
                </Box>
              </Stack>

              <Stack spacing={1.5} sx={{ position: 'relative', zIndex: 1, mt: { xs: 4, md: 'auto' }, mb: { md: 4 } }}>
                {features.map((feature: string) => (
                  <Stack direction="row" spacing={1.25} alignItems="center" key={feature}>
                    <CheckCircleRounded sx={{ color: '#C6D77A', fontSize: 19 }} />
                    <Typography sx={{ color: 'rgba(255,255,255,.86)', fontSize: 13.5, fontWeight: 650 }}>{feature}</Typography>
                  </Stack>
                ))}
              </Stack>

              <Box sx={{ position: 'relative', zIndex: 1, pt: 2.5, borderTop: '1px solid rgba(255,255,255,.16)' }}>
                <Stack direction="row" spacing={1.2} alignItems="flex-start">
                  <LockRounded sx={{ fontSize: 19, color: '#C6D77A', mt: .15 }} />
                  <Box>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 850 }}>Secure by design</Typography>
                    <Typography sx={{ mt: .35, color: 'rgba(255,255,255,.63)', fontSize: 11.5, lineHeight: 1.55 }}>
                      Your access is protected with role controls, verified mobile OTP and complete activity records.
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Box>

            <Box sx={{ bgcolor: surface, p: { xs: 3, sm: 4.5, md: 6 }, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {children}
              <Divider sx={{ mt: 3.5, mb: 2.25 }} />
              <Stack direction="row" spacing={1} alignItems="center">
                <SupportAgentRounded sx={{ color: icon, fontSize: 19 }} />
                <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>
                  Need help accessing your account?{supportEmail ? ` Contact ${supportEmail}.` : ' Contact your property administrator.'}
                </Typography>
              </Stack>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
