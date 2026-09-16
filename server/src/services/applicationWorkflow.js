export const APPLICATION_REVIEW_STATUSES = Object.freeze([
  'submitted', 'under_review', 'shortlisted', 'interview_requested', 'interview_scheduled',
  'site_visit_scheduled', 'additional_documents_requested', 'documents_pending',
]);

export const APPLICATION_ACCEPTED_STATUSES = Object.freeze([
  'approved', 'agreement_pending', 'deposit_pending', 'completed',
]);

export const APPLICATION_LANDLORD_STATUSES = Object.freeze([
  'under_review', 'shortlisted', 'interview_requested', 'interview_scheduled',
  'site_visit_scheduled', 'additional_documents_requested', 'approved', 'rejected',
  'waiting_list', 'agreement_pending', 'deposit_pending', 'completed',
]);

export function sameId(a, b) {
  return Boolean(a && b && String(a?._id || a) === String(b?._id || b));
}

export function isApplicationAccepted(status) {
  return APPLICATION_ACCEPTED_STATUSES.includes(String(status || '').trim().toLowerCase());
}

export function isApplicationDecisionActor(user, application) {
  const role = String(user?.role || '').trim().toLowerCase();
  return role === 'admin' || role === 'manager' || sameId(application?.landlord, user?._id);
}

// A final application decision is intentionally one-way. The only permitted
// progress after approval is the agreement/deposit/completion workflow. This
// keeps the UI rule (Accept/Reject only before a decision) enforceable for old
// clients, direct API calls, and the legacy decision endpoint alike.
export function assertApplicationDecisionTransition(application, nextStatus, user, ErrorClass = Error) {
  if (!isApplicationDecisionActor(user, application)) return;
  const current = String(application?.status || '').trim().toLowerCase();
  const next = String(nextStatus || '').trim().toLowerCase();
  if (!next) return;
  if (current === next) return;

  if (APPLICATION_ACCEPTED_STATUSES.includes(current)) {
    if (!['agreement_pending', 'deposit_pending', 'completed'].includes(next)) {
      throw new ErrorClass(409, 'This application is already accepted; continue with its agreement workflow');
    }
    return;
  }
  if (current === 'rejected' || current === 'withdrawn') {
    throw new ErrorClass(409, 'This application already has a final decision');
  }
  if (['approved', 'rejected'].includes(next) && !APPLICATION_REVIEW_STATUSES.includes(current)) {
    throw new ErrorClass(409, 'Accept or reject the application only while it is under review');
  }
}
