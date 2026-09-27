import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('tenant KYC requires and stores a dedicated WhatsApp number', () => {
  const controller = read('server/src/controllers/propertyManagementController.js');
  const model = read('server/src/models/propertyManagement.js');
  const page = read('src/app/pages/app/TenantKycPage.tsx');
  assert.match(model, /whatsappNumber:/);
  assert.match(controller, /A valid Indian WhatsApp number is required for tenant KYC/);
  assert.match(controller, /updateTenantKycWhatsapp/);
  assert.match(page, /Step D — WhatsApp Contact/);
  assert.match(page, /Update WhatsApp Number/);
});

test('WhatsApp rent delivery uses the tenant KYC WhatsApp destination', () => {
  const notifications = read('server/src/services/notifications.js');
  const delivery = read('server/src/services/notificationDelivery.js');
  const reminders = read('server/src/services/rentCycleReminders.js');
  assert.match(notifications, /TenantKyc\.findOne\(\{ user: userId \}\)/);
  assert.match(notifications, /whatsappTemplate === 'rent_reminder'/);
  assert.match(notifications, /\? kycWhatsappNumber/);
  assert.match(reminders, /TenantKyc\.find\(/);
  assert.match(reminders, /whatsappByTenant/);
  assert.match(delivery, /delivery\.destination \|\| user\.whatsappNumber \|\| user\.phone/);
});

test('rent reminder runs daily at 8:30 IST from final seven days until payment completes', () => {
  const reminders = read('server/src/services/rentCycleReminders.js');
  const server = read('server/src/server.js');
  assert.match(reminders, /fast2smsMessageId: '27057'/);
  assert.match(reminders, /fast2smsPhoneNumberId: '1202480702956271'/);
  assert.match(reminders, /daysRemaining > REMINDER_LEAD_DAYS/);
  assert.match(reminders, /balanceAmount: \{ \$gt: 0 \}/);
  assert.match(reminders, /Date\.UTC\(year, month, day, 3, 0, 0, 0\)/);
  assert.match(server, /scheduleRentCycleWhatsAppReminders/);
  assert.match(reminders, /runRentReminderAutomation/);
  assert.match(reminders, /createMonthlyRentalInvoices/);
  assert.match(reminders, /shouldRunRentReminderCatchUp/);
  const app = read('server/src/app.js');
  assert.match(app, /\/api\/v1\/internal\/rent-reminders\/run/);
  assert.match(app, /x-rent-reminder-secret/);
});
