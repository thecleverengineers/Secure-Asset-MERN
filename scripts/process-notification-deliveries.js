import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { processNotificationQueue } from '../server/src/services/notificationDelivery.js';

try {
  await connectDatabase();
  const summary = await processNotificationQueue({ limit: Number(process.env.NOTIFICATION_BATCH_SIZE || 200) });
  console.log('Notification delivery queue processed:', summary);
  await disconnectDatabase();
  process.exit(0);
} catch (error) {
  console.error('Notification delivery worker failed:', error);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
}
