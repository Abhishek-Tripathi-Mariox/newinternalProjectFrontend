/**
 * People API: users, roles, audit log — loader, endpoint calls and DTO adapters.
 * Store shapes (CONTRACT.md → Data shapes):
 *   user  {id,name,email,phone,title,role,dept,reports,join,status,last,h,ownerId?,memberId?,clientOf?[],shift,invited?}
 *   role  {id,name,desc,h,locked?,perms{[module]:{v,c,e,d,scope}}, users?}
 *   audit {d,actor,text,kind}
 */
import { api, getAll, ms, dayMs } from './client';

const isSuper = (me) => !!me && (me.isSuper || (me.role && me.role.id === 'r-super'));
const canUsers = (me) => isSuper(me) || !!(me && me.role && me.role.perms && me.role.perms.users && me.role.perms.users.v);

/** API user DTO → store user. */
export function fromApiUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone || '',
    title: u.title || '',
    role: u.role,
    dept: u.dept || '',
    reports: u.reportsTo || '',
    join: dayMs(u.joinDate),
    status: u.status,
    last: ms(u.lastActiveAt) || 0,
    invited: ms(u.invitedAt) || ms(u.createdAt) || 0,
    h: u.hue ?? 265,
    memberId: u.memberId || undefined,
    ownerId: u.ownerId || undefined,
    // Only clients carry a project list (UsersTable shows "N (client)" when present).
    clientOf: u.role === 'r-client' ? u.clientOf || [] : undefined,
    shift: u.shiftHours || 8,
  };
}

/** The signed-in principal (`me` from /auth/login|refresh) → store user, for roles that can't list users. */
export function userFromMe(me) {
  const role = me.role || {};
  return {
    id: me.id,
    name: me.name,
    email: me.email,
    phone: '',
    title: me.title || '',
    role: role.id,
    dept: me.dept || me.team || '',
    reports: '',
    join: null,
    status: me.status || 'Active',
    last: Date.now(),
    invited: 0,
    h: me.hue ?? 265,
    memberId: me.memberId || undefined,
    ownerId: me.ownerId || undefined,
    clientOf: role.id === 'r-client' ? me.clientOf || [] : undefined,
    shift: me.shiftHours || 8,
  };
}

/** User modal form → API body. */
export function toApiUser(m) {
  const shift = +m.shift || 8;
  return {
    name: (m.name || '').trim(),
    email: (m.email || '').trim(),
    phone: (m.phone || '').trim(),
    title: (m.title || '').trim(),
    role: m.role,
    dept: m.dept || '',
    reportsTo: m.reports || null,
    joinDate: m.join ? String(m.join).slice(0, 10) : null,
    shiftHours: Math.min(24, Math.max(1, shift)),
  };
}

export const fromApiRole = (r) => ({
  id: r.id,
  name: r.name,
  desc: r.description || '',
  h: r.hue ?? 265,
  locked: !!r.locked,
  perms: r.perms || {},
  users: r.userCount,
});

const fromApiAudit = (e) => ({ id: e.id, d: ms(e.at), actor: e.actor || 'CEO', text: e.text, kind: e.kind });

/** Bootstrap: users, roles and the audit log (or just the signed-in person for roles without Users access). */
export async function loadPeople(me) {
  const self = me ? userFromMe(me) : null;
  if (!canUsers(me)) {
    return {
      users: self ? [self] : [],
      roles: me && me.role ? [{ id: me.role.id, name: me.role.name, desc: '', h: 265, locked: me.role.id === 'r-super', perms: me.role.perms || {} }] : [],
      audit: [],
    };
  }
  const [users, roles, audit] = await Promise.all([
    getAll('/users').then((rows) => rows.map(fromApiUser)),
    api.get('/roles').then((rows) => (rows || []).map(fromApiRole)),
    getAll('/audit-logs').then((rows) => rows.map(fromApiAudit)).catch(() => []),
  ]);
  if (self && !users.some((u) => u.id === self.id)) users.push(self);
  if (me && me.role && !roles.some((r) => r.id === me.role.id)) {
    roles.push({ id: me.role.id, name: me.role.name, desc: '', h: 265, locked: me.role.id === 'r-super', perms: me.role.perms || {} });
  }
  return { users, roles, audit };
}

/** Latest audit entries (after a write). */
export async function fetchAudit() {
  return (await getAll('/audit-logs')).map(fromApiAudit);
}

export const peopleApi = {
  createUser: (body) => api.post('/users', body),
  updateUser: (id, body) => api.patch(`/users/${id}`, body),
  deactivate: (id) => api.post(`/users/${id}/deactivate`),
  reactivate: (id) => api.post(`/users/${id}/reactivate`),
  deleteUser: (id) => api.del(`/users/${id}`),
  resendInvite: (id) => api.post(`/users/${id}/resend-invite`),
  resetPassword: (id) => api.post(`/users/${id}/reset-password`),
  forceLogout: (id) => api.post(`/users/${id}/force-logout`),
  createRole: (body = {}) => api.post('/roles', body),
  duplicateRole: (id) => api.post(`/roles/${id}/duplicate`),
  updateRole: (id, body) => api.patch(`/roles/${id}`, body),
  deleteRole: (id) => api.del(`/roles/${id}`),
};
