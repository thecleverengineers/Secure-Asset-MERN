import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  variant?: 'navigation' | 'plain';
};

/** Shared, low-noise page heading for authenticated workspace routes. */
export default function PageHeader({ title, description, eyebrow = 'Workspace', actions, meta, variant = 'navigation' }: PageHeaderProps) {
  const titleColor = variant === 'plain' ? 'var(--sa-text-primary)' : '#102A43';

  return (
    <Box className="sa-page-header" sx={{ p: 0, mb: { xs: 2.25, md: 3 }, minHeight: 0, display: 'flex', alignItems: 'center', border: 0, borderRadius: 0, boxShadow: 'none', bgcolor: 'transparent', color: 'text.primary' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" gap={{ xs: 1.6, md: 3 }} sx={{ width: '100%' }}>
        <Box sx={{ minWidth: 0 }}>
          {eyebrow && <Typography className="sa-page-kicker" sx={{ mb: .7 }}>{eyebrow}</Typography>}
          <Typography component="h1" variant="h1" sx={{ color: titleColor, fontSize: { xs: 27, sm: 32, lg: 38 }, maxWidth: 900 }}>{title}</Typography>
          {description && <Typography color="text.secondary" sx={{ mt: .7, maxWidth: 760, fontSize: { xs: 14, sm: 15 }, lineHeight: 1.6 }}>{description}</Typography>}
          {meta && <Box sx={{ mt: 1.2 }}>{meta}</Box>}
        </Box>
        {actions && <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0, alignItems: 'center', width: { xs: '100%', md: 'auto' }, '& .MuiButton-root': { flex: { xs: '1 1 150px', md: '0 0 auto' } } }}>{actions}</Stack>}
      </Stack>
    </Box>
  );
}
