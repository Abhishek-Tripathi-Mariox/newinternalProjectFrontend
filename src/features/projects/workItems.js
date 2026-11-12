/**
 * Pure helpers shared by the task / bug views (cards, boards, lists, member
 * drawer, modals). Owned by the Tasks/Bugs/Team port — keep this free of React
 * so it can be reused by any feature (and keeps react-refresh happy).
 */
import { DAY, fday, dLabel, sod } from '@/lib/date';
import { MUTED, RED } from '@/lib/color';
import { initials, plural } from '@/lib/format';
import { TASK_STATUS, BUG_STATUS, BUG_SEVERITY, PRIORITIES } from '@/config/constants';
import { serverNow } from '@/lib/clock';

export const TASK_STATUS_KEYS = Object.keys(TASK_STATUS);
export const BUG_STATUS_KEYS = Object.keys(BUG_STATUS);

/** Saturated status dot (board column marker / chip dot). */
export const statusDot = (h) => `oklch(0.62 0.15 ${h ?? 265})`;

/** Placeholder avatar for unassigned items. */
export const UNASSIGNED = { name: 'Unassigned', ini: '?', bg: 'oklch(0.95 0.004 85)', fg: MUTED };

/** Avatar from a member record (or the "Unassigned" placeholder). */
export function memberAvatar(m) {
  if (!m) return UNASSIGNED;
  return { id: m.id, name: m.name, role: m.role, team: m.team, ini: initials(m.name), bg: `oklch(0.92 0.05 ${m.h})`, fg: `oklch(0.38 0.12 ${m.h})` };
}

/** Priority pill colours (tasks). */
export const prioTone = (prio) => {
  const h = PRIORITIES[prio] ?? 220;
  return { bg: `oklch(0.95 0.035 ${h})`, fg: `oklch(0.45 0.13 ${h})` };
};

/** Severity pill colours (bugs). */
export const sevTone = (sev) => {
  const h = BUG_SEVERITY[sev] ?? 220;
  return { bg: `oklch(0.95 0.04 ${h})`, fg: `oklch(0.45 0.15 ${h})`, dot: `oklch(0.62 0.17 ${h})` };
};

export const msShort = (ms) => (ms ? `M${ms.n} · ${ms.name}` : '—');

// ───────────────────────── Tasks ─────────────────────────
export const isTaskOpen = (t) => t.st !== 'Done';
export const isTaskOverdue = (t, T = sod(serverNow())) => isTaskOpen(t) && !!t.due && t.due < T;

const prioRank = (p) => (PRIORITIES[p] === 25 ? 0 : PRIORITIES[p] === 70 ? 1 : 2);
/** High → Medium → Low, then earliest due first. */
export const taskSort = (a, b) => prioRank(a.prio) - prioRank(b.prio) || (a.due || Infinity) - (b.due || Infinity);

export function taskDue(t, T = sod(serverNow())) {
  const od = isTaskOverdue(t, T);
  const dd = t.due ? Math.round((t.due - T) / DAY) : null;
  const label = !t.due ? 'No due date' : t.st === 'Done' ? fday(t.due) : od ? `Overdue · ${fday(t.due)}` : dd === 0 ? 'Due today' : dd === 1 ? 'Tomorrow' : fday(t.due);
  return { label, color: od ? RED : MUTED, overdue: od };
}

export const taskChecklist = (t) => {
  const cl = t.cl || [];
  return { has: cl.length > 0, label: `${cl.filter((x) => x.done).length}/${cl.length}` };
};

/** Quick-filter predicates for the task chips. `weekEnd` = end of this week. */
export function taskFilters(T, weekEnd) {
  return {
    '': () => true,
    mine: () => true,
    overdue: (t) => isTaskOverdue(t, T),
    week: (t) => isTaskOpen(t) && t.due >= T && t.due < weekEnd,
    high: (t) => isTaskOpen(t) && t.prio === 'High',
    blocked: (t) => t.st === 'Blocked',
    unassigned: (t) => !t.a,
  };
}

// ───────────────────────── Bugs ─────────────────────────
export const isBugOpen = (b) => b.st !== 'Closed' && b.st !== 'Fixed';
export const isBugOverdue = (b, T = sod(serverNow())) => isBugOpen(b) && !!b.due && b.due < T;

const SEV_RANK = { Critical: 0, Major: 1, Minor: 2, Trivial: 3 };
/** Most severe first, then earliest due. */
export const bugSort = (a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev] || (a.due || Infinity) - (b.due || Infinity);

export function bugDue(b, T = sod(serverNow())) {
  const od = isBugOverdue(b, T);
  const dd = b.due ? Math.round((b.due - T) / DAY) : null;
  const label = !b.due ? '—' : !isBugOpen(b) ? fday(b.due) : od ? `Overdue · ${fday(b.due)}` : dd === 0 ? 'Due today' : dd === 1 ? 'Tomorrow' : fday(b.due);
  return { label, color: od ? RED : MUTED, overdue: od };
}

/** When the bug was closed (last log entry), or today. */
export const bugClosedAt = (b, T) => ((b.log || []).slice(-1)[0] || {}).d || T;

/** "3d open" / "Closed in 2d". */
export function bugAge(b, T = sod(serverNow())) {
  const end = isBugOpen(b) ? T : bugClosedAt(b, T);
  const age = Math.max(0, Math.round((sod(end) - b.repDate) / DAY));
  return isBugOpen(b) ? `${age}d open` : `Closed in ${age}d`;
}

export const bugReporter = (b, MEM) => (b.rep === 'client' ? 'Client' : (MEM[b.rep] || {}).name || '—');

export const bugReported = (b) => dLabel(b.repDate);

export const attachmentLabel = (n) => plural(n, 'attachment');

/** Quick-filter predicates for the bug chips / KPIs. */
export function bugFilters(T) {
  return {
    '': () => true,
    open: isBugOpen,
    overdue: (b) => isBugOverdue(b, T),
    critical: (b) => isBugOpen(b) && b.sev === 'Critical',
    reopened: (b) => b.st === 'Reopened',
    unassigned: (b) => !b.a,
    closed: (b) => b.st === 'Closed',
  };
}

/** Lookup map by id. */
export const byId = (list = []) => {
  const o = {};
  list.forEach((x) => { o[x.id] = x; });
  return o;
};
