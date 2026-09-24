import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  variant?: 'navigation' | 'plain';
  premium?: boolean;
};

/** Shared, low-noise page heading for authenticated workspace routes. */
export default function PageHeader({ title, description, eyebrow = 'Workspace', actions, meta, variant = 'navigation', premium = false }: PageHeaderProps) {
  const plain = variant === 'plain';
  const titleColor = premium ? '#FFFFFF' : plain ? 'var(--sa-text-primary)' : 'var(--sa-navigation)';

  return (
    <Box
      className="sa-page-header"
      data-secureasset-premium-header={premium ? 'dashboard-v1' : undefined}
      sx={{
        p: premium ? { xs: 2.2, sm: 2.8, md: 3.35 } : 0,
        mb: { xs: 2.25, md: 3 }, minHeight: 0, display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden',
        border: premium ? '1px solid rgba(255,255,255,.18)' : 0,
        borderRadius: premium ? { xs: 4, md: 5 } : 0,
        boxShadow: premium ? '0 22px 48px rgba(7,63,86,.19)' : 'none',
        background: plain ? 'background.paper' : 'transparent',
        backgroundImage: premium ? 'linear-gradient(125deg, #062F43 0%, #0B5270 52%, #237A5B 118%)' : 'none',
        color: premium ? '#FFFFFF' : 'text.primary',
        '&::before': premium ? { content: '""', position: 'absolute', width: 300, height: 300, right: -95, top: -170, borderRadius: '50%', background: 'rgba(255,255,255,.10)', pointerEvents: 'none' } : undefined,
        '&::after': premium ? { content: '""', position: 'absolute', width: 180, height: 180, right: 150, bottom: -145, borderRadius: '50%', border: '1px solid rgba(255,255,255,.12)', pointerEvents: 'none' } : undefined,
        '& .sa-page-kicker': premium ? { color: 'rgba(255,255,255,.72)' } : undefined,
        '& .MuiChip-root.MuiChip-outlined': premium ? { color: '#FFFFFF', borderColor: 'rgba(255,255,255,.34)' } : undefined,
        '& .MuiButton-root': premium ? { position: 'relative', zIndex: 1 } : undefined,
        '& .MuiButton-outlined': premium ? { color: '#FFFFFF', borderColor: 'rgba(255,255,255,.42)', '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,.10)' } } : undefined,
        '& .MuiButton-contained': premium ? { color: '#073F56', bgcolor: '#FFFFFF', '&:hover': { bgcolor: '#EAF5F4' } } : undefined,
        '& .sa-light-button.MuiButton-contained': { color: 'var(--sa-navigation)', bgcolor: '#fff', border: '1px solid rgba(11,82,112,.18)', '&:hover': { bgcolor: '#F4FAFC' } },
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" gap={{ xs: 1.6, md: 3 }} sx={{ width: '100%' }}>
        <Box sx={{ minWidth: 0, position: 'relative', zIndex: 1 }}>
          {eyebrow && <Typography className="sa-page-kicker" sx={{ mb: .7 }}>{eyebrow}</Typography>}
          <Typography component="h1" variant="h1" sx={{ color: titleColor, fontSize: { xs: 27, sm: 32, lg: 38 }, maxWidth: 900 }}>{title}</Typography>
          {description && <Typography color={premium ? 'inherit' : 'text.secondary'} sx={{ mt: .7, maxWidth: 760, fontSize: { xs: 14, sm: 15 }, lineHeight: 1.6, opacity: premium ? .82 : 1 }}>{description}</Typography>}
          {meta && <Box sx={{ mt: 1.2 }}>{meta}</Box>}
        </Box>
        {actions && <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0, alignItems: 'center', width: { xs: '100%', md: 'auto' }, '& .MuiButton-root': { flex: { xs: '1 1 150px', md: '0 0 auto' } } }}>{actions}</Stack>}
      </Stack>
    </Box>
  );
}
