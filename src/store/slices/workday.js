import { HOUR, today } from '@/lib/date';
import { liveBase } from '@/domain/live';
import { pidOf, sessionUser } from '@/domain/permissions';
import { curMs } from '@/domain/projects';
import { getOwners } from '@/store/owners';
import { fetchEvents, fetchLive, fetchReports, fromApiLog, isCeo, workdayApi } from '@/api/workday';

/** Same JSON → same reference (keeps polling from re-rendering when nothing changed). */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Workday actions: check-in/out, breaks, timers, end-of-shift reports — backed by /workday/*
 * (the signed-in person) and /live/:pid/* (the CEO acting from Live now). Every action calls the
 * API, shows the server's message ('Welcome back · 12m break · 3m over'…) and refreshes the
 * live board + today's attendance events.
 */
export const createWorkdaySlice = (set, get) => {
  /** Is `pid` the signed-in person's own day (→ /workday), or the CEO acting on someone (→ /live/:pid)? */
  const isSelf = (pid) => {
    const me = get().me;
    return !!me && !isCeo(me) && me.pid === pid;
  };

  /** Merge a time log created by the server (timer stop / check-out) into the timesheet. */
  const addLog = (log, pid) => {
    const l = fromApiLog(log, pid);
    if (l) set((s) => ({ logs: (s.logs || []).some((x) => x.id === l.id) ? s.logs : (s.logs || []).concat(l) }));
  };

  /** Run a workday request, merge any timer log, refresh the board, flash the server message. */
  async function run(pid, req, { flash = true, fallback } = {}) {
    try {
      const res = await req();
      if (res && res.log) addLog(res.log, pid);
      await get().pollLive();
      if (flash) get().flash((res && res.message) || fallback || 'Done');
      return res;
    } catch (e) {
      get().flash(e.message);
      get().pollLive().catch(() => {});
      return null;
    }
  }

  return {
    /**
     * Refresh the live board and today's attendance events (CEO: + today's shift reports).
     * Called every 20 s by App and after every workday action. Unchanged data keeps its
     * reference so nothing re-renders.
     */
    async pollLive() {
      const me = get().me;
      if (!me || (!isCeo(me) && !me.pid) || (me.role && me.role.id === 'r-client')) return;
      const T = today();
      try {
        const [live, evs, reps] = await Promise.all([
          fetchLive(me),
          fetchEvents(me, T, T),
          isCeo(me) ? fetchReports(me, T, T).catch(() => null) : Promise.resolve(null),
        ]);
        if (get().me !== me) return; // signed out meanwhile
        const S = get();
        const patch = {};
        if (!same(S.live, live)) patch.live = live;
        const old = S.attLog || [];
        const keep = old.filter((e) => e.t < T);
        const todays = old.filter((e) => e.t >= T);
        if (!same(todays, evs)) patch.attLog = keep.concat(evs);
        if (reps) {
          const oldR = (S.reports || []).filter((r) => r.d === T);
          if (!same(oldR, reps)) patch.reports = (S.reports || []).filter((r) => r.d !== T).concat(reps);
        }
        if (Object.keys(patch).length) set(patch);
      } catch {
        // Polling is best effort; the next tick retries.
      }
    },

    checkIn(id) {
      return run(id, () => workdayApi.checkIn(id, isSelf(id)), { fallback: 'Checked in' });
    },

    /** Check out: the server ends any break and stops the timer (logging its time). */
    checkOut(id) {
      return run(id, () => workdayApi.checkOut(id, isSelf(id)), { fallback: 'Checked out' });
    },

    /** Start or end a break (CEO "Break" / "Resume" on Live now). Starting a break stops the running timer. */
    toggleBreak(id) {
      const a = liveBase(get().live).att[id] || {};
      return a.brk
        ? run(id, () => workdayApi.endBreak(id, isSelf(id)))
        : run(id, () => workdayApi.startBreak(id, isSelf(id), isSelf(id) ? 'Tea / coffee' : null, ''));
    },

    /** Header "Break" button for the signed-in person: check in, open the break modal, or end the break. */
    async myBreak() {
      const S = get();
      const pid = pidOf(sessionUser(S));
      if (!pid) return;
      const a = liveBase(S.live).att[pid];
      if (!a || a.out) { await get().checkIn(pid); return; }
      if (!a.brk) { get().openModal('brk', { pid }); return; }
      // "Welcome back · 12m break · 3m over" comes from the server.
      await run(pid, () => workdayApi.endBreak(pid, isSelf(pid)));
    },

    /** Start a typed break (from the break modal). Resolves to an error message or undefined. */
    async startBreak(pid, type, note) {
      try {
        const res = await workdayApi.startBreak(pid, isSelf(pid), type, (note || '').trim());
        if (res && res.log) addLog(res.log, pid);
        set({ modal: null });
        await get().pollLive();
        get().flash(res.message);
        return undefined;
      } catch (e) {
        return e.message;
      }
    },

    /** Start a task timer for `id` (the server stops and logs any running one). */
    startTimer(id, tid) {
      return run(id, () => workdayApi.startTimer(id, isSelf(id), tid));
    },

    stopTimer(id) {
      return run(id, () => workdayApi.stopTimer(id, isSelf(id)), { fallback: 'Timer stopped · time added to timesheet' });
    },

    /**
     * Open the end-of-shift modal ('eos') with its initial form:
     * `{who, sales, done, blockers, plan, outcome, calls, meetings, rows?[{p,ms,h,note}], pmRows?[{p,st,note}]}`.
     * The signed-in person's form is pre-filled by the server (GET /workday/end-shift).
     */
    async openEndShift(pid) {
      if (isSelf(pid)) {
        try {
          const f = await workdayApi.endShiftForm();
          const str = (v) => (v === '' || v == null ? '' : String(v));
          get().openModal('eos', {
            who: f.who || pid, sales: !!f.sales, done: f.done || '', blockers: f.blockers || '', plan: f.plan || '', outcome: f.outcome || '',
            calls: str(f.calls), meetings: str(f.meetings),
            ...(f.sales ? {} : {
              rows: (f.rows || []).map((r) => ({ p: r.p || '', ms: r.ms || '', h: str(r.h), note: r.note || '' })),
              pmRows: (f.pmRows || []).map((r) => ({ p: r.p, st: r.st || 'On track', note: r.note || '' })),
            }),
          });
          return;
        } catch (e) {
          get().flash(e.message);
          return;
        }
      }
      // Someone else's day (Super Admin previewing): pre-fill from loaded data.
      const S = get();
      const T = today();
      const sales = getOwners().some((o) => o.id === pid);
      const m = { who: pid, sales, done: '', blockers: '', plan: '', outcome: '', calls: '', meetings: '' };
      if (!sales) {
        const todays = (S.logs || []).filter((l) => l.m === pid && l.d === T);
        const tm = (liveBase(S.live).timers || {})[pid];
        const ids = (S.projects || []).filter((p) => p.status === 'Running' && (p.team || []).includes(pid)).map((p) => p.id);
        todays.forEach((l) => { if (!ids.includes(l.p)) ids.push(l.p); });
        if (tm && tm.p && !ids.includes(tm.p)) ids.push(tm.p);
        m.rows = ids.length ? ids.map((id) => {
          const ls = todays.filter((l) => l.p === id);
          const isRun = tm && tm.p === id;
          const h = ls.reduce((x, l) => x + l.h, 0) + (isRun ? (Date.now() - tm.start) / HOUR : 0);
          return { p: id, ms: (ls[0] && ls[0].ms) || (isRun && tm.ms) || curMs(S.milestones, id), h: h ? String(Math.round(h * 4) / 4) : '', note: ls.map((l) => l.note).filter(Boolean).join('; ') || (isRun ? tm.title : '') };
        }) : [{ p: '', ms: '', h: '', note: '' }];
        m.pmRows = (S.projects || []).filter((p) => p.pm === pid && !['Done', 'Completed', 'Cancelled'].includes(p.status)).map((p) => ({ p: p.id, st: 'On track', note: '' }));
      }
      get().openModal('eos', m);
    },

    /**
     * Submit the end-of-shift report (form from openEndShift). The server checks logged hours
     * against time worked, replaces today's logs with the report rows and checks the person out;
     * the signed-in person is then signed out. Resolves to an error message or undefined.
     */
    async submitEndShift(m) {
      const pid = m.who;
      // Same quick checks as the server (same wording) for instant feedback.
      if (!m.sales) {
        const rows = (m.rows || []).filter((r) => r.p && +r.h > 0);
        if (!rows.length) return 'Add hours for at least one project.';
        if (!m.done.trim()) return 'Write what you completed today.';
      } else if (!m.outcome.trim()) return 'Write a short summary of your day.';
      if (!isSelf(pid)) return 'Only the person themself can submit their end-of-shift report.';
      let res;
      try {
        res = await workdayApi.submitEndShift({
          done: m.done || '', blockers: m.blockers || '', plan: m.plan || '', outcome: m.outcome || '',
          calls: m.calls === '' ? 0 : +m.calls || 0, meetings: m.meetings === '' ? 0 : +m.meetings || 0,
          rows: m.sales ? [] : (m.rows || []).filter((r) => r.p).map((r) => ({ p: r.p, ms: r.ms || null, h: r.h === '' ? 0 : +r.h || 0, note: r.note || '' })),
          pmRows: (m.pmRows || []).map((x) => ({ p: x.p, st: x.st, note: x.note || '' })),
        });
      } catch (e) {
        return e.message;
      }
      set({ modal: null });
      await get().endSession(res && res.message ? res.message : 'Report submitted · shift ended');
      return undefined;
    },
  };
};
