import { useMemo } from 'react';
import { useLeadStatusNames, useSources } from '@/store/masters';
import { DAY, parseDay, sod } from '@/lib/date';
import { isOpenLead } from '@/features/leads/leadUtils';
import { getOwners } from '@/store/owners';

export const PERIODS = [['7', '7D'], ['30', '30D'], ['90', '90D'], ['ytd', 'YTD'], ['custom', 'Custom']];
export const PERIOD_LABELS = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days', ytd: 'Year to date' };

const sum = (a) => a.reduce((x, l) => x + (l.value || 0), 0);
const shortDay = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Resolve the selected period to a [from, to) day range.
 * Custom ranges are inclusive of both picked days; a reversed range is swapped.
 */
export function periodRange(period, T, from, to) {
  if (period === 'ytd') return [new Date(new Date(T).getFullYear(), 0, 1).getTime(), T + DAY];
  if (period === 'custom') {
    let a = from ? parseDay(from) : T - 29 * DAY;
    let b = to ? parseDay(to) : T;
    if (a > b) [a, b] = [b, a];
    return [a, b + DAY];
  }
  return [T - (+period - 1) * DAY, T + DAY];
}

/** Human label for the header, e.g. "Last 30 days" or "1 Nov 2026 – 10 Nov 2026". */
export function periodLabel(period, pr) {
  if (period !== 'custom') return PERIOD_LABELS[period];
  const last = pr[1] - DAY;
  return pr[0] === last ? shortDay(pr[0]) : `${shortDay(pr[0])} – ${shortDay(last)}`;
}

/**
 * Derived dashboard numbers (port of the original "Dashboard" render block).
 * @param {{leads:object[], fus:object[], now:number, period:string, from?:string, to?:string, owner:string}} p
 */
export function useDashboardModel({ leads, fus, now, period, from, to, owner: ow }) {
  const stageNames = useLeadStatusNames();
  const sourceList = useSources();
  return useMemo(() => {
    const T = sod(now);
    const pr = periodRange(period, T, from, to);
    const plen = pr[1] - pr[0];
    const prev = [pr[0] - plen, pr[0]];
    const inRange = (l, r) => l.created >= r[0] && l.created < r[1];

    const L = leads.filter((l) => !ow || l.owner === ow);
    const inP = L.filter((l) => inRange(l, pr));
    const inPrev = L.filter((l) => inRange(l, prev));
    const open = L.filter(isOpenLead);
    const won = inP.filter((l) => l.status === 'Won');
    const lost = inP.filter((l) => l.status === 'Lost');
    const delta = inPrev.length ? Math.round(((inP.length - inPrev.length) / inPrev.length) * 100) : null;
    const winRate = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;

    const F = fus.filter((f) => !ow || f.owner === ow);
    const fToday = F.filter((f) => !f.done && f.due >= T && f.due < T + DAY);
    const fOver = F.filter((f) => !f.done && f.due < now);

    const counts = stageNames.map((k) => inP.filter((l) => l.status === k));
    const maxC = Math.max(1, ...counts.map((a) => a.length));
    const funnel = stageNames.map((k, i) => ({ status: k, count: counts[i].length, pct: counts[i].length / maxC, value: sum(counts[i]) }));

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(T);
      const a = new Date(d.getFullYear(), d.getMonth() - i, 1).getTime();
      const b = new Date(d.getFullYear(), d.getMonth() - i + 1, 1).getTime();
      const m = L.filter((l) => l.created >= a && l.created < b);
      months.push({ a, total: m.length, won: m.filter((l) => l.status === 'Won').length });
    }
    const maxM = Math.max(1, ...months.map((m) => m.total));

    const sources = sourceList.map((src) => ({ source: src, n: inP.filter((l) => l.source === src).length })).sort((a, b) => b.n - a.n);
    const maxS = Math.max(1, ...sources.map((x) => x.n));

    const agenda = fToday.filter((f) => f.due >= now - 30 * 6e4).sort((a, b) => a.due - b.due).slice(0, 6);

    const team = getOwners().filter((o) => !ow || o.id === ow).map((o) => {
      const mine = leads.filter((l) => l.owner === o.id);
      const op = mine.filter(isOpenLead);
      const w = mine.filter((l) => l.status === 'Won' && inRange(l, pr));
      const mf = fus.filter((f) => f.owner === o.id && !f.done);
      return { id: o.id, open: op.length, pipe: sum(op), won: w.length, wonValue: sum(w), pending: mf.length, overdue: mf.filter((f) => f.due < now).length };
    });

    return {
      pr, inP, open, won, lost, delta, winRate, fToday, fOver, funnel,
      openValue: sum(open), wonValue: sum(won),
      months: months.map((m) => ({ ...m, h: Math.max(4, (m.total / maxM) * 140), wonShare: m.total ? m.won / m.total : 0 })),
      sources: sources.map((x) => ({ ...x, pct: x.n / maxS })),
      agenda, team,
    };
  }, [leads, fus, now, period, from, to, ow, stageNames, sourceList]);
}
