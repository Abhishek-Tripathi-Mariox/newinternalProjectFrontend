import { MILESTONE_TEMPLATE } from '@/config/constants';
import { DAY, NOON, sod, today } from '@/lib/date';
import { seeded } from '@/lib/random';

/*
 * Delivery seed data. Ported 1:1 from the prototype's seedProj(): same LCG seed
 * and the same order of random calls so generated data matches the original.
 */

const MEMBERS = [
  ['rj', 'Rajat Sharma', 'Senior Developer', 'Web', 265], ['an', 'Ankit Mehra', 'Full-stack Developer', 'Web', 220], ['pr', 'Pooja Rawat', 'UI/UX Designer', 'Design', 340],
  ['vg', 'Vikas Gupta', 'Android Developer', 'Mobile', 150], ['si', 'Sneha Iyer', 'iOS Developer', 'Mobile', 190], ['ar', 'Arjun Reddy', 'Flutter Developer', 'Mobile', 120],
  ['km', 'Karan Malhotra', 'Backend Developer', 'Backend', 70], ['tb', 'Tarun Bansal', 'Backend Developer', 'Backend', 95], ['ik', 'Isha Kapoor', 'UI/UX Designer', 'Design', 10],
  ['dn', 'Divya Nair', 'QA Engineer', 'QA', 30], ['my', 'Manish Yadav', 'QA Engineer', 'QA', 50], ['mj', 'Meera Joshi', 'Project Manager', 'PMO', 300], ['na', 'Nitin Arora', 'Project Manager', 'PMO', 205],
];

// [name, client, service, status, pm, team, startDaysAgo, endDaysAgo (last day worked), dueInDays, value, hue, prio]
const PROJECTS = [
  ['Swiftcart Grocery App', 'Swiftcart Retail', 'Mobile App', 'Running', 'mj', ['rj', 'vg', 'si', 'pr', 'dn'], 70, 0, 24, 1850000, 150, 'High'],
  ['Medibook Patient Portal', 'Medibook Health', 'Web Development', 'Running', 'na', ['rj', 'an', 'km', 'ik', 'my'], 60, 0, 31, 1420000, 220, 'High'],
  ['Nova CRM Revamp', 'Nova Finserv', 'Custom Software', 'Running', 'mj', ['rj', 'tb', 'km', 'dn'], 45, 0, -3, 2200000, 265, 'High'],
  ['Fleetly Driver App', 'Fleetly Logistics', 'Mobile App', 'Running', 'na', ['ar', 'vg', 'tb', 'my'], 55, 0, 12, 1250000, 70, 'Medium'],
  ['EduSpark LMS', 'EduSpark Learning', 'Web Development', 'Running', 'mj', ['an', 'ik', 'km', 'dn'], 38, 0, 45, 980000, 300, 'Medium'],
  ['Hotelio Booking Engine', 'Hotelio', 'Custom Software', 'Running', 'na', ['tb', 'ar', 'pr', 'my'], 25, 0, 60, 1600000, 190, 'Medium'],
  ['Urban Threads Store', 'Urban Threads', 'E-commerce', 'On hold', 'mj', ['an', 'pr', 'dn'], 65, 18, 20, 760000, 340, 'Low'],
  ['Zenpay Merchant Dashboard', 'Zenpay', 'UI/UX Design', 'On hold', 'na', ['ik', 'pr'], 50, 22, -5, 420000, 30, 'Low'],
  ['Propnest Listings', 'Propnest Realty', 'Web Development', 'Completed', 'mj', ['an', 'km', 'ik', 'my'], 75, 8, -8, 890000, 120, 'Medium'],
  ['FitPulse Wellness', 'FitPulse', 'Mobile App', 'Completed', 'na', ['si', 'vg', 'pr', 'dn'], 75, 30, -28, 1100000, 95, 'Medium'],
  ['KisanMitra Advisory', 'KisanMitra Agro', 'AI / ML', 'Planning', 'mj', ['km', 'tb', 'ik'], -6, 0, 95, 1500000, 45, 'High'],
];

// Timesheet note pool per milestone index.
const NOTES = [
  ['Requirement workshop', 'Wireframes', 'UI screens', 'Design review with client', 'User flows'],
  ['Database schema', 'Auth module', 'API integration', 'Feature build', 'Admin panel'],
  ['Feature build', 'Payments integration', 'Bug fixes', 'Code review', 'Notifications'],
  ['Test cases', 'Regression testing', 'UAT fixes', 'Bug fixes', 'Performance testing'],
  ['Deployment', 'Store submission', 'Handover docs', 'Client training', 'Go-live support'],
];

/** People who already logged hours today in the seed. */
const TODAY_SET = ['rj', 'an', 'pr', 'vg', 'km', 'dn', 'mj', 'tb'];

/** Seed members, projects, milestones and ~75 days of timesheet logs. */
export function seedProjects() {
  const { r, pick } = seeded(4242);
  const D = DAY;
  const T = today();
  const rnd = (x) => Math.round(x * 2) / 2;

  const members = MEMBERS.map(([id, name, role, team, h]) => ({ id, name, role, team, h, shift: 8 }));
  const projects = PROJECTS.map((p, i) => ({
    id: `PR-${101 + i}`, name: p[0], client: p[1], service: p[2], status: p[3], pm: p[4], team: [p[4]].concat(p[5]),
    start: sod(T - p[6] * D + NOON), end: sod(T - p[7] * D + NOON), due: sod(T + p[8] * D + NOON),
    value: p[9], h: p[10], prio: p[11], alloc: {},
  }));

  // Index of the current milestone for each project (0..5).
  const cur = (p) => {
    if (p.status === 'Completed') return 5;
    if (p.status === 'Planning') return 0;
    const e = (p.end - p.start) / Math.max(D, p.due - p.start);
    return Math.min(p.status === 'On hold' ? 2 : 3, Math.max(0, Math.floor(e * 4)));
  };
  // Which milestone was active on a given day.
  const msAt = (p, d, c) => {
    const top = p.status === 'Completed' ? 4 : c;
    return Math.max(0, Math.min(top, Math.floor(((d - p.start) / (p.end - p.start + D)) * (top + 1))));
  };
  const CI = {};
  projects.forEach((p) => { CI[p.id] = cur(p); });

  const logs = [];
  let n = 0;
  for (let k = 75; k >= 0; k--) {
    const d = sod(T - k * D + NOON);
    if (new Date(d).getDay() === 0) continue;
    members.forEach((m) => {
      if (k === 0 && !TODAY_SET.includes(m.id)) return;
      if (k > 0 && r() < 0.05) return;
      const act = projects.filter((p) => p.status !== 'Planning' && p.team.includes(m.id) && d >= p.start && d <= p.end);
      if (!act.length) return;
      let parts;
      if (k === 0 && m.id === 'rj') parts = [['PR-101', 4], ['PR-102', 2], ['PR-103', 2]];
      else {
        const tot = pick([8, 8, 8, 8, 8, 7.5, 8.5, 9, 7]);
        const sh = act.slice().sort(() => r() - 0.5);
        const kk = Math.min(sh.length, pick([1, 2, 2, 3, 3]));
        const w = kk === 1 ? [1] : kk === 2 ? ((x) => [x, 1 - x])(pick([0.5, 0.625, 0.75])) : [0.5, 0.25, 0.25];
        parts = sh.slice(0, kk).map((p, i) => [p.id, rnd(tot * w[i])]);
      }
      parts.forEach(([pid, hrs]) => {
        if (hrs <= 0) return;
        const p = projects.find((x) => x.id === pid);
        const mi = msAt(p, d, CI[pid]);
        logs.push({ id: `L${++n}`, m: m.id, p: pid, ms: `${pid}-M${mi + 1}`, d, h: hrs, note: pick(NOTES[mi]) });
      });
    });
  }

  // Hours per project and per project+member, used to size budgets/allocations.
  const tot = {};
  const tpm = {};
  logs.forEach((l) => {
    tot[l.p] = (tot[l.p] || 0) + l.h;
    const k = `${l.p}:${l.m}`;
    tpm[k] = (tpm[k] || 0) + l.h;
  });

  const { fractions: FR, names: MN } = MILESTONE_TEMPLATE;
  const milestones = [];
  projects.forEach((p) => {
    const c = CI[p.id];
    const used = tot[p.id] || 0;
    const pr = p.status === 'Completed' ? 0.92 + r() * 0.14 : p.status === 'Planning' ? 0 : p.id === 'PR-103' ? 1.06 : p.status === 'On hold' ? 0.4 + r() * 0.15 : 0.45 + r() * 0.35;
    const budget = pr ? Math.round(used / pr / 10) * 10 : 900;
    let cum = 0;
    FR.forEach((fr, i) => {
      cum += fr;
      milestones.push({
        id: `${p.id}-M${i + 1}`, p: p.id, n: i + 1, name: MN[i], alloc: Math.round((budget * fr) / 5) * 5,
        due: sod(p.start + (p.due - p.start) * cum + NOON),
        status: i < c ? 'Done' : i === c && p.status !== 'Planning' ? (p.id === 'PR-103' ? 'In review' : 'In progress') : 'Not started',
      });
    });
    p.team.forEach((mid) => {
      const t = tpm[`${p.id}:${mid}`] || 0;
      p.alloc[mid] = pr ? Math.max(10, Math.round(((t / pr) * (0.85 + r() * 0.35)) / 5) * 5) : Math.round(budget / p.team.length / 5) * 5;
    });
    delete p.end;
  });

  return { members, projects, milestones, logs };
}
