/** Time-log groupings used by the project drawer (member detail, milestone breakdown). */
import { fd, fday } from '@/lib/date';
import { hh } from '@/lib/format';
import { nDays } from './view';

const entryRow = (l) => ({ id: l.id, date: fday(l.d), note: l.note || '—', h: hh(l.h) });

/** Hours one member logged on one project, grouped by milestone (original `detail`). */
export function memberProjectDetail(logs, milestonesOfProject, pid, mid) {
  const Lg = logs.filter((l) => l.p === pid && l.m === mid).sort((a, b) => a.d - b.d);
  const tot = Lg.reduce((x, l) => x + l.h, 0);
  const nd = new Set(Lg.map((l) => l.d)).size;
  const groups = (milestonesOfProject || [])
    .map((ms) => {
      const r = Lg.filter((l) => l.ms === ms.id);
      if (!r.length) return null;
      const dd = new Set(r.map((l) => l.d)).size;
      return { id: ms.id, name: `${ms.n}. ${ms.name}`, total: hh(r.reduce((x, l) => x + l.h, 0)), days: nDays(dd), rows: r.map(entryRow) };
    })
    .filter(Boolean);
  return {
    groups,
    empty: !Lg.length,
    sum: Lg.length
      ? `${hh(tot)} over ${nd} working day${nd === 1 ? '' : 's'} · ${fd(Lg[0].d)} to ${fd(Lg[Lg.length - 1].d)} · grouped by milestone`
      : '',
  };
}

/** Who logged hours on a milestone, biggest first (original `byMember`). */
export function milestoneByMember(logs, msId) {
  const Lg = logs.filter((l) => l.ms === msId);
  const by = {};
  Lg.forEach((l) => (by[l.m] = by[l.m] || []).push(l));
  const tot = Lg.reduce((x, l) => x + l.h, 0);
  const arr = Object.keys(by)
    .map((id) => ({ id, h: by[id].reduce((x, l) => x + l.h, 0) }))
    .sort((a, b) => b.h - a.h);
  return arr.map((x) => {
    const rows = by[x.id].slice().sort((a, b) => a.d - b.d);
    const nd = new Set(rows.map((l) => l.d)).size;
    return { id: x.id, hours: x.h, share: tot ? x.h / tot : 0, rel: arr[0].h ? x.h / arr[0].h : 0, days: nd, rows: rows.map(entryRow) };
  });
}
