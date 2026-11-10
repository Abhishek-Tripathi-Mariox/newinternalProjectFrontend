import { useMemo } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { people as peopleOf } from '@/domain/attendance';
import { leadInsights } from '@/domain/leads';
import { crMoney } from '@/domain/projects';
import { DAY, MINUTE, LATE_MIN, sod, clock, fmtDur, isSunday } from '@/lib/date';
import { h1, hh, money } from '@/lib/format';
import { toneStrong } from '@/lib/color';
import { OWNERS } from '@/config/constants';
import { liveBase, actsSince } from './liveData';

const HOUR = 36e5;
/** Sort order for people rows: problems first. */
const ORD = { absent: 0, idle: 1, notimer: 2, break: 3, work: 4, off: 5 };

/** Row filters behind the chips / KPI cards. */
export const LIVE_FILTERS = {
  all: () => true,
  attention: (x) => ['absent', 'idle', 'notimer'].includes(x.key),
  work: (x) => x.key === 'work',
  break: (x) => x.key === 'break',
  delivery: (x) => !x.sales,
  sales: (x) => x.sales,
  absent: (x) => x.key === 'absent',
  idle: (x) => x.key === 'idle',
};

export const LIVE_CHIPS = [['all', 'Everyone'], ['attention', 'Needs attention'], ['work', 'Working'], ['break', 'On break'], ['delivery', 'Delivery'], ['sales', 'Sales']];
export const FEED_SEGMENTS = [['all', 'All'], ['team', 'Team'], ['sales', 'Sales'], ['proj', 'Clients']];

/** Feed dot hue per event kind. */
const FK = { in: 265, out: 265, start: 250, stop: 250, break: 70, call: 150, email: 250, whatsapp: 150, meeting: 300, note: 85, quote: 35, status: 265, owner: 220, appr: 150 };

const dotFor = (key) =>
  key === 'work' ? 'oklch(0.62 0.16 150)'
    : key === 'break' || key === 'notimer' ? 'oklch(0.72 0.14 70)'
      : key === 'idle' || key === 'absent' ? 'oklch(0.6 0.19 25)'
        : 'oklch(0.78 0.01 265)';

/** Original `attention` sub-line for a project info() object. */
function attentionSub(I) {
  if (I.why && I.why.length) return I.why.join(' · ');
  if (I.health === 'Over budget') return `${hh(I.used)} used of ${hh(I.budget)} budget`;
  if (I.health === 'Overdue') return `Was due ${I.dueLabel} · ${I.curM ? I.curM.name : ''}`;
  if (I.health === 'At risk') return `${Math.round(I.pct * 100)}% of budget used · due ${I.dueLabel}`;
  return `On hold · ${I.curM ? I.curM.name : ''}`;
}

/**
 * Pure builder for the Live now page. Alerts carry an `action` descriptor
 * that the page turns into navigation / store updates:
 *   {type:'liveF', value} · {type:'project', pid} · {type:'hotLeads'} · {type:'timesheets'}
 */
export function buildLiveModel(S, { now, liveF, feedF, staleDays, pv }) {
  const T = sod(now);
  const LV = liveBase(S.live);
  const ppl = peopleOf(S);
  const PPL = {};
  ppl.forEach((p) => { PPL[p.id] = p; });
  const PRJ = {};
  S.projects.forEach((p) => { PRJ[p.id] = p; });
  const ownerName = (id) => (OWNERS.find((o) => o.id === id) || { name: id }).name;

  const LATE = T + LATE_MIN * MINUTE;
  const pastLate = !isSunday(T) && now > LATE;
  const actsToday = actsSince(S.leads, LV.feed, T);
  const logT = {};
  S.logs.forEach((l) => { if (l.d === T) logT[l.m] = (logT[l.m] || 0) + l.h; });

  const liveAll = ppl.map((p) => {
    const a = LV.att[p.id];
    const tm = LV.timers[p.id];
    const idl = LV.idle[p.id];
    let status;
    let hue;
    let key;
    if (!a) { status = pastLate ? 'Not checked in' : 'Not in yet'; hue = pastLate ? 25 : 265; key = pastLate ? 'absent' : 'off'; }
    else if (a.out) { status = `Checked out ${clock(a.out)}`; hue = 265; key = 'off'; }
    else if (a.brk) { status = `On break · ${fmtDur(now - a.brk)}`; hue = 70; key = 'break'; }
    else if (idl && now - idl >= 30 * MINUTE) { status = `Idle ${fmtDur(now - idl)}`; hue = 25; key = 'idle'; }
    else if (p.sales || tm) { status = 'Working'; hue = 150; key = 'work'; }
    else { status = 'No timer running'; hue = 70; key = 'notimer'; }

    const run = tm ? now - tm.start : 0;
    const todayH = (logT[p.id] || 0) + run / HOUR;
    const pr = tm && PRJ[tm.p];
    const myActs = actsToday.filter((x) => x.owner === p.id).sort((x, y) => y.t - x.t);
    const tasks = p.sales ? [] : (S.tasks || [])
      .filter((t) => t.a === p.id && t.st !== 'Done')
      .slice(0, 15)
      .map((t) => ({ value: t.id, label: `${t.title} · ${(PRJ[t.p] || {}).name || ''}` }));
    const tone = toneStrong(hue);
    const late = !!a && a.in > LATE;

    return {
      id: p.id, key, sales: p.sales, todayH, name: p.name, role: p.role, h: p.h,
      status, sBg: tone.bg, sFg: tone.fg, dot: dotFor(key),
      doing: tm ? tm.title : p.sales ? (myActs[0] ? myActs[0].text : 'No lead activity yet today') : '—',
      doingSub: tm
        ? `${pr ? `${pr.name} · ` : ''}timer running ${fmtDur(run)}`
        : p.sales
          ? `${myActs.length} lead action${myActs.length === 1 ? '' : 's'} today${myActs[0] ? ` · last at ${clock(myActs[0].t)}` : ''}`
          : '',
      today: h1(todayH), shift: `/ ${p.shift}h`,
      barW: `${Math.min(100, (todayH / p.shift) * 100).toFixed(1)}%`,
      barBg: todayH > p.shift ? 'oklch(0.55 0.15 300)' : todayH >= p.shift * 0.9 ? 'oklch(0.58 0.13 150)' : 'oklch(0.55 0.15 265)',
      inLabel: a ? clock(a.in) + (late ? ' · late' : '') : '—',
      inColor: late ? 'oklch(0.5 0.17 25)' : 'oklch(0.35 0.015 265)',
      checkedIn: !!a,
      canIn: !a, canOut: !!a && !a.out, canBreak: !!a && !a.out, brkLabel: a && a.brk ? 'Resume' : 'Break',
      hasTimer: !!tm, canStart: !p.sales && !!a && !a.out && !a.brk && !tm, tasks,
    };
  }).sort((a, b) => ORD[a.key] - ORD[b.key] || a.name.localeCompare(b.name));

  const cnt = (k) => liveAll.filter((x) => x.key === k).length;
  const names = (list) => list.map((x) => x.name).join(', ');
  const delH = liveAll.filter((x) => !x.sales).reduce((s, x) => s + x.todayH, 0);
  const touched = new Set(actsToday.map((x) => x.lead.id)).size;

  // ---- Alerts -----------------------------------------------------------
  const alerts = [];
  const push = (a) => alerts.push({ ...a, key: `a${alerts.length}`, dot: `oklch(0.62 0.17 ${a.hue})` });
  if (cnt('absent')) push({ hue: 25, title: `${cnt('absent')} not checked in by 10:30`, sub: names(liveAll.filter((x) => x.key === 'absent')), actLabel: 'Show', action: { type: 'liveF', value: 'absent' } });
  if (cnt('idle')) push({ hue: 25, title: `${cnt('idle')} idle for 30+ minutes`, sub: names(liveAll.filter((x) => x.key === 'idle')), actLabel: 'Show', action: { type: 'liveF', value: 'idle' } });
  if (cnt('notimer')) push({ hue: 70, title: `${cnt('notimer')} checked in with no timer running`, sub: names(liveAll.filter((x) => x.key === 'notimer')), actLabel: 'Show', action: { type: 'liveF', value: 'attention' } });

  if (pv && pv.pF && pv.info) {
    pv.pF.map(pv.info)
      .filter((I) => I.bad && I.p.status !== 'Completed')
      .sort((a, b) => (a.score ?? 100) - (b.score ?? 100))
      .slice(0, 4)
      .forEach((I) => push({
        hue: /^Late/.test(I.hLabel) ? 25 : 70,
        title: `${I.p.name} · ${I.hLabel}`,
        sub: attentionSub(I),
        actLabel: 'Open project',
        action: { type: 'project', pid: I.p.id, reset: true },
      }));
  }

  const { touch, isHot } = leadInsights({ leads: S.leads, fus: S.fus, staleDays, now });
  const touchOf = (id) => (typeof touch === 'function' ? touch(id) : touch[id]);
  const coldHot = S.leads.filter((l) => isHot(l) && now - touchOf(l.id) > DAY && !actsToday.some((x) => x.lead.id === l.id));
  if (coldHot.length) {
    push({
      hue: 35,
      title: `${coldHot.length} hot lead${coldHot.length > 1 ? 's' : ''} not contacted in 24h`,
      sub: coldHot.slice(0, 4).map((l) => `${l.company} (${ownerName(l.owner)})`).join(', '),
      actLabel: 'Open leads',
      action: { type: 'hotLeads' },
    });
  }

  S.milestones
    .filter((m) => m.appr && m.appr.st === 'Changes requested' && m.status !== 'Done')
    .slice(0, 3)
    .forEach((m) => {
      const p = PRJ[m.p] || {};
      push({ hue: 25, title: `${p.client || 'Client'} requested changes · ${m.name}`, sub: `${m.appr.note || ''} · ${p.name || ''}`, actLabel: 'Open project', action: { type: 'project', pid: p.id } });
    });

  (S.crs || []).filter((c) => ['Approved', 'In progress'].includes(c.status)).forEach((c) => {
    const mo = crMoney(c, { logs: S.logs, milestones: S.milestones, members: S.members });
    if (!mo.over) return;
    const p = PRJ[c.p] || {};
    push({
      hue: 25,
      title: `${c.id} is ${h1(mo.used - c.hours)} over its estimate`,
      sub: `${c.title} · ${h1(mo.used)} logged of ${c.hours}h · profit now ${money((c.amount || 0) - mo.cost)}`,
      actLabel: 'Open project',
      action: { type: 'project', pid: p.id },
    });
  });

  (S.crs || [])
    .filter((c) => c.status === 'Sent to client' && now - (c.sentAt || c.raised) > 3 * DAY)
    .slice(0, 3)
    .forEach((c) => {
      const p = PRJ[c.p] || {};
      push({
        hue: 70,
        title: `${c.id} waiting ${Math.floor((now - (c.sentAt || c.raised)) / DAY)} days for ${p.client || 'client'} approval`,
        sub: `${c.title} · ${c.hours}h · ${money(c.amount || 0)}`,
        actLabel: 'Open project',
        action: { type: 'project', pid: p.id },
      });
    });

  const yd = T - DAY;
  if (!isSunday(yd)) {
    const miss = S.members.filter((x) =>
      S.projects.some((p) => p.status === 'Running' && p.team.includes(x.id)) && !S.logs.some((l) => l.m === x.id && l.d === yd));
    if (miss.length) {
      push({ hue: 70, title: `${miss.length} timesheet${miss.length > 1 ? 's' : ''} missing for yesterday`, sub: miss.map((x) => x.name).join(', '), actLabel: 'Open timesheets', action: { type: 'timesheets' } });
    }
  }

  // ---- KPIs & chips -------------------------------------------------------
  const kpis = [
    ['work', 'Working now', cnt('work'), 150, `${liveAll.length} people`],
    ['break', 'On break', cnt('break'), 70, ''],
    ['idle', 'Idle 30m+', cnt('idle'), 25, ''],
    ['absent', pastLate ? 'Not checked in' : 'Not in yet', pastLate ? cnt('absent') : liveAll.filter((x) => !LV.att[x.id]).length, 25, pastLate ? 'after 10:30' : 'before 10:30'],
    ['delivery', 'Delivery hours today', h1(delH), 265, 'logged + running timers'],
    ['sales', 'Leads touched today', touched, 150, `${actsToday.length} actions`],
  ].map(([key, label, value, h, sub]) => ({ key, label, value, sub, dot: `oklch(0.62 0.14 ${h})` }));

  const chips = LIVE_CHIPS.map(([key, label]) => ({ key, label, count: liveAll.filter(LIVE_FILTERS[key]).length }));
  const activeChip = liveF === 'absent' || liveF === 'idle' ? 'attention' : liveF;
  const rows = liveAll.filter(LIVE_FILTERS[liveF] || LIVE_FILTERS.all);

  // ---- Activity feed -------------------------------------------------------
  const feedAll = LV.feed.filter((e) => !e.lead).map((e) => ({ t: e.t, who: e.who, grp: 'team', text: e.text, kind: e.kind }))
    .concat(actsToday.map((x) => ({ t: x.t, who: x.owner, grp: 'sales', text: x.fromFeed ? x.text : `${x.text} · ${x.lead.company}`, kind: x.kind })))
    .concat(S.milestones.filter((m) => m.appr && m.appr.at >= T).map((m) => ({
      t: m.appr.at, who: null, grp: 'proj', text: `${(PRJ[m.p] || {}).client || 'Client'} · ${m.appr.st.toLowerCase()} · ${m.name}`, kind: 'appr',
    })))
    .sort((a, b) => b.t - a.t);
  const feed = feedAll
    .filter((e) => feedF === 'all' || e.grp === feedF)
    .map((e, i) => {
      const p = PPL[e.who];
      return {
        key: `${e.t}-${i}`, time: clock(e.t), who: p ? p.name : 'Client', h: p ? p.h : 150, ini: p ? undefined : 'C',
        text: e.text, dot: `oklch(0.62 0.14 ${FK[e.kind] ?? 265})`,
      };
    });

  // ---- Sales table ----------------------------------------------------------
  const sales = OWNERS.map((o) => {
    const r = liveAll.find((x) => x.id === o.id) || { id: o.id, name: o.name, h: o.h, status: '—', sBg: '', sFg: '' };
    const ac = actsToday.filter((x) => x.owner === o.id);
    const fT = S.fus.filter((f) => f.owner === o.id && f.due >= T && f.due < T + DAY);
    const od = S.fus.filter((f) => f.owner === o.id && !f.done && f.due < now).length;
    return {
      ...r,
      touched: new Set(ac.map((x) => x.lead.id)).size,
      calls: ac.filter((x) => x.kind === 'call').length,
      quotes: ac.filter((x) => x.kind === 'quote' && /^Sent/.test(x.text)).length,
      fu: `${fT.filter((f) => f.done).length} / ${fT.length}`,
      od, odColor: od ? 'oklch(0.55 0.18 25)' : 'oklch(0.52 0.012 265)',
    };
  });

  // ---- Summary text ----------------------------------------------------------
  const summary = `Mariox · ${new Date(now).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${clock(now)}\n`
    + `${cnt('work')} working · ${cnt('break')} on break · ${cnt('idle')} idle · ${cnt('absent')} not checked in\n`
    + `Delivery hours today: ${h1(delH)}\nLeads touched today: ${touched}\n`
    + (alerts.length ? `\nNeeds attention:\n${alerts.map((a) => `• ${a.title}`).join('\n')}` : '\nNothing needs attention.');

  return {
    sub: `Updated ${clock(now)} · refreshes every 20 seconds · ${liveAll.filter((x) => LV.att[x.id]).length} of ${liveAll.length} checked in today`,
    kpis, alerts, chips, activeChip, rows, feed, sales, summary,
  };
}

/** Live now view model — recomputed whenever data, filters or `now` change. */
export function useLiveModel(now, feedF) {
  const S = useScoped();
  const liveF = useStore((s) => s.liveF) || 'all';
  const staleDays = useStore((s) => s.staleDays);
  const pv = useProjectsModel();
  return useMemo(() => buildLiveModel(S, { now, liveF, feedF, staleDays, pv }), [S, now, liveF, feedF, staleDays, pv]);
}
