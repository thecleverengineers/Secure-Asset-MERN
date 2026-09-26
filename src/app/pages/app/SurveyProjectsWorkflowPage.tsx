import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardActionArea, CardContent, Checkbox, Chip, CircularProgress, DialogActions, DialogContent,
  Divider, FormControlLabel, Grid, IconButton, LinearProgress, Menu, MenuItem, Paper, Stack, Step, StepLabel, Stepper, TextField, Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import CameraAltRounded from '@mui/icons-material/CameraAltRounded';
import ChatRounded from '@mui/icons-material/ChatRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CloudUploadRounded from '@mui/icons-material/CloudUploadRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import MapRounded from '@mui/icons-material/MapRounded';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import NoteAddRounded from '@mui/icons-material/NoteAddRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import PaidRounded from '@mui/icons-material/PaidRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import StraightenRounded from '@mui/icons-material/StraightenRounded';
import TaskAltRounded from '@mui/icons-material/TaskAltRounded';
import UploadFileRounded from '@mui/icons-material/UploadFileRounded';
import { useNavigate, useParams } from 'react-router';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import CompactPageToolbar from '../../components/layout/CompactPageToolbar';
import SurveyProjectNavigationMap, { type SurveyProjectDestination } from '../../components/survey/SurveyProjectNavigationMap';
import { useSite } from '../../context/SiteContext';
import {
  acceptSurveyMilestone, acceptSurveyWorkflowPayment, approveSurveyWorkflowReport, attachSurveyWorkflowEvidence, attachSurveyWorkflowReportFile,
  checkInSurveyWorkflowProject, checkOutSurveyWorkflowProject,
  createConversation, downloadSurveyReport, downloadSurveyWorkflowEvidence, fetchSurveyWorkflowEvidence,
  downloadSurveyWorkflowReportFile, getSurveyWorkflowProject, getSurveyWorkflowProjects, removeSurveyWorkflowEvidence,
  fetchSurveyWorkflowPaymentProof, requestSurveyWorkflowRevision, reviewSurveyWorkflowFieldwork, saveSurveyWorkflowFieldwork,
  rejectSurveyWorkflowFinalPayment, submitSurveyWorkflowFieldwork, submitSurveyWorkflowFinalPayment, submitSurveyWorkflowMilestonePayment,
  updateSurveyMilestone, uploadDocument,
} from '../../services/api';

const stages = [
  ['posted', 'Posted'], ['applications', 'Applications'], ['hired', 'Hired'], ['in_progress', 'In progress'],
  ['submitted', 'Submitted'], ['approved', 'Approved'], ['completed', 'Completed'],
] as const;
const stageIndex = (value: string) => Math.max(0, stages.findIndex(([key]) => key === value));
const surveyJourneySteps = [
  { title: 'Field data & evidence', owner: 'Surveyor' },
  { title: 'Landlord review', owner: 'Landlord' },
  { title: 'Final payment proof', owner: 'Landlord' },
  { title: 'Surveyor confirmation', owner: 'Surveyor' },
  { title: 'Final report upload', owner: 'Surveyor' },
  { title: 'Property verified', owner: 'SecureAsset' },
] as const;
const directSurveyJourneySteps = [
  { title: 'Quote accepted', owner: 'Surveyor' },
  { title: 'Two milestones agreed', owner: 'Both' },
  { title: 'Visit, measurements & evidence', owner: 'Surveyor' },
  { title: 'Milestone 1 payment', owner: 'Landlord' },
  { title: 'Survey report upload & submit', owner: 'Surveyor' },
  { title: 'Report review & approve', owner: 'Landlord' },
  { title: 'Milestone 2 payment', owner: 'Landlord' },
  { title: 'Accept payment & verify property', owner: 'Surveyor' },
] as const;
type SurveyJourneyState = { activeStep: number; status: string; owner: string; nextAction: string; waiting: string };
function surveyJourney(project: any): SurveyJourneyState {
  const status = String(project?.status || '');
  const stage = String(project?.workflowStage || 'hired');
  if (project?.workflowType === 'direct_surveyor') {
    const milestonesReady = (project?.milestones || []).length === 2 && (project.milestones || []).every((item: any) => ['accepted', 'approved', 'paid'].includes(String(item.status || '')) && Number(item.amount || 0) > 0);
    if (status === 'completed' || stage === 'completed' || project?.verificationStatus === 'fully_verified') return { activeStep: 7, status: 'Property verified', owner: 'Surveyor', nextAction: 'The second payment was accepted and the property is verified.', waiting: 'The approved report is locked as the verified survey record.' };
    if (status === 'second_payment_submitted') return { activeStep: 7, status: 'Milestone 2 proof awaiting Surveyor acceptance', owner: 'Surveyor', nextAction: 'Review the transaction ID and payment proof, then accept milestone 2 to verify the property.', waiting: 'Property verification happens immediately after the Surveyor accepts milestone 2.' };
    if (status === 'awaiting_second_payment') return { activeStep: 6, status: 'Report approved — milestone 2 payment needed', owner: 'Landlord', nextAction: 'Pay milestone 2 using the Surveyor bank details, then upload proof and enter the transaction ID.', waiting: 'The Surveyor accepts the submitted second payment to complete property verification.' };
    if (status === 'client_review') return { activeStep: 5, status: 'Survey report awaiting landlord approval', owner: 'Landlord', nextAction: 'Open the submitted report, review it, then approve it to unlock milestone 2.', waiting: 'Milestone 2 remains locked until the landlord approves the report.' };
    if (status === 'report_upload_requested') return { activeStep: 4, status: 'Milestone 1 accepted — report needed', owner: 'Surveyor', nextAction: 'Upload and submit the survey report for landlord review.', waiting: 'The landlord reviews and approves the report before milestone 2 is opened.' };
    if (status === 'first_payment_submitted') return { activeStep: 3, status: 'Milestone 1 proof awaiting Surveyor acceptance', owner: 'Surveyor', nextAction: 'Review the transaction ID and proof, then accept milestone 1.', waiting: 'Survey report upload unlocks only after milestone 1 is accepted.' };
    if (status === 'awaiting_first_payment') return { activeStep: 3, status: 'Milestone 1 payment needed', owner: 'Landlord', nextAction: 'Pay milestone 1 using the Surveyor bank details, then upload proof and enter the transaction ID.', waiting: 'The Surveyor must accept the payment before report upload.' };
    if (stage === 'in_progress' || milestonesReady) return { activeStep: 2, status: 'Visit, measurements & evidence', owner: 'Surveyor', nextAction: 'Update field data, measurements and/or evidence, then submit to open milestone 1.', waiting: 'Exact-location check-in is optional.' };
    return { activeStep: 1, status: 'Two milestones must be agreed', owner: 'Both', nextAction: 'The landlord sets both milestone amounts and the Surveyor accepts both.', waiting: 'Fieldwork starts after both milestone amounts are agreed.' };
  }
  const finalPayment = (project?.payments || []).find((item: any) => item.type === 'survey_final');
  const paymentRejected = finalPayment?.paymentVerification?.status === 'rejected';
  if (status === 'completed' || stage === 'completed' || project?.verificationStatus === 'fully_verified') return { activeStep: 5, status: 'Property verified', owner: 'SecureAsset', nextAction: 'Review or download the final report.', waiting: 'The completed survey record is available to the landlord and Surveyor.' };
  if (status === 'report_upload_requested') return { activeStep: 4, status: 'Final report upload needed', owner: 'Surveyor', nextAction: 'Upload the final signed survey report to verify the property.', waiting: 'Payment is confirmed. The final report is the only remaining requirement.' };
  if (status === 'payment_submitted') return { activeStep: 3, status: 'Payment proof awaiting receipt confirmation', owner: 'Surveyor', nextAction: 'Review the transaction ID and payment screenshot, then confirm receipt or return it with a reason.', waiting: 'The report stays locked until the Surveyor records receipt confirmation.' };
  if (status === 'awaiting_final_payment') return { activeStep: 2, status: paymentRejected ? 'Payment proof needs an update' : 'Final payment proof needed', owner: 'Landlord', nextAction: paymentRejected ? 'Correct the payment details and resubmit the transaction ID, screenshot, and declaration.' : 'Pay the final invoice, then enter the transaction ID, upload the screenshot, and declare the payment.', waiting: 'After submission, the Surveyor verifies receipt before report upload.' };
  if (status === 'awaiting_landlord_review') return { activeStep: 1, status: 'Fieldwork ready for review', owner: 'Landlord', nextAction: 'Review the measurements and evidence, then approve or request changes.', waiting: 'The Surveyor cannot change submitted fieldwork until a decision is made.' };
  if (status === 'revision_requested') return { activeStep: 0, status: 'Fieldwork changes requested', owner: 'Surveyor', nextAction: 'Update the requested measurements or evidence, then submit the fieldwork again.', waiting: 'Landlord review resumes after the corrected fieldwork is submitted.' };
  return { activeStep: 0, status: 'Field data & evidence in progress', owner: 'Surveyor', nextAction: 'Record measurements and attach evidence before submitting the fieldwork.', waiting: 'The landlord is notified only after the required field data and evidence are complete.' };
}
const label = (value: unknown) => String(value || '—').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value: unknown) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
const date = (value: unknown) => value ? new Date(String(value)).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

type FieldEditorState = {
  mode: 'new' | 'measurement' | 'note';
  measurementId: string;
  measurementIndex: number;
  noteId: string;
  noteIndex: number;
  label: string;
  value: string;
  unit: string;
  type: string;
  notes: string;
  fieldNote: string;
};
const emptyField: FieldEditorState = {
  mode: 'new', measurementId: '', measurementIndex: -1, noteId: '', noteIndex: -1,
  label: '', value: '', unit: 'metre', type: 'dimension', notes: '', fieldNote: '',
};

function projectDestination(project: any): SurveyProjectDestination {
  const candidates = [
    project?.job?.exactLocation,
    project?.propertySite,
    { latitude: project?.property?.map?.latitude, longitude: project?.property?.map?.longitude },
    Array.isArray(project?.property?.location?.coordinates)
      ? { latitude: project.property.location.coordinates[1], longitude: project.property.location.coordinates[0] }
      : null,
  ];
  for (const candidate of candidates) {
    const latitude = Number(candidate?.latitude);
    const longitude = Number(candidate?.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0)) return { latitude, longitude };
  }
  return null;
}

function gpsPosition() {
  return new Promise<{ latitude: number; longitude: number; accuracy: number }>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location services are not available on this device'));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      () => reject(new Error('Allow precise location access to use secure survey check-in')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

function EvidenceCard({ projectId, item, canDelete, onDelete }: { projectId: string; item: any; canDelete: boolean; onDelete: () => void }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const fileId = String(item.file?._id || item.file || '');
  const mime = String(item.file?.mimeType || item.mimeType || '').toLowerCase();
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (!fileId) return;
    fetchSurveyWorkflowEvidence(projectId, fileId).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setUrl(objectUrl);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [fileId, projectId]);
  const open = () => {
    if (!url) return;
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (popup) popup.opener = null;
  };
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  return <Card data-secureasset-survey-evidence-actions="three-dot-v164" elevation={0} sx={{ height: '100%', border: '1px solid #e4e9f0', borderRadius: 2, overflow: 'hidden', boxShadow: 'none' }}>
    <Box sx={{ height: { xs: 92, sm: 108 }, bgcolor: '#f2f4f7', display: 'grid', placeItems: 'center' }}>
      {!url && !failed && <CircularProgress size={26} />}
      {failed && <Stack alignItems="center" spacing={1}><DescriptionRounded color="disabled" /><Typography variant="caption" color="text.secondary">Preview unavailable</Typography></Stack>}
      {url && isImage && <Box component="img" src={url} alt={item.name || 'Survey evidence'} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {url && isVideo && <Box component="video" src={url} muted preload="metadata" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {url && !isImage && !isVideo && <Stack alignItems="center" spacing={1}><DescriptionRounded color="primary" sx={{ fontSize: 38 }} /><Typography variant="caption">Open document</Typography></Stack>}
    </Box>
    <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
      <Stack direction="row" spacing={.75} justifyContent="space-between" alignItems="flex-start"><Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ fontWeight: 600 }}>{item.name || item.file?.name || 'Survey evidence'}</Typography>
      <Typography variant="caption" color="text.secondary">{label(item.kind)} · {date(item.capturedAt || item.createdAt)}</Typography>
      </Box><IconButton size="small" aria-label="Evidence actions" aria-controls={menuAnchor ? `evidence-actions-${fileId}` : undefined} aria-haspopup="menu" aria-expanded={Boolean(menuAnchor)} onClick={(event) => setMenuAnchor(event.currentTarget)}><MoreVertRounded fontSize="small" /></IconButton></Stack>
      {item.note && <Typography variant="body2" color="text.secondary" sx={{ mt: .8 }}>{item.note}</Typography>}
      <Menu id={`evidence-actions-${fileId}`} anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem disabled={!url} onClick={() => { setMenuAnchor(null); open(); }}><OpenInNewRounded fontSize="small" /><Typography sx={{ ml: 1 }}>Preview</Typography></MenuItem>
        <MenuItem onClick={() => { setMenuAnchor(null); void downloadSurveyWorkflowEvidence(projectId, fileId, item.name || item.file?.name); }}><DownloadRounded fontSize="small" /><Typography sx={{ ml: 1 }}>Download</Typography></MenuItem>
        {canDelete && <MenuItem sx={{ color: 'error.main' }} onClick={() => { setMenuAnchor(null); onDelete(); }}><DeleteRounded fontSize="small" /><Typography sx={{ ml: 1 }}>Delete</Typography></MenuItem>}
      </Menu>
    </CardContent>
  </Card>;
}

function ProjectList({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    getSurveyWorkflowProjects({ limit: 50 }).then((response) => setProjects(response.data || []))
      .catch((reason) => setError((reason as Error).message)).finally(() => setLoading(false));
  }, []);
  if (loading) return <Box sx={{ py: 10, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 7 }}>
    <CompactPageToolbar marker="survey-projects-toolbar-v164" title="Active Survey Projects" description="Navigate, capture field evidence, complete landlord review, and securely finish each verified report." />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {!projects.length ? <Alert severity="info">No hired survey projects are connected to this account yet.</Alert> : <Grid container spacing={2}>{projects.map((project) => {
      const progress = Math.round(stageIndex(project.workflowStage) / (stages.length - 1) * 100);
      return <Grid size={{ xs: 12, md: 6 }} key={project._id}><Card elevation={0} sx={{ height: '100%', border: '1px solid rgba(15,23,42,.08)', borderColor: 'rgba(15,23,42,.08)', borderRadius: 4, boxShadow: '0 10px 30px rgba(15,23,42,.05)' }}><CardActionArea onClick={() => onOpen(project._id)} sx={{ height: '100%' }}><CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" spacing={1}><Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 700 }}>{project.projectNumber || 'Survey project'}</Typography><Typography noWrap color="text.secondary">{project.property?.title || project.job?.title || project.surveyCategory || 'Property survey'}</Typography></Box><Stack direction="row" spacing={.7} flexWrap="wrap" justifyContent="flex-end" useFlexGap><Chip size="small" color={project.workflowStage === 'completed' ? 'success' : 'primary'} label={label(project.workflowStage)} /><Chip size="small" color={project.paymentStatus === 'paid' ? 'success' : 'warning'} label={`Payment ${label(project.paymentStatus || 'unpaid')}`} /></Stack></Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>{project.property?.address?.fullAddress || project.job?.addressApproximate || project.propertySite?.fullAddress || 'Property address available inside the project'}</Typography>
        <LinearProgress variant="determinate" value={progress} sx={{ my: 2, height: 7, borderRadius: 99 }} />
        <Grid container spacing={1.5}><Grid size={6}><Typography variant="caption" color="text.secondary">PROJECT VALUE</Typography><Typography sx={{ fontWeight: 600 }}>{money(project.paymentSummary?.total)}</Typography></Grid><Grid size={6}><Typography variant="caption" color="text.secondary">EVIDENCE</Typography><Typography sx={{ fontWeight: 600 }}>{project.evidenceCount || project.evidence?.length || 0} files</Typography></Grid></Grid>
        <Button endIcon={<OpenInNewRounded />} sx={{ mt: 1.5, px: 0 }}>Open project workspace</Button>
      </CardContent></CardActionArea></Card></Grid>;
    })}</Grid>}
  </Box>;
}

export default function SurveyProjectsWorkflowPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: siteData } = useSite();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldOpen, setFieldOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [finalPaymentOpen, setFinalPaymentOpen] = useState(false);
  const [paymentConfirmationOpen, setPaymentConfirmationOpen] = useState(false);
  const [paymentRejectionOpen, setPaymentRejectionOpen] = useState(false);
  const [finalPayment, setFinalPayment] = useState({ transactionId: '', method: 'upi' as 'upi' | 'bank_transfer' | 'offline', proof: null as File | null, payerDeclaration: false });
  const [field, setField] = useState<FieldEditorState>({ ...emptyField });
  const [reviewChecklist, setReviewChecklist] = useState({ measurementsReviewed: false, evidenceReviewed: false, scopeReviewed: false });
  const [reviewComment, setReviewComment] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [paymentConfirmation, setPaymentConfirmation] = useState({ receiptConfirmed: false, confirmationNote: '' });
  const [paymentRejectionReason, setPaymentRejectionReason] = useState('');
  const [milestoneDrafts, setMilestoneDrafts] = useState<Record<string, { title: string; description: string; amount: string }>>({});
  const [milestonePayment, setMilestonePayment] = useState<{ milestone: any; transactionId: string; method: 'upi' | 'bank_transfer' | 'offline'; proof: File | null; payerDeclaration: boolean } | null>(null);
  const currentStage = String(project?.workflowStage || 'hired');
  const surveyorCanEdit = Boolean(project?.permissions?.surveyor && (currentStage === 'hired' || currentStage === 'in_progress' || (currentStage === 'submitted' && project?.status === 'revision_requested')));
  const hasAnyFieldData = Boolean(
    project?.fieldData?.measurements?.length
    || project?.fieldData?.fieldNotes?.length
    || project?.fieldData?.observations?.notes?.length
    || project?.fieldData?.gpsCoordinates?.length
    || project?.fieldData?.boundaryPoints?.length
    || project?.fieldData?.calculations?.length
    || project?.fieldData?.media?.length
    || project?.evidence?.length
  );
  const canSubmitFieldwork = Boolean(project?.permissions?.surveyor && hasAnyFieldData && (['hired', 'in_progress'].includes(currentStage) || (currentStage === 'submitted' && project?.status === 'revision_requested')));
  const canUploadFinalReport = Boolean(project?.permissions?.surveyor && currentStage === 'approved' && project?.status === 'report_upload_requested');
  const finalPaymentRecord = (project?.payments || []).find((item: any) => item.type === 'survey_final') || null;
  const finalPaymentRejected = finalPaymentRecord?.paymentVerification?.status === 'rejected';
  const fieldworkReview = project?.fieldworkReview || { status: 'not_requested', checklist: {}, snapshot: {} };
  const finalPaymentWorkflow = project?.finalPaymentWorkflow || { status: 'not_required' };
  const journey = surveyJourney(project);
  const directProject = project?.workflowType === 'direct_surveyor';
  const journeySteps = directProject ? directSurveyJourneySteps : surveyJourneySteps;
  const directMilestones = [...(project?.milestones || [])].sort((left: any, right: any) => Number(left.order || 0) - Number(right.order || 0));
  const measurements = project?.fieldData?.measurements || [];
  const fieldNotes = project?.fieldData?.fieldNotes?.length ? project.fieldData.fieldNotes : project?.fieldData?.observations?.notes || [];
  const reportSections = project?.report?.sections || {};
  const mapProvider = String(siteData.settings?.map?.provider || 'google');
  const mapApiKey = siteData.settings?.map?.enabled === false || siteData.settings?.map?.navigationEnabled === false || mapProvider !== 'google' ? '' : String(siteData.settings?.map?.publicApiKey || '');
  const mapTravelMode = String(siteData.settings?.map?.travelMode || 'DRIVING').toUpperCase() as 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';

  const rawPropertyImage = project?.property?.coverImage || project?.property?.images?.[0] || project?.job?.image || project?.propertySite?.image || '';
  const propertyImage = typeof rawPropertyImage === 'string' ? rawPropertyImage : String(rawPropertyImage?.url || rawPropertyImage?.path || rawPropertyImage?.src || '');
  const rawLandlordAvatar = project?.client?.profileImage || project?.client?.avatar || project?.client?.photo || '';
  const landlordAvatar = typeof rawLandlordAvatar === 'string' ? rawLandlordAvatar : String(rawLandlordAvatar?.url || rawLandlordAvatar?.path || '');
  const rawSurveyorAvatar = project?.surveyor?.profileImage || project?.surveyor?.avatar || project?.surveyor?.photo || '';
  const surveyorAvatar = typeof rawSurveyorAvatar === 'string' ? rawSurveyorAvatar : String(rawSurveyorAvatar?.url || rawSurveyorAvatar?.path || '');
  const projectAddress = project?.property?.address?.fullAddress || project?.job?.addressApproximate || project?.propertySite?.fullAddress || 'Property location protected';
  const quoteAmount = Number(project?.quotation?.amount || project?.paymentSummary?.total || 0);
  const approvedAmount = Number(project?.paymentSummary?.total || project?.quotation?.amount || 0);
  const scheduledDate = project?.job?.preferredVisitDate || project?.startDate || project?.activeVisit?.checkIn?.at || null;
  const firstPaymentRecord = (project?.payments || [])[0] || null;

  async function load() {
    if (!projectId) return;
    setLoading(true); setError('');
    try {
      const response = await getSurveyWorkflowProject(projectId);
      setProject(response.data);
    } catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [projectId]);
  useEffect(() => {
    if (!directProject) return;
    setMilestoneDrafts(Object.fromEntries(directMilestones.map((milestone: any) => [String(milestone._id), {
      title: String(milestone.title || ''), description: String(milestone.description || ''), amount: milestone.amount === undefined ? '' : String(milestone.amount),
    }])));
  }, [directProject, project?._id, project?.updatedAt]);

  async function run(task: () => Promise<any>, success: string) {
    setBusy(true); setError('');
    try { const response = await task(); if (response?.data) setProject(response.data); else await load(); setNotice(response?.message || success); return true; }
    catch (reason) { setError((reason as Error).message); return false; }
    finally { setBusy(false); }
  }

  async function saveDirectMilestone(milestone: any) {
    if (!projectId) return;
    const draft = milestoneDrafts[String(milestone._id)];
    if (!draft || !draft.title.trim() || !Number(draft.amount)) { setError('Enter a positive amount and a milestone title before saving.'); return; }
    await run(() => updateSurveyMilestone(projectId, String(milestone._id), { title: draft.title.trim(), description: draft.description.trim(), amount: Number(draft.amount) }), 'Milestone budget saved and sent to the Surveyor.');
  }

  async function acceptDirectMilestone(milestone: any) {
    if (!projectId) return;
    await run(() => acceptSurveyMilestone(projectId, String(milestone._id)), `Milestone ${milestone.order} accepted.`);
  }

  async function submitDirectMilestonePayment(event: FormEvent) {
    event.preventDefault();
    if (!projectId || !milestonePayment) return;
    if (!milestonePayment.transactionId.trim()) { setError('Enter the milestone payment transaction ID.'); return; }
    if (!milestonePayment.proof) { setError('Upload the milestone payment proof.'); return; }
    setBusy(true); setError('');
    try {
      const uploaded = await uploadDocument(milestonePayment.proof, { type: 'survey_payment_proof', category: 'image', visibility: 'private', surveyProject: projectId, description: `Milestone ${milestonePayment.milestone.order} payment proof for ${project?.projectNumber || 'survey project'}` });
      const fileId = String((uploaded.data as any)?.driveFile?._id || (uploaded.data as any)?.driveFile || '');
      if (!fileId) throw new Error('Payment proof uploaded without a secure file reference');
      const response = await submitSurveyWorkflowMilestonePayment(projectId, String(milestonePayment.milestone._id), { transactionId: milestonePayment.transactionId.trim(), proofFileId: fileId, method: milestonePayment.method, payerDeclaration: milestonePayment.payerDeclaration });
      setProject(response.data); setNotice(response.message || `Milestone ${milestonePayment.milestone.order} payment proof submitted.`); setMilestonePayment(null);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function checkIn() {
    if (!projectId) return;
    setBusy(true); setError('');
    try {
      let gps: { latitude?: number; longitude?: number; accuracy?: number } = {};
      try { gps = await gpsPosition(); } catch { /* exact-location access is optional */ }
      const response = await checkInSurveyWorkflowProject(projectId, gps);
      setProject(response.data);
      setNotice(response.message || 'Check-in recorded. Exact-location verification is optional.');
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function checkOut() {
    if (!projectId) return;
    setBusy(true); setError('');
    try { const gps = await gpsPosition(); const response = await checkOutSurveyWorkflowProject(projectId, gps); setProject(response.data); setNotice(response.message || 'Site visit completed.'); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  function resetField() { setField({ ...emptyField }); }

  function editMeasurement(item: any, index: number) {
    setField({
      ...emptyField, mode: 'measurement', measurementId: String(item?._id || ''), measurementIndex: item?._id ? -1 : index,
      label: String(item?.label || ''), value: item?.value === undefined || item?.value === null ? '' : String(item.value),
      unit: String(item?.unit || 'metre'), type: String(item?.type || 'dimension'), notes: String(item?.notes || ''),
    });
    setFieldOpen(true);
  }

  function editFieldNote(item: any, index: number) {
    setField({
      ...emptyField, mode: 'note', noteId: String(item?._id || ''), noteIndex: item?._id ? -1 : index,
      fieldNote: String(item?.text || item || ''),
    });
    setFieldOpen(true);
  }

  async function saveFieldwork(event: FormEvent) {
    event.preventDefault(); if (!projectId) return;
    const body: Record<string, any> = {};
    if (field.mode !== 'note' && (field.label.trim() || field.value !== '')) {
      if (!field.label.trim() || field.value === '' || !field.unit.trim()) { setError('Measurement label, value, and unit are required.'); return; }
      body.measurement = { label: field.label.trim(), value: Number(field.value), unit: field.unit.trim(), type: field.type, notes: field.notes };
      if (field.measurementId) body.measurementId = field.measurementId;
      else if (field.measurementIndex >= 0) body.measurementIndex = field.measurementIndex;
    }
    if (field.mode !== 'measurement' && field.fieldNote.trim()) {
      body.note = field.fieldNote.trim();
      if (field.noteId) body.noteId = field.noteId;
      else if (field.noteIndex >= 0) body.noteIndex = field.noteIndex;
    }
    if (!Object.keys(body).length) { setError('Add a measurement or field note.'); return; }
    const done = await run(() => saveSurveyWorkflowFieldwork(projectId, body), 'Field observation saved.');
    if (done) { setFieldOpen(false); resetField(); }
  }

  async function uploadEvidence(files: FileList | null) {
    if (!files?.length || !projectId) return;
    const selectedFiles = Array.from(files);
    setBusy(true); setError('');
    try {
      let latest: any = null;
      for (const file of selectedFiles) {
        const kind = file.type.startsWith('image/') ? 'photo' : file.type.startsWith('video/') ? 'video' : 'document';
        const uploaded = await uploadDocument(file, { type: 'survey_evidence', category: kind === 'photo' ? 'image' : kind, visibility: 'private', surveyProject: projectId, description: `Evidence for ${project.projectNumber || 'survey project'}` });
        const driveFile = (uploaded.data as any).driveFile;
        const fileId = String(driveFile?._id || driveFile || '');
        if (!fileId) throw new Error(`${file.name} uploaded without a secure file reference`);
        let gps: Record<string, number> = {};
        try { gps = await gpsPosition(); } catch { /* evidence remains valid when capture GPS is unavailable */ }
        latest = await attachSurveyWorkflowEvidence(projectId, { fileId, kind, note: '', capturedAt: new Date().toISOString(), ...gps });
      }
      if (latest?.data) setProject(latest.data);
      setNotice(`${selectedFiles.length} evidence file${selectedFiles.length === 1 ? '' : 's'} uploaded securely.`);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function uploadReportFile(files: FileList | null) {
    if (!files?.length || !projectId) return;
    const file = files[0];
    setBusy(true); setError('');
    try {
      const uploaded = await uploadDocument(file, {
        type: 'survey_report', category: 'document', visibility: 'private', surveyProject: projectId,
        description: `Survey report for ${project.projectNumber || 'survey project'}`,
      });
      const driveFile = (uploaded.data as any).driveFile;
      const fileId = String(driveFile?._id || driveFile || '');
      if (!fileId) throw new Error(`${file.name} uploaded without a secure file reference`);
      const attached = await attachSurveyWorkflowReportFile(projectId, { fileId, title: file.name });
      setProject(attached.data);
      setNotice('Final survey report uploaded. The survey is complete and the property is verified.');
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function submitFieldworkReview() {
    if (!projectId) return;
    await run(() => submitSurveyWorkflowFieldwork(projectId), 'Fieldwork submitted for landlord review.');
  }

  async function reviewFieldwork(event: FormEvent) {
    event.preventDefault();
    if (!projectId) return;
    if (!reviewChecklist.measurementsReviewed || !reviewChecklist.evidenceReviewed || !reviewChecklist.scopeReviewed) {
      setError('Confirm each review item before approving the submitted fieldwork.');
      return;
    }
    const done = await run(() => reviewSurveyWorkflowFieldwork(projectId, { checklist: reviewChecklist, comment: reviewComment.trim() }), 'Fieldwork review recorded. Final payment is ready.');
    if (done) {
      setReviewOpen(false);
      setReviewChecklist({ measurementsReviewed: false, evidenceReviewed: false, scopeReviewed: false });
      setReviewComment('');
    }
  }

  async function submitFinalPayment(event: FormEvent) {
    event.preventDefault();
    if (!projectId || !finalPaymentRecord) return;
    if (!finalPayment.transactionId.trim()) { setError('Enter the final payment transaction ID.'); return; }
    if (!finalPayment.proof) { setError('Upload the final payment screenshot.'); return; }
    setBusy(true); setError('');
    try {
      const uploaded = await uploadDocument(finalPayment.proof, {
        type: 'survey_payment_proof', category: 'image', visibility: 'private', surveyProject: projectId,
        description: `Final payment proof for ${project?.projectNumber || 'survey project'}`,
      });
      const fileId = String((uploaded.data as any)?.driveFile?._id || (uploaded.data as any)?.driveFile || '');
      if (!fileId) throw new Error('Payment screenshot uploaded without a secure file reference');
      const response = await submitSurveyWorkflowFinalPayment(projectId, String(finalPaymentRecord._id), { transactionId: finalPayment.transactionId.trim(), proofFileId: fileId, method: finalPayment.method, payerDeclaration: finalPayment.payerDeclaration });
      setProject(response.data);
      setNotice(response.message || 'Final payment proof and declaration submitted for Surveyor receipt confirmation.');
      setFinalPaymentOpen(false);
      setFinalPayment({ transactionId: '', method: 'upi', proof: null, payerDeclaration: false });
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function openPaymentProof(paymentId: string) {
    if (!projectId) return;
    setBusy(true); setError('');
    try {
      const blob = await fetchSurveyWorkflowPaymentProof(projectId, paymentId);
      const url = URL.createObjectURL(blob);
      const popup = window.open(url, '_blank', 'noopener,noreferrer');
      if (popup) popup.opener = null;
      else {
        const link = document.createElement('a');
        link.href = url;
        link.download = 'survey-final-payment-proof';
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function acceptPayment(paymentId: string) {
    if (!projectId) return;
    if (String(finalPaymentRecord?._id || '') === paymentId) {
      setPaymentConfirmation({ receiptConfirmed: false, confirmationNote: '' });
      setPaymentConfirmationOpen(true);
      return;
    }
    await run(() => acceptSurveyWorkflowPayment(projectId, paymentId), 'Payment accepted and marked paid.');
  }

  function paymentForMilestone(milestone: any) {
    const milestoneId = String(milestone?._id || '');
    return (project?.payments || []).find((payment: any) => String(payment.gateway?.milestoneId || '') === milestoneId)
      || (project?.payments || []).find((payment: any) => String(payment._id || '') === String(milestone?.payment?._id || milestone?.payment || ''))
      || null;
  }

  function openDirectMilestonePayment(milestone: any) {
    setMilestonePayment({ milestone, transactionId: '', method: 'upi', proof: null, payerDeclaration: false });
  }

  async function confirmFinalPayment(event: FormEvent) {
    event.preventDefault();
    if (!projectId || !finalPaymentRecord) return;
    if (!paymentConfirmation.receiptConfirmed) {
      setError('Confirm that you reviewed the transaction ID, screenshot, and received the final payment.');
      return;
    }
    const done = await run(
      () => acceptSurveyWorkflowPayment(projectId, String(finalPaymentRecord._id), { receiptConfirmed: true, confirmationNote: paymentConfirmation.confirmationNote.trim() }),
      'Final payment receipt confirmed. The report can now be uploaded.',
    );
    if (done) {
      setPaymentConfirmationOpen(false);
      setPaymentConfirmation({ receiptConfirmed: false, confirmationNote: '' });
    }
  }

  async function rejectFinalPayment(event: FormEvent) {
    event.preventDefault();
    if (!projectId || !finalPaymentRecord) return;
    const reason = paymentRejectionReason.trim();
    if (reason.length < 5) { setError('Explain what the landlord needs to correct in the payment proof.'); return; }
    const done = await run(() => rejectSurveyWorkflowFinalPayment(projectId, String(finalPaymentRecord._id), reason), 'Payment proof returned to the landlord for correction.');
    if (done) { setPaymentRejectionOpen(false); setPaymentRejectionReason(''); }
  }

  async function approveDirectReport() {
    if (!projectId) return;
    await run(() => approveSurveyWorkflowReport(projectId), 'Survey report approved. Milestone 2 payment is now available.');
  }

  async function sendRevision(event: FormEvent) {
    event.preventDefault(); if (!projectId) return;
    const done = await run(() => requestSurveyWorkflowRevision(projectId, revisionReason), 'Revision request sent.');
    if (done) { setRevisionOpen(false); setRevisionReason(''); }
  }

  async function chat() {
    if (!project) return;
    const other = project.permissions?.landlord ? project.surveyor : project.client;
    setBusy(true); setError('');
    try {
      const response = await createConversation({ participants: [other?._id || other], type: 'survey', title: `Survey project · ${project.projectNumber || ''}`, reference: { model: 'SurveyProject', id: project._id, label: project.projectNumber || 'Survey project' } });
      navigate(`/app/messages?conversation=${response.data?._id || ''}`);
    } catch (reason) { setError((reason as Error).message); setBusy(false); }
  }

  const directBudgetReadyForUi = directMilestones.length === 2 && directMilestones.every((milestone: any) => milestone.status === 'accepted' && Number(milestone.amount || 0) > 0);
  const journeyProgress = Math.round(journey.activeStep / (journeySteps.length - 1) * 100);

  function renderJourneyAction() {
    if (directProject) {
      const firstMilestone = directMilestones.find((milestone: any) => Number(milestone.order) === 1);
      const secondMilestone = directMilestones.find((milestone: any) => Number(milestone.order) === 2);
      const firstPayment = paymentForMilestone(firstMilestone);
      const secondPayment = paymentForMilestone(secondMilestone);
      if (journey.activeStep === 7) return <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {project.report?._id && <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadSurveyReport(project.report._id, 'pdf')}>View verified report</Button>}
        {project.report?.reportFile && <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadSurveyWorkflowReportFile(projectId || '', project.report.reportFile.name || 'survey-report')}>Download report file</Button>}
      </Stack>;
      if (project.permissions?.landlord && journey.activeStep === 3 && firstMilestone && firstPayment && project.status === 'awaiting_first_payment') return <Button variant="contained" startIcon={<PaidRounded />} onClick={() => openDirectMilestonePayment(firstMilestone)} disabled={busy || !project.surveyorPaymentDetails?.ready}>Pay milestone 1 &amp; submit proof</Button>;
      if (project.permissions?.surveyor && journey.activeStep === 3 && firstPayment?.paymentVerification?.status === 'submitted') return <Button variant="contained" startIcon={<PaidRounded />} onClick={() => acceptPayment(String(firstPayment._id))} disabled={busy}>Accept milestone 1 payment</Button>;
      if (project.permissions?.surveyor && journey.activeStep === 4 && canUploadFinalReport) return <Button component="label" variant="contained" startIcon={<UploadFileRounded />} disabled={busy}>Upload &amp; submit survey report<input hidden type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={(event) => { void uploadReportFile(event.target.files); event.currentTarget.value = ''; }} /></Button>;
      if (project.permissions?.landlord && journey.activeStep === 5 && project.report) return <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadSurveyWorkflowReportFile(projectId || '', project.report?.reportFile?.name || 'survey-report')}>Open report</Button>
        <Button color="success" variant="contained" startIcon={<CheckCircleRounded />} onClick={() => void approveDirectReport()} disabled={busy}>Approve report &amp; unlock milestone 2</Button>
        <Button color="warning" variant="outlined" onClick={() => { setRevisionReason(''); setRevisionOpen(true); }} disabled={busy}>Request report revision</Button>
      </Stack>;
      if (project.permissions?.landlord && journey.activeStep === 6 && secondMilestone && secondPayment && project.status === 'awaiting_second_payment') return <Button variant="contained" startIcon={<PaidRounded />} onClick={() => openDirectMilestonePayment(secondMilestone)} disabled={busy || !project.surveyorPaymentDetails?.ready}>Pay milestone 2 &amp; submit proof</Button>;
      if (project.permissions?.surveyor && journey.activeStep === 7 && secondPayment?.paymentVerification?.status === 'submitted') return <Button variant="contained" startIcon={<PaidRounded />} onClick={() => acceptPayment(String(secondPayment._id))} disabled={busy}>Accept milestone 2 &amp; verify property</Button>;
      if (project.permissions?.surveyor && currentStage === 'hired' && directBudgetReadyForUi) return <Button variant="contained" startIcon={<LocationOnRounded />} onClick={checkIn} disabled={busy}>Optional check-in</Button>;
      return <Typography variant="body2" color="text.secondary">{journey.waiting}</Typography>;
    }
    if (journey.activeStep === 5) return <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {project.report?._id && <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadSurveyReport(project.report._id, 'pdf')}>View final report</Button>}
      {project.report?.reportFile && <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadSurveyWorkflowReportFile(projectId || '', project.report.reportFile.name || 'survey-report')}>Download report file</Button>}
    </Stack>;
    if (project.permissions?.surveyor && canSubmitFieldwork) return <Button variant="contained" startIcon={<SendRounded />} onClick={submitFieldworkReview} disabled={busy}>Submit field data &amp; evidence for review</Button>;
    if (project.permissions?.surveyor && surveyorCanEdit) return <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <Button variant="contained" startIcon={<NoteAddRounded />} onClick={() => setFieldOpen(true)} disabled={busy}>Add field data</Button>
      <Button component="label" variant="outlined" startIcon={<CloudUploadRounded />} disabled={busy}>Upload evidence<input hidden multiple type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={(event) => { void uploadEvidence(event.target.files); event.currentTarget.value = ''; }} /></Button>
    </Stack>;
    if (project.permissions?.surveyor && currentStage === 'hired') return <Button variant="contained" startIcon={<LocationOnRounded />} onClick={checkIn} disabled={busy}>Optional check-in</Button>;
    if (project.permissions?.landlord && project.status === 'awaiting_landlord_review') return <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <Button color="success" variant="contained" startIcon={<CheckCircleRounded />} onClick={() => setReviewOpen(true)} disabled={busy}>Open fieldwork review</Button>
      <Button color="warning" variant="outlined" onClick={() => setRevisionOpen(true)} disabled={busy}>Request changes</Button>
    </Stack>;
    if (project.permissions?.landlord && finalPaymentRecord && project.status === 'awaiting_final_payment') return <Button variant="contained" startIcon={<PaidRounded />} onClick={() => setFinalPaymentOpen(true)} disabled={busy}>{finalPaymentRejected ? 'Correct & resubmit payment proof' : 'Submit final payment proof'}</Button>;
    if (project.permissions?.surveyor && finalPaymentRecord && project.status === 'payment_submitted') return <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <Button variant="contained" startIcon={<PaidRounded />} onClick={() => acceptPayment(String(finalPaymentRecord._id))} disabled={busy}>Confirm receipt &amp; unlock report</Button>
      <Button color="warning" variant="outlined" onClick={() => setPaymentRejectionOpen(true)} disabled={busy}>Return proof with reason</Button>
    </Stack>;
    if (project.permissions?.surveyor && canUploadFinalReport) return <Button component="label" variant="contained" startIcon={<UploadFileRounded />} disabled={busy}>Upload final report &amp; verify property<input hidden type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={(event) => { void uploadReportFile(event.target.files); event.currentTarget.value = ''; }} /></Button>;
    return <Typography variant="body2" color="text.secondary">{journey.waiting}</Typography>;
  }

  if (!projectId) return <ProjectList onOpen={(id) => navigate(`/app/survey-projects/${id}`)} />;
  if (loading) return <Box sx={{ py: 12, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (!project) return <Box sx={{ px: 3 }}><Alert severity="error">{error || 'Survey project not found'}</Alert></Box>;

  return <Box data-secureasset-survey-workflow="field-review-payment-report-v164" data-secureasset-survey-version="approved-premium-project-details-v212" sx={{
    px: { xs: 1.25, sm: 2.25, lg: 3 }, pb: 8, pt: { xs: 1.25, md: 2 }, maxWidth: 1540, mx: 'auto',
    fontFamily: '"Open Sans", Arial, sans-serif',
    color: '#0d2340',
    '& .MuiTypography-root, & .MuiButton-root, & .MuiChip-root, & .MuiInputBase-root, & .MuiFormLabel-root': { fontFamily: '"Open Sans", Arial, sans-serif' },
    '& .MuiButton-root': { textTransform: 'none', borderRadius: 2, fontWeight: 600, boxShadow: 'none' },
    '& .MuiChip-root': { fontWeight: 600 },
  }}>
    <Stack direction="row" spacing={.65} alignItems="center" sx={{ mb: 1.2, color: '#667085' }}>
      <Button size="small" startIcon={<ArrowBackRounded />} onClick={() => navigate('/app/survey-projects')} sx={{ minWidth: 0, px: 0, color: '#667085', '&:hover': { bgcolor: 'transparent', color: '#0b4a8b' } }}>Survey Projects</Button>
      <Typography variant="caption">›</Typography>
      <Typography variant="caption" sx={{ color: '#344054', fontWeight: 600 }}>Project Details</Typography>
    </Stack>

    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ md: 'flex-start' }} sx={{ mb: 2 }}>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ fontSize: { xs: 25, sm: 29, md: 31 }, lineHeight: 1.15, fontWeight: 700, letterSpacing: '-.025em', color: '#0b1f3a' }}>Survey Project Details</Typography>
          <Chip size="small" label={journey.activeStep === journeySteps.length - 1 ? 'Completed' : label(project.workflowStage || project.status || 'In progress')} color={journey.activeStep === journeySteps.length - 1 ? 'success' : 'primary'} sx={{ borderRadius: 99, height: 25 }} />
        </Stack>
        <Typography variant="body2" sx={{ mt: .75, color: '#475467' }}>
          Project ID: <Box component="span" sx={{ color: '#0f2747', fontWeight: 600 }}>{project.projectNumber || project._id}</Box>
        </Typography>
        <Typography variant="caption" sx={{ mt: .4, display: 'block', color: '#98a2b3' }}>
          Created {date(project.createdAt)} · Last updated {date(project.updatedAt)}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', md: 'auto' } }}>
        <Button variant="outlined" startIcon={<ChatRounded />} onClick={chat} disabled={busy} sx={{ minHeight: 42, px: 2, flex: { xs: 1, sm: 'initial' }, borderColor: '#cfd8e5', color: '#102a4c' }}>Contact Surveyor</Button>
        <Button variant="contained" startIcon={<TaskAltRounded />} onClick={() => {
          if (project.permissions?.landlord && project.status === 'awaiting_landlord_review') setReviewOpen(true);
          else document.getElementById('survey-evidence')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }} disabled={busy} sx={{ minHeight: 42, px: 2.1, flex: { xs: 1, sm: 'initial' }, bgcolor: '#082b52', '&:hover': { bgcolor: '#0b3b70' } }}>Review Evidence</Button>
        <IconButton aria-label="Project actions" sx={{ border: '1px solid #d8e0ea', borderRadius: 2, width: 42, height: 42 }}><MoreVertRounded /></IconButton>
      </Stack>
    </Stack>

    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 1.5, borderRadius: 2.5 }}>{notice}</Alert>}
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1.5, borderRadius: 2.5 }}>{error}</Alert>}

    <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
      <Grid size={{ xs: 12, md: 5 }}>
        <Paper elevation={0} sx={{ p: 1.45, height: '100%', minHeight: 126, border: '1px solid #e5eaf1', borderRadius: 2.5, boxShadow: '0 6px 22px rgba(15,23,42,.035)', bgcolor: '#fff' }}>
          <Stack direction="row" spacing={1.45} alignItems="center" sx={{ height: '100%' }}>
            <Box sx={{ width: { xs: 112, sm: 146 }, height: 98, borderRadius: 2, overflow: 'hidden', flexShrink: 0, bgcolor: '#eef4f8', display: 'grid', placeItems: 'center' }}>
              {propertyImage ? <Box component="img" src={propertyImage} alt={project.property?.title || 'Survey property'} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <LocationOnRounded sx={{ fontSize: 34, color: '#6b7d91' }} />}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, color: '#102a4c', fontSize: 16 }}>{project.property?.title || project.job?.title || 'Survey Property'}</Typography>
              <Stack direction="row" spacing={.55} alignItems="flex-start" sx={{ mt: .7 }}>
                <LocationOnRounded sx={{ fontSize: 16, color: '#667085', mt: .15 }} />
                <Typography variant="body2" sx={{ color: '#667085', lineHeight: 1.45 }}>{projectAddress}</Typography>
              </Stack>
              <Stack direction="row" spacing={.65} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                <Chip size="small" label={project.job?.propertyType || project.propertySite?.propertyType || 'Property'} sx={{ bgcolor: '#f2f4f7', color: '#475467', height: 24 }} />
                <Chip size="small" label={project.job?.surveyType ? label(project.job.surveyType) : label(project.surveyCategory || 'Survey')} sx={{ bgcolor: '#f2f4f7', color: '#475467', height: 24 }} />
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Grid>
      <Grid size={{ xs: 12, md: 3.5 }}>
        <Paper elevation={0} sx={{ p: 1.7, height: '100%', minHeight: 126, border: '1px solid #e5eaf1', borderRadius: 2.5, boxShadow: '0 6px 22px rgba(15,23,42,.035)' }}>
          <Typography variant="caption" sx={{ color: '#475467', fontWeight: 600 }}>Landlord</Typography>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: 1.25 }}>
            <Avatar src={landlordAvatar || undefined} alt={project.client?.name || 'Landlord'} sx={{ width: 50, height: 50, bgcolor: '#e7eef7', color: '#102a4c', fontWeight: 700 }}>{String(project.client?.name || 'L').slice(0, 1)}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, color: '#102a4c' }}>{project.client?.name || 'Landlord'}</Typography>
              {project.client?.email && <Typography variant="caption" noWrap sx={{ display: 'block', color: '#667085' }}>{project.client.email}</Typography>}
              {project.client?.phone && <Typography variant="caption" sx={{ display: 'block', color: '#667085' }}>{project.client.phone}</Typography>}
            </Box>
          </Stack>
        </Paper>
      </Grid>
      <Grid size={{ xs: 12, md: 3.5 }}>
        <Paper elevation={0} sx={{ p: 1.7, height: '100%', minHeight: 126, border: '1px solid #e5eaf1', borderRadius: 2.5, boxShadow: '0 6px 22px rgba(15,23,42,.035)' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Typography variant="caption" sx={{ color: '#475467', fontWeight: 600 }}>Assigned Surveyor</Typography>
            <IconButton size="small" onClick={chat} disabled={busy} sx={{ border: '1px solid #e4e7ec', borderRadius: 1.5 }}><ChatRounded sx={{ fontSize: 17 }} /></IconButton>
          </Stack>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: .75 }}>
            <Avatar src={surveyorAvatar || undefined} alt={project.surveyor?.name || 'Surveyor'} sx={{ width: 50, height: 50, bgcolor: '#e7eef7', color: '#102a4c', fontWeight: 700 }}>{String(project.surveyor?.name || 'S').slice(0, 1)}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, color: '#102a4c' }}>{project.surveyor?.name || 'Assigned Surveyor'}</Typography>
              {project.surveyor?.email && <Typography variant="caption" noWrap sx={{ display: 'block', color: '#667085' }}>{project.surveyor.email}</Typography>}
              {project.surveyor?.phone && <Typography variant="caption" sx={{ display: 'block', color: '#667085' }}>{project.surveyor.phone}</Typography>}
            </Box>
          </Stack>
        </Paper>
      </Grid>
    </Grid>

    <Paper elevation={0} sx={{ mb: 1.5, border: '1px solid #e4e9f0', borderRadius: 2.5, overflow: 'hidden', boxShadow: '0 6px 22px rgba(15,23,42,.035)' }}>
      <Grid container>
        {[
          { title: 'Quote Amount', value: money(quoteAmount), icon: <PaidRounded />, accent: '#079455', bg: '#ecfdf3' },
          { title: 'Approved Amount', value: money(approvedAmount), icon: <CheckCircleRounded />, accent: '#079455', bg: '#ecfdf3' },
          { title: 'Scheduled Date', value: scheduledDate ? new Date(String(scheduledDate)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not scheduled', sub: scheduledDate ? new Date(String(scheduledDate)).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '', icon: <TaskAltRounded />, accent: '#0b4aa2', bg: '#eff6ff' },
          { title: 'Project Status', value: journey.status, sub: 'Next: ' + journey.nextAction, icon: <TaskAltRounded />, accent: '#079455', bg: '#ecfdf3' },
        ].map((item, index) => <Grid size={{ xs: 6, md: 3 }} key={item.title} sx={{ borderRight: { md: index < 3 ? '1px solid #edf0f4' : 'none' }, borderBottom: { xs: index < 2 ? '1px solid #edf0f4' : 'none', md: 'none' } }}>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ p: { xs: 1.35, sm: 1.65 }, minHeight: 86 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, color: item.accent, bgcolor: item.bg, '& svg': { fontSize: 20 } }}>{item.icon}</Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: '#667085' }}>{item.title}</Typography>
              <Typography sx={{ mt: .15, fontWeight: 700, color: item.accent === '#079455' && item.title === 'Project Status' ? '#087a49' : '#102a4c', fontSize: { xs: 14, sm: 16 }, lineHeight: 1.25 }}>{item.value}</Typography>
              {item.sub && <Typography variant="caption" noWrap sx={{ display: 'block', color: '#98a2b3', maxWidth: 220 }}>{item.sub}</Typography>}
            </Box>
          </Stack>
        </Grid>)}
      </Grid>
    </Paper>

    <Box sx={{ display: { xs: 'flex', md: 'none' }, mb: 1.5, p: .5, border: '1px solid #e4e9f0', borderRadius: 2, bgcolor: '#fff', overflowX: 'auto' }}>
      {['Overview', 'Evidence', 'Payment', 'Report'].map((tab, index) => <Box key={tab} onClick={() => document.getElementById(index === 1 ? 'survey-evidence' : index === 2 ? 'survey-payment' : index === 3 ? 'survey-report' : 'survey-overview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} sx={{ px: 1.6, py: .8, minWidth: 'max-content', borderBottom: index === 0 ? '2px solid #079455' : '2px solid transparent', color: index === 0 ? '#087a49' : '#667085', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{tab}</Box>)}
    </Box>

    <Paper id="survey-overview" elevation={0} sx={{ mb: 1.5, p: { xs: 1.5, sm: 1.8 }, border: '1px solid #e4e9f0', borderRadius: 2.5, boxShadow: '0 6px 22px rgba(15,23,42,.035)' }}>
      <Box sx={{ overflowX: 'auto', pb: .25 }}>
        <Stack direction="row" alignItems="flex-start" sx={{ minWidth: directProject ? 860 : 650 }}>
          {journeySteps.map((step, index) => {
            const completed = index < journey.activeStep;
            const active = index === journey.activeStep;
            return <Box key={step.title} sx={{ flex: 1, minWidth: 100, position: 'relative', textAlign: 'center', px: .5 }}>
              {index < journeySteps.length - 1 && <Box sx={{ position: 'absolute', left: '50%', right: '-50%', top: 14, height: 2, bgcolor: completed ? '#079455' : '#e0e7ef', zIndex: 0 }} />}
              <Box sx={{ position: 'relative', zIndex: 1, mx: 'auto', width: 29, height: 29, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: completed || active ? '#079455' : '#e8edf3', color: completed || active ? '#fff' : '#667085', fontSize: 12, fontWeight: 700, boxShadow: active ? '0 0 0 5px rgba(7,148,85,.12)' : 'none' }}>{completed ? <CheckCircleRounded sx={{ fontSize: 17 }} /> : index + 1}</Box>
              <Typography sx={{ mt: .75, fontSize: 11.5, fontWeight: active ? 700 : 600, color: active ? '#102a4c' : '#475467', lineHeight: 1.3 }}>{step.title}</Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: .2, color: '#98a2b3', fontSize: 10.5 }}>{step.owner}</Typography>
            </Box>;
          })}
        </Stack>
      </Box>
    </Paper>

    <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, lg: 7.2 }}>
        <Stack spacing={1.5}>
          <Paper id="survey-evidence" elevation={0} sx={{ p: { xs: 1.6, md: 1.9 }, border: '1px solid #e4e9f0', borderRadius: 2.5, boxShadow: '0 6px 22px rgba(15,23,42,.035)' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Stack direction="row" spacing={.8} alignItems="center"><CameraAltRounded sx={{ fontSize: 20, color: '#079455' }} /><Typography sx={{ fontWeight: 700, color: '#102a4c' }}>Survey Evidence</Typography></Stack>
              <Stack direction="row" spacing={.75} alignItems="center">
                <Typography variant="caption" sx={{ color: '#667085' }}>{project.evidence?.length || 0} files</Typography>
                {project.permissions?.surveyor && surveyorCanEdit && <Button component="label" size="small" variant="outlined" startIcon={<CloudUploadRounded />} disabled={busy}>Upload<input hidden multiple type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={(event) => { void uploadEvidence(event.target.files); event.currentTarget.value = ''; }} /></Button>}
              </Stack>
            </Stack>
            {!project.evidence?.length ? <Alert severity="info" sx={{ mt: 1.4 }}>No survey evidence has been uploaded yet.</Alert> : <Grid container spacing={1} sx={{ mt: .5 }}>{project.evidence.map((item: any) => <Grid size={{ xs: 6, sm: 4, md: 3 }} key={item._id}><EvidenceCard projectId={projectId} item={item} canDelete={surveyorCanEdit} onDelete={() => run(() => removeSurveyWorkflowEvidence(projectId, item._id), 'Evidence removed.')} /></Grid>)}</Grid>}
            <Stack direction="row" spacing={.8} flexWrap="wrap" useFlexGap sx={{ mt: 1.3 }}>
              {project.permissions?.landlord && project.status === 'awaiting_landlord_review' && <Button size="small" color="success" variant="contained" startIcon={<CheckCircleRounded />} onClick={() => setReviewOpen(true)} disabled={busy}>Approve Evidence</Button>}
              {project.permissions?.landlord && project.status === 'awaiting_landlord_review' && <Button size="small" color="warning" variant="outlined" onClick={() => setRevisionOpen(true)} disabled={busy}>Request Changes</Button>}
              {project.permissions?.surveyor && canSubmitFieldwork && <Button size="small" variant="contained" startIcon={<SendRounded />} onClick={submitFieldworkReview} disabled={busy}>Submit for Review</Button>}
            </Stack>
          </Paper>

          <Paper id="survey-report" elevation={0} sx={{ p: { xs: 1.6, md: 1.9 }, border: '1px solid #e4e9f0', borderRadius: 2.5, boxShadow: '0 6px 22px rgba(15,23,42,.035)' }}>
            <Stack direction="row" spacing={.8} alignItems="center"><DescriptionRounded sx={{ fontSize: 20, color: '#079455' }} /><Typography sx={{ fontWeight: 700, color: '#102a4c' }}>Final Survey Report</Typography></Stack>
            {project.report ? <Stack spacing={1.1} sx={{ mt: 1.25 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                <Box><Typography sx={{ fontWeight: 600 }}>{project.report.title || project.report.reportNumber || 'Final survey report'}</Typography><Typography variant="caption" sx={{ color: '#667085' }}>{project.report.reportNumber || 'Report'} · Revision {project.report.revisionNumber || 0}</Typography></Box>
                <Stack direction="row" spacing={.75}>
                  {project.report?._id && <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadSurveyReport(project.report._id, 'pdf')}>View Report</Button>}
                  {project.report?.reportFile && <Button size="small" variant="contained" startIcon={<DownloadRounded />} onClick={() => downloadSurveyWorkflowReportFile(projectId || '', project.report.reportFile.name || 'survey-report')}>Download</Button>}
                </Stack>
              </Stack>
              <Chip size="small" label={label(project.report.status || 'available')} color={project.report.status === 'final' || project.report.status === 'locked' ? 'success' : 'primary'} sx={{ alignSelf: 'flex-start' }} />
            </Stack> : <Box sx={{ mt: 1.25, p: 1.4, borderRadius: 2, bgcolor: '#f5f9ff', border: '1px solid #dbeafe' }}>
              <Typography variant="body2" sx={{ color: '#475467' }}>Final report will be available after the required survey workflow, review, and payment confirmation are completed.</Typography>
            </Box>}
            {project.permissions?.surveyor && canUploadFinalReport && <Button component="label" size="small" variant="contained" startIcon={<UploadFileRounded />} disabled={busy} sx={{ mt: 1.2 }}>Upload Final Report<input hidden type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={(event) => { void uploadReportFile(event.target.files); event.currentTarget.value = ''; }} /></Button>}
          </Paper>

          <Paper elevation={0} sx={{ p: { xs: 1.6, md: 1.9 }, border: '1px solid #e4e9f0', borderRadius: 2.5, boxShadow: '0 6px 22px rgba(15,23,42,.035)' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={.8} alignItems="center"><TaskAltRounded sx={{ fontSize: 20, color: '#079455' }} /><Typography sx={{ fontWeight: 700, color: '#102a4c' }}>Activity Timeline</Typography></Stack>
              <Typography variant="caption" sx={{ color: '#0b4aa2', fontWeight: 600 }}>Project workflow</Typography>
            </Stack>
            <Stack sx={{ mt: 1.3 }}>
              {journeySteps.map((step, index) => {
                const completed = index < journey.activeStep;
                const active = index === journey.activeStep;
                return <Stack key={step.title} direction="row" spacing={1.15} sx={{ position: 'relative', pb: index === journeySteps.length - 1 ? 0 : 1.35 }}>
                  {index < journeySteps.length - 1 && <Box sx={{ position: 'absolute', left: 10, top: 22, bottom: -1, width: 1.5, bgcolor: completed ? '#79d7ad' : '#e4e7ec' }} />}
                  <Box sx={{ width: 21, height: 21, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, bgcolor: completed || active ? '#12b76a' : '#e4e7ec', color: '#fff', zIndex: 1 }}>{completed ? <CheckCircleRounded sx={{ fontSize: 14 }} /> : active ? index + 1 : ''}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ fontSize: 13, fontWeight: active ? 700 : 600, color: '#344054' }}>{step.title}</Typography><Typography variant="caption" sx={{ color: '#98a2b3' }}>{active ? journey.status : completed ? 'Completed' : 'Pending'} · {step.owner}</Typography></Box>
                </Stack>;
              })}
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: { xs: 1.6, md: 1.9 }, border: '1px solid #e4e9f0', borderRadius: 2.5, boxShadow: '0 6px 22px rgba(15,23,42,.035)' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ sm: 'center' }}>
              <Box><Typography sx={{ fontWeight: 700, color: '#102a4c' }}>Fieldwork & Measurements</Typography><Typography variant="caption" sx={{ color: '#667085' }}>GPS visit, measurements and notes remain fully available.</Typography></Box>
              {project.permissions?.surveyor && <Stack direction="row" spacing={.65} flexWrap="wrap" useFlexGap>
                {currentStage === 'hired' && <Button size="small" variant="contained" startIcon={<LocationOnRounded />} onClick={checkIn} disabled={busy}>Check In</Button>}
                {surveyorCanEdit && <Button size="small" variant="outlined" startIcon={<NoteAddRounded />} onClick={() => setFieldOpen(true)}>Add Field Data</Button>}
                {currentStage === 'in_progress' && project.activeVisit?.checkIn?.at && !project.activeVisit?.checkOut?.at && <Button size="small" variant="text" onClick={checkOut} disabled={busy}>Check Out</Button>}
              </Stack>}
            </Stack>
            <Grid container spacing={1.4} sx={{ mt: .4 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="caption" sx={{ color: '#667085', fontWeight: 600 }}>MEASUREMENTS ({measurements.length})</Typography>
                <Stack spacing={.6} sx={{ mt: .65 }}>{measurements.length ? measurements.map((item: any, index: number) => <Box key={String(item._id || index)} sx={{ p: .9, borderRadius: 1.5, bgcolor: '#f8fafc', border: '1px solid #eef2f6' }}><Stack direction="row" justifyContent="space-between" spacing={1}><Box><Typography sx={{ fontSize: 13, fontWeight: 600 }}>{item.label || label(item.type)}</Typography>{item.notes && <Typography variant="caption" sx={{ color: '#98a2b3' }}>{item.notes}</Typography>}</Box><Stack direction="row" alignItems="center" spacing={.35}><Typography sx={{ color: '#0b4aa2', fontSize: 13, fontWeight: 700 }}>{item.value} {item.unit}</Typography>{surveyorCanEdit && <IconButton size="small" onClick={() => editMeasurement(item, index)}><EditRounded sx={{ fontSize: 15 }} /></IconButton>}</Stack></Stack></Box>) : <Typography variant="body2" sx={{ color: '#98a2b3', mt: 1 }}>No measurements recorded.</Typography>}</Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="caption" sx={{ color: '#667085', fontWeight: 600 }}>FIELD NOTES ({fieldNotes.length})</Typography>
                <Stack spacing={.6} sx={{ mt: .65 }}>{fieldNotes.length ? fieldNotes.map((item: any, index: number) => <Box key={String(item._id || index)} sx={{ p: .9, borderRadius: 1.5, bgcolor: '#f8fafc', border: '1px solid #eef2f6' }}><Stack direction="row" justifyContent="space-between" spacing={1}><Box><Typography variant="body2">{item.text || item}</Typography><Typography variant="caption" sx={{ color: '#98a2b3' }}>{date(item.at || item.capturedAt || item.createdAt)}</Typography></Box>{surveyorCanEdit && <IconButton size="small" onClick={() => editFieldNote(item, index)}><EditRounded sx={{ fontSize: 15 }} /></IconButton>}</Stack></Box>) : <Typography variant="body2" sx={{ color: '#98a2b3', mt: 1 }}>No field notes recorded.</Typography>}</Stack>
              </Grid>
            </Grid>
            <Box sx={{ mt: 1.5 }}><SurveyProjectNavigationMap apiKey={mapApiKey} destination={projectDestination(project)} destinationLabel={project.property?.title || project.job?.title || 'survey property'} externalUrl={project.navigationUrl} travelMode={mapTravelMode} defaultZoom={Number(siteData.settings?.map?.defaultZoom || 15)} mapId={String(siteData.settings?.map?.mapId || '')} directionsEnabled={siteData.settings?.map?.directionsEnabled !== false} serverRoutingEnabled={siteData.settings?.map?.serverRoutesEnabled !== false && siteData.settings?.map?.routesEnabled !== false} routeRefreshSeconds={Number(siteData.settings?.map?.routeRefreshSeconds || 10)} locationUpdateSeconds={Number(siteData.settings?.map?.locationUpdateSeconds || 5)} /></Box>
          </Paper>

          {directProject && <Paper elevation={0} sx={{ p: { xs: 1.6, md: 1.9 }, border: '1px solid #e4e9f0', borderRadius: 2.5, boxShadow: '0 6px 22px rgba(15,23,42,.035)' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography sx={{ fontWeight: 700, color: '#102a4c' }}>Commercial Milestones</Typography><Chip size="small" color={directBudgetReadyForUi ? 'success' : 'warning'} label={directBudgetReadyForUi ? 'Budget agreed' : 'Awaiting agreement'} /></Stack>
            <Stack spacing={1} sx={{ mt: 1.2 }}>{directMilestones.map((milestone: any) => {
              const draft = milestoneDrafts[String(milestone._id)] || { title: milestone.title || '', description: milestone.description || '', amount: String(milestone.amount || '') };
              const payment = paymentForMilestone(milestone);
              const editable = project.permissions?.landlord && ['proposed', 'rejected'].includes(String(milestone.status || ''));
              return <Box key={milestone._id} sx={{ p: 1.2, border: '1px solid #e6ebf1', borderRadius: 2 }}>
                <Grid container spacing={1}><Grid size={{ xs: 12, md: 7 }}><TextField fullWidth size="small" label={'Milestone ' + milestone.order + ' title'} value={draft.title} disabled={!editable} onChange={(event) => setMilestoneDrafts({ ...milestoneDrafts, [String(milestone._id)]: { ...draft, title: event.target.value } })} /><TextField fullWidth size="small" multiline minRows={2} sx={{ mt: .8 }} label="Scope / deliverable" value={draft.description} disabled={!editable} onChange={(event) => setMilestoneDrafts({ ...milestoneDrafts, [String(milestone._id)]: { ...draft, description: event.target.value } })} /></Grid><Grid size={{ xs: 12, md: 5 }}><TextField fullWidth size="small" type="number" label="Agreed amount (INR)" value={draft.amount} disabled={!editable} onChange={(event) => setMilestoneDrafts({ ...milestoneDrafts, [String(milestone._id)]: { ...draft, amount: event.target.value } })} /><Stack direction="row" spacing={.6} flexWrap="wrap" useFlexGap sx={{ mt: .8 }}><Chip size="small" label={label(milestone.status)} color={milestone.status === 'accepted' || milestone.status === 'paid' ? 'success' : 'warning'} />{editable && <Button size="small" variant="outlined" onClick={() => void saveDirectMilestone(milestone)} disabled={busy}>Save</Button>}{project.permissions?.surveyor && ['proposed', 'rejected'].includes(String(milestone.status || '')) && <Button size="small" color="success" variant="contained" onClick={() => void acceptDirectMilestone(milestone)} disabled={busy}>Accept</Button>}</Stack>{payment && <Typography variant="caption" sx={{ display: 'block', mt: .7, color: '#667085' }}>{payment.invoiceNumber} · {money(payment.amount)} · {label(payment.status)}</Typography>}</Grid></Grid>
              </Box>;
            })}</Stack>
          </Paper>}
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, lg: 4.8 }}>
        <Stack spacing={1.5}>
          <Paper id="survey-payment" elevation={0} sx={{ p: { xs: 1.6, md: 1.9 }, border: '1px solid #e4e9f0', borderRadius: 2.5, boxShadow: '0 6px 22px rgba(15,23,42,.035)' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center"><Stack direction="row" spacing={.8} alignItems="center"><PaidRounded sx={{ fontSize: 20, color: '#079455' }} /><Typography sx={{ fontWeight: 700, color: '#102a4c' }}>Payment Details</Typography></Stack><Chip size="small" label={label(project.paymentStatus || 'unpaid')} color={project.paymentStatus === 'paid' ? 'success' : 'warning'} /></Stack>
            {directProject && <Box sx={{ mt: 1.25, p: 1.2, borderRadius: 2, bgcolor: project.surveyorPaymentDetails?.ready ? '#f0fdf4' : '#fff7ed', border: project.surveyorPaymentDetails?.ready ? '1px solid #bbf7d0' : '1px solid #fed7aa' }}>
              <Typography variant="caption" sx={{ color: '#667085', fontWeight: 700 }}>SURVEYOR BANK INFORMATION</Typography>
              {project.surveyorPaymentDetails?.ready ? <Stack spacing={.35} sx={{ mt: .7 }}>
                <Stack direction="row" justifyContent="space-between" spacing={2}><Typography variant="body2" sx={{ color: '#667085' }}>Bank</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{project.surveyorPaymentDetails.bankName}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between" spacing={2}><Typography variant="body2" sx={{ color: '#667085' }}>Account</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{project.surveyorPaymentDetails.accountNumber}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between" spacing={2}><Typography variant="body2" sx={{ color: '#667085' }}>IFSC</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{project.surveyorPaymentDetails.ifsc}</Typography></Stack>
                <Typography variant="caption" sx={{ color: '#98a2b3' }}>Use these current Surveyor payment instructions before uploading proof.</Typography>
              </Stack> : <Typography variant="body2" sx={{ mt: .6, color: '#b54708' }}>The Surveyor must update bank name, account number and IFSC before milestone payment can be submitted.</Typography>}
            </Box>}
            <Box sx={{ mt: 1.25 }}>
              <Typography variant="caption" sx={{ color: '#667085' }}>Payment Amount</Typography>
              <Typography sx={{ fontSize: 21, fontWeight: 700, color: '#102a4c' }}>{money(firstPaymentRecord?.amount || approvedAmount)}</Typography>
              {firstPaymentRecord?.transactionId && <><Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#667085' }}>Transaction ID</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{firstPaymentRecord.transactionId}</Typography></>}
            </Box>
            <Stack spacing={1} sx={{ mt: 1.25 }}>
              {(project.payments || []).length ? project.payments.map((payment: any) => <Box key={payment._id} sx={{ p: 1.1, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #edf1f5' }}>
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center"><Box><Typography sx={{ fontSize: 13, fontWeight: 600 }}>{label(payment.type)}</Typography><Typography variant="caption" sx={{ color: '#667085' }}>{payment.invoiceNumber || 'Payment'} · {money(payment.amount)}</Typography></Box><Chip size="small" label={label(payment.status)} color={payment.status === 'paid' ? 'success' : 'warning'} /></Stack>
                <Stack direction="row" spacing={.6} flexWrap="wrap" useFlexGap sx={{ mt: .8 }}>
                  {payment.proofSubmitted && <Button size="small" variant="outlined" startIcon={<OpenInNewRounded />} onClick={() => void openPaymentProof(String(payment._id))} disabled={busy}>View Proof</Button>}
                  {project.permissions?.surveyor && ['pending', 'partial', 'overdue'].includes(payment.status) && (payment.type !== 'survey_final' || payment.paymentVerification?.status === 'submitted') && <Button size="small" variant="contained" startIcon={<PaidRounded />} onClick={() => acceptPayment(String(payment._id))} disabled={busy}>{payment.type === 'survey_final' ? 'Confirm Receipt' : 'Accept Payment'}</Button>}
                  {project.permissions?.surveyor && payment.type === 'survey_final' && payment.paymentVerification?.status === 'submitted' && <Button size="small" color="warning" variant="outlined" onClick={() => setPaymentRejectionOpen(true)} disabled={busy}>Return Proof</Button>}
                </Stack>
              </Box>) : <Typography variant="body2" sx={{ color: '#98a2b3' }}>Payment details will appear here when a payment is created.</Typography>}
            </Stack>
            {project.permissions?.landlord && finalPaymentRecord && ['awaiting_final_payment', 'payment_submitted'].includes(project.status) && finalPaymentRecord.paymentVerification?.status !== 'submitted' && <Button fullWidth variant="contained" sx={{ mt: 1.2 }} startIcon={<PaidRounded />} onClick={() => setFinalPaymentOpen(true)} disabled={busy}>{finalPaymentRejected ? 'Correct & Resubmit Payment Proof' : 'Submit Payment Proof'}</Button>}
          </Paper>

          <Paper elevation={0} sx={{ p: { xs: 1.6, md: 1.9 }, border: '1px solid #e4e9f0', borderRadius: 2.5, boxShadow: '0 6px 22px rgba(15,23,42,.035)' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center"><Stack direction="row" spacing={.8} alignItems="center"><ChatRounded sx={{ fontSize: 20, color: '#079455' }} /><Typography sx={{ fontWeight: 700, color: '#102a4c' }}>Messages & Notes</Typography></Stack><Button size="small" onClick={chat} disabled={busy}>View All</Button></Stack>
            <Stack spacing={.8} sx={{ mt: 1.2 }}>
              {fieldNotes.slice(0, 3).map((item: any, index: number) => <Box key={String(item._id || index)} sx={{ p: 1.05, border: '1px solid #edf1f5', borderRadius: 2 }}><Stack direction="row" spacing={.85}><Avatar src={surveyorAvatar || undefined} sx={{ width: 30, height: 30, fontSize: 12 }}>{String(project.surveyor?.name || 'S').slice(0, 1)}</Avatar><Box><Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{project.surveyor?.name || 'Surveyor'}</Typography><Typography variant="caption" sx={{ color: '#98a2b3' }}>{date(item.at || item.capturedAt || item.createdAt)}</Typography><Typography variant="body2" sx={{ mt: .35, color: '#475467', fontSize: 12.5 }}>{item.text || item}</Typography></Box></Stack></Box>)}
              {!fieldNotes.length && <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: '#f8fafc' }}><Typography variant="body2" sx={{ color: '#667085' }}>Use secure project chat to discuss the survey, evidence and required corrections.</Typography></Box>}
            </Stack>
            <Button fullWidth variant="outlined" startIcon={<ChatRounded />} onClick={chat} disabled={busy} sx={{ mt: 1.1 }}>Open Secure Conversation</Button>
          </Paper>

          <Paper elevation={0} sx={{ p: { xs: 1.6, md: 1.9 }, border: '1px solid #e4e9f0', borderRadius: 2.5, boxShadow: '0 6px 22px rgba(15,23,42,.035)' }}>
            <Typography sx={{ fontWeight: 700, color: '#102a4c' }}>Project Summary</Typography>
            <Stack spacing={.9} sx={{ mt: 1.2 }}>
              {[
                ['Survey type', label(project.job?.surveyType || project.surveyCategory)],
                ['Property type', project.job?.propertyType || project.propertySite?.propertyType || '—'],
                ['Visit date', date(project.job?.preferredVisitDate || project.startDate)],
                ['Deadline', date(project.job?.preferredCompletionDate || project.dueDate)],
                ['Project value', money(project.paymentSummary?.total)],
                ['Outstanding', money(project.paymentSummary?.outstanding)],
              ].map(([title, value]) => <Stack key={title} direction="row" justifyContent="space-between" spacing={2}><Typography variant="body2" sx={{ color: '#667085' }}>{title}</Typography><Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right', color: '#344054' }}>{value}</Typography></Stack>)}
            </Stack>
            <Box sx={{ mt: 1.25, p: 1.15, borderRadius: 2, bgcolor: 'rgba(7,148,85,.07)', border: '1px solid rgba(7,148,85,.12)' }}>
              <Typography variant="caption" sx={{ color: '#667085' }}>CURRENT ACTION</Typography>
              <Typography sx={{ mt: .2, fontSize: 13.5, fontWeight: 700, color: '#087a49' }}>{journey.nextAction}</Typography>
              <Typography variant="caption" sx={{ mt: .3, display: 'block', color: '#667085' }}>{journey.waiting}</Typography>
              <Box sx={{ mt: .9 }}>{renderJourneyAction()}</Box>
            </Box>
          </Paper>
        </Stack>
      </Grid>
    </Grid>

    <Button fullWidth variant="contained" startIcon={<TaskAltRounded />} onClick={() => {
      if (project.permissions?.landlord && project.status === 'awaiting_landlord_review') setReviewOpen(true);
      else document.getElementById('survey-evidence')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }} sx={{ display: { xs: 'flex', md: 'none' }, mt: 1.5, minHeight: 46, bgcolor: '#087a49', '&:hover': { bgcolor: '#066b40' } }}>Review Evidence</Button>

    <ProfessionalDialog open={Boolean(milestonePayment)} onClose={() => !busy && setMilestonePayment(null)} maxWidth="sm" fullWidth professionalTitle={`Pay milestone ${milestonePayment?.milestone?.order || ''}`} professionalSubtitle="Pay using the assigned Surveyor's current bank information, then enter the transaction ID and upload payment proof.">
      <Box component="form" onSubmit={submitDirectMilestonePayment}>
        <DialogContent dividers><Stack spacing={2}>
          <Alert severity="info">Milestone amount: {money(milestonePayment?.milestone?.amount)}</Alert>
          <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: project.surveyorPaymentDetails?.ready ? '#f0fdf4' : '#fff7ed', border: project.surveyorPaymentDetails?.ready ? '1px solid #bbf7d0' : '1px solid #fed7aa' }}>
            <Typography sx={{ fontWeight: 700, color: '#102a4c' }}>Surveyor bank information</Typography>
            {project.surveyorPaymentDetails?.ready ? <Stack spacing={.65} sx={{ mt: 1 }}>
              <Stack direction="row" justifyContent="space-between" spacing={2}><Typography variant="body2" color="text.secondary">Bank name</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{project.surveyorPaymentDetails.bankName}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between" spacing={2}><Typography variant="body2" color="text.secondary">Account number</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{project.surveyorPaymentDetails.accountNumber}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between" spacing={2}><Typography variant="body2" color="text.secondary">IFSC</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{project.surveyorPaymentDetails.ifsc}</Typography></Stack>
            </Stack> : <Typography variant="body2" sx={{ mt: .8, color: '#b54708' }}>Payment is locked until the Surveyor updates complete bank information.</Typography>}
          </Box>
          <TextField select fullWidth label="Payment method" value={milestonePayment?.method || 'bank_transfer'} onChange={(event) => milestonePayment && setMilestonePayment({ ...milestonePayment, method: event.target.value as 'upi' | 'bank_transfer' | 'offline' })}>{[['bank_transfer', 'Bank transfer'], ['upi', 'UPI'], ['offline', 'Offline transfer']].map(([value, title]) => <MenuItem key={value} value={value}>{title}</MenuItem>)}</TextField>
          <TextField required fullWidth label="Transaction ID" value={milestonePayment?.transactionId || ''} onChange={(event) => milestonePayment && setMilestonePayment({ ...milestonePayment, transactionId: event.target.value })} inputProps={{ minLength: 6, maxLength: 160 }} />
          <Button component="label" variant="outlined" startIcon={<CloudUploadRounded />}>{milestonePayment?.proof ? milestonePayment.proof.name : 'Upload payment proof'}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => milestonePayment && setMilestonePayment({ ...milestonePayment, proof: event.target.files?.[0] || null })} /></Button>
          <FormControlLabel control={<Checkbox checked={Boolean(milestonePayment?.payerDeclaration)} onChange={(event) => milestonePayment && setMilestonePayment({ ...milestonePayment, payerDeclaration: event.target.checked })} />} label={`I confirm that I paid ${money(milestonePayment?.milestone?.amount)} to the Surveyor using the bank information shown above.`} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setMilestonePayment(null)} disabled={busy}>Cancel</Button><Button type="submit" variant="contained" startIcon={<SendRounded />} disabled={busy || !project.surveyorPaymentDetails?.ready || !milestonePayment?.transactionId.trim() || !milestonePayment?.proof || !milestonePayment?.payerDeclaration}>{busy ? 'Submitting…' : 'Submit transaction & proof'}</Button></DialogActions>
      </Box>
    </ProfessionalDialog>
    <ProfessionalDialog open={fieldOpen} onClose={() => setFieldOpen(false)} maxWidth="sm" fullWidth professionalTitle={field.mode === 'measurement' ? 'Update measurement' : field.mode === 'note' ? 'Update field note' : 'Record field observation'} professionalSubtitle="Add or update the field record for this hired project."><Box component="form" onSubmit={saveFieldwork}><DialogContent dividers><Stack spacing={2}><Grid container spacing={2}><Grid size={{ xs: 12, sm: 6 }}><TextField select fullWidth label="Measurement type" value={field.type} disabled={field.mode === 'note'} onChange={(event) => setField({ ...field, type: event.target.value })}>{['dimension', 'area', 'angle', 'elevation', 'boundary', 'other'].map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Label" value={field.label} disabled={field.mode === 'note'} onChange={(event) => setField({ ...field, label: event.target.value })} placeholder="North boundary" /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="number" label="Value" value={field.value} disabled={field.mode === 'note'} onChange={(event) => setField({ ...field, value: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Unit" value={field.unit} disabled={field.mode === 'note'} onChange={(event) => setField({ ...field, unit: event.target.value })} placeholder="metre" /></Grid></Grid><TextField fullWidth label="Measurement notes" value={field.notes} disabled={field.mode === 'note'} onChange={(event) => setField({ ...field, notes: event.target.value })} /><TextField fullWidth multiline minRows={3} label="General field note" value={field.fieldNote} disabled={field.mode === 'measurement'} onChange={(event) => setField({ ...field, fieldNote: event.target.value })} /></Stack></DialogContent><DialogActions><Button onClick={() => { setFieldOpen(false); resetField(); }}>Cancel</Button><Button type="submit" variant="contained" disabled={busy || (field.mode === 'note' ? !field.fieldNote.trim() : (!field.label.trim() || field.value === '' || !field.unit.trim()))}>{busy ? 'Saving…' : field.mode === 'measurement' ? 'Update measurement' : field.mode === 'note' ? 'Update note' : 'Save fieldwork'}</Button></DialogActions></Box></ProfessionalDialog>
    <ProfessionalDialog open={reviewOpen} onClose={() => !busy && setReviewOpen(false)} maxWidth="sm" fullWidth professionalTitle="Review fieldwork" professionalSubtitle="Record your decision only after you have inspected the measurements, field notes, evidence, and agreed scope.">
      <Box component="form" onSubmit={reviewFieldwork}>
        <DialogContent dividers><Stack spacing={2}>
          <Alert severity="info">Review round {Number(fieldworkReview.version || 0) || 1}: {measurements.length} measurements, {fieldNotes.length} notes, and {project.evidence?.length || 0} evidence files are available. Any submitted field record can move the workflow forward.</Alert>
          <FormControlLabel control={<Checkbox checked={reviewChecklist.measurementsReviewed} onChange={(event) => setReviewChecklist({ ...reviewChecklist, measurementsReviewed: event.target.checked })} />} label="I reviewed the available measurements and field notes." />
          <FormControlLabel control={<Checkbox checked={reviewChecklist.evidenceReviewed} onChange={(event) => setReviewChecklist({ ...reviewChecklist, evidenceReviewed: event.target.checked })} />} label="I reviewed the available photos, videos, and documents (if any)." />
          <FormControlLabel control={<Checkbox checked={reviewChecklist.scopeReviewed} onChange={(event) => setReviewChecklist({ ...reviewChecklist, scopeReviewed: event.target.checked })} />} label="I confirm the submitted fieldwork meets the agreed survey scope." />
          <TextField fullWidth multiline minRows={3} label="Review comment (optional)" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} inputProps={{ maxLength: 2000 }} helperText="This is shared with the assigned Surveyor and retained in the project audit record." />
          <Alert severity="warning">Approving this review creates the final invoice. The report stays locked until the landlord declares the payment and the Surveyor confirms receipt.</Alert>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setReviewOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" color="success" variant="contained" disabled={busy || !reviewChecklist.measurementsReviewed || !reviewChecklist.evidenceReviewed || !reviewChecklist.scopeReviewed}>{busy ? 'Recording…' : 'Approve fieldwork & create final invoice'}</Button></DialogActions>
      </Box>
    </ProfessionalDialog>
    <ProfessionalDialog open={finalPaymentOpen} onClose={() => !busy && setFinalPaymentOpen(false)} maxWidth="sm" fullWidth professionalTitle="Submit final survey payment" professionalSubtitle="Enter the transaction ID, upload the payment screenshot, and make the landlord payment declaration. The assigned Surveyor then confirms receipt.">
      <Box component="form" onSubmit={submitFinalPayment}>
        <DialogContent dividers><Stack spacing={2}>
          <Alert severity="info">Final amount: {money(finalPaymentRecord?.amount)}</Alert>
          <TextField select fullWidth label="Payment method" value={finalPayment.method} onChange={(event) => setFinalPayment({ ...finalPayment, method: event.target.value as 'upi' | 'bank_transfer' | 'offline' })}>{[['upi', 'UPI'], ['bank_transfer', 'Bank transfer'], ['offline', 'Offline transfer']].map(([value, title]) => <MenuItem key={value} value={value}>{title}</MenuItem>)}</TextField>
          <TextField required fullWidth label="Transaction ID" value={finalPayment.transactionId} onChange={(event) => setFinalPayment({ ...finalPayment, transactionId: event.target.value })} inputProps={{ minLength: 6, maxLength: 160 }} />
          <Button component="label" variant="outlined" startIcon={<CloudUploadRounded />}>{finalPayment.proof ? finalPayment.proof.name : 'Upload payment screenshot'}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFinalPayment({ ...finalPayment, proof: event.target.files?.[0] || null })} /></Button>
          <Typography variant="caption" color="text.secondary">PNG, JPG, JPEG, or WebP only. The screenshot remains private and is available only to the landlord, assigned Surveyor, and administrators.</Typography>
          <FormControlLabel control={<Checkbox checked={finalPayment.payerDeclaration} onChange={(event) => setFinalPayment({ ...finalPayment, payerDeclaration: event.target.checked })} />} label={`I confirm that I made or authorised this exact payment of ${money(finalPaymentRecord?.amount)}.`} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setFinalPaymentOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" variant="contained" startIcon={<SendRounded />} disabled={busy || !finalPayment.transactionId.trim() || !finalPayment.proof || !finalPayment.payerDeclaration}>{busy ? 'Submitting…' : 'Submit proof & declaration'}</Button></DialogActions>
      </Box>
    </ProfessionalDialog>
    <ProfessionalDialog open={paymentConfirmationOpen} onClose={() => !busy && setPaymentConfirmationOpen(false)} maxWidth="sm" fullWidth professionalTitle="Confirm final payment receipt" professionalSubtitle="The Surveyor must verify the landlord's transaction ID and screenshot before the report can be unlocked.">
      <Box component="form" onSubmit={confirmFinalPayment}>
        <DialogContent dividers><Stack spacing={2}>
          <Alert severity="info">Invoice {finalPaymentRecord?.invoiceNumber || '—'} · {money(finalPaymentRecord?.amount)} · transaction {finalPaymentRecord?.transactionId || 'recorded privately'}</Alert>
          <Button variant="outlined" onClick={() => finalPaymentRecord && void openPaymentProof(String(finalPaymentRecord._id))} disabled={busy || !finalPaymentRecord?.proofSubmitted}>Open payment screenshot</Button>
          <FormControlLabel control={<Checkbox checked={paymentConfirmation.receiptConfirmed} onChange={(event) => setPaymentConfirmation({ ...paymentConfirmation, receiptConfirmed: event.target.checked })} />} label="I reviewed the transaction and screenshot and confirm that the final payment was received." />
          <TextField fullWidth multiline minRows={3} label="Confirmation note (optional)" value={paymentConfirmation.confirmationNote} onChange={(event) => setPaymentConfirmation({ ...paymentConfirmation, confirmationNote: event.target.value })} inputProps={{ maxLength: 1200 }} helperText="This note is retained with the payment confirmation audit record." />
          <Alert severity="warning">This action unlocks final report upload. Property verification still occurs only after the Surveyor uploads the final report.</Alert>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setPaymentConfirmationOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" variant="contained" disabled={busy || !paymentConfirmation.receiptConfirmed}>{busy ? 'Confirming…' : 'Confirm receipt & unlock report'}</Button></DialogActions>
      </Box>
    </ProfessionalDialog>
    <ProfessionalDialog open={paymentRejectionOpen} onClose={() => !busy && setPaymentRejectionOpen(false)} maxWidth="sm" fullWidth professionalTitle="Return payment proof" professionalSubtitle="Tell the landlord exactly what needs to be corrected. They can resubmit without restarting the survey workflow."><Box component="form" onSubmit={rejectFinalPayment}><DialogContent dividers><Stack spacing={2}><Alert severity="info">The final report remains locked until corrected payment proof is confirmed.</Alert><TextField required fullWidth multiline minRows={4} label="Correction reason" value={paymentRejectionReason} onChange={(event) => setPaymentRejectionReason(event.target.value)} helperText="For example: transaction ID is unclear or the screenshot does not show the amount." inputProps={{ minLength: 5, maxLength: 1200 }} /></Stack></DialogContent><DialogActions><Button onClick={() => setPaymentRejectionOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" color="warning" variant="contained" disabled={busy || paymentRejectionReason.trim().length < 5}>{busy ? 'Returning…' : 'Return for correction'}</Button></DialogActions></Box></ProfessionalDialog>
    <ProfessionalDialog open={revisionOpen} onClose={() => setRevisionOpen(false)} maxWidth="sm" fullWidth professionalTitle={directProject && project.status === 'client_review' ? 'Request report revision' : 'Request fieldwork revision'}><Box component="form" onSubmit={sendRevision}><DialogContent dividers><TextField required fullWidth multiline minRows={4} label={directProject && project.status === 'client_review' ? 'Required report corrections' : 'Required corrections'} value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} inputProps={{ minLength: 5, maxLength: 1200 }} /></DialogContent><DialogActions><Button onClick={() => setRevisionOpen(false)}>Cancel</Button><Button type="submit" color="warning" variant="contained" disabled={busy || revisionReason.trim().length < 5}>Send revision request</Button></DialogActions></Box></ProfessionalDialog>
  </Box>;
}
