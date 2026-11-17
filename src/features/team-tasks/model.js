import { viewReportees, viewUser } from '@/domain/permissions';

export const TT_STATUSES = ['To do', 'In progress', 'Done'];
export const STATUS_HUE = { 'To do': 265, 'In progress': 70, Done: 150 };
export const PRIO_HUE = { High: 25, Medium: 70, Low: 220 };

/** The user whose tasks we show: the previewed user, else the signed-in user. */
export const viewerId = (state) => state.viewAs || (state.auth && state.auth.uid) || null;

/** Super Admin previewing someone (the data is the Super Admin's, so filter it like the server would). */
export const isPreview = (state) => !!(state.viewAs && state.auth && state.viewAs !== state.auth.uid);

const isBossRole = (role) => role === 'r-super' || role === 'r-admin';

/** User ids below the viewer in "Reports to". */
export function teamIdsOf(state) {
  return new Set(viewReportees(state).map((r) => r.id).filter(Boolean));
}

/** Tasks the viewer may see (server already scopes real sessions; previews are filtered here). */
export function visibleTasks(state) {
  const all = state.teamTasks || [];
  if (!isPreview(state)) return all;
  const u = viewUser(state);
  if (!u) return [];
  const boss = isBossRole(u.role);
  const team = teamIdsOf(state);
  // The flags came from the Super Admin's session: recompute them as the previewed user (same rules as the server).
  return all
    .filter((t) => boss || t.a === u.id || t.by === u.id || team.has(t.a))
    .map((t) => {
      const manager = boss || t.by === u.id || team.has(t.a);
      return { ...t, canEdit: manager, canDelete: manager, canStatus: manager || t.a === u.id };
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
  if (isBossRole(u.role)) return (state.users || []).filter((x) => x.status === 'Active' && x.role !== 'r-client').map((x) => ({ id: x.id, name: x.name, self: x.id === u.id }));
  return [{ id: u.id, name: u.name, self: true }].concat(viewReportees(state).filter((r) => r.id).map((r) => ({ id: r.id, name: r.name, role: r.role })));
}
