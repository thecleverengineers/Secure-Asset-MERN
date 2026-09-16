import { Box, Skeleton, Stack } from '@mui/material';

export function DashboardSkeleton() {
  return (
    <Box aria-label="Loading dashboard" role="status" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 6 }}>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Skeleton variant="text" width={150} height={20} />
        <Skeleton variant="text" width="min(460px, 80%)" height={48} />
        <Skeleton variant="text" width="min(620px, 92%)" height={22} />
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 1.7 }}>
        {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} variant="rounded" height={112} sx={{ borderRadius: 3 }} />)}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)', gap: 2, mt: 2 }}>
        <Skeleton variant="rounded" height={390} sx={{ borderRadius: 3 }} />
        <Skeleton variant="rounded" height={390} sx={{ borderRadius: 3 }} />
      </Box>
    </Box>
  );
}

export function ChartSkeleton() {
  return <Skeleton aria-label="Loading chart" role="status" variant="rounded" height={390} sx={{ borderRadius: 3 }} />;
}

export function WorkspaceSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Box aria-label="Loading workspace" role="status" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 6 }}>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Skeleton variant="text" width={140} height={20} />
        <Skeleton variant="text" width="min(520px, 86%)" height={42} />
        <Skeleton variant="text" width="min(700px, 94%)" height={20} />
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1.5 }}>
        {Array.from({ length: rows }, (_, index) => <Skeleton key={index} variant="rounded" height={128} sx={{ borderRadius: 3 }} />)}
      </Box>
    </Box>
  );
}
