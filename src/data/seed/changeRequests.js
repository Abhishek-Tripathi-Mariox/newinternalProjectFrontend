import { DAY, HOUR, NOON, sod, today } from '@/lib/date';

/*
 * Change-request seed + healing helpers (ports of seedCrs, healCrMs and the
 * CR-101-1 backfill from the prototype's initState).
 */

/**
 * Seed four CRs. Also appends the CR milestone for the approved CR-101-1 to
 * `pd.milestones` (in place, like the original).
 * @param {{projects:object[], milestones:object[]}} pd
 */
export function seedCrs(pd) {
  const D = DAY;
  const T = today();
  const crs = [];
  const P = (id) => pd.projects.find((p) => p.id === id);
  const mk = (pid, n, o) => {
    const p = P(pid);
    if (!p) return null;
    const c = { id: `CR-${pid.slice(3)}-${n}`, p: pid, n, by: 'Client', reqBy: p.client, docs: [], prio: 'Medium', target: 'new', ms: null, rate: 1500, days: 0, ...o };
    c.amount = c.hours * c.rate;
    crs.push(c);
    return c;
  };

  const a = mk('PR-101', 1, {
    title: 'Wallet & cashback', desc: 'Customers hold a wallet balance, earn 2% cashback on every order and can pay with the wallet at checkout.',
    hours: 60, rate: 1600, days: 7, prio: 'High', status: 'In progress', raised: T - 12 * D, sentAt: T - 10 * D, decidedAt: T - 9 * D,
    hist: [
      { t: T - 12 * D, text: 'Raised by Swiftcart Retail' }, { t: T - 11 * D, text: 'Estimated 60h · ₹96,000 · +7 days' },
      { t: T - 10 * D, text: 'Sent to client for approval' }, { t: T - 9 * D, text: 'Approved by client in portal' }, { t: T - 8 * D, text: 'Work started' },
    ],
  });
  if (a) {
    const p = P('PR-101');
    const n = pd.milestones.filter((m) => m.p === p.id).reduce((x, m) => Math.max(x, m.n), 0) + 1;
    a.ms = `${p.id}-${a.id}`;
    pd.milestones.push({ id: a.ms, p: p.id, n, name: `CR: ${a.title}`, alloc: 60, due: p.due, status: 'In progress', cr: a.id });
  }
  mk('PR-101', 2, {
    title: 'Hindi & Marathi language support', desc: 'Translate the customer app into Hindi and Marathi, with a language switcher in settings.',
    hours: 36, rate: 1600, days: 5, status: 'Sent to client', raised: T - 6 * D, sentAt: T - 5 * D,
    hist: [{ t: T - 6 * D, text: 'Raised by Swiftcart Retail' }, { t: T - 5 * D, text: 'Sent to client for approval' }],
  });
  mk('PR-103', 1, {
    title: 'Bulk lead import from Excel', desc: 'Admins upload an .xlsx of leads, map columns and import with duplicate checks.',
    hours: 24, rate: 1800, days: 3, status: 'Draft', by: 'Internal', reqBy: 'Meera Joshi', raised: T - D,
    hist: [{ t: T - D, text: 'Draft created by Meera Joshi' }],
  });
  mk('PR-102', 1, {
    title: 'Video consultation module', desc: 'Doctors run video calls inside the portal, with recording and consultation notes.',
    hours: 120, rate: 1500, days: 21, prio: 'High', status: 'Rejected', raised: T - 20 * D, sentAt: T - 18 * D, decidedAt: T - 15 * D,
    note: 'Out of budget this quarter. Revisit in Phase 2.',
    hist: [
      { t: T - 20 * D, text: 'Raised by Medibook Health' }, { t: T - 18 * D, text: 'Sent to client for approval' },
      { t: T - 15 * D, text: 'Rejected by client · Out of budget this quarter. Revisit in Phase 2.' },
    ],
  });
  return crs;
}

/**
 * Ensure every approved / in-progress / done CR that points at its own
 * milestone actually has that milestone. Returns the same array when nothing changed.
 */
export function healCrMs(crs, ms, projects) {
  let out = ms;
  (crs || []).forEach((c) => {
    if (!c.ms || !['Approved', 'In progress', 'Done'].includes(c.status) || out.some((m) => m.id === c.ms)) return;
    const p = (projects || []).find((x) => x.id === c.p);
    if (!p) return;
    if ((c.target || 'new') !== 'new' && !c.ms.startsWith(`${p.id}-CR`)) return;
    const n = out.filter((m) => m.p === p.id).reduce((x, m) => Math.max(x, m.n), 0) + 1;
    out = out.concat({
      id: c.ms, p: p.id, n, name: `CR: ${c.title}`, alloc: c.hours, due: p.due,
      status: c.status === 'Done' ? 'Done' : c.status === 'In progress' ? 'In progress' : 'Not started', cr: c.id,
    });
  });
  return out;
}

/**
 * Migration: older data had CR-101-1 without a work breakdown. Adds its team,
 * tasks, signature, board tasks and timesheet logs. Mutates/returns `pd`.
 */
export function backfillCr1011(pd) {
  const D = DAY;
  const T0 = today();
  const msId = 'PR-101-CR-101-1';
  const c1 = pd.crs.find((c) => c.id === 'CR-101-1');
  if (!c1 || c1.tasks) return pd;

  const tk = [
    { t: 'Wallet ledger & cashback rules API', a: 'tb', h: 22 }, { t: 'Wallet screens · Android', a: 'vg', h: 14 },
    { t: 'Wallet screens · iOS', a: 'si', h: 14 }, { t: 'Wallet regression tests', a: 'dn', h: 10 },
  ];
  pd.crs = pd.crs.map((c) => (c.id === 'CR-101-1'
    ? { ...c, team: ['tb', 'vg', 'si', 'dn'], tasks: tk, sig: { name: 'Rahul Khanna', title: 'Product Head', at: T0 - 9 * D + 11 * HOUR, via: 'Typed signature in client portal', note: '' } }
    : c));
  if (!pd.tasks.some((t) => t.cr === 'CR-101-1')) {
    pd.tasks = pd.tasks.concat(tk.map((t, i) => ({
      id: `T-CR1-${i}`, p: 'PR-101', ms: msId, title: t.t, desc: 'From CR-101-1 · Wallet & cashback', a: t.a,
      st: i < 2 ? 'Done' : 'In progress', prio: 'High', due: T0 + 3 * D, est: t.h, cl: [], created: T0 - 9 * D, cr: 'CR-101-1',
      log: [{ d: T0 - 9 * D, t: 'Created from CR-101-1' }],
    })));
  }
  if (!pd.logs.some((l) => l.ms === msId)) {
    const plan = [['tb', 8], ['tb', 8], ['vg', 7], ['si', 7], ['tb', 8], ['vg', 8], ['si', 6], ['dn', 6], ['vg', 6]];
    let k = 8;
    plan.forEach(([m, h], i) => {
      let d = sod(T0 - k * D + NOON);
      if (new Date(d).getDay() === 0) { k--; d = sod(T0 - k * D + NOON); }
      pd.logs.push({ id: `L-CR1-${i}`, m, p: 'PR-101', ms: msId, d, h, note: 'Wallet & cashback (CR-101-1)' });
      if (i % 2) k--;
    });
  }
  return pd;
}
