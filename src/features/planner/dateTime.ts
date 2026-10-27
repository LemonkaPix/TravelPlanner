export const PLAN_TIME_ZONE = 'Europe/Warsaw';
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: PLAN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: PLAN_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date).replace(/\//g, '.');
}
export function formatTime(date: Date): string {
  return timeFormatter.format(date);
}

// Form input is a Polish wall time. Reject missing/ambiguous DST times rather
// than silently choosing an occurrence.
export function parseDateTime(date: string, time: string): Date | null {
  const match = /^(\d{2})\.(\d{2})\.(20\d{2})$/.exec(date);
  if (!match || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [, day, month, year] = match.map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const matches: Date[] = [];
  // All Polish civil offsets in the supported 2000–2099 date range.
  for (const offset of [60, 120]) {
    const candidate = new Date(wall - offset * 60_000);
    if (formatDate(candidate) === date && formatTime(candidate) === time) matches.push(candidate);
  }
  return matches.length === 1 ? matches[0] : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function isLabel(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 240;
}
