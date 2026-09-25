import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('surveyor verification page contains the requested profile verification sections', () => {
  const page = read('src/app/pages/app/SurveyorVerificationPage.tsx');
  for (const label of [
    'Basic Profile', 'Full name', 'Date of birth', 'Gender', 'Address', 'PIN code',
    'Contact Verification', 'Mobile number', 'Email address',
    'Identity Verification', 'Government ID type', 'ID number', 'Front image', 'Back image (where applicable)',
    'Professional Information', 'Occupation / profession', 'Years of experience', 'Service area / working location', 'Short professional description',
    'Bank Details — Optional', 'Bank name', 'IFSC', 'Account number', 'Passbook image', 'Declaration',
  ]) assert.ok(page.includes(label), `missing ${label}`);
  assert.match(page, /Aadhaar/);
  assert.match(page, /PAN/);
  assert.match(page, /Voter ID/);
  assert.match(page, /Driving Licence/);
  assert.match(page, /I confirm that the information and documents submitted are correct and belong to me\./);
});

test('verification OTP uses Admin Fast2SMS credentials with the approved WhatsApp authentication template', () => {
  const controller = read('server/src/controllers/surveyorSubscriptionController.js');
  const fast2sms = read('server/src/services/fast2sms.js');
  const routes = read('server/src/routes/surveyorSubscriptionRoutes.js');
  assert.match(controller, /SURVEYOR_VERIFICATION_WHATSAPP_TEMPLATE = 'otp_template'/);
  assert.match(controller, /sendFast2SmsWhatsApp/);
  assert.match(controller, /variables: \[otp\]/);
  assert.match(fast2sms, /otp_template: Object\.freeze/);
  assert.match(fast2sms, /endpoint: 'https:\/\/www\.fast2sms\.com\/dev\/whatsapp'/);
  assert.match(fast2sms, /messageId: '12353'/);
  assert.match(fast2sms, /phoneNumberId: '494331070422489'/);
  assert.match(fast2sms, /category: 'authentication'/);
  assert.match(fast2sms, /variables: \['otp'\]/);
  assert.match(fast2sms, /authorization: String\(config\.authorization \|\| ''\)/);
  assert.match(fast2sms, /template\.endpoint \|\| config\.whatsappEndpoint/);
  assert.match(fast2sms, /template\.phoneNumberId \|\| config\.whatsappPhoneNumberId/);
  assert.match(fast2sms, /authenticationEnabled = template\.category === 'authentication'/);
  assert.doesNotMatch(fast2sms.slice(fast2sms.indexOf('export function buildFast2SmsWhatsAppUrl'), fast2sms.indexOf('export async function getFast2SmsConfiguration')), /media|document_filename/);
  assert.match(routes, /verification\/mobile-otp\/request/);
  assert.match(routes, /verification\/mobile-otp\/verify/);
  assert.match(controller, /crypto\.timingSafeEqual/);
});

test('mobile OTP verification is mandatory before Surveyor verification submission', () => {
  const controller = read('server/src/controllers/surveyorSubscriptionController.js');
  assert.match(controller, /missing\.push\('mobile OTP verification'\)/);
  assert.match(controller, /verification\.mobileVerification\?\.verifiedAt/);
  assert.match(controller, /normalizeIndianMobile\(verification\.phone\)/);
});

test('government ID and passbook uploads are private protected Drive documents', () => {
  const routes = read('server/src/routes/uploadRoutes.js');
  const middleware = read('server/src/middleware/rolePermission.js');
  const upload = read('server/src/controllers/uploadController.js');
  const page = read('src/app/pages/app/SurveyorVerificationPage.tsx');
  assert.match(routes, /surveyor-verification-document/);
  assert.match(middleware, /requireSurveyorVerificationDocumentUpload/);
  assert.match(upload, /surveyor_verification_identity/);
  assert.match(upload, /surveyor_verification_bank/);
  assert.match(upload, /'identity_document'/);
  assert.match(upload, /'financial_document'/);
  assert.match(page, /uploadSurveyorVerificationDocument/);
});

test('verification document references must belong to the submitting Surveyor', () => {
  const controller = read('server/src/controllers/surveyorSubscriptionController.js');
  assert.match(controller, /assertOwnedVerificationDocument/);
  assert.match(controller, /owner: userId/);
  assert.match(controller, /visibility: 'private'/);
  assert.match(controller, /\/api\/v1\/drive\/files\//);
});

test('bank details stay optional while bank verification status is hidden and pending', () => {
  const model = read('server/src/models/surveyor.js');
  const controller = read('server/src/controllers/surveyorSubscriptionController.js');
  const page = read('src/app/pages/app/SurveyorVerificationPage.tsx');
  assert.match(model, /bankDetails: \{/);
  assert.match(model, /bankVerification: \{/);
  assert.match(model, /default: 'pending'/);
  assert.match(controller, /select\('-bankVerification'\)/);
  assert.match(controller, /verification\.bankVerification = \{ status: 'pending' \}/);
  assert.doesNotMatch(page, /Bank verification status/);
});

test('required declaration and core fields gate submission', () => {
  const controller = read('server/src/controllers/surveyorSubscriptionController.js');
  for (const required of ['full name','profile photo','date of birth','gender','address','city','state','PIN code','government ID type','government ID number','government ID front image','occupation / profession','years of experience','service area / working location','professional description','declaration']) {
    assert.ok(controller.includes(required), `missing server requirement: ${required}`);
  }
});
