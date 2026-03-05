const CHICAGO_TZ = 'America/Chicago';
const DEADLINE_HOUR = 22;

export function getWeekEndingSunday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getDeadlineForWeek(weekEndingSunday: Date): Date {
  const deadline = new Date(weekEndingSunday);
  deadline.setHours(DEADLINE_HOUR, 0, 0, 0);
  return deadline;
}

export function isSubmissionAllowed(weekEndingSunday: Date): boolean {
  const now = new Date();
  const chicagoNowStr = now.toLocaleString('en-US', { timeZone: CHICAGO_TZ });
  const chicagoNow = new Date(chicagoNowStr);

  const sundayStr = weekEndingSunday.toLocaleString('en-US', { timeZone: CHICAGO_TZ });
  const chicagoSunday = new Date(sundayStr);
  chicagoSunday.setHours(DEADLINE_HOUR, 0, 0, 0);

  return chicagoNow <= chicagoSunday;
}

export function getDeadlineForWeekEndingDate(weekEndingDateStr: string): Date {
  const date = new Date(weekEndingDateStr + 'T12:00:00');
  const sundayStr = date.toLocaleString('en-US', { timeZone: CHICAGO_TZ });
  const chicagoSunday = new Date(sundayStr);
  chicagoSunday.setHours(DEADLINE_HOUR, 0, 0, 0);
  return chicagoSunday;
}

export function getNextDeadline(): Date {
  const now = new Date();
  const chicagoNow = new Date(now.toLocaleString('en-US', { timeZone: CHICAGO_TZ }));

  const dayOfWeek = chicagoNow.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

  const nextSunday = new Date(chicagoNow);
  nextSunday.setDate(chicagoNow.getDate() + daysUntilSunday);
  nextSunday.setHours(DEADLINE_HOUR, 0, 0, 0);

  if (chicagoNow > nextSunday) {
    nextSunday.setDate(nextSunday.getDate() + 7);
  }

  return nextSunday;
}

export function getNextDeadlineDate(): string {
  const deadline = getNextDeadline();
  const chicagoDeadline = new Date(deadline.toLocaleString('en-US', { timeZone: CHICAGO_TZ }));
  return chicagoDeadline.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function getTimeUntilDeadline(): { days: number; hours: number; minutes: number; seconds: number; isPast: boolean } {
  const now = new Date();
  const deadline = getNextDeadline();

  const nowUtc = now.getTime();
  const deadlineUtc = deadline.getTime() + getTimezoneOffsetMs(deadline);

  const diff = deadlineUtc - nowUtc;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, isPast: false };
}

function getTimezoneOffsetMs(date: Date): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const chicagoDate = new Date(date.toLocaleString('en-US', { timeZone: CHICAGO_TZ }));
  return utcDate.getTime() - chicagoDate.getTime();
}

export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getMonthKeyForWeek(weekEndingDate: Date): string {
  const monday = getMondayOfWeek(weekEndingDate);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  const chicagoNow = new Date(now.toLocaleString('en-US', { timeZone: CHICAGO_TZ }));
  const sunday = new Date(chicagoNow);
  const day = sunday.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  sunday.setDate(sunday.getDate() + daysUntilSunday);
  return getMonthKeyForWeek(sunday);
}

export function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDateWithYear(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatSteps(steps: number): string {
  return steps.toLocaleString();
}

export function getWeekEndingSundayFromDate(dateStr: string): Date {
  const parts = dateStr.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
  if (parts) {
    const parsed = new Date(parts[0]);
    if (!isNaN(parsed.getTime())) {
      return getWeekEndingSunday(parsed);
    }
  }
  return getWeekEndingSunday(new Date());
}

export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
