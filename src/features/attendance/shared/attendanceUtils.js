/**
 * Shared, pure helpers for the attendance-based views (Live now, Attendance,
 * Reports, End-of-shift). They wrap `domain/attendance` with the
 * presentation rules of the original portal (late threshold, ranges, colours,
 * event narration).
 */
import { DAY, MINUTE, LATE_MIN, addDays, range, parseDay, clock, fmtDur, isSunday } from '@/lib/date';
import { toneStrong } from '@/lib/color';

/** Range presets in the order the original selects list them. */
export const RANGE_OPTIONS = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['date', 'Pick a date…'], ['week', 'This week'],
  ['7d', 'Last 7 days'], ['month', 'This month'], ['lastmonth', 'Last month'], ['30d', 'Last 30 days'],
];
export const RANGE_TITLES = { week: 'This week', '7d': 'Last 7 days', month: 'This month', '30d': 'Last 30 days', lastmonth: 'Last month' };
export const DAY_PRESETS = ['today', 'yesterday', 'date'];

/** Late = first login after 10:30 local. */
export const LATE_MS = LATE_MIN * MINUTE;
export const isLate = (first, day) => !!first && first > day + LATE_MS;
/** A day "counts" once it is in the past or today is past 10:30. */
export const isExpectedDay = (day, T, now) => day < T || now > day + LATE_MS;

export const HOUR_MS = 36e5;

/** Segment colours. */
export const SEG = {
  attWork: 'oklch(0.64 0.14 150)',
  attBreak: 'oklch(0.76 0.14 70)',
  tlWork: 'oklch(0.68 0.16 150)',
  tlBreak: 'oklch(0.8 0.14 75)',
};

/** Worked-duration colour: ≥ 8h green, past day < 6h red. */
export function workedColor(work, day, T, present = true) {
  if (work >= 8 * HOUR_MS) return 'oklch(0.42 0.12 150)';
  if (day < T && present && work < 6 * HOUR_MS) return 'oklch(0.5 0.17 25)';
  return 'oklch(0.23 0.015 265)';
}

/** Status pill colours from a hue. */
export const statusColors = (h) => {
  const t = toneStrong(h);
  return { bg: t.bg, fg: t.fg };
};

/** Resolve the {range, date} filter to a concrete day / range. */
export function resolveRange({ range: preset, date }, T) {
  const isDay = DAY_PRESETS.includes(preset);
  const day = preset === 'yesterday' ? addDays(T, -1) : preset === 'date' && date ? parseDay(date) : T;
  const rng = isDay ? [day, day + DAY] : range(preset) || [T - 6 * DAY, T + DAY];
  return { isDay, day, rng };
}

/** Working days (Mon–Sat) inside a range, capped at today. Ascending. */
export function workdays(rng, T) {
  const out = [];
  for (let d = rng[0]; d < Math.min(rng[1], T + DAY); d = addDays(d, 1)) if (!isSunday(d)) out.push(d);
  return out;
}

/** Attach `team` to people (Sales for sales owners). */
export function withTeams(ppl, members) {
  const byId = {};
  members.forEach((m) => { byId[m.id] = m; });
  return ppl.map((p) => ({ ...p, team: p.sales ? 'Sales' : (byId[p.id] || {}).team }));
}

/** Event labels used by the Attendance view. */
export const EVL = { login: ['Logged in', 150], logout: ['Logged out', 265], break: ['Started break', 70], resume: ['Back from break', 250] };
/** Event labels used by Reports. */
export const REV = { login: ['Logged in', 150], logout: ['Logged out', 265], break: ['Break', 70], resume: ['Resumed', 250] };

const WORDING = {
  log: { resume: (d) => `after ${d}`, late: 'Late', session: (d) => `session ${d}`, breakLabel: 'Break' },
  pop: { resume: (d) => `Break lasted ${d}`, late: 'Late login', session: (d) => `Session ${d}`, breakLabel: 'Went on break' },
};

/**
 * Narrate a day's events (reports hours log / timeline popover).
 * Returns `{ events, breakStart }` where each event is
 * `{ key, raw, label, time, sub, hue }` plus a trailing "Now" item when live.
 */
export function narrateDay(list, summary, day, now, variant = 'log') {
  const w = WORDING[variant];
  let bs = null;
  let li = null;
  const events = list.map((e, i) => {
    const v = REV[e.k] || [e.k, 265];
    let sub = '';
    if (e.k === 'break') bs = e.t;
    if (e.k === 'resume' && bs != null) { sub = w.resume(fmtDur(e.t - bs)); bs = null; }
    if (e.k === 'login') {
      li = e.t;
      if (e.t === summary.first && e.t > day + LATE_MS) sub = w.late;
    }
    if (e.k === 'logout' && li != null) { sub = w.session(fmtDur(e.t - li)); li = null; }
    return { key: `${e.t}-${i}`, raw: v[0], label: v[0] === 'Break' ? w.breakLabel : v[0], time: clock(e.t), sub, hue: v[1] };
  });
  if (summary.onBreak) {
    events.push({ key: 'now', raw: 'On break', label: 'On break', time: 'Now', sub: `${fmtDur(now - bs)} so far`, hue: 70, now: true });
  } else if (summary.online) {
    events.push({ key: 'now', raw: 'Working', label: 'Working', time: 'Now', sub: '', hue: 150, now: true });
  }
  return { events, breakStart: bs };
}

/** Dot / text colours for a narrated event. */
export const eventDot = (ev) => (ev.now ? (ev.hue === 70 ? 'oklch(0.72 0.14 70)' : 'oklch(0.62 0.16 150)') : `oklch(0.62 0.15 ${ev.hue})`);
export const eventFg = (ev) => (ev.now ? (ev.hue === 70 ? 'oklch(0.45 0.12 70)' : 'oklch(0.42 0.13 150)') : `oklch(0.4 0.12 ${ev.hue})`);

/** End-of-shift report as label/value lines (Attendance expanded row). */
export function reportLines(reports, projectsById, pid, day) {
  const r = (reports || []).find((x) => x.who === pid && x.d === day);
  if (!r) return [];
  const L = [];
  const pname = (id) => (projectsById[id] || {}).name;
  if (r.sales) {
    L.push(['Activity', `${r.calls} calls · ${r.meetings} meetings`]);
    if (r.outcome) L.push(['Summary', r.outcome]);
  } else {
    L.push(['Hours', (r.rows || []).map((x) => `${pname(x.p) || ''} ${x.h}h${x.note ? ` (${x.note})` : ''}`).join(' · ')]);
    if (r.done) L.push(['Completed', r.done]);
    (r.pm || []).forEach((x) => L.push([pname(x.p) || 'Project', x.st + (x.note ? ` · ${x.note}` : '')]));
  }
  if (r.blockers) L.push(['Blockers', r.blockers]);
  if (r.plan) L.push(['Tomorrow', r.plan]);
  return L.map(([k, v]) => ({ k, v }));
}

/** Index an array by id. */
export const indexById = (list) => {
  const o = {};
  (list || []).forEach((x) => { o[x.id] = x; });
  return o;
};

/** "Mon, 9 Nov" style labels used across these views. */
export const dayShort = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
export const dayLong = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
export const dayLongShortMonth = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
