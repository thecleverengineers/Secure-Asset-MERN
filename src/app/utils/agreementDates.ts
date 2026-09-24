export function calendarMonthEndDate(startValue: string, durationMonths: number) {
  const match = String(startValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || !Number.isInteger(durationMonths) || durationMonths < 1) return '';
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const start = new Date(year, month, day, 12);
  if (start.getFullYear() !== year || start.getMonth() !== month || start.getDate() !== day) return '';
  const targetIndex = month + durationMonths;
  const targetYear = year + Math.floor(targetIndex / 12);
  const targetMonth = targetIndex % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0, 12).getDate();
  const end = new Date(targetYear, targetMonth, Math.min(day, lastDay), 12);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
}

export function agreementDateLabel(value: string) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '—';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { dateStyle: 'medium' });
}
