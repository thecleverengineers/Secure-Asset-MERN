# Fast2SMS WhatsApp Business delivery

SecureAsset uses the approved Fast2SMS templates supplied in the WhatsApp Business workbook. The provider authorization key is encrypted with the application secret in MongoDB and is never returned to the browser or committed to source control.

## Admin setup

Open **Site & Marketplace Administration → SMS / WhatsApp** and:

1. Enter the Fast2SMS authorization key.
2. Enable **Fast2SMS WhatsApp transactional delivery**.
3. Confirm the WhatsApp API endpoint and phone number ID. The supplied workbook defaults are `https://www.fast2sms.com/dev/whatsapp` and `1202480702956271`.
4. Save the configuration and send a test template to an opted-in Indian mobile number.
5. Keep WhatsApp enabled in the recipient's notification preferences. An explicit WhatsApp opt-out is always respected.

The existing SMS OTP configuration remains independent. Enabling WhatsApp does not enable OTP delivery.

## Approved event mapping

| Business event | Template | Fast2SMS message ID |
| --- | --- | ---: |
| Registration completed / KYC required | `secure_asset_kyc` | 26891 |
| Public property published | `property_listed_successfully` | 26892 |
| Lease reaches pending approval or active | `lease_agreement_ready` | 27054 |
| Survey assigned to a surveyor | `new_survey_assigned` | 27055 |
| Monthly rental invoice created | `rent_reminder` | 27057 |
| Landlord accepts a rent payment | `confirming_successful_receipt_of_rent` | 27056 |
| Any finalized non-rental payment, and landlord side of rent payment | `payment_completed` | 26887 |

Delivery is queued through the existing notification worker, respects quiet hours and notification category preferences, and is idempotent per business event. If the provider is disabled or the recipient has no valid mobile number, the worker records a skipped delivery instead of failing the underlying transaction.
