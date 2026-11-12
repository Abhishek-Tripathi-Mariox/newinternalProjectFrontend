/**
 * Delivery API: loader + DTO adapters for members, projects, milestones, tasks, bugs, change
 * requests and time logs. Store shapes are documented in CONTRACT.md → "Data shapes".
 */
import { ApiError, api, dayMs, download, getAll, ms, toDay } from './client';
import { fromApiDoc } from './files';

/* ───────────── Permissions ───────────── */

const isSuper = (me) => !!me && (me.isSuper || (me.role && me.role.id === 'r-super'));
/** Can the signed-in principal open module `mod` (view)? */
export const canView = (me, mod) => isSuper(me) || !!(me && me.role && me.role.perms && me.role.perms[mod] && me.role.perms[mod].v);

/* ───────────── Adapters: API → store ───────────── */

const tms = (v) => (v == null ? null : typeof v === 'number' ? v : ms(v));

export const fromApiMember = (m) => ({
  id: m.id, name: m.name, role: m.roleTitle || '', team: m.team, h: m.hue, shift: m.shiftHours || 8,
  ...(m.costPerHour != null ? { cost: m.costPerHour } : {}),
  ...(m.active === false ? { inactive: true } : {}),
});

/** Project DTO (list row or detail) → store project. `docs` kept from `prev` when the DTO has none. */
export function fromApiProject(p, prev) {
  const ids = (p.team || []).map((t) => t.memberId);
  const team = p.pmId ? [p.pmId].concat(ids.filter((x) => x !== p.pmId)) : ids;
  const alloc = {};
  (p.team || []).forEach((t) => { alloc[t.memberId] = t.allocHours || 0; });
  const docs = Array.isArray(p.documents) ? p.documents.map(fromApiDoc) : (prev && prev.docs) || [];
  return {
    id: p.id, name: p.name, client: p.client, clientEmail: p.clientEmail || '', service: (p.services || []).join(', '), status: p.status, pm: p.pmId, team,
    start: dayMs(p.startDate), due: dayMs(p.dueDate), value: p.value || 0, h: p.hue, prio: p.priority || 'Medium', alloc,
    brief: p.brief || '', links: (p.links || []).map((l) => ({ type: l.type, url: l.url })), docs,
    portal: p.portal ? { on: !!p.portal.on, ...(p.portal.token ? { token: p.portal.token } : {}) } : { on: false },
  };
}

export function fromApiMilestone(m) {
  const a = m.approval;
  return {
    id: m.id, p: m.projectId, n: m.n, name: m.name, alloc: m.allocHours || 0, due: dayMs(m.dueDate), status: m.status,
    ...(m.crId ? { cr: m.crId } : {}),
    ...(a && a.status ? { appr: { st: a.status, asked: tms(a.askedAt), at: tms(a.at), note: a.note || '' } } : {}),
  };
}

export const fromApiTask = (t) => ({
  id: t.id, p: t.projectId, ms: t.milestoneId || '', title: t.title, desc: t.description || '', a: t.assigneeId || '', st: t.status,
  prio: t.priority, due: dayMs(t.dueDate), est: t.estimateHours || 0, cl: t.checklist || [], created: tms(t.createdAt),
  ...(t.crId ? { cr: t.crId } : {}),
  log: (t.log || []).map((l) => ({ d: tms(l.d), t: l.t })),
});

export const fromApiBug = (b, prev) => ({
  id: b.id, p: b.projectId, ms: b.milestoneId || '', title: b.title, dept: b.dept, env: b.env, sev: b.severity, prio: b.priority, st: b.status,
  a: b.assigneeId || '', rep: b.reporter, repDate: dayMs(b.reportedOn), due: dayMs(b.dueDate), build: b.build || '', steps: b.steps || '',
  exp: b.expected || '', act: b.actual || '', link: b.link || '',
  atts: Array.isArray(b.attachments) ? b.attachments.map(fromApiDoc) : (prev && prev.atts) || [],
  log: Array.isArray(b.events) ? b.events.map((e) => ({ t: e.text, d: tms(e.at) })) : (prev && prev.log) || [],
});

export const fromApiCr = (c, prev) => ({
  id: c.id, p: c.projectId, n: c.n, title: c.title, desc: c.description || '', by: c.requestedBy, reqBy: c.requestedByName || '',
  hours: c.hours, rate: c.rate, amount: c.amount, days: c.extraDays || 0, prio: c.priority, target: c.target || 'new', status: c.status,
  raised: tms(c.raisedAt), sentAt: tms(c.sentAt), decidedAt: tms(c.decidedAt), doneAt: tms(c.doneAt), ms: c.milestoneId || null,
  team: c.team || [], tasks: (c.tasks || []).map((t) => ({ t: t.title, a: t.assigneeId || '', h: t.hours || 0 })),
  note: c.note || '',
  ...(c.signature ? { sig: { name: c.signature.name, title: c.signature.title || '', at: tms(c.signature.at), via: c.signature.via || '', note: c.signature.note || '' } } : {}),
  docs: Array.isArray(c.documents) ? c.documents.map(fromApiDoc) : (prev && prev.docs) || [],
  hist: Array.isArray(c.history) ? c.history.map((h) => ({ t: tms(h.at), text: h.text })) : (prev && prev.hist) || [],
});

export const fromApiLog = (l) => ({
  id: l.id, m: l.memberId, p: l.projectId, ms: l.milestoneId || '', d: dayMs(l.date || l.day), h: l.hours, note: l.note || '',
});

/* ───────────── Adapters: store / form → API ───────────── */

const PROJECT_FIELDS = { name: 'name', client: 'client', clientEmail: 'clientEmail', status: 'status', pm: 'pmId', value: 'value', prio: 'priority', brief: 'brief' };
/** updProj patch → PATCH /projects/:id body. */
export function toApiProjectPatch(patch) {
  const b = {};
  Object.entries(PROJECT_FIELDS).forEach(([k, f]) => { if (patch[k] !== undefined) b[f] = patch[k]; });
  if (patch.service !== undefined) b.services = String(patch.service).split(',').map((x) => x.trim()).filter(Boolean);
  if (patch.start !== undefined) b.startDate = toDay(patch.start);
  if (patch.due !== undefined) b.dueDate = toDay(patch.due);
  return b;
}

/** New-project form → POST /projects body. */
export const toApiProject = (m) => ({
  name: m.name || '', client: m.client || '', clientEmail: (m.clientEmail || '').trim(), services: String(m.service || '').split(',').map((x) => x.trim()).filter(Boolean),
  status: m.status, pmId: m.pm || undefined, startDate: m.start || '', dueDate: m.due || '',
  ...(Array.isArray(m.ms) && m.ms.length
    ? { milestones: m.ms.map((r) => ({ name: (r.name || '').trim(), dueDate: r.due, allocHours: Math.max(0, +r.hours || 0) })) }
    : { budgetHours: +m.budget || 0 }),
  team: m.team || [],
  value: +m.value || 0, priority: m.prio || 'Medium', brief: m.brief || '', links: (m.links || []).map((l) => ({ type: l.type, url: l.url || '' })),
});

/** updMs patch → PATCH /milestones/:id body. */
export function toApiMilestonePatch(patch) {
  const b = {};
  if (patch.name !== undefined) b.name = patch.name;
  if (patch.alloc !== undefined) b.allocHours = Math.max(0, +patch.alloc || 0);
  if (patch.status !== undefined) b.status = patch.status;
  if (patch.due !== undefined) b.dueDate = toDay(patch.due);
  return b;
}

const TASK_FIELDS = { title: 'title', desc: 'description', p: 'projectId', ms: 'milestoneId', a: 'assigneeId', st: 'status', prio: 'priority', cl: 'checklist' };
/** Task patch / form → task body. `due` may be ms or 'YYYY-MM-DD'. */
export function toApiTask(m) {
  const b = {};
  Object.entries(TASK_FIELDS).forEach(([k, f]) => { if (m[k] !== undefined) b[f] = m[k]; });
  if (m.due !== undefined) b.dueDate = m.due == null || m.due === '' ? null : typeof m.due === 'number' ? toDay(m.due) : m.due;
  if (m.est !== undefined) b.estimateHours = +m.est || 0;
  if (b.checklist) b.checklist = b.checklist.map((x) => ({ t: x.t, done: !!x.done }));
  return b;
}

const BUG_FIELDS = {
  title: 'title', p: 'projectId', ms: 'milestoneId', dept: 'dept', env: 'env', sev: 'severity', prio: 'priority', st: 'status', a: 'assigneeId',
  rep: 'reporter', build: 'build', steps: 'steps', exp: 'expected', act: 'actual', link: 'link',
};
/** Bug patch / form → bug body. Days may be ms or 'YYYY-MM-DD'. */
export function toApiBug(m) {
  const b = {};
  Object.entries(BUG_FIELDS).forEach(([k, f]) => { if (m[k] !== undefined) b[f] = m[k]; });
  const day = (v) => (v == null || v === '' ? null : typeof v === 'number' ? toDay(v) : v);
  if (m.repDate !== undefined && m.repDate) b.reportedOn = day(m.repDate);
  if (m.due !== undefined) b.dueDate = day(m.due);
  return b;
}

/** CR modal form → CR body. */
export const toApiCr = (m) => ({
  title: m.title || '', description: m.desc || '', requestedBy: m.by || 'Client', requestedByName: m.reqBy || '', hours: +m.hours || 0,
  rate: +m.rate || 0, extraDays: Math.max(0, Math.round(+m.days || 0)), priority: m.prio || 'Medium', target: m.target || 'new',
  team: m.team || [], tasks: (m.tasks || []).map((t) => ({ title: t.t || '', assigneeId: t.a || null, hours: +t.h || 0 })),
});

/** Project follow-up DTO → store shape (mirrors sales follow-ups: due ms, dur, remind, prio, meet). */
export const fromApiPfu = (f) => ({
  id: f.id, p: f.projectId, type: f.type, title: f.title, owner: f.ownerId, due: ms(f.dueAt), dur: f.durationMin || 0,
  remind: f.remindMin || 0, prio: f.priority, meet: f.meetUrl || '', attendees: f.attendees || '', notes: f.notes || '',
  done: !!f.done, notified: !!f.notified, createdBy: f.createdBy || null,
});

/** Project follow-up modal form → API body. */
export function toApiPfu(m) {
  const due = new Date(`${m.date}T${m.time}`);
  return {
    projectId: m.pid, type: m.type, title: m.title || '', ownerId: m.owner || undefined,
    dueAt: Number.isNaN(due.getTime()) ? '' : due.toISOString(), durationMin: +m.dur || 0, remindMin: +m.remind || 0,
    priority: m.prio, meetUrl: m.meet ? (m.meetUrl || '').trim() : '', attendees: m.attendees || '', notes: m.notes || '',
  };
}

/** Log-hours form → POST /time-logs body. */
export const toApiLogs = (m) => ({
  memberId: m.member || undefined, date: m.date || '',
  rows: (m.rows || []).map((r) => ({ projectId: r.p || '', milestoneId: r.ms || null, hours: r.h === '' ? 0 : +r.h || 0, note: r.note || '' })),
});

/** Projects filter bar (pj.f) → time-log filters (export). */
export function logFilters(f = {}) {
  const q = { member: f.member, project: f.project, team: f.team, date: f.date || 'week' };
  if (f.date === 'custom') Object.assign(q, { from: f.from, to: f.to });
  return q;
}

/** Download the timesheet CSV for the current filters. */
export const exportLogs = (f) => download('/time-logs/export.csv', logFilters(f));

/* ───────────── Loader ───────────── */

const optional = (p) => p.catch((e) => {
  if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return null;
  throw e;
});

/** Milestones of the given projects: GET /milestones, falling back to one call per project. */
async function loadMilestones(projectIds) {
  try {
    return await getAll('/milestones');
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  }
  const per = await Promise.all(projectIds.map((id) => optional(api.get(`/projects/${id}/milestones`))));
  return per.flatMap((x) => x || []);
}

/** Fill in children the list endpoint didn't embed (older API without ?include=). */
async function fillMissing(rows, has, fetchOne) {
  const miss = rows.filter((r) => !has(r));
  if (!miss.length) return rows;
  const full = await Promise.all(miss.map((r) => optional(fetchOne(r.id))));
  const byId = Object.fromEntries(full.filter(Boolean).map((d) => [d.id, d]));
  return rows.map((r) => (byId[r.id] ? { ...r, ...byId[r.id] } : r));
}

/**
 * Bootstrap the delivery domain → `{ members, projects, milestones, tasks, bugs, crs, logs }`.
 * Modules the role can't view are skipped (empty lists).
 */
export async function loadDelivery(me) {
  const vProj = canView(me, 'projects');
  const isClient = !!(me && me.role && me.role.id === 'r-client');
  const [memberRows, projectRows, taskRows, bugRows, crRows, logRows, pfuRows] = await Promise.all([
    api.get('/members'),
    vProj ? getAll('/projects', { include: 'documents', period: 'all' }) : [],
    canView(me, 'tasks') ? getAll('/tasks') : [],
    canView(me, 'bugs') ? getAll('/bugs', { include: 'events,attachments', quick: 'all', allTime: true }) : [],
    vProj ? optional(getAll('/change-requests', { include: 'history,documents' })) : [],
    canView(me, 'ts') ? optional(getAll('/time-logs')) : [],
    vProj && !isClient ? optional(getAll('/project-follow-ups')) : [],
  ]);

  const [projectsFull, msRows, bugsFull, crsFull] = await Promise.all([
    fillMissing(projectRows, (p) => Array.isArray(p.documents), (id) => api.get(`/projects/${id}`)),
    vProj ? loadMilestones(projectRows.map((p) => p.id)) : [],
    fillMissing(bugRows, (b) => Array.isArray(b.events) && Array.isArray(b.attachments), (id) => api.get(`/bugs/${id}`)),
    fillMissing(crRows || [], (c) => Array.isArray(c.history) && Array.isArray(c.documents), (id) => api.get(`/change-requests/${id}`)),
  ]);

  return {
    members: (memberRows || []).map(fromApiMember),
    projects: projectsFull.map((p) => fromApiProject(p)),
    milestones: msRows.map(fromApiMilestone),
    tasks: taskRows.map(fromApiTask),
    bugs: bugsFull.map((b) => fromApiBug(b)),
    crs: crsFull.map((c) => fromApiCr(c)),
    logs: (logRows || []).map(fromApiLog),
    pfus: (pfuRows || []).map(fromApiPfu),
  };
}
