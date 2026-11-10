import { BUG_SEVERITY_DAYS } from '@/config/constants';
import { DAY, NOON, sod, today } from '@/lib/date';
import { seeded } from '@/lib/random';

/* Bug seed — port of the prototype's seedBugs() (seed 5150, same random-call order). */

// [title, dept, env, severity]
const BUGS = [
  ['App crashes on launch after update', 'Mobile', 'Android', 'Critical'], ['Checkout total ignores coupon discount', 'Backend', 'API / Backend', 'Major'], ['OTP not received on some Jio numbers', 'Backend', 'API / Backend', 'Critical'],
  ['Profile photo upload fails above 5 MB', 'Mobile', 'iOS', 'Major'], ['Button text cut off on small screens', 'Design', 'Android', 'Minor'], ['Date picker shows wrong timezone', 'Web', 'Web', 'Major'],
  ['Search returns duplicate results', 'Backend', 'API / Backend', 'Minor'], ['Logout does not clear session token', 'Backend', 'API / Backend', 'Critical'], ['Dark mode: text invisible on cards', 'Design', 'iOS', 'Minor'],
  ['Push notification opens wrong screen', 'Mobile', 'Android', 'Major'], ['Export to Excel downloads empty file', 'Web', 'Admin panel', 'Major'], ['Spelling mistake on onboarding screen', 'Design', 'Web', 'Trivial'],
  ['Slow loading on order history (8s+)', 'Backend', 'API / Backend', 'Major'], ['Payment success page shows twice', 'Web', 'Web', 'Major'], ['Filter chips reset when going back', 'Mobile', 'iOS', 'Minor'],
  ['Invoice PDF missing GST number', 'Web', 'Admin panel', 'Major'], ['Keyboard covers input on login screen', 'Mobile', 'Android', 'Minor'], ['Admin can delete own account', 'Web', 'Admin panel', 'Major'],
  ['Map pin drifts while scrolling', 'Mobile', 'iOS', 'Minor'], ['Session expires during long forms', 'Web', 'Web', 'Major'], ['Wrong currency symbol for USD clients', 'Web', 'Web', 'Minor'], ['Images not cached, reloads every time', 'Mobile', 'Android', 'Minor'],
];

export function seedBugs(projects, milestones, members) {
  const { r, pick } = seeded(5150);
  const D = DAY;
  const T = today();
  const MEM = {};
  members.forEach((m) => { MEM[m.id] = m; });
  const bugs = [];
  let n = 0;

  projects.filter((p) => p.status === 'Running' || p.status === 'On hold' || p.status === 'Completed').forEach((p) => {
    const ms = milestones.filter((m) => m.p === p.id).sort((a, b) => a.n - b.n);
    const cur = ms.find((m) => m.status !== 'Done') || ms[ms.length - 1];
    const k = p.status === 'Completed' ? 2 : p.status === 'On hold' ? 2 : 3 + Math.floor(r() * 3);
    for (let i = 0; i < k; i++) {
      const b = pick(BUGS);
      const dev = p.team.filter((id) => (MEM[id] || {}).team === b[1]);
      const qa = p.team.filter((id) => (MEM[id] || {}).team === 'QA');
      const ago = Math.floor(r() * 20);
      const rep = sod(T - ago * D + NOON);
      const sevDays = BUG_SEVERITY_DAYS[b[3]];
      const st = p.status === 'Completed' ? 'Closed' : pick(['Open', 'Open', 'In progress', 'In progress', 'Fixed', 'Retest', 'Reopened', 'Closed']);
      const a = dev.length ? pick(dev) : pick(p.team.slice(1).length ? p.team.slice(1) : p.team);
      const by = r() < 0.3 ? 'client' : qa.length ? pick(qa) : p.pm;
      // Evaluation order below mirrors the original object literal (ms, prio, build).
      const ms0 = (r() < 0.7 && cur ? cur : pick(ms)).id;
      const prio = b[3] === 'Critical' ? 'High' : b[3] === 'Major' ? pick(['High', 'Medium']) : pick(['Medium', 'Low']);
      const build = `v${1 + Math.floor(r() * 3)}.${Math.floor(r() * 9)}.${Math.floor(r() * 9)}`;
      bugs.push({
        id: `BUG-${1001 + n++}`, p: p.id, ms: ms0, title: b[0], dept: b[1], env: b[2], sev: b[3], prio,
        st, a, rep: by, repDate: rep, due: sod(rep + sevDays * D + NOON), build,
        steps: '1. Open the app\n2. Go to the affected screen\n3. Repeat the action', exp: 'Works without errors', act: b[0], link: '',
        log: [{ t: `Reported by ${by === 'client' ? 'client' : (MEM[by] || {}).name}`, d: rep }].concat(st !== 'Open' ? [{ t: `Status → ${st}`, d: Math.min(T, rep + D) }] : []),
      });
    }
  });
  return bugs;
}
