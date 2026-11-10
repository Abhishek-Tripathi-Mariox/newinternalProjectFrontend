import { OWNERS } from '@/config/constants';
import { DAY, HOUR, MINUTE, today } from '@/lib/date';
import { seeded } from '@/lib/random';

/**
 * Simulated "today" for the Live board: who checked in, breaks, running
 * timers, idle flags and the activity feed. Seeded from today's date so the
 * picture is stable through the day. Port of the prototype's seedLive().
 *
 * @param {{members?:object[], tasks?:object[], leads?:object[]}} S full state
 */
export function seedLive(S = {}) {
  const T = today();
  const now = Date.now();
  // Same (possibly fractional) seed as the original.
  const { r } = seeded((T / DAY) % 100000 + 17);
  const tasks = S.tasks || [];
  const leads = S.leads || [];
  const att = {};
  const timers = {};
  const idle = {};
  const feed = [];
  if (new Date(T).getDay() === 0) return { date: T, att, timers, idle, feed };

  const ppl = (S.members || []).map((m) => ({ id: m.id, sales: false })).concat(OWNERS.map((o) => ({ id: o.id, sales: true })));
  ppl.forEach((p) => {
    if (r() < 0.1) return;
    const tin = T + (9 * 60 + 5 + Math.floor(r() * 95)) * MINUTE;
    if (tin > now) return;
    const a = (att[p.id] = { in: tin, out: null, brk: null, brkMin: 0 });
    feed.push({ t: tin, who: p.id, kind: 'in', text: `Checked in${tin > T + 630 * MINUTE ? ' late' : ''}` });

    if (p.sales) {
      const mine = leads.filter((l) => l.owner === p.id && l.status !== 'Won' && l.status !== 'Lost');
      const n = 2 + Math.floor(r() * 5);
      for (let i = 0; i < n && mine.length; i++) {
        const l = mine[Math.floor(r() * mine.length)];
        const t = tin + Math.floor(r() * Math.max(1, now - tin));
        const k = ['call', 'call', 'email', 'whatsapp'][Math.floor(r() * 4)];
        feed.push({ t, who: p.id, kind: k, lead: l.id, text: `${k === 'call' ? 'Called ' : k === 'email' ? 'Emailed ' : 'WhatsApp to '}${l.contact} · ${l.company}` });
      }
    }

    const outAt = T + (18 * 60 + 15 + Math.floor(r() * 60)) * MINUTE;
    if (outAt < now && r() < 0.7) {
      a.out = outAt;
      a.brkMin = 45;
      feed.push({ t: outAt, who: p.id, kind: 'out', text: 'Checked out' });
      return;
    }
    if (r() < 0.12) {
      a.brk = now - Math.floor(5 + r() * 25) * MINUTE;
      feed.push({ t: a.brk, who: p.id, kind: 'break', text: 'Went on break' });
      return;
    }
    if (!p.sales) {
      const mine = tasks.filter((t) => t.a === p.id && t.st !== 'Done');
      const t = mine[Math.floor(r() * mine.length)];
      if (t && r() > 0.12) {
        const st = Math.max(tin + 10 * MINUTE, now - Math.floor(15 + r() * 150) * MINUTE);
        timers[p.id] = { task: t.id, p: t.p, ms: t.ms, title: t.title, start: st };
        feed.push({ t: st, who: p.id, kind: 'start', text: `Started timer · ${t.title}` });
        if (r() < 0.15) idle[p.id] = now - Math.floor(31 + r() * 30) * MINUTE;
      }
    }
  });
  return { date: T, att, timers, idle, feed };
}

/** Normalise a (possibly null) live object for today — original lBase(). */
export const liveBase = (L) => ({ date: today(), att: {}, timers: {}, idle: {}, feed: [], ...L });

/**
 * When the attendance log has nothing for today, derive today's events from
 * the live board (original componentDidMount). Returns the new log or null.
 */
export function backfillTodayAttendance(live, attLog) {
  const T0 = today();
  const log = attLog || [];
  if (log.some((e) => e.t >= T0)) return null;
  const add = [];
  Object.keys(live.att || {}).forEach((who) => {
    const a = live.att[who];
    add.push({ t: a.in, who, k: 'login' });
    if (a.out && a.brkMin) {
      const b = Math.max(a.in + HOUR, T0 + 13 * HOUR + 10 * MINUTE);
      add.push({ t: b, who, k: 'break' }, { t: b + a.brkMin * MINUTE, who, k: 'resume' });
    }
    if (a.brk) add.push({ t: a.brk, who, k: 'break' });
    if (a.out) add.push({ t: a.out, who, k: 'logout' });
  });
  return log.concat(add);
}
