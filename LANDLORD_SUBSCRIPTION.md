# Landlord Subscription Workflow

1. A person signs up and receives the `tenant` role.
2. The tenant can continue using normal tenant features without a subscription.
3. The tenant opens **Landlord Subscription** and purchases a plan.
4. The same account gains landlord capabilities while the subscription is active.
5. The tenant creates owner-scoped properties and selects `rent` or `sale`.
6. `private` keeps the property inside the owner's dashboard.
7. `public` publishes an available property to the marketplace.
8. Plan limits control total owned properties and simultaneous public listings.
9. Cancellation immediately changes subscription-owned listings back to private.

All authorization checks are enforced by the Node.js API and MongoDB ownership fields, not only by the React interface.
