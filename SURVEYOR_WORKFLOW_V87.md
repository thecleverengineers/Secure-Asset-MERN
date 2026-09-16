# SecureAsset v87 — PDF-aligned Surveyor workflow

Release ID: `2026-09-03-pdf-aligned-surveyor-workflow-v87`

## Implemented lifecycle

| Stage | Landlord | Surveyor | Platform |
|---|---|---|---|
| Posted | Selects an owned property and supplies location, size/type, requirements, budget, visit date, and deadline | Finds a public job with approximate distance | Protects exact location and records the job |
| Applications | Reviews verified profile, experience, rating, portfolio, price, distance, and dates | Submits one formal scope, methodology, price, and schedule | Notifies the landlord and records the audit event |
| Hired | Chooses one proposal and may chat with the Surveyor | Receives the hired project and map navigation | Rejects competing proposals and creates secure payment tracking |
| In progress | Tracks the visit and evidence | Completes GPS check-in, measurements, notes, photos, videos, documents, and check-out | Applies the geofence and marks the property Surveyed |
| Submitted | Reviews the report and evidence | Submits findings or a requested revision | Notifies landlord and administrators and marks Field Verified |
| Approved | Approves or requests revision | Downloads the locked approved report | Creates the final balance and marks Document Verified |
| Completed | Sees the fully verified property | Sees completed project and received payment | Completes after payment and marks Fully Verified |

## Surveyor navigation

The Surveyor sidebar now contains only:

- Surveyor Workspace
- Find Survey Jobs
- My Proposals
- Active Projects
- Professional Profile
- Verification

Chat and notifications remain in the application header. Surveyor subscription remains in the profile menu. Navigation, check-in, field data, evidence, report review, payment status, and audit history are contained inside each active project. Legacy survey records remain readable, while old standalone Surveyor modules redirect to Active Projects.

## Compatibility and security

- Existing SurveyProject records are normalized lazily into the canonical lifecycle without deleting historical records.
- New jobs require an owner-scoped property, exact map pin, visit date, report deadline, requirements, deliverables, and a valid budget.
- Secure check-in requires acceptable GPS accuracy, a one-kilometre geofence, and any agreed advance payment to be paid.
- Evidence bytes remain protected by the encrypted Drive route and are available only to the assigned parties or an administrator.
- Report approval locks the report, creates the outstanding final payment, and advances property verification.
