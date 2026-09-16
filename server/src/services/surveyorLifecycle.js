import {
  SurveyorSubscription, SurveyorVerification, SurveyEquipment, SurveyProject, Payment,
} from '../models/index.js';
import { notifyOnce } from './notifications.js';
import { ensureDefaultSurveyorPlans, refreshSurveyorSubscriptionState } from './surveyorSubscription.js';


export async function runSurveyorLifecycleMaintenance() {
  await ensureDefaultSurveyorPlans();
  const now = new Date(); const upcoming = new Date(now.getTime() + 8 * 86400000);
  const subscriptions = await SurveyorSubscription.find({ status: { $in: ['trial', 'active', 'expiring_soon', 'grace_period'] }, expiresAt: { $lte: upcoming } }).lean();
  for (const sub of subscriptions) {
    await refreshSurveyorSubscriptionState(sub.user);
    const days = Math.ceil((new Date(sub.expiresAt).getTime() - now.getTime()) / 86400000);
    if ([7, 3, 1, 0].includes(days)) await notifyOnce({ user: sub.user, key: `surveyor-sub-expiry-${sub._id}-${days}`, title: days > 0 ? 'Surveyor subscription expiring' : 'Surveyor subscription grace period', message: days > 0 ? `Your ${sub.planKey} plan expires in ${days} day${days === 1 ? '' : 's'}.` : 'Renew now to keep your public profile, services and quotation access active.', actionUrl: '/app/surveyor-subscription', category: 'survey' });
  }

  const licenceWindow = new Date(now.getTime() + 30 * 86400000);
  for (const verification of await SurveyorVerification.find({ status: 'verified', licenceExpiryDate: { $gte: now, $lte: licenceWindow } }).lean()) {
    const days = Math.ceil((new Date(verification.licenceExpiryDate).getTime() - now.getTime()) / 86400000);
    await notifyOnce({ user: verification.user, key: `surveyor-licence-${verification._id}-${new Date(verification.licenceExpiryDate).toISOString().slice(0, 10)}`, title: 'Professional licence expiring', message: `Your professional licence expires in ${days} days. Upload the renewed licence to keep verification active.`, actionUrl: '/app/surveyor-verification', category: 'survey' });
  }

  const equipmentWindow = new Date(now.getTime() + 14 * 86400000);
  for (const equipment of await SurveyEquipment.find({ nextCalibrationDate: { $gte: now, $lte: equipmentWindow }, availability: { $ne: 'retired' } }).lean()) {
    await notifyOnce({ user: equipment.surveyor, key: `equipment-calibration-${equipment._id}-${new Date(equipment.nextCalibrationDate).toISOString().slice(0, 10)}`, title: 'Equipment calibration due', message: `${equipment.name} is due for calibration on ${new Date(equipment.nextCalibrationDate).toLocaleDateString('en-IN')}.`, actionUrl: '/app/survey-equipment', category: 'survey' });
  }

  const projectWindow = new Date(now.getTime() + 2 * 86400000);
  for (const project of await SurveyProject.find({ dueDate: { $gte: now, $lte: projectWindow }, status: { $nin: ['completed', 'cancelled'] } }).lean()) {
    await notifyOnce({ user: project.surveyor, key: `survey-project-due-${project._id}-${new Date(project.dueDate).toISOString().slice(0, 10)}`, title: 'Survey project deadline approaching', message: `${project.projectNumber || 'A survey project'} is due on ${new Date(project.dueDate).toLocaleDateString('en-IN')}.`, actionUrl: '/app/survey-projects', category: 'survey' });
  }

  await Payment.updateMany({ type: { $in: ['survey_advance', 'survey_milestone', 'survey_final'] }, status: 'pending', dueDate: { $lt: now } }, { status: 'overdue' });
}

export function scheduleSurveyorLifecycleMaintenance() {
  const execute = () => runSurveyorLifecycleMaintenance().catch((error) => console.error('Surveyor lifecycle maintenance failed', error));
  const first = setTimeout(execute, 3000); first.unref();
  const interval = setInterval(execute, 6 * 60 * 60 * 1000); interval.unref();
  return () => { clearTimeout(first); clearInterval(interval); };
}
