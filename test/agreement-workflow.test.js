import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertApplicationDecisionTransition, isApplicationAccepted } from '../server/src/services/applicationWorkflow.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const model = read('server/src/models/agreements.js');
const applicationModel = read('server/src/models/index.js');
const controller = read('server/src/controllers/agreementController.js');
const routes = read('server/src/routes/agreementRoutes.js');
const api = read('src/app/services/api.ts');
const applicationPanel = read('src/app/components/application/ApplicationAgreementPanel.tsx');
const signatureImage = read('src/app/utils/signatureImage.ts');
const templatesPage = read('src/app/pages/app/AgreementTemplatesPage.tsx');
const resourcePage = read('src/app/pages/app/ResourcePage.tsx');
const modulePage = read('src/app/pages/app/ModulePage.tsx');
const appShell = read('src/app/components/layout/AppShell.tsx');
const rbac = read('server/src/services/rbac.js');
const messagingController = read('server/src/controllers/messagingController.js');

test('agreement records support separate rent, lease and sale stamp-paper workflows with two private marks', () => {
  assert.match(model, /AGREEMENT_TYPES = Object\.freeze\(\['rent', 'lease', 'sale'\]\)/);
  assert.match(model, /StampPaperSchema/);
  assert.match(model, /agreementType: \{ type: String, enum: AGREEMENT_TYPES/);
  assert.match(model, /first_party_signed/);
  assert.match(model, /PartyMarkSchema/);
  assert.match(model, /firstPartyMark/);
  assert.match(model, /secondPartySignature/);
  assert.match(model, /internal_signature/);
  assert.match(applicationModel, /acceptedAt: Date, acceptedBy: objectId\('User'\)/);
});

test('application acceptance is a one-way server-enforced decision', () => {
  const owner = { _id: 'owner-1', role: 'tenant' };
  const application = { _id: 'application-1', landlord: 'owner-1', status: 'submitted' };
  class WorkflowError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }
  assert.equal(isApplicationAccepted('approved'), true);
  assert.doesNotThrow(() => assertApplicationDecisionTransition(application, 'approved', owner, WorkflowError));
  application.status = 'approved';
  assert.doesNotThrow(() => assertApplicationDecisionTransition(application, 'agreement_pending', owner, WorkflowError));
  assert.throws(() => assertApplicationDecisionTransition(application, 'rejected', owner, WorkflowError), /already accepted/);
  application.status = 'rejected';
  assert.throws(() => assertApplicationDecisionTransition(application, 'approved', owner, WorkflowError), /final decision/);
});

test('agreement API requires a first-party mark before requesting a second-party signature', () => {
  assert.match(controller, /isApplicationAccepted\(application\.status\)/);
  assert.match(controller, /template\.agreementType !== agreementType/);
  assert.match(controller, /createStampPaperPdf/);
  assert.match(controller, /export const prepareAgreementRequest/);
  assert.match(controller, /export const uploadFirstPartyMark/);
  assert.match(controller, /export const sendInternalAgreementRequest/);
  assert.match(controller, /export const uploadSecondPartySignature/);
  assert.match(controller, /hasMark\(request\.firstPartyMark\)/);
  assert.match(controller, /Only the landlord-enabled first party can upload/);
  assert.match(controller, /Only the requested second party can upload/);
  assert.match(controller, /Confirm that you agree to sign this agreement/);
  assert.match(controller, /requiredTransparentPng/);
  assert.match(controller, /isTransparentPng/);
  assert.match(controller, /backgroundRemoved: true/);
  assert.match(controller, /createNotification/);
  assert.doesNotMatch(controller, /sendEnvelope\(/);
  assert.doesNotMatch(controller, /createRecipientView\(/);
  assert.match(routes, /router\.post\('\/requests'/);
  assert.match(routes, /router\.post\('\/requests\/:id\/first-party-mark'/);
  assert.match(routes, /router\.post\('\/requests\/:id\/send'/);
  assert.match(routes, /router\.post\('\/requests\/:id\/second-party-signature'/);
  assert.match(routes, /router\.get\('\/requests\/:id\/marks\/:party'/);
  assert.match(routes, /router\.get\('\/requests\/:id\/preview'/);
});

test('landlord-enabled tenants can maintain templates and use the internal two-party signing sequence', () => {
  for (const phrase of ['labels', 'agreementTypes', 'Agreement body', 'Stamp-paper settings', 'Save template', 'Delete']) {
    assert.ok(templatesPage.includes(phrase), `template editor is missing ${phrase}`);
  }
  for (const phrase of ['getAgreementTemplates', 'prepareAgreementRequest', 'uploadFirstPartyAgreementMark', 'sendInternalAgreementRequest', 'uploadSecondPartyAgreementSignature', 'approveAgreementRequest', 'renewAgreementCycle', 'requestAgreementCancellation', 'First party', 'Second party', 'Preview', 'internal-two-party-signature-approval-cycle-v86']) {
    assert.ok(applicationPanel.includes(phrase), `application agreement panel is missing ${phrase}`);
  }
  assert.doesNotMatch(applicationPanel, /DocuSign/);
  assert.match(applicationPanel, /useActionDialog/);
  assert.match(applicationPanel, /askConfirmation/);
  assert.match(applicationPanel, /\{actions\.dialogs\}/);
  assert.doesNotMatch(applicationPanel, /window\.confirm\s*\(/);
  assert.match(api, /\/agreements\/templates/);
  assert.match(api, /\/agreements\/requests/);
  assert.match(api, /fetchAgreementPreviewBlob/);
  assert.match(api, /uploadFirstPartyAgreementMark/);
  assert.match(api, /sendInternalAgreementRequest/);
  assert.match(api, /uploadSecondPartyAgreementSignature/);
  assert.match(api, /fetchAgreementPartyMarkBlob/);
  assert.match(rbac, /agreement-templates/);
  assert.match(appShell, /agreement-templates/);
  assert.match(modulePage, /AgreementTemplatesPage/);
});

test('an accepted tenant application exposes its agreement request and a guarded landlord chat', () => {
  for (const phrase of ['Chat with landlord', 'createConversation', 'accepted-application-chat-v85', "type: 'application'", "model: 'Application'"]) {
    assert.ok(applicationPanel.includes(phrase), `application panel is missing ${phrase}`);
  }
  assert.match(messagingController, /assertAcceptedApplicationConversation/);
  assert.match(messagingController, /isApplicationAccepted\(application\.status\)/);
  assert.match(messagingController, /Only the accepted applicant and property landlord can start this conversation/);
  assert.match(messagingController, /application:\$\{String\(parsed\.data\.reference\?\.id\)\}/);
});

test('signature uploads are cropped and converted locally to transparent PNG files', () => {
  for (const phrase of ['makeSignatureBackgroundTransparent', 'averageBorder', 'getImageData', 'image/png', 'background', 'new File']) {
    assert.ok(signatureImage.includes(phrase), `signature image processor is missing ${phrase}`);
  }
  assert.match(applicationPanel, /makeSignatureBackgroundTransparent/);
  assert.match(applicationPanel, /transparent-png-v86/);
  assert.match(applicationPanel, /Confirm agreement signature/);
});

test('the applicant signature waits for first-party verification before an active rent or lease cycle exists', () => {
  assert.match(model, /awaiting_first_party_approval/);
  assert.match(model, /firstPartyVerificationAt/);
  assert.match(model, /firstPartyApprovalAt/);
  assert.match(model, /cycleStartedAt/);
  assert.match(model, /cycleEndsAt/);
  assert.match(model, /nextDueAt/);
  assert.match(model, /renewalHistory/);
  assert.match(controller, /request\.status = 'awaiting_first_party_approval'/);
  assert.match(controller, /export const approveAgreementRequest/);
  assert.match(controller, /startAgreementCycle\(req, request\)/);
  assert.match(controller, /rentalUnit \? 'payment_pending' : 'active'/);
  assert.match(controller, /request\.rentalUnit \? 'deposit_pending' : 'completed'/);
  assert.match(controller, /ensureInitialRentalInvoice/);
  assert.match(controller, /requestPayload\(request, tenancy\)/);
  assert.match(routes, /router\.post\('\/requests\/:id\/approve'/);
  assert.match(api, /export async function approveAgreementRequest/);
  assert.match(applicationPanel, /awaiting-verification-v86/);
  assert.match(applicationPanel, /approved-rent-lease-lifecycle-v86/);
  for (const phrase of ['timeLeftLabel', 'Next due:', 'Request renewal', 'Download agreement paper']) assert.ok(applicationPanel.includes(phrase));
});

test('only the first party can cancel or close while the second party requests cancellation', () => {
  assert.match(controller, /export const requestAgreementCancellation/);
  assert.match(controller, /Only the applicant tenant can request cancellation/);
  assert.match(controller, /export const cancelAgreementCycle/);
  assert.match(controller, /Only the landlord-enabled first party can cancel this cycle/);
  assert.match(controller, /export const closeAgreementCycle/);
  assert.match(controller, /Only the landlord-enabled first party can close this cycle/);
  assert.match(controller, /async function releaseCycleProperty/);
  assert.match(controller, /status: \{ \$in: \['occupied', 'rented', 'leased'\] \}/);
  assert.match(controller, /\{ \$set: \{ status: 'available', updatedBy: actorId \} \}/);
  assert.match(routes, /router\.post\('\/requests\/:id\/cancellation-request', requestAgreementCancellation\)/);
  assert.match(routes, /router\.post\('\/requests\/:id\/cancel', landlordPermission\('edit'\), cancelAgreementCycle\)/);
  assert.match(routes, /router\.post\('\/requests\/:id\/close', landlordPermission\('edit'\), closeAgreementCycle\)/);
  assert.match(api, /requestAgreementCancellation/);
  assert.match(api, /cancelAgreementCycle/);
  assert.match(api, /closeAgreementCycle/);
  assert.match(applicationPanel, /Only the landlord-enabled first party can cancel or close the cycle/);
  assert.match(applicationPanel, /firstPartySide \? <>/);
  assert.match(applicationPanel, /tenantSide \? <>/);
});

test('landlord-enabled tenants can add, edit and click to preview each agreement template', () => {
  assert.match(templatesPage, /data-secureasset-agreement-templates="templates-v77"/);
  assert.match(templatesPage, /data-secureasset-agreement-template-preview="clickable-preview-v77"/);
  assert.match(controller, /const filter = \{ owner: req\.user\._id \}/);
  assert.match(controller, /AgreementTemplate\.findOne\(\{ _id: req\.params\.id, owner: req\.user\._id \}\)/);
  assert.match(controller, /owner: req\.user\._id, key/);
  assert.match(templatesPage, /function openPreview\(template: any\)/);
  assert.match(templatesPage, /<ButtonBase/);
  assert.match(templatesPage, /aria-label=\{`Preview \$\{labels\[type\]\} template/);
  assert.match(templatesPage, />Preview<\/Button>/);
  assert.match(templatesPage, />Edit template<\/Button>/);
  assert.match(templatesPage, /professionalTitle=\{previewing/);
});

test('landlord-enabled tenants always receive Manage Templates in the sidebar', () => {
  assert.match(appShell, /'agreement-templates': \{ key: 'agreement-templates', label: 'Manage Templates'/);
  assert.match(appShell, /module\.key === 'agreement-templates' \? 'Manage Templates' : module\.label/);
  assert.match(appShell, /\[\.\.\.LANDLORD_FEATURE_MENU_KEYS\]\.forEach/);
  assert.match(appShell, /const canonical = key === 'agreement-templates' \? items\['agreement-templates'\] : fallback/);
  assert.match(rbac, /\['agreement-templates','Manage Templates','documents','description','\/app\/agreement-templates','basic'\]/);
});

test('Accept/Reject controls disappear after a final application decision', () => {
  assert.match(resourcePage, /canDecideApplication\(actionRow\)/);
  assert.match(resourcePage, /editRoles:\['admin','manager','landlord','tenant'\]/);
  assert.match(resourcePage, /data-secureasset-application-actions="direct-decision-v76"/);
  assert.match(resourcePage, /canDecideApplication\(row\)/);
  assert.match(resourcePage, /onClick=\{\(event\) => \{ event\.stopPropagation\(\); void decideApplication\(row, 'approved'\); \}\}/);
  assert.match(resourcePage, /onClick=\{\(event\) => \{ event\.stopPropagation\(\); void decideApplication\(row, 'rejected'\); \}\}/);
  assert.match(resourcePage, />Accept<\/Button>/);
  assert.match(resourcePage, />Reject<\/Button>/);
  assert.match(resourcePage, />Agreement<\/Button>/);
  assert.match(resourcePage, /Accept application/);
  assert.match(resourcePage, /Reject application/);
  assert.match(resourcePage, /applicationAcceptedStatuses\.includes/);
  assert.match(applicationPanel, /reviewPending && landlordCanManage/);
  assert.match(applicationPanel, /accepted && <Paper/);
});
