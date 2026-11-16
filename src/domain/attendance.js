import { sod } from '@/lib/date';
import { getActiveOwners } from '@/store/owners';
import { serverNow } from '@/lib/clock';
import { pidOf, teamPids, viewReportees, viewUser } from '@/domain/permissions';

/**
 * Everyone tracked by Live / Attendance / Reports: delivery members followed
 * by sales owners (original `ppl`).
 * @returns {{id,name,role,h,sales,shift}[]}
 */
export function people(state) {
  return (state.members || []).filter((x) => !x.inactive).map((x) => ({ id: x.id, name: x.name, role: `${x.role} · ${x.team}`, h: x.h, sales: false, shift: x.shift || 8 }))
    .concat(getActiveOwners().map((o) => ({ id: o.id, name: o.name, role: 'Sales', h: o.h, sales: true, shift: 8 })));
}

/**
 * People shown on Attendance / Reports: everyone (Super Admin, or "Attendance & reports" scope All);
 * Team = the viewed user plus the people who report to them; Own = just them. Anyone missing from
 * the member / sales-owner lists is added from the users list / session.
 */
export function workdayPeople(state) {
  const all = people(state);
  const t = teamPids(state);
  if (t === null) return all;
  const ids = new Set(t);
  const out = all.filter((p) => ids.has(p.id));
  const u = viewUser(state) || {};
  const extra = [{ pid: pidOf(u), name: u.name, role: u.title || '' }].concat(viewReportees(state));
  extra.forEach((r) => {
    if (!r.pid || out.some((p) => p.id === r.pid)) return;
    out.push({ id: r.pid, name: r.name || r.pid, role: [r.role, r.team].filter(Boolean).join(' · '), h: 265, sales: false, shift: 8 });
  });
  return out;
}

/** Group attendance events in [from, to) by `who|day`, each list sorted by time. */
export function groupAttendance(attLog, from, to) {
  const byPD = {};
  (attLog || []).forEach((e) => {
    if (e.t < from || e.t >= to) return;
    const k = `${e.who}|${sod(e.t)}`;
    (byPD[k] = byPD[k] || []).push(e);
  });
  Object.values(byPD).forEach((a) => a.sort((x, y) => x.t - y.t));
  return byPD;
}

/**
 * Summarise one person's day of attendance events (sorted).
 * For today, open work/break segments run until `now`.
 * @returns {{first, last, work, br, breaks:[start,end|null][], segs:['w'|'b',a,b][], online, onBreak}}
 */
export function sumDay(list, d, now = serverNow()) {
  const T = sod(now);
  let first = null;
  let last = null;
  let open = null;
  let brk = null;
  let work = 0;
  let br = 0;
  let online = false;
  let onBreak = false;
  const breaks = [];
  const segs = [];
  list.forEach((e) => {
    if (e.k === 'login') {
      if (first == null) first = e.t;
      if (open == null && brk == null) open = e.t;
    } else if (e.k === 'break' && open != null) {
      work += e.t - open; segs.push(['w', open, e.t]); open = null; brk = e.t;
    } else if (e.k === 'resume' && brk != null) {
      br += e.t - brk; breaks.push([brk, e.t]); segs.push(['b', brk, e.t]); brk = null; open = e.t;
    } else if (e.k === 'logout') {
      if (open != null) { work += e.t - open; segs.push(['w', open, e.t]); open = null; }
      if (brk != null) { br += e.t - brk; breaks.push([brk, e.t]); segs.push(['b', brk, e.t]); brk = null; }
      last = e.t;
    }
  });
  if (d === T && open != null) { work += now - open; segs.push(['w', open, now]); online = true; }
  if (d === T && brk != null) { br += now - brk; breaks.push([brk, null]); segs.push(['b', brk, now]); onBreak = true; }
  return { first, last: online || onBreak ? null : last, work, br, breaks, segs, online, onBreak };
}
