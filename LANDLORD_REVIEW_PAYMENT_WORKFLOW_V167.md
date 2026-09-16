# Landlord review and final-payment workflow v167

This release makes the landlord's approval path visible and auditable. A final report remains unavailable until every stage below has been completed by the correct party.

## Workflow

1. The assigned Surveyor records field measurements and uploads at least one evidence file.
2. The Surveyor selects Submit for landlord review. SecureAsset takes a review snapshot containing the submitted measurement, note, and evidence counts.
3. The landlord opens Landlord review & payment desk and inspects the evidence, measurements, notes, and agreed scope.
4. The landlord either requests a fieldwork revision with a written reason, or checks all three acknowledgements and records approval. Approval creates the final invoice when an amount remains outstanding.
5. The landlord pays outside SecureAsset, then enters the transaction ID, uploads an image screenshot, and confirms the payment declaration.
6. The assigned Surveyor opens the protected screenshot, verifies the transaction and received payment, then records receipt confirmation. The landlord can be asked to correct the proof instead.
7. Only then can the Surveyor upload the final report. Uploading that report completes the survey and marks the property fully verified.

## Recorded controls

- Fieldwork approval requires three acknowledgements: measurements and notes, evidence, and agreed scope.
- Each submission carries a review-round number, timestamp, submitted-by actor, reviewer, comment, snapshot, and immutable audit entry.
- A revision decision retains its reason and routes the project back to the Surveyor without allowing a report bypass.
- Final payment requires two separate actions: landlord declaration and Surveyor receipt confirmation.
- The report endpoint independently checks the recorded landlord approval, confirmed final payment, and any remaining survey balance.
- Payment proof file identifiers are not returned in normal project data. The protected content endpoint applies project-participant access control.

## Landlord instructions

Open App → Survey Projects → choose the project. In Landlord review & payment desk, select Open recorded review once fieldwork is ready. Read the submitted work, then either request changes or select all three confirmations and approve. Once the invoice appears, use Pay & submit proof. After the Surveyor confirms receipt, the final-report status changes to ready for upload.

## Outcome

An approved fieldwork review alone does not verify the property. A property becomes fully verified only when the assigned Surveyor uploads the final report after the recorded payment sequence is complete.
