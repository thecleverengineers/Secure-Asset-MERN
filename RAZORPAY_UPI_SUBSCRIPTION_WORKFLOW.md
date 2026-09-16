# Tenant subscription payment workflow

SecureAsset keeps one Tenant account and activates professional capabilities only after a subscription payment is verified.

## Landlord and Surveyor activation

1. A Tenant selects a Landlord or Surveyor plan.
2. Razorpay creates an order on the server using the administrator's encrypted key secret. The browser receives only the public key ID.
3. Razorpay Checkout returns `order_id`, `payment_id` and `signature`. The server verifies the HMAC signature before marking the payment paid.
4. Manual UPI payments remain pending. The Tenant records the UPI transaction/reference ID and the payment appears in Admin → Subscription Payment Approvals.
5. An administrator approves or rejects the manual payment. Approval runs the same idempotent payment lifecycle as Razorpay and enables the matching mode, expiry and plan limits.
6. The effective role and subscription status are enforced again by API middleware and resource authorization. Sidebar visibility is only a convenience; it is not the security boundary.

## Payment configuration

Administrators use Site & Marketplace Administration → Razorpay & UPI to manage:

- Razorpay merchant/key ID
- Razorpay key secret (encrypted in MongoDB and never returned to the client)
- UPI ID and display name
- Optional UPI QR image URL

The `.env` values `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `UPI_ID`, `UPI_NAME` and `UPI_QR_URL` remain safe bootstrap fallbacks. Database settings take precedence after an administrator saves the integration.

## Document Vault placement

The canonical `Document Vault` module is placed immediately after the dashboard in the authenticated sidebar. The legacy `Landlord Documents` duplicate is hidden so every role uses the same protected vault route. The dashboard also exposes a prominent Secure Document Vault action.
