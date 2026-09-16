import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { notifyOnce } from '../server/src/services/notifications.js';
import { RentalInvoice, ReminderRule, AuditLog } from '../server/src/models/index.js';
import { createMonthlyRentalInvoices, daysBetweenCalendarDates, refreshRentalBillingStatuses } from '../server/src/services/rentalBilling.js';
import { processRentCycleWhatsAppReminders } from '../server/src/services/rentCycleReminders.js';

const DAY = 86400000;

async function sendReminders(now) {
  const invoices = await RentalInvoice.find({ status: { $in: ['upcoming', 'pending', 'partially_paid', 'overdue'] }, balanceAmount: { $gt: 0 }, dueDate: { $gte: new Date(now.getTime() - 120 * DAY), $lte: new Date(now.getTime() + 30 * DAY) } }).lean();
  let sent = 0;
  for (const invoice of invoices) {
    const rule = await ReminderRule.findOne({
      owner: invoice.landlord,
      active: true,
      $or: [
        { property: invoice.property },
        { property: null },
        { property: { $exists: false } },
      ],
    }).sort({ property: -1 }).lean();
    const offsets = rule?.offsetsDays?.length ? rule.offsetsDays.map(Number) : [-7, -3, -1, 0, 1, 3, 7];
    const offset = daysBetweenCalendarDates(now, new Date(invoice.dueDate)); // negative before due; positive overdue
    const weekly = Boolean(rule?.repeatWeeklyUntilPaid && offset > 7 && offset % 7 === 0);
    if (!offsets.includes(offset) && !weekly) continue;
    const reminderKey = `${invoice._id}:${offset}`;
    const balance = Number(invoice.balanceAmount || invoice.totalAmount || 0);
    const dueText = offset < 0 ? `due in ${Math.abs(offset)} day${Math.abs(offset) === 1 ? '' : 's'}` : offset === 0 ? 'due today' : `${offset} day${offset === 1 ? '' : 's'} overdue`;
    const message = rule?.template?.message
      ? rule.template.message.replaceAll('{{invoice}}', invoice.invoiceNumber).replaceAll('{{amount}}', String(balance)).replaceAll('{{due}}', dueText)
      : `Invoice ${invoice.invoiceNumber} has ₹${balance.toLocaleString('en-IN')} ${dueText}.`;
    await notifyOnce({ user: invoice.tenant, key: `rent-reminder-${reminderKey}`, title: rule?.template?.subject || (offset > 0 ? 'Rent payment overdue' : 'Upcoming rent payment'), message, category: 'payment', actionUrl: '/app/rental-invoices' });
    await RentalInvoice.updateOne({ _id: invoice._id }, { $set: { lastReminderAt: now } });
    sent += 1;
  }
  return sent;
}

try {
  await connectDatabase();
  const now = new Date();
  const created = await createMonthlyRentalInvoices(now);
  const statuses = await refreshRentalBillingStatuses(now);
  const reminders = await sendReminders(now);
  const rentCycleWhatsApp = await processRentCycleWhatsAppReminders(now);
  await AuditLog.create({ action: 'automation_run', module: 'rental-automation', role: 'system', updatedValue: { ...created, ...statuses, reminders, rentCycleWhatsApp, ranAt: now } });
  console.log(JSON.stringify({ success: true, ...created, ...statuses, remindersSent: reminders, rentCycleWhatsApp, ranAt: now.toISOString() }));
} catch (error) {
  console.error('Rental automation failed:', error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
