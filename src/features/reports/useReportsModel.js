import { useMemo } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { sumDay, groupAttendance, people as peopleOf } from '@/domain/attendance';
import { DAY, MINUTE, sod, addDays, clock, fmtDur, ymd } from '@/lib/date';
import {
  resolveRange, workdays, withTeams, isExpectedDay, LATE_MS, SEG, narrateDay, workedColor, dayLongShortMonth,
} from '@/features/attendance/shared/attendanceUtils';

export const REP_DEFAULTS = { person: '', range: 'today', date: '', tab: 'timeline', tday: 0, tmode: 'day', tteam: '' };

const H0 = 6 * 36e5;
const HS = 18 * 36e5;
const HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22];
const hLbl = (h) => `${h % 12 || 12}${h < 12 || h === 24 ? 'am' : 'pm'}`;
const fmt = (d, o) => new Date(d).toLocaleDateString('en-IN', o);

/** "5 min ago" / "3h ago" / "2 days ago". */
const agoLong = (t, now) => {
  const m = Math.round((now - t) / MINUTE);
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)} day${m >= 2880 ? 's' : ''} ago`;
};

/** Timeline tab: one row per person with working/break segments. */
export function buildTimeline(S, RF, now) {
  const T = sod(now);
  const tD = RF.tday || T;
  const wk = RF.tmode === 'week';
  const tStart = wk ? addDays(tD, -((new Date(tD).getDay() + 6) % 7)) : tD;
  const tDays = wk ? [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(tStart, i)) : [tD];
  const tEnd = addDays(tDays[tDays.length - 1], 1);
  const nD = tDays.length;
  const tBy = groupAttendance(S.attLog || [], tStart, tEnd);
  const lastBy = {};
  (S.attLog || []).forEach((e) => { if (!lastBy[e.who] || e.t > lastBy[e.who]) lastBy[e.who] = e.t; });
  const xp = (t, i, d) => ((i + Math.max(0, Math.min(1, (t - d - H0) / HS))) / nD) * 100;

  const rows = withTeams(peopleOf(S), S.members)
    .filter((p) => !RF.tteam || p.team === RF.tteam)
    .map((p) => {
      let tot = 0;
      let live = null;
      const segs = [];
      const dayTotals = [];
      tDays.forEach((d, i) => {
        const list = tBy[`${p.id}|${d}`];
        if (!list) return;
        const s = sumDay(list, d, now);
        tot += s.work;
        if (d === T) live = s;
        s.segs.forEach((g) => {
          const l = xp(g[1], i, d);
          const r = xp(g[2], i, d);
          if (r - l <= 0) return;
          const isW = g[0] === 'w';
          segs.push({
            key: `${d}-${g[1]}`, pid: p.id, d, k: g[0], a: g[1], b: g[2],
            left: `${l.toFixed(3)}%`, width: `${Math.max(0.25, r - l).toFixed(3)}%`,
            top: wk ? '7px' : isW ? '12px' : '17px',
            bot: wk ? '20px' : isW ? '12px' : '17px',
            bg: isW ? SEG.tlWork : SEG.tlBreak,
            tip: `${isW ? 'Working' : 'Break'} · ${clock(g[1])} – ${g[2] >= now - MINUTE && d === T ? 'now' : clock(g[2])} · ${fmtDur(g[2] - g[1])}`,
          });
        });
        if (wk) dayTotals.push({ key: d, left: `${(i / nD) * 100}%`, width: `${100 / nD}%`, text: fmtDur(s.work) });
      });
      const on = live && live.online;
      const br = live && live.onBreak;
      const lt = lastBy[p.id];
      return {
        id: p.id, person: p, name: p.name,
        total: tot ? fmtDur(tot) : '—', totH: tot, totFg: tot ? 'oklch(0.23 0.015 265)' : 'oklch(0.6 0.01 265)',
        segs, dayTotals, rank: on ? 0 : br ? 1 : 2,
        dot: on ? 'oklch(0.66 0.17 150)' : br ? 'oklch(0.75 0.15 75)' : 'oklch(0.78 0.01 265)',
        sub: on ? `Working now · ${p.role || ''}` : br ? `On break · ${p.role || ''}` : lt ? `Last tracked: ${agoLong(lt, now)}` : 'Never tracked',
        subFg: on ? 'oklch(0.48 0.14 150)' : br ? 'oklch(0.5 0.13 70)' : 'oklch(0.55 0.012 265)',
      };
    })
    .sort((a, b) => a.rank - b.rank || b.totH - a.totH);

  const step = wk ? 7 : 1;
  const nextDay = addDays(tD, step);
  return {
    label: wk
      ? `${fmt(tStart, { day: 'numeric', month: 'short' })} – ${fmt(tDays[6], { day: 'numeric', month: 'short', year: 'numeric' })}`
      : fmt(tD, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    cols: wk
      ? tDays.map((d, i) => ({ key: d, label: fmt(d, { weekday: 'short', day: 'numeric' }), left: `${(i / nD) * 100}%`, width: `${100 / nD}%`, align: 'center' }))
      : HOURS.map((h) => ({ key: h, label: hLbl(h), left: `${((h - 6) / 18) * 100}%`, width: `${(2 / 18) * 100}%`, align: 'flex-start' })),
    grid: wk ? tDays.map((d, i) => `${(i / nD) * 100}%`) : HOURS.map((h) => `${((h - 6) / 18) * 100}%`),
    rows,
    prevDay: addDays(tD, -step),
    nextDay,
    canNext: nextDay <= T,
  };
}

/** Popover details for a clicked timeline segment. */
export function buildPopover(S, pop, now) {
  if (!pop) return null;
  const T = sod(now);
  const p = peopleOf(S).find((x) => x.id === pop.pid);
  const d = pop.d;
  const list = (S.attLog || []).filter((e) => e.who === pop.pid && e.t >= d && e.t < addDays(d, 1)).sort((x, y) => x.t - y.t);
  if (!p || !list.length) return null;
  const s = sumDay(list, d, now);
  const isW = pop.k === 'w';
  const live = d === T && (s.online || s.onBreak);
  const endT = s.last || now;
  const span = s.first ? endT - s.first : 0;
  const { events } = narrateDay(list, s, d, now, 'pop');
  return {
    person: p,
    date: dayLongShortMonth(d),
    segLabel: isW ? 'Working session' : 'Break',
    segRange: `${clock(pop.a)} – ${pop.b >= now - MINUTE && d === T ? 'now' : clock(pop.b)}`,
    segDur: fmtDur(pop.b - pop.a),
    segBg: isW ? 'oklch(0.96 0.04 150)' : 'oklch(0.97 0.04 80)',
    segDot: isW ? SEG.tlWork : SEG.tlBreak,
    segFg: isW ? 'oklch(0.4 0.13 150)' : 'oklch(0.45 0.12 70)',
    stats: [
      ['Logged in', s.first ? clock(s.first) : '—', s.first > d + LATE_MS ? 'oklch(0.5 0.17 25)' : ''],
      ['Logged out', live ? 'Still in' : s.last ? clock(s.last) : '—', ''],
      ['Total login time', fmtDur(span), ''],
      ['Worked', fmtDur(s.work), 'oklch(0.42 0.13 150)'],
      ['Breaks', s.breaks.length ? String(s.breaks.length) : 'None', ''],
      ['Total break time', fmtDur(s.br), s.br ? 'oklch(0.5 0.13 70)' : ''],
    ].map(([label, value, fg]) => ({ label, value, fg: fg || 'oklch(0.23 0.015 265)' })),
    events,
  };
}

/** Hours log tab: per-day groups of event rows, KPIs and CSV rows. */
export function buildHoursLog(S, RF, now) {
  const T = sod(now);
  const { isDay, day: rSel, rng } = resolveRange(RF, T);
  const rDays = workdays(rng, T).reverse();
  const rBy = groupAttendance(S.attLog || [], rng[0], rng[1]);
  const ppl = peopleOf(S);
  const rPpl = ppl.filter((p) => !RF.person || p.id === RF.person);
  const rP = RF.person ? ppl.find((p) => p.id === RF.person) : null;
  let tw = 0;
  let tb = 0;
  let pres = 0;
  let late = 0;
  const csv = [];

  const days = rDays.map((d) => {
    const rows = [];
    rPpl.forEach((p) => {
      const list = rBy[`${p.id}|${d}`];
      if (!list) {
        if (RF.person && isExpectedDay(d, T, now)) {
          rows.push({ id: p.id, person: p, absent: true, events: [], brk: '—', worked: '—', workedColor: 'oklch(0.52 0.012 265)' });
        }
        return;
      }
      const s = sumDay(list, d, now);
      tw += s.work;
      tb += s.br;
      pres++;
      if (s.first > d + LATE_MS) late++;
      const { events } = narrateDay(list, s, d, now, 'log');
      events.forEach((ev) => { if (!ev.now) csv.push([ymd(d), p.name, ev.raw, ev.time, ev.sub]); });
      rows.push({
        id: p.id, person: p, absent: false, events,
        brk: s.breaks.length ? `${s.breaks.length} · ${fmtDur(s.br)}` : 'None',
        worked: fmtDur(s.work),
        workedColor: workedColor(s.work, d, T),
      });
    });
    return {
      key: d,
      label: fmt(d, { weekday: 'long', day: 'numeric', month: 'short' }) + (d === T ? ' · Today' : ''),
      sub: `${rows.filter((r) => !r.absent).length} present`,
      rows,
    };
  }).filter((x) => x.rows.length);

  return {
    days,
    title: `${rP ? rP.name : 'Everyone'} · ${isDay
      ? fmt(rSel, { day: 'numeric', month: 'short', year: 'numeric' })
      : `${fmt(rng[0], { day: 'numeric', month: 'short' })} – ${fmt(Math.min(rng[1], T + DAY) - 1, { day: 'numeric', month: 'short' })}`}`,
    kpis: [
      ['Total worked', fmtDur(tw), pres ? `avg ${fmtDur(tw / pres)} per day` : ''],
      ['Break time', fmtDur(tb), ''],
      ['Days present', pres, rP ? `of ${rDays.filter((d) => isExpectedDay(d, T, now)).length}` : 'person-days'],
      ['Late logins', late, 'after 10:30'],
    ].map(([label, value, sub]) => ({ label, value, sub })),
    people: ppl.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.name })),
    csv: [['Date', 'Person', 'Event', 'Time', 'Note']].concat(csv),
    csvName: `mariox-hours-${ymd(T)}.csv`,
  };
}

/** Reports view model. `pop` is the open timeline popover (local UI state). */
export function useReportsModel(now, pop) {
  const S = useScoped();
  const repF = useStore((s) => s.repF);
  const RF = useMemo(() => ({ ...REP_DEFAULTS, ...(repF || {}) }), [repF]);
  const timeline = useMemo(() => (RF.tab === 'timeline' ? buildTimeline(S, RF, now) : null), [S, RF, now]);
  const log = useMemo(() => (RF.tab === 'log' ? buildHoursLog(S, RF, now) : null), [S, RF, now]);
  const popover = useMemo(() => buildPopover(S, pop, now), [S, pop, now]);
  return { RF, timeline, log, popover };
}
