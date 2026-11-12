/**
 * Workday API: live board, attendance events and end-of-shift reports — loader, endpoint calls
 * and DTO adapters (ISO → ms, 'YYYY-MM-DD' → local day ms).
 *   live   {date,att{[pid]:{in,out,brk,brkMin,brkType?,brkPlan?,brkNote?}},timers{[pid]:{task,p,ms,title,start}},idle{[pid]:t},feed[{t,who,kind,text,lead?}]}
 *   attLog [{t,who,k,meta?}]
 *   report {id,who,d,t,sales,done,blockers,plan,outcome,calls,meetings,rows[{p,ms,h,note}],pm[{p,st,note}]}
 *
 * Super Admin (not previewing): everyone, from /live/state, /attendance/events, /shift-reports.
 * Staff: their own day from /workday/state and their own events / reports.
 */
import { api, getAll, ms, dayMs, toDay } from './client';
import { today, addDays } from '@/lib/date';

/** Days of attendance history loaded at sign-in (Attendance / Reports ranges go up to last month). */
const HISTORY_DAYS = 45;

export const isCeo = (me) => !!me && (me.isSuper || (me.role && me.role.id === 'r-super'));
const isStaff = (me) => !!me && !!me.pid && !(me.role && me.role.id === 'r-client');

const num = (x) => (x == null ? 0 : Number(x) || 0);
const t = (v) => (typeof v === 'number' ? v : ms(v));
const day = (v) => (v == null ? null : typeof v === 'number' ? v : dayMs(v));

const mapValues = (o, fn) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, fn(v)]));

/** /live/state | /workday/state → store `live`. */
export function fromApiLive(L) {
  if (!L) return null;
  return {
    date: day(L.date) || today(),
    att: mapValues(L.att, (a) => ({
      in: t(a.in), out: t(a.out), brk: t(a.brk), brkMin: num(a.brkMin),
      ...(a.brkType ? { brkType: a.brkType } : {}),
      ...(a.brkPlan != null ? { brkPlan: num(a.brkPlan) } : {}),
      ...(a.brkNote ? { brkNote: a.brkNote } : {}),
    })),
    timers: mapValues(L.timers, (x) => ({ task: x.task ?? x.taskId, p: x.p ?? x.projectId, ms: x.ms ?? x.milestoneId ?? null, title: x.title, start: t(x.start ?? x.startedAt) })),
    idle: mapValues(L.idle, t),
    // Lead activities also come with the leads (lead.acts); keep only the activity-feed lines here.
    feed: (L.feed || []).filter((e) => e.source !== 'lead').map((e) => ({ t: t(e.t ?? e.at), who: e.who ?? e.personId, kind: e.kind, text: e.text, ...(e.lead ? { lead: e.lead } : {}) })),
  };
}

/** Attendance event DTO → attLog entry. */
export const fromApiEvent = (e) => ({ t: t(e.at ?? e.t), who: e.personId ?? e.who, k: e.kind ?? e.k, ...(e.meta ? { meta: e.meta } : {}) });

/** Shift report DTO → store report. */
export function fromApiReport(r) {
  const who = r.who ?? r.personId;
  const d = day(r.d ?? r.day);
  return {
    id: r.id || `R-${who}-${toDay(d)}`,
    who,
    d,
    t: t(r.t ?? r.submittedAt) || d,
    sales: !!(r.sales ?? r.isSales),
    done: r.done || '',
    blockers: r.blockers || '',
    plan: r.plan || '',
    outcome: r.outcome || '',
    calls: num(r.calls),
    meetings: num(r.meetings),
    rows: (r.rows || []).map((x) => ({ p: x.p, ms: x.ms || null, h: num(x.h), note: x.note || '' })),
    pm: (r.pm || r.pmRows || []).map((x) => ({ p: x.p, st: x.st, note: x.note || '' })),
    internal: (r.internal || r.internalRows || []).map((x) => ({ cat: x.cat || 'Other', h: num(x.h), note: x.note || '' })),
  };
}

/** API time log (returned by timer stop / check-out) → store log. */
export const fromApiLog = (l, pid) => (l ? { id: l.id, m: pid, p: l.projectId, ms: l.milestoneId || null, d: dayMs(l.day), h: num(l.hours), note: l.note || '' } : null);

const range = (from, to) => ({ from: toDay(from), to: toDay(to) });

/** Today's live board for the caller (CEO: everyone). */
export async function fetchLive(me) {
  return fromApiLive(await api.get(isCeo(me) ? '/live/state' : '/workday/state'));
}

/** Attendance events in [from, to] (local day ms). CEO: everyone; staff: their own (person is forced). */
export async function fetchEvents(me, from, to) {
  const q = { ...range(from, to), ...(isCeo(me) ? {} : { person: me.pid }) };
  return (await getAll('/attendance/events', q)).map(fromApiEvent);
}

export async function fetchReports(me, from, to) {
  const q = { ...range(from, to), ...(isCeo(me) ? {} : { person: me.pid }) };
  return (await getAll('/shift-reports', q)).map(fromApiReport);
}

/** Bootstrap: live board, ~45 days of attendance events and shift reports. */
export async function loadWorkday(me) {
  if (!isCeo(me) && !isStaff(me)) return {};
  const T = today();
  const from = addDays(T, -HISTORY_DAYS);
  const [live, attLog, reports] = await Promise.all([
    fetchLive(me),
    fetchEvents(me, from, T),
    fetchReports(me, from, T).catch(() => []),
  ]);
  return { live, attLog, reports };
}

/** Workday endpoints. `self` = the signed-in person acting on their own day; otherwise the CEO acts via /live/:pid. */
export const workdayApi = {
  checkIn: (pid, self) => api.post(self ? '/workday/check-in' : `/live/${pid}/check-in`),
  checkOut: (pid, self) => api.post(self ? '/workday/check-out' : `/live/${pid}/check-out`),
  startBreak: (pid, self, type, note) => api.post(self ? '/workday/break' : `/live/${pid}/break`, { ...(type ? { type } : {}), note: note || '' }),
  endBreak: (pid, self) => api.post(self ? '/workday/break/end' : `/live/${pid}/resume`),
  startTimer: (pid, self, taskId) => api.post(self ? '/workday/timer/start' : `/live/${pid}/timer/start`, { taskId }),
  stopTimer: (pid, self) => api.post(self ? '/workday/timer/stop' : `/live/${pid}/timer/stop`),
  endShiftForm: () => api.get('/workday/end-shift'),
  submitEndShift: (body) => api.post('/workday/end-shift', body),
};
