import { DAY, NOON, sod } from '@/lib/date';
import { seeded } from '@/lib/random';

/* Task seed — port of the prototype's seedTasks() (seed 9091, same random-call order). */

const TITLES = [
  ['Kickoff call with client', 'Finalize requirement document', 'User flow diagrams', 'Wireframes for core screens', 'High-fidelity UI for home and onboarding', 'Design system and components', 'Client design sign-off'],
  ['Set up repo and CI pipeline', 'Database schema', 'Login, signup and OTP', 'User profile API', 'Admin panel: user management', 'Push notification setup'],
  ['Payment gateway integration', 'Search and filters', 'Order history screen', 'Reports dashboard', 'Third-party API integration', 'Performance optimisation'],
  ['Write test cases', 'Regression testing: Android', 'Regression testing: iOS and web', 'Fix UAT feedback, batch 1', 'Security review', 'Load testing'],
  ['Production deployment', 'App store submission', 'Handover documentation', 'Client training session', 'Post-launch monitoring'],
];
const CHECKLIST = ['Build', 'Unit tests', 'Code review', 'QA check', 'Deploy to staging'];
/** Milestone index → teams preferred as assignee. */
const ROLE_FOR = { 0: ['Design'], 3: ['QA'] };

/**
 * @param {object[]} projects
 * @param {object[]} milestones
 * @param {object[]} members used to prefer Design/QA people on matching milestones
 */
export function seedTasks(projects, milestones, members = []) {
  const { r, pick } = seeded(9091);
  const D = DAY;
  const MEM = {};
  members.forEach((m) => { MEM[m.id] = m; });
  const tasks = [];
  let n = 0;

  projects.forEach((p) => {
    if (p.status === 'Cancelled') return;
    const ms = milestones.filter((m) => m.p === p.id).sort((a, b) => a.n - b.n);
    const ci = ms.findIndex((m) => m.status !== 'Done');
    const cur = ci < 0 ? ms.length - 1 : ci;
    const team = p.team.slice(1).length ? p.team.slice(1) : p.team;
    ms.forEach((m, i) => {
      if (i > cur + 1) return;
      const k = p.status === 'Planning' ? (i === 0 ? 4 : 0) : i < cur ? 3 : 4 + Math.floor(r() * 2);
      const titles = TITLES[Math.min(i, 4)].slice().sort(() => r() - 0.5).slice(0, k);
      titles.forEach((title) => {
        const pool = ROLE_FOR[i] ? team.filter((id) => ROLE_FOR[i].includes((MEM[id] || {}).team)) : [];
        const a = pool.length ? pick(pool) : pick(team);
        let st;
        if (m.status === 'Done' || p.status === 'Completed') st = 'Done';
        else if (i === cur && p.status !== 'Planning') st = pick(['Done', 'In progress', 'In progress', 'In review', 'To do', 'Blocked']);
        else st = 'To do';
        if (p.status === 'On hold' && st === 'In progress') st = 'Blocked';
        const due = sod(m.due - Math.floor(r() * 6) * D + NOON);
        const cl = r() < 0.45
          ? CHECKLIST.slice(0, 2 + Math.floor(r() * 3)).map((t, x) => ({ t, done: st === 'Done' || (st !== 'To do' && x < 1 + Math.floor(r() * 2)) }))
          : [];
        tasks.push({
          id: `T${++n}`, p: p.id, ms: m.id, title, desc: '', a, st, prio: pick(['High', 'Medium', 'Medium', 'Low']), due,
          est: pick([2, 4, 4, 6, 8, 12, 16]), cl, created: due - (5 + Math.floor(r() * 10)) * D,
        });
      });
    });
  });
  return tasks;
}
