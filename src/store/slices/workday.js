import { BREAK_TYPES, DEFAULT_PASSWORD, OWNERS } from '@/config/constants';
import { HOUR, MINUTE, sod, today, fmtDur, clock } from '@/lib/date';
import { liveBase } from '@/data/seed/live';
import { pidOf, authUser, sessionUser } from '@/domain/permissions';
import { curMs } from '@/domain/projects';
import { navigate } from '../navigation';

/**
 * Stop `id`'s running timer at `t`, adding a timesheet entry when it ran ≥ 1 min.
 * @returns {[live, logs]}
 */
function stopTimerAt(L, logs, id, t) {
  const tm = L.timers[id];
  if (!tm) return [L, logs];
  const mins = (t - tm.start) / MINUTE;
  const timers = { ...L.timers };
  delete timers[id];
  const nl = mins >= 1 ? logs.concat({ id: `L${t}${id}`, m: id, p: tm.p, ms: tm.ms, d: sod(t), h: Math.round((mins / 60) * 100) / 100, note: `${tm.title} · timer` }) : logs;
  return [{ ...L, timers, feed: L.feed.concat({ t, who: id, kind: 'stop', text: `Stopped timer · ${tm.title} · ${fmtDur(t - tm.start)}` }) }, nl];
}

/** Workday actions: session, check-in/out, breaks, timers, end-of-shift reports. */
export const createWorkdaySlice = (set, get) => ({
  /** Append an attendance event for `who` now. */
  attPush(who, k) {
    if (!who) return;
    set((s) => ({ attLog: (s.attLog || []).concat({ t: Date.now(), who, k }) }));
  },

  /** Sign in. Returns an error message, or undefined on success. */
  login(email, pw) {
    const S = get();
    const u = (S.users || []).find((x) => (x.email || '').toLowerCase() === (email || '').trim().toLowerCase());
    if (!u) return 'No account uses that email.';
    if (u.status !== 'Active') return `This account is ${(u.status || 'inactive').toLowerCase()}. Ask an admin to activate it.`;
    if ((pw || '') !== (u.pw || DEFAULT_PASSWORD)) return 'Wrong password.';
    const sup = u.role === 'r-super';
    set((s) => ({ auth: { uid: u.id, at: Date.now() }, selLead: null, modal: null, users: s.users.map((x) => (x.id === u.id ? { ...x, last: Date.now() } : x)) }));
    navigate('/live');
    get().flash(`Welcome, ${u.name.split(' ')[0]}`);
    if (sup) {
      set({ viewAs: null });
    } else {
      get().setViewAs(u.id, true);
      const pid = pidOf(u);
      const a = liveBase(get().live).att[pid];
      if (!a || a.out) get().checkIn(pid);
    }
    return undefined;
  },

  /** Sign out. Staff still checked in must submit the end-of-shift report first. */
  logout() {
    const S = get();
    const u = authUser(S);
    if (u && u.role !== 'r-super') {
      const pid = pidOf(u);
      const a = liveBase(S.live).att[pid];
      if (a && !a.out) {
        get().flash('Submit your end-of-shift report to log out');
        get().openEndShift(pid);
        return;
      }
    }
    set({ auth: null, viewAs: null, selLead: null, modal: null });
    navigate('/live');
  },

  checkIn(id) {
    get().attPush(id, 'login');
    const t = Date.now();
    set((s) => {
      const L = liveBase(s.live);
      return { live: { ...L, att: { ...L.att, [id]: { in: t, out: null, brk: null, brkMin: 0 } }, feed: L.feed.concat({ t, who: id, kind: 'in', text: 'Checked in' }) } };
    });
    get().flash('Checked in');
  },

  /** Check out: ends any break, stops the timer (logging its time). */
  checkOut(id) {
    const a0 = liveBase(get().live).att[id];
    if (a0 && a0.brk) get().attPush(id, 'resume');
    get().attPush(id, 'logout');
    const t = Date.now();
    set((s) => {
      const [L, logs] = stopTimerAt(liveBase(s.live), s.logs, id, t);
      const a = L.att[id] || {};
      return { logs, live: { ...L, att: { ...L.att, [id]: { ...a, out: t, brk: null } }, feed: L.feed.concat({ t: t + 1, who: id, kind: 'out', text: 'Checked out' }) } };
    });
    get().flash('Checked out');
  },

  /** Start or end a break. Starting a break stops the running timer. */
  toggleBreak(id) {
    const a0 = liveBase(get().live).att[id] || {};
    get().attPush(id, a0.brk ? 'resume' : 'break');
    const t = Date.now();
    set((s) => {
      const L0 = liveBase(s.live);
      const a = L0.att[id] || {};
      const [L, logs] = a.brk ? [L0, s.logs] : stopTimerAt(L0, s.logs, id, t);
      const na = a.brk ? { ...a, brk: null, brkMin: (a.brkMin || 0) + (t - a.brk) / MINUTE } : { ...a, brk: t };
      return {
        logs,
        live: { ...L, att: { ...L.att, [id]: na }, feed: L.feed.concat({ t: t + 1, who: id, kind: 'break', text: a.brk ? `Back from break · ${fmtDur(t - a.brk)}` : 'Went on break' }) },
      };
    });
  },

  /** Header "Break" button for the signed-in person: check in, open the break modal, or end the break. */
  myBreak() {
    const S = get();
    const pid = pidOf(sessionUser(S));
    if (!pid) return;
    const a = liveBase(S.live).att[pid];
    if (!a || a.out) { get().checkIn(pid); return; }
    if (!a.brk) { get().openModal('brk', { pid }); return; }
    const len = Date.now() - a.brk;
    const plan = (a.brkPlan || 0) * MINUTE;
    get().toggleBreak(pid);
    get().flash(`Welcome back · ${fmtDur(len)} break${plan && len > plan + MINUTE ? ` · ${fmtDur(len - plan)} over` : ''}`);
  },

  /** Start a typed break (from the break modal). */
  startBreak(pid, type, note) {
    const mins = (BREAK_TYPES.find((b) => b[0] === type) || [0, 15])[1];
    const t = Date.now();
    get().toggleBreak(pid);
    set((s) => {
      const L = liveBase(s.live);
      const a = L.att[pid] || {};
      return { modal: null, live: { ...L, att: { ...L.att, [pid]: { ...a, brkType: type, brkPlan: mins, brkNote: (note || '').trim() } } } };
    });
    get().flash(`${type} break started · back by ${clock(t + mins * MINUTE)}`);
  },

  /** Start a task timer for `id` (stops any running one). */
  startTimer(id, tid) {
    const t = Date.now();
    const tk = (get().tasks || []).find((x) => x.id === tid);
    if (!tk) return;
    set((s) => {
      const [L, logs] = stopTimerAt(liveBase(s.live), s.logs, id, t);
      const idle = { ...L.idle };
      delete idle[id];
      return {
        logs,
        live: { ...L, idle, timers: { ...L.timers, [id]: { task: tk.id, p: tk.p, ms: tk.ms, title: tk.title, start: t } }, feed: L.feed.concat({ t: t + 1, who: id, kind: 'start', text: `Started timer · ${tk.title}` }) },
      };
    });
    get().flash(`Timer started · ${tk.title}`);
  },

  stopTimer(id) {
    const t = Date.now();
    set((s) => {
      const [live, logs] = stopTimerAt(liveBase(s.live), s.logs, id, t);
      return { live, logs };
    });
    get().flash('Timer stopped · time added to timesheet');
  },

  /**
   * Open the end-of-shift modal ('eos') with its initial form:
   * `{who, sales, done, blockers, plan, outcome, calls, meetings, rows?[{p,ms,h,note}], pmRows?[{p,st,note}]}`.
   * Sales: today's calls/meetings are pre-counted. Delivery: one row per active
   * project / today's logs / running timer, pre-filled with today's hours.
   */
  openEndShift(pid) {
    const S = get();
    const T = today();
    const sales = OWNERS.some((o) => o.id === pid);
    const m = { who: pid, sales, done: '', blockers: '', plan: '', outcome: '', calls: '', meetings: '' };
    if (sales) {
      const ac = [];
      S.leads.forEach((l) => (l.acts || []).forEach((a) => { if (a.t >= T && l.owner === pid) ac.push(a); }));
      m.calls = String(ac.filter((a) => a.kind === 'call').length);
      m.meetings = String(ac.filter((a) => a.kind === 'meeting').length);
    } else {
      const todays = S.logs.filter((l) => l.m === pid && l.d === T);
      const tm = (liveBase(S.live).timers || {})[pid];
      const ids = S.projects.filter((p) => p.status === 'Running' && p.team.includes(pid)).map((p) => p.id);
      todays.forEach((l) => { if (!ids.includes(l.p)) ids.push(l.p); });
      if (tm && tm.p && !ids.includes(tm.p)) ids.push(tm.p);
      m.rows = ids.length ? ids.map((id) => {
        const ls = todays.filter((l) => l.p === id);
        const run = tm && tm.p === id;
        const h = ls.reduce((x, l) => x + l.h, 0) + (run ? (Date.now() - tm.start) / HOUR : 0);
        return { p: id, ms: (ls[0] && ls[0].ms) || (run && tm.ms) || curMs(S.milestones, id), h: h ? String(Math.round(h * 4) / 4) : '', note: ls.map((l) => l.note).filter(Boolean).join('; ') || (run ? tm.title : '') };
      }) : [{ p: '', ms: '', h: '', note: '' }];
      m.pmRows = S.projects.filter((p) => p.pm === pid && !['Done', 'Completed', 'Cancelled'].includes(p.status)).map((p) => ({ p: p.id, st: 'On track', note: '' }));
    }
    get().openModal('eos', m);
  },

  /**
   * Submit the end-of-shift report (form from openEndShift). `workedHours` is the
   * time worked today (attendance) — logged hours may not exceed it. Replaces
   * today's logs with the report rows, checks out, and signs staff out.
   */
  submitEndShift(m, workedHours = 0) {
    const S = get();
    const pid = m.who;
    const T = today();
    const now = Date.now();
    let rows = [];
    if (!m.sales) {
      rows = (m.rows || []).filter((r) => r.p && +r.h > 0);
      if (!rows.length) return 'Add hours for at least one project.';
      const lt = rows.reduce((x, r) => x + +r.h, 0);
      const wh = workedHours || 0;
      if (lt > wh + 0.01) return `Logged ${Math.round(lt * 100) / 100}h but you worked ${fmtDur(wh * HOUR)}. Reduce hours to match time worked.`;
      if (!m.done.trim()) return 'Write what you completed today.';
    } else if (!m.outcome.trim()) return 'Write a short summary of your day.';

    const rep = {
      id: `R${now}`, who: pid, d: T, t: now, sales: m.sales, done: m.done.trim(), blockers: m.blockers.trim(), plan: m.plan.trim(), outcome: m.outcome.trim(),
      calls: +m.calls || 0, meetings: +m.meetings || 0,
      rows: rows.map((r) => ({ p: r.p, ms: r.ms || curMs(S.milestones, r.p), h: Math.round(+r.h * 4) / 4, note: (r.note || '').trim() })),
      pm: (m.pmRows || []).map((x) => ({ p: x.p, st: x.st, note: (x.note || '').trim() })),
    };
    const a = liveBase(S.live).att[pid];
    if (a && !a.out) get().checkOut(pid);
    set((s) => ({
      modal: null,
      reports: (s.reports || []).filter((r) => !(r.who === pid && r.d === T)).concat(rep),
      logs: m.sales ? s.logs : s.logs.filter((l) => !(l.m === pid && l.d === T)).concat(rep.rows.map((r, i) => ({ id: `L${now}-${i}`, m: pid, p: r.p, ms: r.ms, d: T, h: r.h, note: r.note }))),
    }));
    const u0 = authUser(S);
    if (u0 && u0.role !== 'r-super' && pidOf(u0) === pid) {
      set({ auth: null, viewAs: null, selLead: null });
      navigate('/live');
    }
    get().flash('Report submitted · shift ended');
    return undefined;
  },
});
