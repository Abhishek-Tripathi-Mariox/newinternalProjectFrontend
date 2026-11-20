import { viewReportees, viewUser } from '@/domain/permissions';

export const TT_STATUSES = ['To do', 'In progress', 'Reopened', 'Done'];
export const STATUS_HUE = { 'To do': 265, 'In progress': 70, Reopened: 25, Done: 150 };
/** Status choices from the current one: "Reopened" only from Done (or to stay Reopened). */
export const statusChoices = (cur) => TT_STATUSES.filter((x) => x !== 'Reopened' || cur === 'Done' || cur === 'Reopened').map((x) => ({ value: x, label: x }));
export const PRIO_HUE = { High: 25, Medium: 70, Low: 220 };

/** The user whose tasks we show: the previewed user, else the signed-in user. */
export const viewerId = (state) => state.viewAs || (state.auth && state.auth.uid) || null;

/** Super Admin previewing someone (the data is the Super Admin's, so filter it like the server would). */
export const isPreview = (state) => !!(state.viewAs && state.auth && state.viewAs !== state.auth.uid);

const FULL = { v: true, c: true, e: true, d: true, scope: 'all' };
const NO_TT = { v: false, c: false, e: false, d: false, scope: 'own' };

/** Team tasks permission ({v,c,e,d,scope}) of the viewer: the previewed user's role, else the signed-in session. */
export function ttPerm(state) {
  if (isPreview(state)) {
    const u = viewUser(state);
    if (!u) return NO_TT;
    if (u.role === 'r-super') return FULL;
    const r = (state.roles || []).find((x) => x.id === u.role);
    return (r && r.perms && r.perms.tt) || NO_TT;
  }
  const me = state.me;
  if (!me || me.isSuper || (me.role && me.role.id === 'r-super')) return FULL;
  return (me.role && me.role.perms && me.role.perms.tt) || NO_TT;
}

/** User ids below the viewer in "Reports to". */
export function teamIdsOf(state) {
  if (ttPerm(state).scope === 'own') return new Set();
  return new Set(viewReportees(state).map((r) => r.id).filter(Boolean));
}

/** Tasks the viewer may see (server already scopes real sessions; previews are filtered here). */
export function visibleTasks(state) {
  const all = state.teamTasks || [];
  if (!isPreview(state)) return all;
  const u = viewUser(state);
  if (!u) return [];
  const perm = ttPerm(state);
  if (!perm.v) return [];
  const boss = perm.scope === 'all';
  const team = teamIdsOf(state);
  // The flags came from the Super Admin's session: recompute them as the previewed user (same rules as the server).
  return all
    .filter((t) => boss || t.a === u.id || t.by === u.id || team.has(t.a))
    .map((t) => {
      const manager = boss || t.by === u.id || team.has(t.a);
      return { ...t, canEdit: manager && perm.e, canDelete: manager && perm.d, canStatus: (manager && perm.e) || t.a === u.id };
    });
}

/** Tabs: Assigned to me / Given by me / My team / All. */
export function tabTest(tab, me, team) {
  switch (tab) {
    case 'mine': return (t) => t.a === me;
    case 'given': return (t) => t.by === me && t.a !== me;
    case 'team': return (t) => team.has(t.a);
    default: return () => true;
  }
}

/** Preview-only assignee list (self + people below). Real sessions ask the server. */
export function previewAssignees(state) {
  const u = viewUser(state);
  if (!u) return [];
  const perm = ttPerm(state);
  if (!perm.c) return [];
  if (perm.scope === 'all') return (state.users || []).filter((x) => x.status === 'Active' && x.role !== 'r-client').map((x) => ({ id: x.id, name: x.name, self: x.id === u.id }));
  if (perm.scope === 'own') return [{ id: u.id, name: u.name, self: true }];
  return [{ id: u.id, name: u.name, self: true }].concat(viewReportees(state).filter((r) => r.id).map((r) => ({ id: r.id, name: r.name, role: r.role })));
}
