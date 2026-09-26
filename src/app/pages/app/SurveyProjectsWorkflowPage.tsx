import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, Checkbox, Chip, CircularProgress, DialogActions, DialogContent,
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
  acceptSurveyMilestone, acceptSurveyWorkflowPayment, attachSurveyWorkflowEvidence, attachSurveyWorkflowReportFile,
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
  { title: 'Survey report submitted', owner: 'Surveyor' },
  { title: 'Report review & milestone 2', owner: 'Landlord' },
  { title: 'Receipt confirmation', owner: 'Surveyor' },
  { title: 'Property verified', owner: 'SecureAsset' },
] as const;
type SurveyJourneyState = { activeStep: number; status: string; owner: string; nextAction: string; waiting: string };
function surveyJourney(project: any): SurveyJourneyState {
  const status = String(project?.status || '');
  const stage = String(project?.workflowStage || 'hired');
  if (project?.workflowType === 'direct_surveyor') {
    if (status === 'completed' || stage === 'completed' || project?.verificationStatus === 'fully_verified') return { activeStep: 7, status: 'Property verified', owner: 'SecureAsset', nextAction: 'Review or download the verified survey report.', waiting: 'The completed direct-hiring record is available to the landlord and Surveyor.' };
    if (status === 'second_payment_submitted') return { activeStep: 6, status: 'Milestone 2 proof awaiting receipt confirmation', owner: 'Surveyor', nextAction: 'Review the landlord transaction and payment proof, then accept milestone 2.', waiting: 'Property verification is completed only after the Surveyor accepts the second payment.' };
    if (status === 'awaiting_second_payment') return { activeStep: 5, status: 'Report ready for milestone 2', owner: 'Landlord', nextAction: 'Read the submitted survey report, then pay milestone 2 with transaction ID and proof.', waiting: 'The property remains unverified until milestone 2 receipt is accepted.' };
    if (status === 'report_upload_requested') return { activeStep: 4, status: 'Milestone 1 accepted — report needed', owner: 'Surveyor', nextAction: 'Upload the survey report for the landlord to read.', waiting: 'Milestone 2 opens after the report is submitted.' };
    if (status === 'first_payment_submitted') return { activeStep: 3, status: 'Milestone 1 proof awaiting receipt confirmation', owner: 'Surveyor', nextAction: 'Review the landlord transaction and payment proof, then accept milestone 1.', waiting: 'The report upload remains locked until milestone 1 is accepted.' };
    if (status === 'awaiting_first_payment') return { activeStep: 3, status: 'Milestone 1 payment needed', owner: 'Landlord', nextAction: 'Pay milestone 1 with transaction ID and payment proof.', waiting: 'The Surveyor can submit the report after receipt confirmation.' };
    if (stage === 'in_progress') return { activeStep: 2, status: 'Visit and fieldwork in progress', owner: 'Surveyor', nextAction: 'Complete the site visit, record measurements, attach evidence, and submit.', waiting: 'Milestone 1 payment opens after fieldwork is submitted.' };
    return { activeStep: 1, status: 'Agree the two milestones', owner: 'Both', nextAction: 'The landlord sets the two amounts and the Surveyor accepts them before check-in.', waiting: 'Chat is available now; site check-in is locked until both milestones are accepted.' };
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
  return <Card data-secureasset-survey-evidence-actions="three-dot-v164" elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
    <Box sx={{ height: 172, bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}>
      {!url && !failed && <CircularProgress size={26} />}
      {failed && <Stack alignItems="center" spacing={1}><DescriptionRounded color="disabled" /><Typography variant="caption" color="text.secondary">Preview unavailable</Typography></Stack>}
      {url && isImage && <Box component="img" src={url} alt={item.name || 'Survey evidence'} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {url && isVideo && <Box component="video" src={url} muted preload="metadata" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {url && !isImage && !isVideo && <Stack alignItems="center" spacing={1}><DescriptionRounded color="primary" sx={{ fontSize: 38 }} /><Typography variant="caption">Open document</Typography></Stack>}
    </Box>
    <CardContent sx={{ p: 1.6, '&:last-child': { pb: 1.6 } }}>
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
  const canSubmitFieldwork = Boolean(project?.permissions?.surveyor && (currentStage === 'in_progress' || (currentStage === 'submitted' && project?.status === 'revision_requested')));
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
    try { const gps = await gpsPosition(); const response = await checkInSurveyWorkflowProject(projectId, gps); setProject(response.data); setNotice(response.message || 'Secure GPS check-in verified.'); }
    catch (reason) { setError((reason as Error).message); }
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
      if (project.permissions?.landlord && journey.activeStep === 3 && firstMilestone && firstPayment && ['awaiting_first_payment', 'first_payment_submitted'].includes(project.status) && firstPayment.paymentVerification?.status !== 'submitted') return <Button variant="contained" startIcon={<PaidRounded />} onClick={() => openDirectMilestonePayment(firstMilestone)} disabled={busy}>Pay milestone 1 &amp; submit proof</Button>;
      if (project.permissions?.surveyor && journey.activeStep === 3 && firstPayment?.paymentVerification?.status === 'submitted') return <Button variant="contained" startIcon={<PaidRounded />} onClick={() => acceptPayment(String(firstPayment._id))} disabled={busy}>Accept milestone 1 payment</Button>;
      if (project.permissions?.surveyor && journey.activeStep === 4 && canUploadFinalReport) return <Button component="label" variant="contained" startIcon={<UploadFileRounded />} disabled={busy}>Upload survey report<input hidden type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={(event) => { void uploadReportFile(event.target.files); event.currentTarget.value = ''; }} /></Button>;
      if (project.permissions?.landlord && journey.activeStep === 5 && secondMilestone && secondPayment && secondPayment.paymentVerification?.status !== 'submitted') return <Button variant="contained" startIcon={<PaidRounded />} onClick={() => openDirectMilestonePayment(secondMilestone)} disabled={busy}>Pay milestone 2 &amp; submit proof</Button>;
      if (project.permissions?.surveyor && journey.activeStep === 6 && secondPayment?.paymentVerification?.status === 'submitted') return <Button variant="contained" startIcon={<PaidRounded />} onClick={() => acceptPayment(String(secondPayment._id))} disabled={busy}>Accept milestone 2 payment &amp; verify property</Button>;
      if (project.permissions?.surveyor && currentStage === 'hired' && directBudgetReadyForUi) return <Button variant="contained" startIcon={<LocationOnRounded />} onClick={checkIn} disabled={busy}>Secure check-in to start fieldwork</Button>;
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
    if (project.permissions?.surveyor && currentStage === 'hired') return <Button variant="contained" startIcon={<LocationOnRounded />} onClick={checkIn} disabled={busy}>Secure check-in to start fieldwork</Button>;
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

  return <Box data-secureasset-survey-workflow="field-review-payment-report-v164" data-secureasset-survey-version="premium-project-workspace-v211" sx={{
    px: { xs: 1.5, sm: 2.5, lg: 3.5 }, pb: 8, pt: { xs: 1.5, md: 2.25 }, maxWidth: 1600, mx: 'auto',
    fontFamily: '"Inter", "Open Sans", Arial, sans-serif',
    '& .MuiTypography-root, & .MuiButton-root, & .MuiChip-root, & .MuiInputBase-root': { fontFamily: '"Inter", "Open Sans", Arial, sans-serif' },
    '& .MuiButton-root': { textTransform: 'none', borderRadius: 2.2, fontWeight: 700, boxShadow: 'none' },
    '& .MuiChip-root': { fontWeight: 700 },
  }}>
    <Box data-secureasset-survey-premium-header="v211" sx={{
      mb: 2.25, p: { xs: 2, sm: 2.4, md: 2.8 }, borderRadius: { xs: 3, md: 4 },
      border: '1px solid rgba(15,23,42,.08)',
      background: 'linear-gradient(135deg, rgba(255,255,255,.98) 0%, rgba(248,250,252,.98) 52%, rgba(239,246,255,.92) 100%)',
      boxShadow: '0 14px 40px rgba(15,23,42,.07)',
    }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'center' }}>
        <Box sx={{ minWidth: 0 }}>
          <Button size="small" startIcon={<ArrowBackRounded />} onClick={() => navigate('/app/survey-projects')} sx={{ px: 0, mb: .75, color: 'text.secondary', '&:hover': { bgcolor: 'transparent', color: 'primary.main' } }}>Survey Projects</Button>
          <Stack direction="row" spacing={1.1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h4" sx={{ fontWeight: 850, color: '#0f2747', letterSpacing: '-.035em', fontSize: { xs: 27, sm: 32, md: 36 } }}>Property Survey Project</Typography>
            <Chip size="small" label={journey.status} color={journey.activeStep === journeySteps.length - 1 ? 'success' : 'primary'} sx={{ borderRadius: 99, px: .35 }} />
          </Stack>
          <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: .8 }}>
            <Typography variant="body2" color="text.secondary">Project ID: <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{project.projectNumber || project._id}</Box></Typography>
            <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'divider', display: { xs: 'none', sm: 'block' } }} />
            <Typography variant="body2" color="text.secondary">{project.property?.address?.fullAddress || project.job?.addressApproximate || project.propertySite?.fullAddress || 'Property location protected'}</Typography>
          </Stack>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
          <Button variant="outlined" startIcon={<ChatRounded />} onClick={chat} disabled={busy} sx={{ minHeight: 44, px: 2.2 }}>Message Surveyor</Button>
          {project.permissions?.surveyor && surveyorCanEdit && <Button component="label" variant="contained" startIcon={<CloudUploadRounded />} disabled={busy} sx={{ minHeight: 44, px: 2.2, background: 'linear-gradient(135deg,#0b4aa2,#0a2f73)' }}>Upload Evidence<input hidden multiple type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={(event) => { void uploadEvidence(event.target.files); event.currentTarget.value = ''; }} /></Button>}
        </Stack>
      </Stack>
    </Box>
    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mt: 2 }}>{notice}</Alert>}
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mt: 2 }}>{error}</Alert>}

    <Paper data-secureasset-survey-journey="premium-guided-journey-v211" elevation={0} sx={{
      p: { xs: 1.8, sm: 2.2, md: 2.7 }, mt: 2, border: '1px solid rgba(15,23,42,.08)', borderRadius: { xs: 3, md: 4 },
      overflow: 'hidden', background: 'linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)', boxShadow: '0 10px 32px rgba(15,23,42,.055)'
    }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.2} alignItems={{ md: 'center' }}>
        <Box>
          <Typography sx={{ fontSize: { xs: 16, md: 18 }, fontWeight: 800, color: '#102a4c' }}>{directProject ? 'Direct Surveyor Project Progress' : 'Survey Project Progress'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .35 }}>{directProject ? 'Track the agreed milestones, site visit, evidence, payments, report and verification.' : 'Track field evidence, review, payment, final report and property verification.'}</Typography>
        </Box>
        <Chip size="small" color={journey.activeStep === journeySteps.length - 1 ? 'success' : 'primary'} label={`Current owner: ${journey.owner}`} sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, borderRadius: 99 }} />
      </Stack>
      <Box sx={{ mt: 2, mx: { xs: -1.8, sm: -2.2, md: -2.7 }, px: { xs: 1.8, sm: 2.2, md: 2.7 }, overflowX: 'auto', pb: .7 }}>
        <Stepper activeStep={journey.activeStep} alternativeLabel sx={{
          minWidth: directProject ? 900 : 700,
          '& .MuiStepConnector-line': { borderColor: 'rgba(20,65,120,.18)', borderTopWidth: 2 },
          '& .MuiStepIcon-root': { color: '#d6e0ec' },
          '& .MuiStepIcon-root.Mui-active': { color: '#0b4aa2' },
          '& .MuiStepIcon-root.Mui-completed': { color: '#079455' },
          '& .MuiStepLabel-label': { fontSize: 12, fontWeight: 700, color: '#667085', mt: .5 },
          '& .MuiStepLabel-label.Mui-active': { color: '#0b4aa2', fontWeight: 800 },
          '& .MuiStepLabel-label.Mui-completed': { color: '#344054' },
        }}>
          {journeySteps.map((step) => <Step key={step.title}><StepLabel optional={<Typography variant="caption" color="text.secondary">{step.owner}</Typography>}>{step.title}</StepLabel></Step>)}
        </Stepper>
      </Box>
      <LinearProgress variant="determinate" value={journeyProgress} sx={{ mt: 1, height: 6, borderRadius: 99, bgcolor: '#e9eef5', '& .MuiLinearProgress-bar': { borderRadius: 99, background: 'linear-gradient(90deg,#0b4aa2,#079455)' } }} />
      <Box sx={{ mt: 2, p: { xs: 1.6, sm: 1.9 }, borderRadius: 2.5, bgcolor: 'rgba(11,74,162,.045)', border: '1px solid rgba(11,74,162,.10)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ md: 'center' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#0b4aa2', letterSpacing: '.08em' }}>NEXT ACTION</Typography>
            <Typography sx={{ mt: .3, fontWeight: 800, color: '#102a4c' }}>{journey.nextAction}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .35 }}>{journey.waiting}</Typography>
          </Box>
          <Box sx={{ flexShrink: 0 }}>{renderJourneyAction()}</Box>
        </Stack>
      </Box>
    </Paper>

    <Grid container spacing={2.5} sx={{ mt: .2 }}>
      <Grid size={{ xs: 12, lg: 8 }}><Stack spacing={2.5}>
        {directProject && <Paper data-secureasset-direct-surveyor-budget="two-milestones-v205" elevation={0} sx={{ p: { xs: 2, md: 2.8 }, border: '1px solid', borderColor: 'primary.light', borderRadius: 4, bgcolor: 'rgba(25, 118, 210, .035)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ md: 'center' }}><Box><Typography variant="h6" sx={{ fontWeight: 700 }}>Two-milestone budget</Typography><Typography color="text.secondary">The landlord proposes the amounts; the hired Surveyor accepts each milestone before site work begins.</Typography></Box><Chip size="small" color={directBudgetReadyForUi ? 'success' : 'warning'} label={directBudgetReadyForUi ? 'Budget agreed' : 'Awaiting agreement'} /></Stack>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1.5}>{directMilestones.map((milestone: any) => {
            const draft = milestoneDrafts[String(milestone._id)] || { title: milestone.title || '', description: milestone.description || '', amount: String(milestone.amount || '') };
            const payment = paymentForMilestone(milestone);
            const editable = project.permissions?.landlord && ['proposed', 'rejected'].includes(String(milestone.status || ''));
            return <Paper variant="outlined" key={milestone._id} sx={{ p: 1.7, borderRadius: 3 }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} justifyContent="space-between"><Box sx={{ flex: 1 }}><TextField fullWidth size="small" label={`Milestone ${milestone.order} title`} value={draft.title} disabled={!editable} onChange={(event) => setMilestoneDrafts({ ...milestoneDrafts, [String(milestone._id)]: { ...draft, title: event.target.value } })} /><TextField fullWidth size="small" multiline minRows={2} sx={{ mt: 1 }} label="Scope / deliverable" value={draft.description} disabled={!editable} onChange={(event) => setMilestoneDrafts({ ...milestoneDrafts, [String(milestone._id)]: { ...draft, description: event.target.value } })} /></Box><Stack sx={{ minWidth: { md: 230 } }} spacing={1}><TextField fullWidth size="small" type="number" label="Agreed amount (INR)" value={draft.amount} disabled={!editable} onChange={(event) => setMilestoneDrafts({ ...milestoneDrafts, [String(milestone._id)]: { ...draft, amount: event.target.value } })} /><Stack direction="row" spacing={.7} flexWrap="wrap" useFlexGap><Chip size="small" label={label(milestone.status)} color={milestone.status === 'accepted' || milestone.status === 'paid' ? 'success' : 'warning'} />{editable && <Button size="small" variant="outlined" onClick={() => void saveDirectMilestone(milestone)} disabled={busy}>Save budget</Button>}{project.permissions?.surveyor && ['proposed', 'rejected'].includes(String(milestone.status || '')) && <Button size="small" color="success" variant="contained" onClick={() => void acceptDirectMilestone(milestone)} disabled={busy}>Accept</Button>}</Stack>{payment && <Typography variant="caption" color="text.secondary">{payment.invoiceNumber} · {money(payment.amount)} · {label(payment.status)}</Typography>}</Stack></Stack>
              {payment?.paymentVerification?.status === 'submitted' && <Alert severity="info" sx={{ mt: 1.2, py: 0.3 }}>Payment proof submitted. The Surveyor must review the transaction and accept receipt.</Alert>}
            </Paper>;
          })}</Stack>
          {!directMilestones.length && <Alert severity="error" sx={{ mt: 2 }}>This direct project has no milestones. Contact support before fieldwork begins.</Alert>}
        </Paper>}
        <Paper elevation={0} sx={{ p: { xs: 2, md: 2.8 }, border: '1px solid rgba(15,23,42,.08)', borderColor: 'rgba(15,23,42,.08)', borderRadius: 4, boxShadow: '0 10px 30px rgba(15,23,42,.05)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}><Box><Typography variant="h6" sx={{ fontWeight: 800, color: '#102a4c' }}>Project Overview</Typography><Typography color="text.secondary">Property, contacts, schedule, scope and agreed commercial details.</Typography></Box><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {project.navigationUrl && <Button component="a" href={project.navigationUrl} target="_blank" rel="noreferrer" variant="outlined" startIcon={<MapRounded />}>Navigate</Button>}
            <Button variant="outlined" startIcon={<ChatRounded />} onClick={chat} disabled={busy}>Chat</Button>
          </Stack></Stack>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>{[
            ['Survey type', label(project.job?.surveyType || project.surveyCategory)], ['Property type', project.job?.propertyType || project.propertySite?.propertyType || '—'],
            ['Landlord', project.client?.name || '—'], ['Surveyor', project.surveyor?.name || '—'], ['Visit date', date(project.job?.preferredVisitDate || project.startDate)],
            ['Deadline', date(project.job?.preferredCompletionDate || project.dueDate)], ['Agreed value', money(project.paymentSummary?.total)], ['Outstanding', money(project.paymentSummary?.outstanding)],
          ].map(([title, value]) => <Grid size={{ xs: 12, sm: 6, md: 4 }} key={title}><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{title.toUpperCase()}</Typography><Typography sx={{ fontWeight: 600, mt: .3 }}>{value}</Typography></Grid>)}</Grid>
          {(project.job?.requirements?.length || project.job?.deliverables?.length || project.quotation?.scope) && <><Divider sx={{ my: 2 }} /><Grid container spacing={2}><Grid size={{ xs: 12, md: 6 }}><Typography sx={{ fontWeight: 700, mb: 1 }}>Requirements</Typography>{(project.job?.requirements || []).map((item: string) => <Typography key={item} variant="body2" color="text.secondary">• {item}</Typography>)}{!project.job?.requirements?.length && <Typography variant="body2" color="text.secondary">{project.quotation?.scope || 'No extra requirements'}</Typography>}</Grid><Grid size={{ xs: 12, md: 6 }}><Typography sx={{ fontWeight: 700, mb: 1 }}>Deliverables</Typography>{(project.job?.deliverables || []).map((item: string) => <Typography key={item} variant="body2" color="text.secondary">• {item}</Typography>)}{!project.job?.deliverables?.length && <Typography variant="body2" color="text.secondary">Formal measured survey report and supporting evidence.</Typography>}</Grid></Grid></>}
          <Box sx={{ mt: 2.5 }}><SurveyProjectNavigationMap apiKey={mapApiKey} destination={projectDestination(project)} destinationLabel={project.property?.title || project.job?.title || 'survey property'} externalUrl={project.navigationUrl} travelMode={mapTravelMode} defaultZoom={Number(siteData.settings?.map?.defaultZoom || 15)} mapId={String(siteData.settings?.map?.mapId || '')} directionsEnabled={siteData.settings?.map?.directionsEnabled !== false} serverRoutingEnabled={siteData.settings?.map?.serverRoutesEnabled !== false && siteData.settings?.map?.routesEnabled !== false} routeRefreshSeconds={Number(siteData.settings?.map?.routeRefreshSeconds || 10)} locationUpdateSeconds={Number(siteData.settings?.map?.locationUpdateSeconds || 5)} /></Box>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 2, md: 2.8 }, border: '1px solid rgba(15,23,42,.08)', borderColor: 'rgba(15,23,42,.08)', borderRadius: 4, boxShadow: '0 10px 30px rgba(15,23,42,.05)' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}><Box><Typography variant="h6" sx={{ fontWeight: 800, color: '#102a4c' }}>Site Visit & Measurements</Typography><Typography color="text.secondary">GPS check-in, measurements, field notes and secure supporting evidence for this survey.</Typography></Box>{project.permissions?.surveyor && <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {currentStage === 'hired' && <Button variant="contained" startIcon={<LocationOnRounded />} onClick={checkIn} disabled={busy}>Secure check-in</Button>}
            {surveyorCanEdit && <Button variant="outlined" startIcon={<NoteAddRounded />} onClick={() => setFieldOpen(true)}>Add field data</Button>}
            {surveyorCanEdit && <Button component="label" variant="outlined" startIcon={<CloudUploadRounded />} disabled={busy}>Upload evidence<input hidden multiple type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={(event) => { void uploadEvidence(event.target.files); event.currentTarget.value = ''; }} /></Button>}
            {canSubmitFieldwork && <Button variant="contained" startIcon={<SendRounded />} onClick={submitFieldworkReview} disabled={busy}>Submit for landlord review</Button>}
          </Stack>}</Stack>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack direction="row" spacing={1} alignItems="center"><StraightenRounded color="primary" /><Typography sx={{ fontWeight: 700 }}>Measurements ({measurements.length})</Typography></Stack>
              <Stack spacing={1} sx={{ mt: 1.3 }}>{measurements.length ? measurements.map((item: any, index: number) => <Box key={`${item._id || item.label}-${index}`} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}><Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center"><Box><Typography sx={{ fontWeight: 600 }}>{item.label || label(item.type)}</Typography>{item.notes && <Typography variant="caption" color="text.secondary">{item.notes}</Typography>}</Box><Stack direction="row" spacing={.5} alignItems="center"><Typography color="primary" sx={{ fontWeight: 700 }}>{item.value} {item.unit}</Typography>{surveyorCanEdit && <Button size="small" startIcon={<EditRounded />} onClick={() => editMeasurement(item, index)}>Edit</Button>}</Stack></Stack></Box>) : <Typography variant="body2" color="text.secondary">No measurements recorded.</Typography>}</Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack direction="row" spacing={1} alignItems="center"><NoteAddRounded color="primary" /><Typography sx={{ fontWeight: 700 }}>Field notes ({fieldNotes.length})</Typography></Stack>
              <Stack spacing={1} sx={{ mt: 1.3 }}>{fieldNotes.length ? fieldNotes.map((item: any, index: number) => <Box key={`${item._id || item.text || index}`} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}><Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start"><Box><Typography variant="body2">{item.text || item}</Typography><Typography variant="caption" color="text.secondary">{date(item.at || item.capturedAt || item.createdAt)}</Typography></Box>{surveyorCanEdit && <Button size="small" startIcon={<EditRounded />} onClick={() => editFieldNote(item, index)}>Edit</Button>}</Stack></Box>) : <Typography variant="body2" color="text.secondary">No field notes recorded.</Typography>}</Stack>
            </Grid>
          </Grid>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2.7, mb: 1.5 }}><Typography sx={{ fontWeight: 800, color: '#102a4c' }}>Evidence Gallery</Typography><Chip size="small" label={`${project.evidence?.length || 0} files`} variant="outlined" /></Stack>
          {!project.evidence?.length ? <Alert severity="info" icon={<CameraAltRounded />}>Upload at least one field photo, video, or document before requesting landlord review.</Alert> : <Grid container spacing={1.5}>{project.evidence.map((item: any) => <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item._id}><EvidenceCard projectId={projectId} item={item} canDelete={surveyorCanEdit} onDelete={() => run(() => removeSurveyWorkflowEvidence(projectId, item._id), 'Evidence removed.')} /></Grid>)}</Grid>}
          {project.permissions?.surveyor && currentStage === 'in_progress' && project.activeVisit?.checkIn?.at && !project.activeVisit?.checkOut?.at && <Button sx={{ mt: 2 }} variant="text" onClick={checkOut} disabled={busy}>Complete site visit / check out</Button>}
          {project.permissions?.surveyor && project.status === 'awaiting_landlord_review' && <Alert severity="info" sx={{ mt: 2 }}>Fieldwork is locked while the landlord reviews your measurements and evidence.</Alert>}
        </Paper>

        <Paper data-secureasset-landlord-review-desk="recorded-review-payment-v167" elevation={0} sx={{ p: { xs: 2, md: 2.8 }, border: '1px solid rgba(15,23,42,.08)', borderColor: 'rgba(15,23,42,.08)', borderRadius: 4, boxShadow: '0 10px 30px rgba(15,23,42,.05)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ md: 'center' }}>
            <Box><Typography variant="h6">Landlord review &amp; payment desk</Typography><Typography color="text.secondary">The landlord reviews the submitted package here. Payment proof then moves to the assigned Surveyor for a separate receipt confirmation.</Typography></Box>
            <Chip size="small" color={fieldworkReview.status === 'approved' ? 'success' : fieldworkReview.status === 'changes_requested' ? 'warning' : 'primary'} label={label(fieldworkReview.status || 'not_requested')} />
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="caption" color="text.secondary">1. SUBMITTED REVIEW PACKAGE</Typography>
              <Typography sx={{ mt: .45 }}>Review round {Number(fieldworkReview.version || 0) || 1}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .55 }}>{Number(fieldworkReview.snapshot?.measurementCount ?? measurements.length)} measurements · {Number(fieldworkReview.snapshot?.fieldNoteCount ?? fieldNotes.length)} notes · {Number(fieldworkReview.snapshot?.evidenceCount ?? (project.evidence?.length || 0))} evidence files</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .8 }}>Submitted {date(fieldworkReview.submittedAt || project.fieldworkSubmittedAt)}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="caption" color="text.secondary">2. LANDLORD DECISION</Typography>
              {project.status === 'awaiting_landlord_review' ? <Stack spacing={1} sx={{ mt: .7 }}><Typography variant="body2" color="text.secondary">Inspect the measurements, notes, and evidence above. The review form records all three acknowledgements before it creates the final invoice.</Typography>{project.permissions?.landlord && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button color="success" variant="contained" startIcon={<CheckCircleRounded />} onClick={() => setReviewOpen(true)} disabled={busy}>Open recorded review</Button><Button color="warning" variant="outlined" onClick={() => setRevisionOpen(true)} disabled={busy}>Request fieldwork revision</Button></Stack>}</Stack> : fieldworkReview.status === 'changes_requested' ? <Alert severity="warning" sx={{ mt: .7 }}>Changes requested: {fieldworkReview.revisionReason || 'The Surveyor has been asked to update the submitted package.'}</Alert> : fieldworkReview.status === 'approved' ? <Stack spacing={.6} sx={{ mt: .7 }}><Chip size="small" color="success" label="Recorded approval" sx={{ alignSelf: 'flex-start' }} /><Typography variant="body2" color="text.secondary">Reviewed {date(fieldworkReview.reviewedAt)}{fieldworkReview.comment ? ` · ${fieldworkReview.comment}` : ''}</Typography></Stack> : <Typography variant="body2" color="text.secondary" sx={{ mt: .7 }}>A review becomes available after the Surveyor submits measurements and evidence.</Typography>}
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="caption" color="text.secondary">3. FINAL PAYMENT CONFIRMATION</Typography>
              {!finalPaymentRecord ? <Typography variant="body2" color="text.secondary" sx={{ mt: .7 }}>A final invoice is generated only after the landlord records fieldwork approval.</Typography> : <Stack spacing={.65} sx={{ mt: .7 }}><Typography>{finalPaymentRecord.invoiceNumber} · {money(finalPaymentRecord.amount)}</Typography>{finalPaymentWorkflow.status === 'awaiting_landlord' && <><Typography variant="body2" color="text.secondary">Pay outside SecureAsset, then submit the transaction ID, screenshot, and payment declaration.</Typography>{project.permissions?.landlord && <Button variant="contained" startIcon={<PaidRounded />} onClick={() => setFinalPaymentOpen(true)} disabled={busy} sx={{ alignSelf: 'flex-start' }}>Pay &amp; submit proof</Button>}</>}{finalPaymentWorkflow.status === 'proof_submitted' && <><Typography variant="body2" color="text.secondary">Landlord declaration and payment proof submitted {date(finalPaymentWorkflow.proofSubmittedAt)}. The final report remains locked until receipt is confirmed.</Typography>{project.permissions?.surveyor && <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><Button size="small" variant="outlined" onClick={() => void openPaymentProof(String(finalPaymentRecord._id))} disabled={busy}>View proof</Button><Button size="small" variant="contained" onClick={() => acceptPayment(String(finalPaymentRecord._id))} disabled={busy}>Confirm receipt</Button></Stack>}</>}{finalPaymentWorkflow.status === 'returned' && <Alert severity="warning">Payment proof needs correction: {finalPaymentWorkflow.rejectionReason || 'Please resubmit the payment details.'}</Alert>}{finalPaymentWorkflow.status === 'confirmed' && <Alert severity="success">Receipt confirmed {date(finalPaymentWorkflow.receiptConfirmedAt)}. The Surveyor can upload the final report.</Alert>}</Stack>}
            </Grid>
          </Grid>
          <Alert severity="info" sx={{ mt: 2 }}>The final report stays unavailable until a recorded landlord review, landlord payment declaration, and Surveyor receipt confirmation are all complete.</Alert>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 2, md: 2.8 }, border: '1px solid rgba(15,23,42,.08)', borderColor: 'rgba(15,23,42,.08)', borderRadius: 4, boxShadow: '0 10px 30px rgba(15,23,42,.05)' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}><Box><Typography variant="h6" sx={{ fontWeight: 800, color: '#102a4c' }}>Survey Report</Typography><Typography color="text.secondary">Preview, upload and download the final survey report after the required review and payment confirmations.</Typography></Box><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {canUploadFinalReport && <Button component="label" variant="contained" startIcon={<UploadFileRounded />} disabled={busy}>Upload final report<input hidden type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={(event) => { void uploadReportFile(event.target.files); event.currentTarget.value = ''; }} /></Button>}
            {project.report?._id && <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadSurveyReport(project.report._id, 'pdf')}>Download PDF</Button>}
            {project.report?.reportFile && <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadSurveyWorkflowReportFile(projectId, project.report.reportFile.name || 'survey-report')}>Download uploaded file</Button>}
          </Stack></Stack>
          {project.status === 'revision_requested' && <Alert severity="warning" sx={{ mt: 2 }}>The landlord requested a fieldwork revision. Update evidence or measurements, then submit the fieldwork again.</Alert>}
          {project.status === 'awaiting_final_payment' && <Alert severity={finalPaymentRejected ? 'warning' : 'info'} sx={{ mt: 2 }}>{finalPaymentRejected ? `Update the payment proof: ${finalPaymentRecord?.paymentVerification?.rejectionReason || 'The Surveyor requested a corrected transaction ID or screenshot.'}` : 'Landlord review is recorded. Submit the final payment transaction, screenshot, and declaration before report upload.'}</Alert>}
          {project.status === 'payment_submitted' && <Alert severity="info" sx={{ mt: 2 }}>The final payment declaration and screenshot are awaiting Surveyor receipt confirmation.</Alert>}
          {project.status === 'report_upload_requested' && <Alert severity="success" sx={{ mt: 2 }}>Final payment is confirmed. The assigned Surveyor can upload the final report now.</Alert>}
          {project.report ? <Box sx={{ mt: 2 }}><Stack direction="row" spacing={1} alignItems="center"><Chip size="small" color={project.report.status === 'final' || project.report.status === 'locked' ? 'success' : 'primary'} label={label(project.report.status)} /><Typography variant="caption" color="text.secondary">{project.report.reportNumber} · revision {project.report.revisionNumber || 0}</Typography></Stack><Typography sx={{ fontSize: 18, mt: 1.5 }}>{project.report.title}</Typography>{project.report.reportFile && <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}><DescriptionRounded color="primary" /><Typography variant="body2">{project.report.reportFile.name || project.report.reportFile.originalName || 'Uploaded survey report'}</Typography><Chip size="small" label="Final file" color="success" /></Stack>}{Object.entries(reportSections).map(([key, value]) => value ? <Box key={key} sx={{ mt: 1.5 }}><Typography variant="caption" color="text.secondary">{label(key).toUpperCase()}</Typography><Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: .3 }}>{String(value)}</Typography></Box> : null)}</Box> : <Alert severity="info" sx={{ mt: 2 }} icon={<DescriptionRounded />}>A final report becomes available only after recorded landlord fieldwork review, payment declaration, and Surveyor receipt confirmation.</Alert>}
        </Paper>
      </Stack></Grid>

      <Grid size={{ xs: 12, lg: 4 }}><Stack spacing={2.5}>
        <Paper elevation={0} sx={{ p: 2.4, border: '1px solid rgba(15,23,42,.08)', borderRadius: 4, background: 'linear-gradient(145deg,#ffffff,#f7fbff)', boxShadow: '0 10px 30px rgba(15,23,42,.055)' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography sx={{ fontWeight: 800, color: '#102a4c' }}>Project Summary</Typography><Chip size="small" label={label(project.workflowStage || project.status)} color={project.workflowStage === 'completed' ? 'success' : 'primary'} /></Stack>
          <Stack spacing={1.25} sx={{ mt: 1.8 }}>
            {[
              ['Project value', money(project.paymentSummary?.total)],
              ['Outstanding', money(project.paymentSummary?.outstanding)],
              ['Visit date', date(project.job?.preferredVisitDate || project.startDate)],
              ['Deadline', date(project.job?.preferredCompletionDate || project.dueDate)],
            ].map(([title, value]) => <Stack key={title} direction="row" justifyContent="space-between" spacing={2}><Typography variant="body2" color="text.secondary">{title}</Typography><Typography variant="body2" sx={{ fontWeight: 800, textAlign: 'right' }}>{value}</Typography></Stack>)}
          </Stack>
          <Box sx={{ mt: 2, p: 1.6, borderRadius: 2.5, bgcolor: project.paymentStatus === 'paid' ? 'rgba(7,148,85,.08)' : 'rgba(11,74,162,.06)' }}>
            <Typography variant="caption" color="text.secondary">PAYMENT STATUS</Typography>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: .35 }}><Typography sx={{ fontWeight: 800 }}>{label(project.paymentStatus || 'unpaid')}</Typography><PaidRounded color={project.paymentStatus === 'paid' ? 'success' : 'primary'} /></Stack>
          </Box>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid rgba(15,23,42,.08)', borderColor: 'rgba(15,23,42,.08)', borderRadius: 4, boxShadow: '0 10px 30px rgba(15,23,42,.05)' }}><Typography sx={{ fontWeight: 700 }}>Verification progress</Typography><Stack spacing={1.5} sx={{ mt: 2 }}>{['surveyed', 'field_verified', 'document_verified', 'fully_verified'].map((step, index) => { const order = ['unverified', 'surveyed', 'field_verified', 'document_verified', 'fully_verified']; const complete = order.indexOf(project.verificationStatus) >= order.indexOf(step); return <Stack key={step} direction="row" spacing={1.2} alignItems="center"><Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: complete ? 'success.main' : 'action.hover', color: complete ? 'white' : 'text.disabled' }}>{complete ? <TaskAltRounded sx={{ fontSize: 18 }} /> : index + 1}</Box><Typography sx={{ fontWeight: complete ? 700 : 600, color: complete ? 'text.primary' : 'text.secondary' }}>{label(step)}</Typography></Stack>; })}</Stack></Paper>
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid rgba(15,23,42,.08)', borderColor: 'rgba(15,23,42,.08)', borderRadius: 4, boxShadow: '0 10px 30px rgba(15,23,42,.05)' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography sx={{ fontWeight: 700 }}>Payment</Typography><Chip size="small" icon={<PaidRounded />} color={project.paymentStatus === 'paid' ? 'success' : 'warning'} label={label(project.paymentStatus || 'unpaid')} /></Stack>
          <Stack spacing={1.2} sx={{ mt: 1.5 }}>
            {(project.payments || []).length ? project.payments.map((payment: any) => <Box key={payment._id} sx={{ pb: 1.2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center"><Typography sx={{ fontWeight: 600 }}>{label(payment.type)}</Typography><Chip size="small" label={label(payment.status)} color={payment.status === 'paid' ? 'success' : 'warning'} /></Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .35 }}>{payment.invoiceNumber} · {money(payment.amount)}</Typography>
              {payment.transactionId && <Typography variant="caption" color="text.secondary">Transaction: {payment.transactionId}</Typography>}
              <Stack direction="row" spacing={.7} flexWrap="wrap" useFlexGap sx={{ mt: .8 }}>
                {payment.proofSubmitted && <Button size="small" variant="outlined" startIcon={<OpenInNewRounded />} onClick={() => void openPaymentProof(String(payment._id))} disabled={busy}>View proof</Button>}
                {project.permissions?.surveyor && ['pending', 'partial', 'overdue'].includes(payment.status) && (payment.type !== 'survey_final' || payment.paymentVerification?.status === 'submitted') && <Button size="small" variant="contained" startIcon={<PaidRounded />} onClick={() => acceptPayment(payment._id)} disabled={busy}>{payment.type === 'survey_final' ? 'Confirm receipt' : 'Accept payment'}</Button>}
                {project.permissions?.surveyor && payment.type === 'survey_final' && payment.paymentVerification?.status === 'submitted' && <Button size="small" color="warning" variant="outlined" onClick={() => setPaymentRejectionOpen(true)} disabled={busy}>Return proof</Button>}
              </Stack>
              {payment.type === 'survey_final' && payment.paymentVerification?.status === 'rejected' && <Alert severity="warning" sx={{ mt: 1, py: 0 }}>Correction requested: {payment.paymentVerification?.rejectionReason || 'Please submit updated payment proof.'}</Alert>}
            </Box>) : <Typography variant="body2" color="text.secondary">The final balance is created after landlord fieldwork review.</Typography>}
          </Stack>
          {project.permissions?.landlord && finalPaymentRecord && ['awaiting_final_payment', 'payment_submitted'].includes(project.status) && finalPaymentRecord.paymentVerification?.status !== 'submitted' && <Button fullWidth variant="contained" sx={{ mt: 2 }} startIcon={<PaidRounded />} onClick={() => setFinalPaymentOpen(true)} disabled={busy}>{finalPaymentRejected ? 'Correct & resubmit payment proof' : 'Submit final payment transaction & screenshot'}</Button>}
          {project.permissions?.landlord && project.status === 'payment_submitted' && <Alert severity="info" sx={{ mt: 1.5 }}>Your transaction and screenshot are awaiting Surveyor confirmation.</Alert>}
        </Paper>
      </Stack></Grid>
    </Grid>

    <ProfessionalDialog open={fieldOpen} onClose={() => setFieldOpen(false)} maxWidth="sm" fullWidth professionalTitle={field.mode === 'measurement' ? 'Update measurement' : field.mode === 'note' ? 'Update field note' : 'Record field observation'} professionalSubtitle="Add or update the field record for this hired project."><Box component="form" onSubmit={saveFieldwork}><DialogContent dividers><Stack spacing={2}><Grid container spacing={2}><Grid size={{ xs: 12, sm: 6 }}><TextField select fullWidth label="Measurement type" value={field.type} disabled={field.mode === 'note'} onChange={(event) => setField({ ...field, type: event.target.value })}>{['dimension', 'area', 'angle', 'elevation', 'boundary', 'other'].map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Label" value={field.label} disabled={field.mode === 'note'} onChange={(event) => setField({ ...field, label: event.target.value })} placeholder="North boundary" /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="number" label="Value" value={field.value} disabled={field.mode === 'note'} onChange={(event) => setField({ ...field, value: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Unit" value={field.unit} disabled={field.mode === 'note'} onChange={(event) => setField({ ...field, unit: event.target.value })} placeholder="metre" /></Grid></Grid><TextField fullWidth label="Measurement notes" value={field.notes} disabled={field.mode === 'note'} onChange={(event) => setField({ ...field, notes: event.target.value })} /><TextField fullWidth multiline minRows={3} label="General field note" value={field.fieldNote} disabled={field.mode === 'measurement'} onChange={(event) => setField({ ...field, fieldNote: event.target.value })} /></Stack></DialogContent><DialogActions><Button onClick={() => { setFieldOpen(false); resetField(); }}>Cancel</Button><Button type="submit" variant="contained" disabled={busy || (field.mode === 'note' ? !field.fieldNote.trim() : (!field.label.trim() || field.value === '' || !field.unit.trim()))}>{busy ? 'Saving…' : field.mode === 'measurement' ? 'Update measurement' : field.mode === 'note' ? 'Update note' : 'Save fieldwork'}</Button></DialogActions></Box></ProfessionalDialog>
    <ProfessionalDialog open={reviewOpen} onClose={() => !busy && setReviewOpen(false)} maxWidth="sm" fullWidth professionalTitle="Review fieldwork" professionalSubtitle="Record your decision only after you have inspected the measurements, field notes, evidence, and agreed scope.">
      <Box component="form" onSubmit={reviewFieldwork}>
        <DialogContent dividers><Stack spacing={2}>
          <Alert severity="info">Review round {Number(fieldworkReview.version || 0) || 1}: {measurements.length} measurements, {fieldNotes.length} notes, and {project.evidence?.length || 0} evidence files are available in this project workspace.</Alert>
          <FormControlLabel control={<Checkbox checked={reviewChecklist.measurementsReviewed} onChange={(event) => setReviewChecklist({ ...reviewChecklist, measurementsReviewed: event.target.checked })} />} label="I reviewed the submitted measurements and field notes." />
          <FormControlLabel control={<Checkbox checked={reviewChecklist.evidenceReviewed} onChange={(event) => setReviewChecklist({ ...reviewChecklist, evidenceReviewed: event.target.checked })} />} label="I reviewed the submitted photos, videos, and documents." />
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
    <ProfessionalDialog open={revisionOpen} onClose={() => setRevisionOpen(false)} maxWidth="sm" fullWidth professionalTitle="Request fieldwork revision"><Box component="form" onSubmit={sendRevision}><DialogContent dividers><TextField required fullWidth multiline minRows={4} label="Required corrections" value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} inputProps={{ minLength: 5, maxLength: 1200 }} /></DialogContent><DialogActions><Button onClick={() => setRevisionOpen(false)}>Cancel</Button><Button type="submit" color="warning" variant="contained" disabled={busy || revisionReason.trim().length < 5}>Send revision request</Button></DialogActions></Box></ProfessionalDialog>
  </Box>;
}
