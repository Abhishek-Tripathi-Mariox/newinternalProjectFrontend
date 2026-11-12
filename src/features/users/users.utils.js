/**
 * Users & roles — feature-local constants and pure helpers (ported from the
 * original `uv()` / `openUser()` logic).
 */
import { MODULES } from '@/config/constants';

export const DEPARTMENTS = ['Management', 'Sales', 'PMO', 'Web', 'Mobile', 'Backend', 'Design', 'QA', 'HR', 'Finance'];

export const USER_STATUSES = ['Active', 'Invited', 'Deactivated'];
/** Hue per user status. */
export const STATUS_HUE = { Active: 150, Invited: 70, Deactivated: 265 };
/** Hue per audit-log kind. */
export const LOG_KIND_HUE = { Invite: 70, Role: 300, Access: 25, Profile: 250, Credentials: 150 };

/** Roles that become delivery members (Team & hours, timesheets). */
export const DELIVERY_ROLES = ['r-pm', 'r-tl', 'r-tm', 'r-qa'];
/** Roles that can be picked under "Reports to". */
export const MANAGER_ROLES = ['r-super', 'r-admin', 'r-sm', 'r-pm', 'r-tl'];
/** Department auto-selected when a role is picked (r-admin keeps the current one). */
export const ROLE_DEPT = { 'r-sm': 'Sales', 'r-se': 'Sales', 'r-pm': 'PMO', 'r-qa': 'QA', 'r-super': 'Management' };

/** Super Admin accounts and your own account can't be previewed, deactivated or deleted from the list. */
export const isProtectedUser = (u, myId) => !!u && (u.id === myId || u.role === 'r-super');

export const PERM_ACTIONS = [['v', 'View'], ['c', 'Create'], ['e', 'Edit'], ['d', 'Delete']];
export const DATA_SCOPES = [
  ['all', 'All', 'All records'],
  ['team', 'Team', 'Only their team’s records'],
  ['own', 'Own', 'Only records they own or are assigned'],
];
export const EMPTY_PERM = { v: false, c: false, e: false, d: false, scope: 'all' };
export const permOf = (role, mod) => ({ ...EMPTY_PERM, ...(role?.perms?.[mod] || {}) });

export const isDeliveryRole = (roleId) => DELIVERY_ROLES.includes(roleId);

/** "Can open: Leads, Follow-ups" or "No modules enabled". */
export function roleSummary(role) {
  if (!role) return '';
  const v = MODULES.filter(([k]) => role.perms?.[k]?.v).map((m) => m[1]);
  return v.length ? `Can open: ${v.join(', ')}` : 'No modules enabled';
}

const statusRank = (s) => USER_STATUSES.indexOf(s);

/** Sort: status (Active → Invited → Deactivated), then role order, then name. */
export function sortUsers(users, roles) {
  const ri = (id) => roles.findIndex((r) => r.id === id);
  return [...users].sort(
    (a, b) => statusRank(a.status) - statusRank(b.status) || ri(a.role) - ri(b.role) || a.name.localeCompare(b.name),
  );
}

export function filterUsers(users, f) {
  const q = (f.q || '').trim().toLowerCase();
  return users.filter(
    (u) =>
      (!q || `${u.name} ${u.email} ${u.title || ''}`.toLowerCase().includes(q)) &&
      (!f.role || u.role === f.role) &&
      (!f.dept || u.dept === f.dept) &&
      (!f.status || u.status === f.status),
  );
}

/** "Projects" column text. */
export function projectsText(u, leads, projects) {
  if (u.clientOf) return `${u.clientOf.length} (client)`;
  if (u.ownerId) return `${leads.filter((l) => l.owner === u.ownerId).length} leads`;
  if (u.memberId) {
    const active = projects.filter((p) => (p.team || []).includes(u.memberId) && ['Running', 'On hold', 'Planning'].includes(p.status));
    const pm = projects.filter((p) => p.pm === u.memberId).length;
    return `${active.length} active${pm ? ` · PM on ${pm}` : ''}`;
  }
  return '—';
}

/** Read a value from either a native change event or a plain value (UI-kit agnostic). */
export const valueOf = (e) => (e && e.target ? e.target.value : e);
export const checkedOf = (e) => (e && e.target ? e.target.checked : !!e);
