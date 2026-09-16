import { Area, AreaChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Box, Chip, Grid, Paper, Stack, Typography } from '@mui/material';
import type { DashboardOverview } from '../../services/types';

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const sentence = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function DashboardCharts({ data }: { data: DashboardOverview }) {
  return <Grid container spacing={2} sx={{ mt: .1 }}>
    <Grid size={{ xs: 12, lg: 7 }}>
      <Paper className="sa-surface-card" elevation={0} sx={{ p: { xs: 2, md: 2.5 }, height: { lg: 390 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Box><Typography variant="h6">Collection trend</Typography><Typography color="text.secondary" sx={{ mt: .35, fontSize: 12 }}>Last six months of activity</Typography></Box>
          <Chip size="small" label={`${data.occupancyRate || 0}% occupancy`} variant="outlined" />
        </Stack>
        <ResponsiveContainer width="100%" height={285}>
          <AreaChart data={data.revenueTrend || []}>
            <defs><linearGradient id="saRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#073F56" stopOpacity={0.28} /><stop offset="95%" stopColor="#073F56" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.09} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={11} />
            <YAxis axisLine={false} tickLine={false} fontSize={11} tickFormatter={(value) => `${Math.round(value / 1000)}K`} />
            <Tooltip formatter={(value: number) => money(value)} />
            <Area type="monotone" dataKey="amount" stroke="#073F56" fill="url(#saRevenue)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </Paper>
    </Grid>
    <Grid size={{ xs: 12, lg: 5 }}>
      <Paper className="sa-surface-card" elevation={0} sx={{ p: { xs: 2, md: 2.5 }, height: { lg: 390 } }}>
        <Typography variant="h6">Workload mix</Typography>
        <Typography color="text.secondary" sx={{ mt: .35, fontSize: 12 }}>Current survey status at a glance</Typography>
        <ResponsiveContainer width="100%" height={215}>
          <PieChart><Pie data={data.surveyStatus?.length ? data.surveyStatus : [{ name: 'No surveys', value: 1 }]} dataKey="value" nameKey="name" innerRadius={53} outerRadius={78} paddingAngle={4} fill="#E46F4F" opacity={0.86} /><Tooltip formatter={(value: number, name: string) => [value, sentence(name)]} /></PieChart>
        </ResponsiveContainer>
        <Stack spacing={.9}>{(data.surveyStatus || []).slice(0, 4).map((item) => <Stack key={item.name} direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: 12 }}>{sentence(item.name)}</Typography><Typography sx={{ fontSize: 12, fontWeight: 820 }}>{item.value}</Typography></Stack>)}</Stack>
      </Paper>
    </Grid>
  </Grid>;
}
