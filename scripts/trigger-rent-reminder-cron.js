const endpoint = process.env.RENT_REMINDER_ENDPOINT || 'https://secure-asset-mern.onrender.com/api/v1/internal/rent-reminders/run';
const secret = String(process.env.RENT_REMINDER_CRON_SECRET || '').trim();

if (!secret) {
  console.error('RENT_REMINDER_CRON_SECRET is required');
  process.exit(1);
}

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'x-rent-reminder-secret': secret, accept: 'application/json' },
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  console.log('Rent reminder cron response', response.status, text);
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  console.error('Rent reminder cron trigger failed', error);
  process.exitCode = 1;
}
