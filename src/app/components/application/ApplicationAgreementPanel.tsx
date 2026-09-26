import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Grid, MenuItem, Paper, Select, Stack, TextField, Typography,
} from '@mui/material';
import ChatRounded from '@mui/icons-material/ChatRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import DrawRounded from '@mui/icons-material/DrawRounded';
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded';
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import ReplayRounded from '@mui/icons-material/ReplayRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import TaskAltRounded from '@mui/icons-material/TaskAltRounded';
import UploadFileRounded from '@mui/icons-material/UploadFileRounded';
import {
  approveAgreementRequest, cancelAgreementCycle, closeAgreementCycle, createConversation, fetchAgreementPreviewBlob,
  fetchAgreementSecurityDepositProofBlob, getAgreementRequests, getAgreementTemplates, prepareAgreementRequest,
  rejectAgreementCancellation, rejectAgreementSecurityDeposit, renewAgreementCycle, requestAgreementCancellation,
  sendInternalAgreementRequest, submitAgreementSecurityDeposit, uploadFirstPartyAgreementMark, uploadSecondPartyAgreementSignature,
} from '../../services/api';
import type { AgreementType } from '../../services/api';
import { makeSignatureBackgroundTransparent } from '../../utils/signatureImage';
import { agreementDateLabel, calendarMonthEndDate } from '../../utils/agreementDates';
import { useActionDialog } from '../shared/useActionDialog';

type Props = {
  application: any;
  user: any;
  landlordCanManage: boolean;
  onDecision?: (status: 'approved' | 'rejected') => Promise<void>;
  onNotice?: (message: string) => void;
  onError?: (message: string) => void;
};

type FirstPartyMarkType = 'signature' | 'stamp_seal';

const REVIEW_STATUSES = ['submitted', 'under_review', 'shortlisted', 'interview_requested', 'interview_scheduled', 'site_visit_scheduled', 'additional_documents_requested', 'documents_pending'];
const ACCEPTED_STATUSES = ['approved', 'agreement_pending', 'deposit_pending', 'completed'];
const ACTIVE_REQUEST_STATUSES = ['draft', 'first_party_signed', 'configuration_required', 'sent', 'viewed', 'awaiting_first_party_approval', 'approved'];

function idOf(value: any) {
  return String(value?._id || value || '');
}

function agreementTypeFor(application: any): AgreementType {
  const property = application?.property || {};
  const value = String(property.purpose || property.listingType || (property.isSale ? 'sale' : 'rent')).toLowerCase();
  return value === 'lease' || value === 'sale' ? value : 'rent';
}

function typeLabel(type: AgreementType) {
  return type === 'sale' ? 'Sale' : type === 'lease' ? 'Lease' : 'Rent';
}

function statusLabel(value: string) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function hasMark(request: any, field: 'firstPartyMark' | 'secondPartySignature') {
  return Boolean(request?.[field]?.file?._id || request?.[field]?.file);
}

function requestStatus(request: any) {
  const status = String(request?.status || '').toLowerCase();
  return request?.provider === 'internal_signature' && status === 'signed' && !request?.firstPartyApprovalAt
    ? 'awaiting_first_party_approval'
    : status;
}

function money(value: unknown) {
  const amount = Number(value || 0);
  return amount > 0 ? `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '₹0';
}

function dateText(value?: string | Date | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function dateInput(value?: string | Date | null) {
  if (value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

export default function ApplicationAgreementPanel({ application, user, landlordCanManage, onDecision, onNotice, onError }: Props) {
  const actions = useActionDialog();
  const navigate = useNavigate();
  const applicationId = idOf(application);
  const type = useMemo(() => agreementTypeFor(application), [application]);
  const accepted = ACCEPTED_STATUSES.includes(String(application?.status || '').toLowerCase());
  const reviewPending = REVIEW_STATUSES.includes(String(application?.status || '').toLowerCase());
  const tenantSide = idOf(application?.applicant) === idOf(user);
  const firstPartySide = landlordCanManage && (idOf(application?.landlord) === idOf(user) || idOf(application?.property?.owner) === idOf(user));
  const landlordId = idOf(application?.landlord) || idOf(application?.property?.owner);
  const [templates, setTemplates] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [termChoice, setTermChoice] = useState('12');
  const [customTerm, setCustomTerm] = useState('');
  const [agreementStartDate, setAgreementStartDate] = useState(() => dateInput(application?.moveInDate));
  const [renewalFor, setRenewalFor] = useState<any | null>(null);
  const [firstPartyMarkType, setFirstPartyMarkType] = useState<FirstPartyMarkType>('signature');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [depositTransactionIds, setDepositTransactionIds] = useState<Record<string, string>>({});
  const [depositProofFiles, setDepositProofFiles] = useState<Record<string, File | null>>({});

  const durationMonths = termChoice === 'custom' ? Number(customTerm) : Number(termChoice);
  const agreementEndDate = type === 'sale' ? '' : calendarMonthEndDate(agreementStartDate, durationMonths);
  const validAgreementTerm = type === 'sale' || (Number.isInteger(durationMonths) && durationMonths > 0 && Boolean(agreementStartDate) && Boolean(agreementEndDate));

  async function reload() {
    if (!accepted || !applicationId) return;
    setLoading(true);
    try {
      const [requestResult, templateResult] = await Promise.all([
        getAgreementRequests({ application: applicationId }),
        firstPartySide ? getAgreementTemplates(type) : Promise.resolve({ data: [] as any[] }),
      ]);
      const nextRequests = requestResult.data || [];
      const nextTemplates = templateResult.data || [];
      setRequests(nextRequests);
      setTemplates(nextTemplates);
      setTemplateId((current) => current || idOf(nextTemplates[0]));
    } catch (error) {
      onError?.((error as Error).message || 'Could not load the agreement workflow');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [accepted, applicationId, firstPartySide, type]);

  useEffect(() => {
    setAgreementStartDate(dateInput(application?.moveInDate));
  }, [applicationId, application?.moveInDate]);

  async function decide(status: 'approved' | 'rejected') {
    if (!onDecision) return;
    setBusy(status);
    try {
      await onDecision(status);
      await reload();
    } finally {
      setBusy('');
    }
  }

  async function prepareRequest(renewalOf = '') {
    if (!templateId) {
      onError?.(`Create or select a ${type} agreement template first`);
      return;
    }
    if (!validAgreementTerm) {
      onError?.('Choose a valid positive whole-month agreement term and start date');
      return;
    }
    const termReview = type === 'sale' ? '' : ` Term: ${durationMonths} month${durationMonths === 1 ? '' : 's'}, ${agreementDateLabel(agreementStartDate)} to ${agreementDateLabel(agreementEndDate)}. Rent cycles remain monthly.`;
    const confirmed = await actions.askConfirmation(
      `${renewalOf ? 'Prepare a new renewal' : 'Prepare this'} ${typeLabel(type).toLowerCase()} agreement?${termReview} You must upload the first-party signature or stamp/seal before the second party can receive it.`,
      { title: renewalOf ? 'Prepare renewal agreement' : 'Review agreement term' },
    );
    if (!confirmed) return;
    setBusy('prepare');
    try {
      const result = await prepareAgreementRequest({
        application: applicationId,
        template: templateId,
        ...(type !== 'sale' && { durationMonths, startDate: agreementStartDate }),
        ...(renewalOf && { renewalOf }),
      });
      setRenewalFor(null);
      onNotice?.(result.message || 'Agreement prepared');
      await reload();
    } catch (error) {
      onError?.((error as Error).message || 'Could not prepare agreement');
    } finally {
      setBusy('');
    }
  }

  async function uploadFirstPartyMark(request: any, file?: File) {
    const requestId = idOf(request);
    if (!file || !requestId) return;
    setBusy(`first-mark-${requestId}`);
    try {
      const transparentFile = await makeSignatureBackgroundTransparent(file, firstPartyMarkType === 'stamp_seal' ? 'stamp-seal' : 'first-party-signature');
      const result = await uploadFirstPartyAgreementMark(requestId, transparentFile, firstPartyMarkType);
      onNotice?.(result.message || 'First-party mark uploaded');
      await reload();
    } catch (error) {
      onError?.((error as Error).message || 'Could not upload first-party signature or stamp/seal');
    } finally {
      setBusy('');
    }
  }

  async function sendToSecondParty(request: any) {
    const requestId = idOf(request);
    const confirmed = await actions.askConfirmation(
      'Send this signed agreement to the applicant tenant? The second party will be able to preview it and upload their signature.',
      { title: 'Request second-party signature' },
    );
    if (!confirmed) return;
    setBusy(`send-${requestId}`);
    try {
      const result = await sendInternalAgreementRequest(requestId);
      onNotice?.(result.message || 'Agreement sent to second party');
      await reload();
    } catch (error) {
      onError?.((error as Error).message || 'Could not send agreement to the second party');
    } finally {
      setBusy('');
    }
  }

  async function uploadSecondPartySignature(request: any, file?: File) {
    const requestId = idOf(request);
    if (!file || !requestId) return;
    const confirmed = await actions.askConfirmation(
      'I have reviewed this agreement and agree to sign it as the second party. My uploaded signature will be attached to the signed agreement.',
      { title: 'Confirm agreement signature' },
    );
    if (!confirmed) return;
    setBusy(`second-mark-${requestId}`);
    try {
      const transparentFile = await makeSignatureBackgroundTransparent(file, 'second-party-signature');
      const result = await uploadSecondPartyAgreementSignature(requestId, transparentFile);
      onNotice?.(result.message || 'Your signature was added');
      await reload();
    } catch (error) {
      onError?.((error as Error).message || 'Could not upload your signature');
    } finally {
      setBusy('');
    }
  }

  async function openPreview(request: any) {
    const requestId = idOf(request);
    setBusy(`preview-${requestId}`);
    try {
      const blob = await fetchAgreementPreviewBlob(requestId);
      const url = URL.createObjectURL(blob);
      const tab = window.open(url, '_blank', 'noopener,noreferrer');
      if (!tab) onError?.('Allow pop-ups to preview the stamp-paper agreement');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (tenantSide && request.status === 'sent') await reload();
    } catch (error) {
      onError?.((error as Error).message || 'Could not preview agreement');
    } finally {
      setBusy('');
    }
  }

  async function downloadAgreement(request: any) {
    const requestId = idOf(request);
    setBusy(`download-${requestId}`);
    try {
      const blob = await fetchAgreementPreviewBlob(requestId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${String(request.renderedTitle || typeLabel(type)).replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase() || 'agreement'}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      onError?.((error as Error).message || 'Could not download the agreement paper');
    } finally {
      setBusy('');
    }
  }

  async function previewSelectedDepositProof(requestId: string) {
    const file = depositProofFiles[requestId];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) onError?.('Allow pop-ups to preview the selected payment proof');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function openSecurityDepositProof(request: any) {
    const requestId = idOf(request);
    setBusy(`deposit-proof-${requestId}`);
    try {
      const blob = await fetchAgreementSecurityDepositProofBlob(requestId);
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) onError?.('Allow pop-ups to preview the security deposit payment proof');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      onError?.((error as Error).message || 'Could not preview security deposit payment proof');
    } finally {
      setBusy('');
    }
  }

  async function submitSecurityDeposit(request: any) {
    const requestId = idOf(request);
    const transactionId = String(depositTransactionIds[requestId] || '').trim();
    const file = depositProofFiles[requestId];
    const amount = Number(request?.securityDeposit?.amount || 0);

    if (!transactionId) { onError?.('Enter the security deposit transaction ID'); return; }
    if (!file) { onError?.('Upload the security deposit payment proof'); return; }
    if (file.size > 8 * 1024 * 1024) { onError?.('Payment proof must be 8 MB or smaller'); return; }

    const confirmed = await actions.askConfirmation(
      `Submit security deposit payment of ${money(amount)} with transaction ID “${transactionId}” for landlord verification?`,
      { title: 'Submit security deposit payment' },
    );
    if (!confirmed) return;

    setBusy(`deposit-submit-${requestId}`);
    try {
      const result = await submitAgreementSecurityDeposit(requestId, transactionId, file);
      setDepositTransactionIds((current) => ({ ...current, [requestId]: '' }));
      setDepositProofFiles((current) => ({ ...current, [requestId]: null }));
      onNotice?.(result.message || 'Security deposit payment submitted');
      await reload();
    } catch (error) {
      onError?.((error as Error).message || 'Could not submit the security deposit payment');
    } finally {
      setBusy('');
    }
  }

  async function rejectSecurityDeposit(request: any) {
    const requestId = idOf(request);
    const reason = await actions.askText(
      'Explain why this security deposit payment cannot be verified. The tenant will be able to resubmit it.',
      { title: 'Reject security deposit payment', label: 'Rejection reason' },
    );
    if (!String(reason || '').trim()) return;

    setBusy(`deposit-reject-${requestId}`);
    try {
      const result = await rejectAgreementSecurityDeposit(requestId, String(reason).trim());
      onNotice?.(result.message || 'Security deposit payment rejected');
      await reload();
    } catch (error) {
      onError?.((error as Error).message || 'Could not reject the security deposit payment');
    } finally {
      setBusy('');
    }
  }

  async function approveAgreement(request: any) {
    const requestId = idOf(request);
    const depositRequired = Boolean(request?.securityDeposit?.required);
    const depositAmount = Number(request?.securityDeposit?.amount || 0);
    const confirmed = await actions.askConfirmation(
      depositRequired
        ? `Review and verify the submitted security deposit of ${money(depositAmount)}, approve the signed agreement, and start the ${typeLabel(type).toLowerCase()} workflow?`
        : `Verify the applicant tenant's uploaded signature and approve this ${typeLabel(type).toLowerCase()} agreement? ${type === 'sale' ? 'The signed paper will be completed.' : `This will start the ${typeLabel(type).toLowerCase()} cycle and show its due date to both parties.`}`,
      { title: depositRequired ? 'Verify deposit & start workflow' : 'Verify and approve agreement' },
    );
    if (!confirmed) return;
    setBusy(`approve-${requestId}`);
    try {
      const result = await approveAgreementRequest(requestId);
      onNotice?.(result.message || 'Agreement approved');
      await reload();
    } catch (error) {
      onError?.((error as Error).message || 'Could not approve the agreement');
    } finally {
      setBusy('');
    }
  }

  async function renewCycle(request: any, firstParty: boolean) {
    const requestId = idOf(request);
    const confirmed = await actions.askConfirmation(
      firstParty ? 'Renew this active cycle for its next term? The tenant will be notified of the new end date.' : 'Request renewal from the landlord-enabled first party?',
      { title: firstParty ? 'Renew agreement cycle' : 'Request renewal' },
    );
    if (!confirmed) return;
    setBusy(`renew-${requestId}`);
    try {
      const result = await renewAgreementCycle(requestId);
      onNotice?.(result.message || (firstParty ? 'Cycle renewed' : 'Renewal requested'));
      await reload();
    } catch (error) {
      onError?.((error as Error).message || 'Could not update the renewal');
    } finally {
      setBusy('');
    }
  }

  async function requestCancellation(request: any) {
    const requestId = idOf(request);
    const confirmed = await actions.askConfirmation(
      'Send a cancellation request to the landlord-enabled first party? The cycle stays active until they decide.',
      { title: 'Request cancellation', danger: true },
    );
    if (!confirmed) return;
    setBusy(`cancel-request-${requestId}`);
    try {
      const result = await requestAgreementCancellation(requestId);
      onNotice?.(result.message || 'Cancellation requested');
      await reload();
    } catch (error) {
      onError?.((error as Error).message || 'Could not request cancellation');
    } finally {
      setBusy('');
    }
  }

  async function cancelCycle(request: any) {
    const requestId = idOf(request);
    const confirmed = await actions.askConfirmation(
      'Cancel this active rent or lease cycle? This first-party action immediately ends the cycle for both parties.',
      { title: 'Cancel agreement cycle', danger: true },
    );
    if (!confirmed) return;
    setBusy(`cancel-${requestId}`);
    try {
      const result = await cancelAgreementCycle(requestId);
      onNotice?.(result.message || 'Cycle cancelled');
      await reload();
    } catch (error) {
      onError?.((error as Error).message || 'Could not cancel the cycle');
    } finally {
      setBusy('');
    }
  }

  async function keepCycleActive(request: any) {
    const requestId = idOf(request);
    const confirmed = await actions.askConfirmation(
      'Keep the cycle active and decline the tenant cancellation request?',
      { title: 'Keep agreement active' },
    );
    if (!confirmed) return;
    setBusy(`reject-cancel-${requestId}`);
    try {
      const result = await rejectAgreementCancellation(requestId);
      onNotice?.(result.message || 'Cancellation request declined');
      await reload();
    } catch (error) {
      onError?.((error as Error).message || 'Could not update the cancellation request');
    } finally {
      setBusy('');
    }
  }

  async function closeCycle(request: any) {
    const requestId = idOf(request);
    const confirmed = await actions.askConfirmation(
      'Close this completed cycle? This is available after the end date and keeps the agreement paper downloadable.',
      { title: 'Close agreement cycle' },
    );
    if (!confirmed) return;
    setBusy(`close-${requestId}`);
    try {
      const result = await closeAgreementCycle(requestId);
      onNotice?.(result.message || 'Cycle closed');
      await reload();
    } catch (error) {
      onError?.((error as Error).message || 'Could not close the cycle');
    } finally {
      setBusy('');
    }
  }

  async function chatWithLandlord() {
    if (!landlordId) {
      onError?.('The first party for this application is unavailable');
      return;
    }
    setBusy('chat');
    try {
      const propertyTitle = String(application?.property?.title || 'Property');
      const result = await createConversation({
        participants: [landlordId],
        type: 'application',
        title: `${propertyTitle} application`,
        reference: { model: 'Application', id: applicationId, label: application?.applicationNumber || propertyTitle },
      });
      navigate(`/app/messages?conversation=${encodeURIComponent(idOf(result.data))}`);
    } catch (error) {
      onError?.((error as Error).message || 'Could not open a conversation with the landlord');
    } finally {
      setBusy('');
    }
  }

  function agreementTermFields() {
    if (type === 'sale') return null;
    return <Stack spacing={1} data-secureasset-agreement-term="required-duration-months-v1">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Select size="small" fullWidth value={termChoice} onChange={(event) => setTermChoice(event.target.value)} displayEmpty aria-label="Agreement duration in months">
          {[1, 3, 6, 9, 12, 18, 24].map((months) => <MenuItem key={months} value={String(months)}>{months} month{months === 1 ? '' : 's'}</MenuItem>)}
          <MenuItem value="custom">Custom</MenuItem>
        </Select>
        <TextField required fullWidth size="small" type="date" label="Agreement start date" value={agreementStartDate} onChange={(event) => setAgreementStartDate(event.target.value)} InputLabelProps={{ shrink: true }} />
        {termChoice === 'custom' && <TextField required fullWidth size="small" type="number" label="Custom duration (months)" value={customTerm} onChange={(event) => setCustomTerm(event.target.value)} inputProps={{ min: 1, step: 1 }} />}
      </Stack>
      <Alert severity="info" sx={{ py: .15 }}>
        {validAgreementTerm ? <><strong>{durationMonths} month{durationMonths === 1 ? '' : 's'}</strong> · {agreementDateLabel(agreementStartDate)} to {agreementDateLabel(agreementEndDate)} · Rent remains monthly.</> : 'Enter a positive whole number of months and choose the required start date.'}
      </Alert>
    </Stack>;
  }

  const inProgress = requests.some((request) => ACTIVE_REQUEST_STATUSES.includes(requestStatus(request)));

  return <Stack spacing={1.7} sx={{ mt: 2 }} data-secureasset-application-agreements="application-agreements-deposit-gate-v219">
    {reviewPending && landlordCanManage && <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: 'divider' }} data-secureasset-application-decision="accepted-only-v85">
      <Stack spacing={1.25}>
        <Box>
          <Typography sx={{ fontWeight: 850 }}>Application decision</Typography>
          <Typography variant="body2" color="text.secondary">Accept or reject this application. These actions disappear after a final decision.</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="contained" color="success" disabled={Boolean(busy)} onClick={() => void decide('approved')}>{busy === 'approved' ? 'Accepting…' : 'Accept application'}</Button>
          <Button variant="outlined" color="error" disabled={Boolean(busy)} onClick={() => void decide('rejected')}>{busy === 'rejected' ? 'Rejecting…' : 'Reject application'}</Button>
        </Stack>
      </Stack>
    </Paper>}

    {accepted && <Paper variant="outlined" sx={{ p: { xs: 1.7, sm: 2.2 }, borderRadius: 3, borderColor: 'divider' }} data-secureasset-agreement-workflow="internal-two-party-signature-approval-cycle-v86">
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <DescriptionRounded color="primary" />
            <Box>
              <Typography sx={{ fontWeight: 850 }}>{typeLabel(type)} agreement</Typography>
              <Typography variant="body2" color="text.secondary">Private stamp-paper agreement with two-party signing and first-party verification before a rent or lease cycle starts.</Typography>
            </Box>
          </Stack>
          <Chip size="small" variant="outlined" label={statusLabel(application.status)} />
        </Stack>
        <Alert severity="info" data-secureasset-signature-background-removal="transparent-png-v86">
          Uploaded signatures and stamp/seal images are automatically converted to cropped PNGs with the paper background made transparent before they leave the signer’s device.
        </Alert>
        <Divider />

        {tenantSide && <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} data-secureasset-application-landlord-chat="accepted-application-chat-v85">
          <Typography variant="body2" color="text.secondary">Your application is accepted. Review any agreement sent to you, sign it, or contact the first party.</Typography>
          <Button size="small" variant="outlined" startIcon={<ChatRounded />} disabled={busy === 'chat' || !landlordId} onClick={() => void chatWithLandlord()} sx={{ whiteSpace: 'nowrap' }}>{busy === 'chat' ? 'Opening chat…' : 'Chat with landlord'}</Button>
        </Stack>}

        {firstPartySide && !inProgress && <Stack spacing={1.1} data-secureasset-first-party-agreement-setup="first-party-upload-before-request-v85">
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'text.secondary' }}>First-party agreement setup</Typography>
          {agreementTermFields()}
          {loading && !templates.length ? <CircularProgress size={22} /> : templates.length ? <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Select size="small" fullWidth value={templateId} onChange={(event) => setTemplateId(event.target.value)} displayEmpty aria-label={`${typeLabel(type)} agreement template`}>
              <MenuItem value="" disabled>Select a template</MenuItem>
              {templates.map((template) => <MenuItem key={idOf(template)} value={idOf(template)}>{template.name} · v{template.version || 1}</MenuItem>)}
            </Select>
            <Button variant="contained" startIcon={<DescriptionRounded />} disabled={Boolean(busy) || !templateId} onClick={() => void prepareRequest()} sx={{ whiteSpace: 'nowrap' }}>{busy === 'prepare' ? 'Preparing…' : 'Prepare agreement'}</Button>
          </Stack> : <Alert severity="info" action={<Button color="inherit" size="small" href="/app/agreement-templates">Create template</Button>}>Create a {typeLabel(type).toLowerCase()} template before preparing this agreement.</Alert>}
        </Stack>}

        {loading && !requests.length ? <Box sx={{ display: 'grid', placeItems: 'center', py: 1 }}><CircularProgress size={24} /></Box> : requests.length ? <Stack spacing={1.1}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'text.secondary' }}>{tenantSide ? 'Your agreement requests' : 'Agreement requests'}</Typography>
          {requests.map((request) => {
            const requestId = idOf(request);
            const status = requestStatus(request);
            const lifecycle = request.lifecycle || {};
            const renewal = lifecycle.renewal || {};
            const cancellation = lifecycle.cancellation || {};
            const cycleEnabled = Boolean(lifecycle.enabled);
            const cycleActive = Boolean(lifecycle.active && lifecycle.current !== false);
            const awaitingFirstPartyApproval = status === 'awaiting_first_party_approval';
            const firstMarked = hasMark(request, 'firstPartyMark');
            const secondSigned = hasMark(request, 'secondPartySignature');
            const canFirstPartyUpload = firstPartySide && ['draft', 'first_party_signed', 'configuration_required'].includes(status);
            const canSend = firstPartySide && status === 'first_party_signed' && firstMarked;
            const canSecondPartySign = tenantSide && ['sent', 'viewed'].includes(status) && !secondSigned;
            const securityDeposit = request.securityDeposit || {};
            const depositRequired = Boolean(securityDeposit.required && Number(securityDeposit.amount || 0) > 0);
            const depositPayment = securityDeposit.payment || request.securityDepositPayment || {};
            const depositStage = String(securityDeposit.status || depositPayment?.paymentVerification?.status || (depositRequired ? 'awaiting_tenant' : 'not_required'));
            const depositSubmitted = depositStage === 'submitted';
            const depositApproved = depositStage === 'approved';
            const canApprove = firstPartySide && awaitingFirstPartyApproval && firstMarked && secondSigned && (!depositRequired || depositSubmitted || depositApproved);
            const canTenantRequestCancellation = tenantSide && cycleActive && cancellation.state !== 'requested';
            return <Paper key={requestId} sx={{ p: { xs: 1.35, sm: 1.6 }, borderRadius: 2.5, bgcolor: 'action.hover' }} elevation={0} data-secureasset-two-party-request={requestId}>
              <Stack spacing={1.15}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.2}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{request.renderedTitle || `${typeLabel(type)} agreement`}</Typography>
                    <Typography variant="caption" color="text.secondary">Template: {request.template?.name || '—'} · Second party: {request.tenantName || 'Tenant'}</Typography>
                  </Box>
                  <Stack direction="row" spacing={.5} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip size="small" variant="outlined" label={statusLabel(status)} />
                    <Button size="small" startIcon={<OpenInNewRounded />} disabled={busy === `preview-${requestId}`} onClick={() => void openPreview(request)}>Preview</Button>
                    <Button size="small" startIcon={<DownloadRounded />} disabled={busy === `download-${requestId}`} onClick={() => void downloadAgreement(request)}>{busy === `download-${requestId}` ? 'Downloading…' : 'Download paper'}</Button>
                  </Stack>
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} divider={<Divider flexItem orientation="vertical" />}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 850 }}>1. First party · landlord-enabled tenant</Typography>
                    <Typography variant="caption" color="text.secondary">Upload your signature or stamp/seal before the request is sent, then verify the applicant’s submitted signature before approval.</Typography>
                    <Stack direction="row" spacing={.55} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: .8 }}>
                      {firstMarked ? <Chip size="small" color="success" icon={<TaskAltRounded />} label={request.firstPartyMark?.kind === 'stamp_seal' ? 'Stamp / seal uploaded' : 'Signature uploaded'} /> : <Chip size="small" label="Mark required" />}
                      {canFirstPartyUpload && <>
                        <Select size="small" value={firstPartyMarkType} onChange={(event) => setFirstPartyMarkType(event.target.value as FirstPartyMarkType)} aria-label="First-party mark type" sx={{ minWidth: 132 }}>
                          <MenuItem value="signature">Signature</MenuItem>
                          <MenuItem value="stamp_seal">Stamp / seal</MenuItem>
                        </Select>
                        <Button component="label" size="small" variant="outlined" startIcon={<UploadFileRounded />} disabled={Boolean(busy)}>
                          {busy === `first-mark-${requestId}` ? 'Processing…' : `Upload ${firstPartyMarkType === 'stamp_seal' ? 'stamp / seal' : 'signature'}`}
                          <input hidden type="file" accept="image/png,image/jpeg" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; void uploadFirstPartyMark(request, file); }} />
                        </Button>
                      </>}
                      {canSend && <Button size="small" variant="contained" startIcon={<SendRounded />} disabled={Boolean(busy)} onClick={() => void sendToSecondParty(request)}>{busy === `send-${requestId}` ? 'Sending…' : 'Send to second party'}</Button>}
                      {canApprove && !depositRequired && <Button size="small" variant="contained" color="success" startIcon={<CheckCircleRounded />} disabled={Boolean(busy)} onClick={() => void approveAgreement(request)}>{busy === `approve-${requestId}` ? 'Approving…' : `Verify & start ${type === 'lease' ? 'lease' : type === 'rent' ? 'rent' : 'sale'} workflow`}</Button>}
                    </Stack>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 850 }}>2. Second party · applicant tenant</Typography>
                    <Typography variant="caption" color="text.secondary">After receiving the request, review the agreement and upload your signature. It then waits for first-party verification and approval.</Typography>
                    <Stack direction="row" spacing={.55} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: .8 }}>
                      {secondSigned ? <Chip size="small" color="success" icon={<TaskAltRounded />} label={awaitingFirstPartyApproval ? 'Signature submitted' : 'Signature uploaded'} /> : <Chip size="small" label={['sent', 'viewed'].includes(status) ? 'Signature required' : 'Waiting for first party'} />}
                      {canSecondPartySign && <Button component="label" size="small" variant="contained" startIcon={<DrawRounded />} disabled={Boolean(busy)}>
                        {busy === `second-mark-${requestId}` ? 'Processing…' : 'Upload my signature'}
                        <input hidden type="file" accept="image/png,image/jpeg" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; void uploadSecondPartySignature(request, file); }} />
                      </Button>}
                    </Stack>
                  </Box>
                </Stack>

                {awaitingFirstPartyApproval && depositRequired && <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 1.2, sm: 1.45 },
                    borderRadius: 2.3,
                    bgcolor: '#fff',
                    borderColor: depositStage === 'approved' ? 'success.light' : depositStage === 'rejected' ? 'error.light' : 'divider',
                  }}
                  data-secureasset-security-deposit-gate="tenant-payment-before-rent-v1"
                >
                  <Stack spacing={1.05}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={.8}>
                      <Box>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 850 }}>Security deposit payment</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Required before the landlord can verify and start the {type === 'lease' ? 'lease' : 'rent'} workflow.
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={.55} alignItems="center">
                        <Chip
                          size="small"
                          color={depositApproved ? 'success' : depositStage === 'rejected' ? 'error' : depositSubmitted ? 'info' : 'warning'}
                          label={statusLabel(depositStage)}
                        />
                        <Chip size="small" variant="outlined" label={money(securityDeposit.amount)} sx={{ fontWeight: 850 }} />
                      </Stack>
                    </Stack>

                    {tenantSide && ['awaiting_tenant', 'rejected'].includes(depositStage) && <Stack spacing={.8}>
                      {depositStage === 'rejected' && <Alert severity="error" sx={{ py: .2 }}>
                        The landlord did not verify the previous payment{depositPayment?.paymentVerification?.rejectionReason ? `: ${depositPayment.paymentVerification.rejectionReason}` : '.'} Submit corrected details and proof.
                      </Alert>}
                      <TextField
                        size="small"
                        fullWidth
                        required
                        label="Transaction ID"
                        placeholder="Enter bank / UPI transaction reference"
                        value={depositTransactionIds[requestId] || ''}
                        onChange={(event) => setDepositTransactionIds((current) => ({ ...current, [requestId]: event.target.value }))}
                        inputProps={{ maxLength: 120 }}
                      />
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={.7}>
                        <Button component="label" size="small" variant="outlined" startIcon={<UploadFileRounded />} disabled={Boolean(busy)}>
                          {depositProofFiles[requestId] ? 'Replace payment proof' : 'Upload payment proof'}
                          <input
                            hidden
                            type="file"
                            accept="image/png,image/jpeg,image/webp,application/pdf"
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null;
                              event.currentTarget.value = '';
                              if (file && file.size > 8 * 1024 * 1024) { onError?.('Payment proof must be 8 MB or smaller'); return; }
                              setDepositProofFiles((current) => ({ ...current, [requestId]: file }));
                            }}
                          />
                        </Button>
                        {depositProofFiles[requestId] && <Button size="small" variant="text" startIcon={<OpenInNewRounded />} onClick={() => void previewSelectedDepositProof(requestId)}>
                          Preview selected proof
                        </Button>}
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<SendRounded />}
                          disabled={Boolean(busy) || !String(depositTransactionIds[requestId] || '').trim() || !depositProofFiles[requestId]}
                          onClick={() => void submitSecurityDeposit(request)}
                        >
                          {busy === `deposit-submit-${requestId}` ? 'Submitting…' : 'Submit security deposit'}
                        </Button>
                      </Stack>
                      {depositProofFiles[requestId] && <Typography variant="caption" color="text.secondary">
                        Selected: {depositProofFiles[requestId]?.name}
                      </Typography>}
                    </Stack>}

                    {tenantSide && depositSubmitted && <Stack spacing={.65}>
                      <Alert severity="info" sx={{ py: .25 }}>
                        Payment submitted with transaction ID <strong>{depositPayment?.transactionId || '—'}</strong>. The landlord will review the proof before starting the rent workflow.
                      </Alert>
                      <Button size="small" variant="outlined" startIcon={<OpenInNewRounded />} disabled={busy === `deposit-proof-${requestId}`} onClick={() => void openSecurityDepositProof(request)} sx={{ alignSelf: 'flex-start' }}>
                        {busy === `deposit-proof-${requestId}` ? 'Opening proof…' : 'Preview submitted proof'}
                      </Button>
                    </Stack>}
                    {tenantSide && depositApproved && <Alert severity="success" sx={{ py: .25 }}>
                      Security deposit verified. The landlord can now complete verification and start the {type === 'lease' ? 'lease' : 'rent'} workflow.
                    </Alert>}

                    {firstPartySide && ['awaiting_tenant', 'rejected'].includes(depositStage) && <Alert severity="warning" sx={{ py: .25 }}>
                      Waiting for the tenant to submit {money(securityDeposit.amount)}, transaction ID and payment proof.
                    </Alert>}

                    {firstPartySide && (depositSubmitted || depositApproved) && <Stack spacing={.8}>
                      <Grid container spacing={.7}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <Box sx={{ p: .85, borderRadius: 1.8, bgcolor: 'action.hover' }}>
                            <Typography variant="caption" color="text.secondary">Deposit amount</Typography>
                            <Typography sx={{ fontSize: 12, fontWeight: 850 }}>{money(securityDeposit.amount)}</Typography>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <Box sx={{ p: .85, borderRadius: 1.8, bgcolor: 'action.hover' }}>
                            <Typography variant="caption" color="text.secondary">Transaction ID</Typography>
                            <Typography sx={{ fontSize: 12, fontWeight: 850, overflowWrap: 'anywhere' }}>{depositPayment?.transactionId || '—'}</Typography>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <Box sx={{ p: .85, borderRadius: 1.8, bgcolor: 'action.hover' }}>
                            <Typography variant="caption" color="text.secondary">Submitted</Typography>
                            <Typography sx={{ fontSize: 12, fontWeight: 850 }}>{dateText(depositPayment?.paymentVerification?.submittedAt)}</Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={.7} flexWrap="wrap" useFlexGap>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<OpenInNewRounded />}
                          disabled={busy === `deposit-proof-${requestId}`}
                          onClick={() => void openSecurityDepositProof(request)}
                        >
                          {busy === `deposit-proof-${requestId}` ? 'Opening proof…' : 'Review payment proof'}
                        </Button>
                        {depositSubmitted && <Button size="small" variant="outlined" color="error" disabled={Boolean(busy)} onClick={() => void rejectSecurityDeposit(request)}>
                          {busy === `deposit-reject-${requestId}` ? 'Rejecting…' : 'Reject payment'}
                        </Button>}
                        {canApprove && <Button size="small" variant="contained" color="success" startIcon={<CheckCircleRounded />} disabled={Boolean(busy)} onClick={() => void approveAgreement(request)}>
                          {busy === `approve-${requestId}` ? 'Verifying & starting…' : `Verify deposit & start ${type === 'lease' ? 'lease' : 'rent'} workflow`}
                        </Button>}
                      </Stack>
                    </Stack>}
                  </Stack>
                </Paper>}

                {awaitingFirstPartyApproval && <Alert severity="warning" icon={<HourglassTopRounded />} data-secureasset-agreement-first-party-approval="awaiting-verification-v86">
                  {depositRequired
                    ? <>The agreement is signed, but the {type === 'lease' ? 'lease' : 'rent'} workflow stays locked until the required security deposit is submitted and reviewed.</>
                    : <>The applicant tenant’s signature is submitted and waiting for the landlord-enabled first party to verify and approve it. The {type === 'lease' ? 'lease' : type === 'rent' ? 'rent' : 'sale'} workflow has not started yet.</>}
                </Alert>}

                {status === 'approved' && !cycleEnabled && <Alert severity="success">The sale agreement is approved. Both parties can preview or download the completed stamp-paper paper.</Alert>}

                {cycleActive && <Paper variant="outlined" sx={{ p: { xs: 1.15, sm: 1.4 }, borderRadius: 2.2, bgcolor: 'background.paper' }} data-secureasset-agreement-cycle="approved-rent-lease-lifecycle-v86">
                  <Stack spacing={1.1}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
                      <Stack direction="row" spacing={.8} alignItems="center"><EventAvailableRounded color="primary" /><Box><Typography sx={{ fontWeight: 850, fontSize: 13 }}>{typeLabel(type)} cycle active</Typography><Typography variant="caption" color="text.secondary">Activated after first-party verification and approval.</Typography></Box></Stack>
                      <Chip size="small" color={lifecycle.expired ? 'warning' : 'success'} label={lifecycle.timeLeftLabel || 'Cycle active'} />
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: .7, sm: 2.2 }} flexWrap="wrap" useFlexGap>
                      <Typography variant="body2"><Box component="span" sx={{ color: 'text.secondary' }}>Started:</Box> {dateText(lifecycle.startsAt)}</Typography>
                      <Typography variant="body2"><Box component="span" sx={{ color: 'text.secondary' }}>Ends:</Box> {dateText(lifecycle.endsAt)}</Typography>
                      <Typography variant="body2"><Box component="span" sx={{ color: 'text.secondary' }}>Next due:</Box> {dateText(lifecycle.nextDueAt)}</Typography>
                      <Typography variant="body2"><Box component="span" sx={{ color: 'text.secondary' }}>Term:</Box> {lifecycle.termMonths || 1} month{Number(lifecycle.termMonths || 1) === 1 ? '' : 's'}</Typography>
                    </Stack>
                    {cancellation.state === 'requested' && <Alert severity="warning">The applicant tenant requested cancellation. Only the landlord-enabled first party can cancel the cycle or keep it active.</Alert>}
                    {cancellation.state === 'rejected' && <Alert severity="info">The prior cancellation request was not approved; the cycle remains active.</Alert>}
                    {firstPartySide && <Stack spacing={.8}>
                      {!renewalFor || idOf(renewalFor) !== requestId
                        ? <Button size="small" variant="outlined" startIcon={<ReplayRounded />} disabled={Boolean(busy) || !templates.length} onClick={() => { setAgreementStartDate(dateInput(request.endDate || lifecycle.endsAt)); setRenewalFor(request); }}>Prepare renewal agreement</Button>
                        : <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                          <Stack spacing={1}>
                            <Typography sx={{ fontWeight: 850, fontSize: 12.5 }}>New agreement for this tenancy</Typography>
                            {agreementTermFields()}
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={.8}>
                              <Select size="small" fullWidth value={templateId} onChange={(event) => setTemplateId(event.target.value)} displayEmpty aria-label="Renewal agreement template">
                                <MenuItem value="" disabled>Select a template</MenuItem>
                                {templates.map((template) => <MenuItem key={idOf(template)} value={idOf(template)}>{template.name} · v{template.version || 1}</MenuItem>)}
                              </Select>
                              <Button size="small" variant="contained" disabled={Boolean(busy) || !templateId || !validAgreementTerm} onClick={() => void prepareRequest(requestId)}>{busy === 'prepare' ? 'Preparing…' : 'Prepare renewal'}</Button>
                              <Button size="small" disabled={Boolean(busy)} onClick={() => setRenewalFor(null)}>Cancel</Button>
                            </Stack>
                          </Stack>
                        </Paper>}
                    </Stack>}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={.8} flexWrap="wrap" useFlexGap>
                      <Button size="small" variant="outlined" startIcon={<DownloadRounded />} disabled={busy === `download-${requestId}`} onClick={() => void downloadAgreement(request)}>Download agreement paper</Button>
                      {firstPartySide ? <>
                        {cancellation.state === 'requested' && <Button size="small" variant="outlined" disabled={Boolean(busy)} onClick={() => void keepCycleActive(request)}>{busy === `reject-cancel-${requestId}` ? 'Updating…' : 'Keep cycle active'}</Button>}
                        <Button size="small" variant="outlined" color="error" startIcon={<CloseRounded />} disabled={Boolean(busy)} onClick={() => void cancelCycle(request)}>{busy === `cancel-${requestId}` ? 'Cancelling…' : 'Cancel cycle'}</Button>
                        <Button size="small" variant="outlined" disabled={Boolean(busy) || !lifecycle.expired} onClick={() => void closeCycle(request)}>{busy === `close-${requestId}` ? 'Closing…' : lifecycle.expired ? 'Close cycle' : 'Close after end date'}</Button>
                      </> : tenantSide ? <>
                        <Button size="small" variant="outlined" startIcon={<ReplayRounded />} disabled={Boolean(busy) || renewal.requested} onClick={() => void renewCycle(request, false)}>{busy === `renew-${requestId}` ? 'Requesting…' : renewal.requested ? 'Renewal requested' : 'Request renewal agreement'}</Button>
                        <Button size="small" variant="outlined" color="warning" disabled={Boolean(busy) || !canTenantRequestCancellation} onClick={() => void requestCancellation(request)}>{busy === `cancel-request-${requestId}` ? 'Requesting…' : cancellation.state === 'requested' ? 'Cancellation requested' : 'Request cancellation'}</Button>
                        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: { sm: 'center' } }}>Only the landlord-enabled first party can cancel or close the cycle.</Typography>
                      </> : null}
                    </Stack>
                  </Stack>
                </Paper>}

                {status === 'cancelled' && <Alert severity="warning">This rent / lease cycle was cancelled by the landlord-enabled first party. The agreement paper remains available to download.</Alert>}
                {status === 'closed' && <Alert severity="success">This rent / lease cycle is closed. The completed agreement paper remains available to download.</Alert>}
              </Stack>
            </Paper>;
          })}
        </Stack> : <Typography variant="body2" color="text.secondary">No agreement request has been prepared for this accepted application.</Typography>}
      </Stack>
    </Paper>}
    {actions.dialogs}
  </Stack>;
}
