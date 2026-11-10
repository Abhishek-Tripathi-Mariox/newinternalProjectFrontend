import { useMemo } from 'react';
import { useScoped } from '@/hooks/useScoped';
import { sumDay, people as peopleOf } from '@/domain/attendance';
import { DAY, sod, clock, fmtDur } from '@/lib/date';
import { liveBase, actsSince } from '@/features/live/liveData';

const HOUR = 36e5;
/** "1.75h" — two-decimal hours. */
export const hx = (x) => `${Math.round(x * 100) / 100}h`;

/**
 * Derived, read-only data for the End shift modal: header, stats, sales
 * auto-stats, project / milestone options and today's worked hours.
 */
export function useEndShiftModel(pid, sales, now) {
  const S = useScoped();
  return useMemo(() => {
    const T = sod(now);
    const p = peopleOf(S).find((x) => x.id === pid) || {};
    const LV = liveBase(S.live);
    const a = LV.att[pid];
    const sd = sumDay((S.attLog || []).filter((e) => e.who === pid && e.t >= T).sort((x, y) => x.t - y.t), T, now);
    const shift = p.shift || 8;

    const base = {
      sub: `${p.name || ''} · ${p.role || ''} · ${new Date(now).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}`,
      stats: [
        ['Checked in', a ? clock(a.in) : '—'],
        ['Worked', fmtDur(sd.work)],
        ['Breaks', sd.breaks.length ? `${sd.breaks.length} · ${fmtDur(sd.br)}` : 'None'],
        ['Shift target', `${shift}h`],
      ].map(([label, value]) => ({ label, value })),
      shift,
      workedH: sd.work / HOUR,
      workedLabel: fmtDur(sd.work),
    };

    if (sales) {
      const ac = actsSince(S.leads, LV.feed, T).filter((x) => x.owner === pid);
      const fT = S.fus.filter((f) => f.owner === pid && f.due >= T && f.due < T + DAY);
      base.auto = [
        ['Leads touched', new Set(ac.map((x) => x.lead.id)).size],
        ['New leads', S.leads.filter((l) => l.owner === pid && l.created >= T).length],
        ['Emails', ac.filter((x) => x.kind === 'email').length],
        ['Quotes', ac.filter((x) => x.kind === 'quote').length],
        ['Follow-ups done', `${fT.filter((f) => f.done).length} / ${fT.length}`],
        ['Due tomorrow', S.fus.filter((f) => f.owner === pid && !f.done && f.due >= T + DAY && f.due < T + 2 * DAY).length],
      ].map(([label, value]) => ({ label, value: String(value) }));
      return base;
    }

    const mine = S.projects.filter((x) => x.team.includes(pid) && x.status !== 'Cancelled');
    const others = S.projects.filter((x) => !x.team.includes(pid) && ['Running', 'Planning', 'On hold'].includes(x.status));
    base.projOpts = mine.map((x) => ({ value: x.id, label: x.name }))
      .concat(others.map((x) => ({ value: x.id, label: `${x.name} (not on team)` })));
    const msByProject = {};
    S.milestones.forEach((m) => { (msByProject[m.p] = msByProject[m.p] || []).push(m); });
    base.msOptsFor = (projectId) => (msByProject[projectId] || [])
      .slice()
      .sort((x, y) => x.n - y.n)
      .map((x) => ({ value: x.id, label: `${x.n}. ${x.name}${x.status === 'Done' ? ' (done)' : ''}` }));
    base.projectName = (id) => (S.projects.find((x) => x.id === id) || {}).name || '';
    base.milestones = S.milestones;
    return base;
  }, [S, pid, sales, now]);
}

/** Hours-vs-shift state line (original eos.state / stateColor). */
export function hoursState(total, shift, worked) {
  const over = total > worked + 0.01;
  if (over) return { over, label: `Over worked time by ${hx(Math.round((total - worked) * 100) / 100)}`, color: 'oklch(0.55 0.19 25)' };
  if (total === 0) return { over, label: 'Nothing entered', color: 'oklch(0.52 0.012 265)' };
  if (total < shift) return { over, label: `Short by ${hx(shift - total)}`, color: 'oklch(0.55 0.13 65)' };
  if (total === shift) return { over, label: 'Full shift', color: 'oklch(0.5 0.13 150)' };
  return { over, label: `Overtime +${hx(total - shift)}`, color: 'oklch(0.55 0.15 300)' };
}
