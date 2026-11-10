import { useMemo } from 'react';
import { sod, tLabel } from '@/lib/date';
import { shortTime, typeHue } from './model';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Month grid model (Monday first) for the calendar view — port of the original
 * `cells` / `cal` computation.
 * @param {object[]} fus filtered follow-ups
 * @param {Record<string, object>} leadMap
 * @param {{calMonth:number|null, calDay:number|null, T:number, now:number}} p
 */
export function useFollowUpCalendar(fus, leadMap, { calMonth, calDay, T, now }) {
  return useMemo(() => {
    const selDay = calDay || T;
    const mBase = new Date(calMonth || selDay);
    mBase.setDate(1);
    mBase.setHours(0, 0, 0, 0);
    const mY = mBase.getFullYear();
    const mM = mBase.getMonth();
    const lead0 = (mBase.getDay() + 6) % 7;
    const nCells = Math.ceil((lead0 + new Date(mY, mM + 1, 0).getDate()) / 7) * 7;

    const byDay = {};
    fus.slice().sort((a, b) => a.due - b.due).forEach((f) => {
      const k = sod(f.due);
      (byDay[k] = byDay[k] || []).push(f);
    });

    const cells = [];
    for (let i = 0; i < nCells; i++) {
      const d = new Date(mY, mM, 1 - lead0 + i).getTime();
      const list = byDay[d] || [];
      cells.push({
        d,
        day: new Date(d).getDate(),
        inMonth: new Date(d).getMonth() === mM,
        isToday: d === T,
        isSelected: d === selDay,
        hasOver: list.some((f) => !f.done && f.due < now),
        more: Math.max(0, list.length - 3),
        events: list.slice(0, 3).map((f) => {
          const h = typeHue(f.type);
          const l = leadMap[f.leadId];
          return {
            fu: f,
            time: shortTime(tLabel(f.due)),
            tip: `${f.type} · ${f.title}${l ? ` · ${l.company}` : ''}`,
            bg: `oklch(0.95 0.035 ${h})`,
            fg: `oklch(0.38 0.12 ${h})`,
          };
        }),
      });
    }

    const dayList = byDay[selDay] || [];
    const nMeet = dayList.filter((f) => f.type === 'Meeting').length;
    const n = dayList.length;
    return {
      selDay,
      monthStart: mBase.getTime(),
      monthLabel: mBase.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      weekdays: WEEKDAYS,
      cells,
      dayList,
      dayTitle: new Date(selDay).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
      daySub: n
        ? `${n} follow-up${n > 1 ? 's' : ''}${nMeet ? ` · ${nMeet} meeting${nMeet > 1 ? 's' : ''}` : ''}`
        : 'No follow-ups',
    };
  }, [fus, leadMap, calMonth, calDay, T, now]);
}
