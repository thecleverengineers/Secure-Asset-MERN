import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, Grid, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import EngineeringRounded from '@mui/icons-material/EngineeringRounded';
import ExploreRounded from '@mui/icons-material/ExploreRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import RequestQuoteRounded from '@mui/icons-material/RequestQuoteRounded';
import { useNavigate } from 'react-router';
import { getSurveyorDashboard, getSurveyorProposals, getSurveyWorkflowProjects } from '../../services/api';
import { safeRecord, safeRecordArray } from '../../utils/runtimeData';
import { WorkspaceSkeleton } from '../../components/shared/PremiumSkeleton';

const label = (value: unknown) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
function Kpi({ title, value, icon: Icon, path }: any) {
  const navigate = useNavigate();
  return <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 4 }}><CardActionArea onClick={() => navigate(path)} sx={{ height: '100%' }}><CardContent><Stack direction="row" justifyContent="space-between" spacing={1}><Box><Typography color="text.secondary" sx={{ fontSize: 12, fontWeight: 800 }}>{title}</Typography><Typography sx={{ fontWeight: 950, fontSize: 28, mt: .4 }}>{value}</Typography></Box><Box sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center' }}><Icon /></Box></Stack></CardContent></CardActionArea></Card>;
}

export default function SurveyorDashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>();
  const [proposals, setProposals] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([getSurveyorDashboard(), getSurveyorProposals({ limit: 100 }), getSurveyWorkflowProjects({ limit: 100 })])
      .then(([dashboard, proposalRows, projectRows]) => {
        setData(safeRecord(dashboard?.data));
        setProposals(safeRecordArray(proposalRows?.data));
        setProjects(safeRecordArray(projectRows?.data));
      })
      .catch((reason) => setError((reason as Error).message)).finally(() => setLoading(false));
  }, []);
  if (loading) return <WorkspaceSkeleton rows={4} />;
  const activeProjects = projects.filter((item) => !['completed', 'cancelled'].includes(item.workflowStage));
  const submitted = proposals.filter((item) => ['submitted', 'viewed', 'under_negotiation', 'revised'].includes(item.status)).length;
  const hired = proposals.filter((item) => item.status === 'accepted').length;
  const completed = projects.filter((item) => item.workflowStage === 'completed').length;
  const usage = data?.usage || {};
  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 7 }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}><Box><Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: '-.04em' }}>Surveyor Workspace</Typography><Typography color="text.secondary">Your focused workflow for proposals, secure fieldwork, evidence, reports, and completion.</Typography></Box><Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => navigate('/app/survey-quotations')}>My proposals</Button><Button variant="contained" startIcon={<ExploreRounded />} onClick={() => navigate('/app/survey-job-marketplace')}>Find jobs</Button></Stack></Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Paper elevation={0} sx={{ p: 2.5, mb: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}><Box><Stack direction="row" spacing={1} alignItems="center"><Typography sx={{ fontWeight: 900 }}>{data?.subscription?.plan?.name || data?.subscription?.planKey || 'Surveyor plan'}</Typography><Chip size="small" color="success" label={label(data?.subscription?.status || 'active')} /></Stack><Typography color="text.secondary" sx={{ fontSize: 12, mt: .5 }}>Expires {data?.subscription?.expiresAt ? new Date(data.subscription.expiresAt).toLocaleDateString('en-IN') : '—'} · Subscription management is available from your profile menu.</Typography></Box><Button variant="outlined" onClick={() => navigate('/app/surveyor-profile')}>Professional profile</Button></Stack>
      <Grid container spacing={2} sx={{ mt: 1 }}>{[['jobs', 'jobsPerMonth'], ['quotations', 'quotationsPerMonth'], ['reports', 'reportsPerMonth']].map(([key, limitKey]) => { const limit = Number(usage.limits?.[limitKey] || 0); const used = Number(usage.used?.[key] || 0); return <Grid size={{ xs: 12, sm: 4 }} key={key}><Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 12, fontWeight: 750 }}>{label(key)}</Typography><Typography color="text.secondary" sx={{ fontSize: 11 }}>{limit < 0 ? 'Unlimited' : `${used}/${limit}`}</Typography></Stack><LinearProgress variant="determinate" value={limit < 0 ? 0 : Math.min(100, limit ? used / limit * 100 : 100)} sx={{ mt: .7, height: 6, borderRadius: 99 }} /></Grid>; })}</Grid>
    </Paper>
    <Grid container spacing={2}>{[
      ['Proposals waiting', submitted, RequestQuoteRounded, '/app/survey-quotations'], ['Hired proposals', hired, CheckCircleRounded, '/app/survey-quotations'],
      ['Active projects', activeProjects.length, EngineeringRounded, '/app/survey-projects'], ['Completed surveys', completed, FactCheckRounded, '/app/survey-projects'],
    ].map(([title, value, Icon, path]: any) => <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={title}><Kpi title={title} value={value} icon={Icon} path={path} /></Grid>)}</Grid>
    <Paper elevation={0} sx={{ p: { xs: 2, md: 2.8 }, mt: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography sx={{ fontWeight: 950, fontSize: 18 }}>Current field projects</Typography><Typography color="text.secondary" variant="body2">Open a project to navigate, check in, accept payment, capture fieldwork, or submit a report.</Typography></Box><Button onClick={() => navigate('/app/survey-projects')}>View all</Button></Stack><Stack spacing={1} sx={{ mt: 2 }}>{activeProjects.length ? activeProjects.slice(0, 5).map((project) => <Card key={project._id} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}><CardActionArea onClick={() => navigate(`/app/survey-projects/${project._id}`)}><CardContent sx={{ py: 1.6 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Box><Typography sx={{ fontWeight: 900 }}>{project.property?.title || project.job?.title || project.projectNumber}</Typography><Typography variant="body2" color="text.secondary">{project.projectNumber} · {project.job?.addressApproximate || project.propertySite?.fullAddress || 'Property survey'}</Typography></Box><Stack direction="row" spacing={.7} flexWrap="wrap" useFlexGap sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}><Chip size="small" color="primary" label={label(project.workflowStage)} /><Chip size="small" color={project.paymentStatus === 'paid' ? 'success' : 'warning'} label={`Payment ${label(project.paymentStatus || 'unpaid')}`} /></Stack></Stack></CardContent></CardActionArea></Card>) : <Alert severity="info">You have no active survey project. Find a job and submit a proposal.</Alert>}</Stack></Paper>
  </Box>;
}
