import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { SurveyorSubscription } from '../server/src/models/index.js';
import { repairSurveyorSubscriptionUserIndex } from './lib/surveyor-subscription-index.js';

try {
  await connectDatabase();
  const result = await repairSurveyorSubscriptionUserIndex(SurveyorSubscription.collection, { logger: console });
  console.log(`SurveyorSubscription index preflight passed (${result.action}).`);
} catch (error) {
  console.error('SurveyorSubscription index preflight failed:', error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
