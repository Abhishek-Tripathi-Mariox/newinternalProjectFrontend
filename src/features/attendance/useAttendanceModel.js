import { useMemo } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { sumDay, groupAttendance, people as peopleOf } from '@/domain/attendance';
import { sod, clock, fmtDur, ymd } from '@/lib/date';
import { TEAMS } from '@/config/constants';
import {
  resolveRange, workdays, withTeams, isLate, isExpectedDay, LATE_MS, EVL, SEG, HOUR_MS,
  RANGE_TITLES, statusColors, workedColor, reportLines, indexById, dayShort, dayLong,
} from './shared/attendanceUtils';

export const ATT_DEFAULTS = { range: 'today', date: '', team: '', q: '', person: '', exp: '' };
export const ATT_TEAMS = ['Sales'].concat(TEAMS);
/** Hour labels above the 8a–10p timeline bar. */
export const ATT_HOURS = ['8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p'];

const T8 = 8 * HOUR_MS;
const SPAN = 14 * HOUR_MS;
const pc = (t, d) => Math.max(0, Math.min(100, ((t - d - T8) / SPAN) * 100));

/** Per person/day row for the day & person views. */
function dayRow(p, d, label, sub, ctx) {
  const { byPD, T, now, exp, reports, PRJ } = ctx;
  const list = byPD[`${p.id}|${d}`] || [];
  const s = sumDay(list, d, now);
  const late = isLate(s.first, d);
  const key = `${p.id}|${d}`;
  const st = !list.length
    ? (d === T && now < d + LATE_MS ? ['Not in yet', 265] : ['Absent', 25])
    : s.onBreak ? ['On break', 70] : s.online ? ['Online', 150] : ['Logged out', 265];
  const rep = reportLines(reports, PRJ, p.id, d);
  const tone = statusColors(st[1]);
  return {
    key, person: p, label, sub,
    status: st[0], sBg: tone.bg, sFg: tone.fg,
    present: list.length > 0, late, work: s.work,
    inL: s.first ? clock(s.first) : '—',
    inColor: late ? 'oklch(0.5 0.17 25)' : 'oklch(0.3 0.015 265)',
    outL: s.last ? clock(s.last) : s.online || s.onBreak ? 'Still in' : '—',
    brkL: s.breaks.length ? `${s.breaks.length} · ${fmtDur(s.br)}` : '—',
    brkTimes: s.breaks.map((b) => `${clock(b[0])}–${b[1] ? clock(b[1]) : 'now'}`).join(', '),
    worked: list.length ? fmtDur(s.work) : '—',
    workedColor: workedColor(s.work, d, T, list.length > 0),
    segs: s.segs.map((g, i) => ({
      key: i,
      left: `${pc(g[1], d).toFixed(2)}%`,
      width: `${Math.max(0.5, pc(g[2], d) - pc(g[1], d)).toFixed(2)}%`,
      bg: g[0] === 'w' ? SEG.attWork : SEG.attBreak,
      tip: `${g[0] === 'w' ? 'Working ' : 'Break '}${clock(g[1])}–${clock(g[2])}`,
    })),
    open: exp === key,
    rep,
    events: list.map((e, i) => ({ key: i, time: clock(e.t), text: EVL[e.k][0], dot: `oklch(0.62 0.14 ${EVL[e.k][1]})` })),
  };
}

/** Pure builder for the Attendance page. */
export function buildAttendanceModel(S, AF, now) {
  const T = sod(now);
  const { isDay, day: dSel, rng } = resolveRange(AF, T);
  const aDays = workdays(rng, T);
  const byPD = groupAttendance(S.attLog || [], rng[0], rng[1]);
  const ppl = withTeams(peopleOf(S), S.members);
  const aq = AF.q.trim().toLowerCase();
  const aPpl = ppl.filter((p) => (!AF.team || p.team === AF.team) && (!aq || p.name.toLowerCase().includes(aq)));
  const PRJ = indexById(S.projects);
  const ctx = { byPD, T, now, exp: AF.exp, reports: S.reports, PRJ };
  const selP = (AF.person && aPpl.find((p) => p.id === AF.person)) || (AF.person && ppl.find((p) => p.id === AF.person)) || null;

  let rows = [];
  let sum = [];
  let kpis;

  if (selP) {
    rows = aDays.slice().reverse().map((d) => dayRow(selP, d, dayShort(d), d === T ? 'Today' : '', ctx));
  } else if (isDay) {
    rows = aPpl.map((p) => dayRow(p, dSel, p.name, p.role, ctx))
      .sort((a, b) => (b.present - a.present) || (a.inL > b.inL ? 1 : -1));
  } else {
    sum = aPpl.map((p) => {
      let wk = 0;
      let br = 0;
      let pres = 0;
      let late = 0;
      const ins = [];
      const outs = [];
      aDays.forEach((d) => {
        const list = byPD[`${p.id}|${d}`];
        if (!list) return;
        const s = sumDay(list, d, now);
        pres++;
        wk += s.work;
        br += s.br;
        if (s.first > d + LATE_MS) late++;
        if (s.first) ins.push(s.first - d);
        if (s.last) outs.push(s.last - d);
      });
      const avgT = (a) => (a.length ? clock(T + a.reduce((x, y) => x + y, 0) / a.length) : '—');
      const expected = aDays.filter((d) => isExpectedDay(d, T, now)).length;
      const absent = Math.max(0, expected - pres);
      return {
        id: p.id, person: p, name: p.name, role: p.role,
        present: `${pres} / ${expected}`, absent, absColor: expected - pres > 0 ? 'oklch(0.5 0.17 25)' : 'oklch(0.52 0.012 265)',
        late, lateColor: late ? 'oklch(0.5 0.17 25)' : 'oklch(0.52 0.012 265)',
        avgIn: avgT(ins), avgOut: avgT(outs), total: fmtDur(wk), totalH: wk, brk: fmtDur(br), avg: pres ? fmtDur(wk / pres) : '—',
      };
    }).sort((a, b) => b.totalH - a.totalH);
  }

  if (selP || isDay) {
    const pr = rows.filter((r) => r.present);
    const tw = pr.reduce((x, r) => x + r.work, 0);
    kpis = selP
      ? [
        ['Days present', `${pr.length} / ${rows.filter((r) => r.status !== 'Not in yet').length}`, ''],
        ['Late days', rows.filter((r) => r.late).length, 'after 10:30'],
        ['Total worked', fmtDur(tw), ''],
        ['Average per day', pr.length ? fmtDur(tw / pr.length) : '—', ''],
      ]
      : [
        ['Present', `${pr.length} / ${rows.length}`, ''],
        ['Online now', rows.filter((r) => r.status === 'Online').length, dSel === T ? 'working' : '—'],
        ['On break', rows.filter((r) => r.status === 'On break').length, ''],
        ['Late', rows.filter((r) => r.late).length, 'after 10:30'],
        ['Absent', rows.filter((r) => r.status === 'Absent').length, ''],
        ['Total worked', fmtDur(tw), pr.length ? `avg ${fmtDur(tw / pr.length)}` : ''],
      ];
  } else {
    const tw = sum.reduce((x, r) => x + r.totalH, 0);
    kpis = [
      ['Total worked', fmtDur(tw), `${aDays.length} working days`],
      ['Late arrivals', sum.reduce((x, r) => x + r.late, 0), 'after 10:30'],
      ['Absences', sum.reduce((x, r) => x + r.absent, 0), 'person-days'],
      ['Average per person', sum.length ? fmtDur(tw / sum.length) : '—', ''],
    ];
  }

  return {
    kpis: kpis.map(([label, value, sub]) => ({ label, value, sub })),
    showDay: !!selP || isDay,
    showSum: !selP && !isDay,
    rows, sum,
    empty: rows.length + sum.length === 0,
    firstCol: selP ? 'Date' : 'Person',
    person: selP,
    title: selP ? selP.name : isDay ? dayLong(dSel) : RANGE_TITLES[AF.range] || '',
    csvName: `mariox-attendance-${ymd(rng[0])}.csv`,
  };
}

/** Attendance view model + filter state. */
export function useAttendanceModel(now) {
  const S = useScoped();
  const attF = useStore((s) => s.attF);
  const AF = useMemo(() => ({ ...ATT_DEFAULTS, ...(attF || {}) }), [attF]);
  const model = useMemo(() => buildAttendanceModel(S, AF, now), [S, AF, now]);
  return { AF, model };
}
