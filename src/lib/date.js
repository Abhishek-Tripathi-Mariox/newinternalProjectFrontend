/**
 * Date helpers. All "day" values in the app are local start-of-day timestamps (ms).
 */
import { serverNow } from './clock';
export const MINUTE = 6e4;
export const HOUR = 36e5;
export const DAY = 864e5;
/** Noon offset — used to step across days safely around DST changes. */
export const NOON = 432e5;

const pad = (n) => String(n).padStart(2, '0');

/** Start of local day for a timestamp. */
export function sod(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const today = () => sod(serverNow());

/** Move `n` days from a start-of-day value, DST-safe. */
export const addDays = (day, n) => sod(day + n * DAY + NOON);

/** yyyy-mm-dd (for <input type="date">). */
export function ymd(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** HH:mm (for <input type="time">). */
export function hm(t) {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse a yyyy-mm-dd input value to a start-of-day timestamp. */
export const parseDay = (v) => (v ? sod(new Date(`${v}T12:00`).getTime()) : null);

/** "Today" / "Tomorrow" / "Yesterday" / "9 Nov". */
export function dLabel(t) {
  const dd = Math.round((sod(t) - sod(serverNow())) / DAY);
  if (dd === 0) return 'Today';
  if (dd === 1) return 'Tomorrow';
  if (dd === -1) return 'Yesterday';
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** "3:30 PM". */
export const tLabel = (t) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/** "3:30 pm" (en-IN clock used by live/attendance views). */
export const clock = (t) => new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

/** "9 Nov 2026". */
export const fd = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Mon, 9 Nov". */
export const fday = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/** "Monday, 9 November 2026". */
export const longDay = (d) =>
  new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** "9 Nov 2026, 3:30 pm". */
export const dateTime = (t) =>
  new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Duration "45m" / "2h 05m". */
export function fmtDur(ms) {
  const m = Math.max(0, Math.round(ms / MINUTE));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export const isSunday = (t) => new Date(t).getDay() === 0;

/**
 * Resolve a named period preset to a [from, to) range. Returns null for "all".
 */
export function range(preset, from, to) {
  const T = today();
  const d = new Date(T);
  switch (preset) {
    case 'today': return [T, T + DAY];
    case 'yesterday': return [T - DAY, T];
    case 'tomorrow': return [T + DAY, T + 2 * DAY];
    case '7d': return [T - 6 * DAY, T + DAY];
    case '30d': return [T - 29 * DAY, T + DAY];
    case '90d': return [T - 89 * DAY, T + DAY];
    case 'month': return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()];
    case 'lastmonth': return [new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), new Date(d.getFullYear(), d.getMonth(), 1).getTime()];
    case 'week': {
      const w = (d.getDay() + 6) % 7;
      return [T - w * DAY, T + (7 - w) * DAY];
    }
    case 'next7': return [T, T + 7 * DAY];
    case 'custom':
      return [from ? new Date(`${from}T00:00`).getTime() : -Infinity, to ? new Date(`${to}T00:00`).getTime() + DAY : Infinity];
    default: return null;
  }
}

/** Working days (Mon–Sat) in [a, b) that are not in the future. */
export function workdaysSoFar(a, b) {
  const T = today();
  let c = 0;
  const d = new Date(a);
  while (d.getTime() < b && d.getTime() <= T) {
    if (d.getDay() !== 0) c++;
    d.setDate(d.getDate() + 1);
  }
  return c;
}

/** Working days (Mon–Sat) between two days inclusive, minimum 1. */
export function workdaysBetween(a, b) {
  let c = 0;
  for (let d = sod(a); d <= b; d += DAY) if (new Date(d).getDay() !== 0) c++;
  return Math.max(1, c);
}

/** "5 min ago" / "3h ago" / date label. */
export function ago(t, now = serverNow()) {
  if (!t) return 'Never';
  const m = Math.round((now - t) / MINUTE);
  return m < 2 ? 'Just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : dLabel(t);
}

export const greeting = (now = serverNow()) => {
  const hr = new Date(now).getHours();
  return hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening';
};

/** Work-day late threshold: 10:30 local. */
export const LATE_MIN = 630;
export const lateAt = (day) => day + LATE_MIN * MINUTE;
