import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { User, Property, Subscription } from '../server/src/models/index.js';

await connectDatabase();
try {
  const userResult = await User.updateMany({ role: 'user' }, { $set: { role: 'tenant' } });
  const properties = await Property.find({});
  let updatedProperties = 0;
  for (const property of properties) {
    let changed = false;
    if (!property.listingType) { property.listingType = property.isSale ? 'sale' : 'rent'; changed = true; }
    if (!property.visibility) { property.visibility = 'private'; changed = true; }
    if (!property.publicationStatus) { property.publicationStatus = 'draft'; changed = true; }
    if (property.visibility === 'public' && property.publicationStatus !== 'published') {
      property.publicationStatus = 'published';
      property.publishedAt ||= new Date();
      changed = true;
    }
    if (changed) {
      await property.save({ validateModifiedOnly: true });
      updatedProperties += 1;
    }
  }

  const now = new Date();
  // Mark the range expression as an application-owned selector. This keeps the
  // migration compatible even if a future caller enables sanitizeFilter for a
  // specific connection or query.
  const active = await Subscription.find({
    status: 'active',
    expiresAt: mongoose.trusted({ $gt: now }),
  }).lean();

  let restoredLandlords = 0;
  for (const subscription of active) {
    if (!subscription.user || !subscription.expiresAt) continue;
    const result = await User.findByIdAndUpdate(subscription.user, {
      $set: {
        landlordEnabled: true,
        landlordSubscriptionExpiresAt: subscription.expiresAt,
      },
    });
    if (result) restoredLandlords += 1;
  }
  console.log(`Migrated ${userResult.modifiedCount} user account(s) to tenant, normalised ${updatedProperties} property listing(s), and restored ${restoredLandlords} active landlord account(s).`);
} finally {
  await disconnectDatabase();
}
