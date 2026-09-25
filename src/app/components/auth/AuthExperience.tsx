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

export default function AuthExperience({ eyebrow, title, description, children }: AuthExperienceProps) {
  const { data } = useSite();
  const settings = data.settings || {};
  const design = settings.design || {};
  const navigation = design.colors?.navigation || '#0B5270';
  const navigationText = design.colors?.navigationText || '#FFFFFF';
  const authentication = settings.authentication || {};
  const features = Array.isArray(authentication.features) && authentication.features.length
    ? authentication.features.slice(0, 4)
    : defaultFeatures;
  const supportEmail = settings.contact?.email || settings.contact?.supportEmail;

  return (
    <Box component="section" className="sa-auth-experience sa-login-premium-shell">
      <Box className="sa-login-premium-wrap">
        <Paper elevation={0} className="sa-auth-surface sa-login-premium-surface">
          <Box className="sa-login-premium-grid">
            <Box
              className="sa-login-premium-brand"
              sx={{
                bgcolor: navigation,
                color: navigationText,
                backgroundImage: `radial-gradient(circle at 88% 10%, rgba(255,255,255,.13), transparent 19rem), linear-gradient(135deg, ${navigation} 0%, #0b6175 58%, #008f83 125%)`,
              }}
            >
              <Box className="sa-login-orbit sa-login-orbit-one" />
              <Box className="sa-login-orbit sa-login-orbit-two" />
              <Stack className="sa-login-brand-copy" spacing={2}>
                <Chip className="sa-login-eyebrow" label={eyebrow} />
                <Box>
                  <Typography className="sa-login-brand-title">{title}</Typography>
                  <Typography className="sa-login-brand-description">{description}</Typography>
                </Box>
              </Stack>

              <Stack className="sa-login-feature-list" spacing={1.25}>
                {features.map((feature: string) => (
                  <Stack direction="row" spacing={1.1} alignItems="center" key={feature}>
                    <Box className="sa-login-feature-icon"><CheckCircleRounded /></Box>
                    <Typography>{feature}</Typography>
                  </Stack>
                ))}
              </Stack>

              <Box className="sa-login-security-note">
                <Stack direction="row" spacing={1.1} alignItems="flex-start">
                  <Box className="sa-login-security-icon"><LockRounded /></Box>
                  <Box>
                    <Typography className="sa-login-security-title">Secure by design</Typography>
                    <Typography className="sa-login-security-copy">
                      Role controls, verified mobile access and protected activity records help keep every account workflow private.
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Box>

            <Box className="sa-login-premium-form-column">
              <Box className="sa-login-premium-card">
                {children}
                <Divider className="sa-login-support-divider" />
                <Stack className="sa-login-support" direction="row" spacing={1} alignItems="center">
                  <SupportAgentRounded />
                  <Typography>
                    Need help accessing your account?{supportEmail ? ` Contact ${supportEmail}.` : ' Contact your property administrator.'}
                  </Typography>
                </Stack>
              </Box>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
