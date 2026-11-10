import { MODULES } from '@/config/constants';
import { DAY, HOUR, today } from '@/lib/date';

/* Users, roles and audit seed — port of the prototype's seedUsers(). */

/** Permission cell helper: P(view, create, edit, delete, scope). */
const P = (v, c, e, d, scope) => ({ v: !!v, c: !!c, e: !!e, d: !!d, scope: scope || 'all' });

/** Build the built-in roles. */
export function seedRoles() {
  const N = P(0, 0, 0, 0);
  const all = P(1, 1, 1, 1);
  const mods = MODULES.map((m) => m[0]);
  const mk = (o) => {
    const p = {};
    mods.forEach((k) => { p[k] = o[k] || N; });
    return p;
  };
  const allMods = () => Object.fromEntries(mods.map((k) => [k, all]));
  return [
    { id: 'r-super', name: 'Super Admin', desc: 'Full access to everything, including roles', h: 265, locked: true, perms: mk(allMods()) },
    { id: 'r-admin', name: 'Admin', desc: 'Everything except deleting users', h: 220, perms: mk({ ...allMods(), users: P(1, 1, 1, 0) }) },
    { id: 'r-sm', name: 'Sales Manager', desc: 'Owns the pipeline and the sales team', h: 150, perms: mk({ dash: P(1), leads: all, fu: all, projects: P(1) }) },
    { id: 'r-se', name: 'Sales Executive', desc: 'Works their own leads and follow-ups', h: 190, perms: mk({ dash: P(1, 0, 0, 0, 'own'), leads: P(1, 1, 1, 0, 'own'), fu: P(1, 1, 1, 1, 'own') }) },
    { id: 'r-pm', name: 'Project Manager', desc: 'Runs projects, milestones, tasks and the team', h: 300, perms: mk({ projects: P(1, 1, 1, 0), tasks: all, bugs: all, ts: P(1, 1, 1, 0), team: P(1, 0, 1, 0), fu: P(1, 1, 1, 0, 'own') }) },
    { id: 'r-tl', name: 'Team Lead', desc: 'Leads a team, assigns tasks, reviews hours', h: 70, perms: mk({ projects: P(1, 0, 0, 0, 'team'), tasks: P(1, 1, 1, 0, 'team'), bugs: P(1, 1, 1, 0, 'team'), ts: P(1, 1, 1, 0, 'team'), team: P(1, 0, 0, 0, 'team') }) },
    { id: 'r-tm', name: 'Team Member', desc: 'Developers and designers', h: 250, perms: mk({ projects: P(1, 0, 0, 0, 'own'), tasks: P(1, 0, 1, 0, 'own'), bugs: P(1, 1, 1, 0, 'own'), ts: P(1, 1, 1, 0, 'own') }) },
    { id: 'r-qa', name: 'QA Engineer', desc: 'Reports, retests and closes bugs', h: 25, perms: mk({ projects: P(1, 0, 0, 0, 'team'), tasks: P(1, 0, 0, 0, 'team'), bugs: all, ts: P(1, 1, 1, 0, 'own') }) },
    { id: 'r-client', name: 'Client', desc: 'External · sees their project, reports bugs', h: 45, perms: mk({ projects: P(1, 0, 0, 0, 'own'), bugs: P(1, 1, 0, 0, 'own') }) },
  ];
}

/** first.last@marioxsoftware.com */
const emailOf = (n) => `${n.toLowerCase().split(' ')[0]}.${n.toLowerCase().split(' ')[1] || 'user'}@marioxsoftware.com`;

/**
 * @param {object[]} members delivery members
 * @param {object[]} owners sales owners
 */
export function seedUsers(members, owners) {
  const D = DAY;
  const T = today();
  const now = Date.now();
  const roles = seedRoles();

  const users = [{ id: 'u-ceo', name: 'CEO', email: 'ceo@marioxsoftware.com', phone: '', title: 'Chief Executive Officer', role: 'r-super', dept: 'Management', reports: '', join: T - 900 * D, status: 'Active', last: now, h: 265 }];
  owners.forEach((o, i) => users.push({
    id: `u-${o.id}`, name: o.name, email: emailOf(o.name), phone: '', title: i === 0 ? 'Sales Head' : 'Business Development Executive',
    role: i === 0 ? 'r-sm' : 'r-se', dept: 'Sales', reports: i === 0 ? 'u-ceo' : `u-${owners[0].id}`, join: T - (400 - i * 50) * D,
    status: 'Active', last: now - (i * 3 + 1) * HOUR, h: o.h, ownerId: o.id,
  }));
  members.forEach((m, i) => {
    const role = m.team === 'PMO' ? 'r-pm' : m.id === 'rj' ? 'r-tl' : m.team === 'QA' ? 'r-qa' : 'r-tm';
    const reports = role === 'r-pm' ? 'u-ceo' : role === 'r-tl' ? 'u-mj' : m.team === 'Web' ? 'u-rj' : `u-${i % 2 ? 'mj' : 'na'}`;
    users.push({
      id: `u-${m.id}`, name: m.name, email: emailOf(m.name), phone: '', title: m.role, role, dept: m.team, reports,
      join: T - (600 - i * 37) * D, status: 'Active', last: now - (((i * 7) % 30) + 1) * HOUR, h: m.h, memberId: m.id, shift: m.shift || 8,
    });
  });
  users.push({ id: 'u-inv1', name: 'Kunal Verma', email: 'kunal.verma@marioxsoftware.com', phone: '', title: 'React Native Developer', role: 'r-tm', dept: 'Mobile', reports: 'u-mj', join: T + 7 * D, status: 'Invited', invited: T - 2 * D, last: 0, h: 170 });
  users.push({ id: 'u-inv2', name: 'Ritika Sen', email: 'ritika.sen@marioxsoftware.com', phone: '', title: 'HR & Operations', role: 'r-admin', dept: 'HR', reports: 'u-ceo', join: T + 3 * D, status: 'Invited', invited: T - D, last: 0, h: 20 });
  users.push({ id: 'u-old', name: 'Amit Joshi', email: 'amit.joshi@marioxsoftware.com', phone: '', title: 'PHP Developer', role: 'r-tm', dept: 'Web', reports: 'u-rj', join: T - 700 * D, status: 'Deactivated', last: T - 46 * D, h: 110 });
  users.push({ id: 'u-cl1', name: 'Swiftcart Retail', email: 'pm@swiftcart.in', phone: '', title: 'Client contact', role: 'r-client', dept: '', reports: 'u-mj', join: T - 70 * D, status: 'Active', last: T - 2 * D, h: 150, clientOf: ['PR-101'] });

  const audit = [
    { d: T - 2 * D + 36e6, actor: 'CEO', text: 'invited Kunal Verma as Team Member', kind: 'Invite' },
    { d: T - D + 40e6, actor: 'CEO', text: 'invited Ritika Sen as Admin', kind: 'Invite' },
    { d: T - 46 * D, actor: 'CEO', text: 'deactivated Amit Joshi', kind: 'Access' },
    { d: T - 20 * D, actor: 'CEO', text: 'changed Rajat Sharma from Team Member to Team Lead', kind: 'Role' },
    { d: T - 12 * D, actor: 'Meera Joshi', text: 'gave Swiftcart Retail client access to Swiftcart Grocery App', kind: 'Access' },
  ];
  return { users, roles, audit };
}
