import { sod } from '@/lib/date';
import { getActiveOwners } from '@/store/owners';

/**
 * Everyone tracked by Live / Attendance / Reports: delivery members followed
 * by sales owners (original `ppl`).
 * @returns {{id,name,role,h,sales,shift}[]}
 */
export function people(state) {
  return (state.members || []).filter((x) => !x.inactive).map((x) => ({ id: x.id, name: x.name, role: `${x.role} · ${x.team}`, h: x.h, sales: false, shift: x.shift || 8 }))
    .concat(getActiveOwners().map((o) => ({ id: o.id, name: o.name, role: 'Sales', h: o.h, sales: true, shift: 8 })));
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
export function sumDay(list, d, now = Date.now()) {
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
