import { optimistic } from '@/api/optimistic';
import { fromApiTeamTask, teamTasksApi, toApiTeamTask } from '@/api/teamTasks';

const msg = (e) => (e && e.message) || 'Something went wrong — try again';
const upsert = (arr, item) => ((arr || []).some((x) => x.id === item.id) ? arr.map((x) => (x.id === item.id ? item : x)) : [item].concat(arr || []));

/** Team tasks: given down the "Reports to" hierarchy (independent of projects). */
export const createTeamTasksSlice = (set, get) => ({
  /** Create / edit from the modal form. Returns an error message or undefined. */
  async saveTeamTask(f, editId) {
    if (!f.title.trim()) return 'Add a title.';
    if (!f.a) return 'Pick who this task is for.';
    let saved;
    try {
      const body = toApiTeamTask(f);
      const res = editId ? await teamTasksApi.update(editId, body) : await teamTasksApi.create(body);
      if (res && res.removed) {
        set((s) => ({ teamTasks: (s.teamTasks || []).filter((x) => x.id !== editId), modal: null }));
        get().flash('Task reassigned');
        return undefined;
      }
      saved = fromApiTeamTask(res);
    } catch (e) {
      return msg(e);
    }
    set((s) => ({ teamTasks: upsert(s.teamTasks, saved), modal: null }));
    get().flash(editId ? 'Task updated' : `Task given to ${saved.aName}`);
    return undefined;
  },

  /** Status / progress note (the assignee, or a manager). */
  async updateTeamTask(id, patch) {
    const body = {};
    if (patch.status !== undefined) body.status = patch.status;
    if (patch.upd !== undefined) body.updateNote = patch.upd;
    const res = await optimistic(
      set, get,
      (s) => ({ teamTasks: (s.teamTasks || []).map((x) => (x.id === id ? { ...x, ...patch } : x)) }),
      () => teamTasksApi.update(id, body),
    );
    if (res && !res.removed) set((s) => ({ teamTasks: upsert(s.teamTasks, fromApiTeamTask(res)) }));
    return !!res;
  },

  async delTeamTask(id) {
    const ok = await optimistic(set, get, (s) => ({ teamTasks: (s.teamTasks || []).filter((x) => x.id !== id) }), () => teamTasksApi.remove(id).then(() => true));
    if (ok) get().flash('Task deleted');
  },
});
