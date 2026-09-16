// KYC uploads use explicit categories so the document's purpose and side are
// retained without overloading the generic Vault media categories.
export const TENANT_KYC_DOCUMENT_CATEGORIES = Object.freeze([
  'tenant_passport_photo',
  'tenant_address_proof_front',
  'tenant_address_proof_back',
  'tenant_government_identity_front',
  'tenant_government_identity_back',
]);

// KYC documents are intentionally limited to safe identity-document formats.
// The general Document Vault remains governed by its own administrator policy.
export const TENANT_KYC_ALLOWED_EXTENSIONS = Object.freeze(['.jpg', '.jpeg', '.png', '.pdf']);

export function isTenantKycCategory(value) {
  return TENANT_KYC_DOCUMENT_CATEGORIES.includes(String(value || '').trim().toLowerCase());
}
