import { optimistic } from '@/api/optimistic';
import { fromApiTeamTask, teamTasksApi, toApiTeamTask } from '@/api/teamTasks';

const msg = (e) => (e && e.message) || 'Something went wrong — try again';
const upsert = (arr, item) => ((arr || []).some((x) => x.id === item.id) ? arr.map((x) => (x.id === item.id ? item : x)) : [item].concat(arr || []));

/** Team tasks: given down the "Reports to" hierarchy (independent of projects). */
export const createTeamTasksSlice = (set, get) => ({
  /**
   * Create / edit from the modal form. `f.atts` = the edited attachment list: saved docs
   * ({id}) and pending files ({file}); removed saved docs are deleted, pending ones uploaded.
   * Returns an error message or undefined.
   */
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
      const before = editId ? ((get().teamTasks || []).find((x) => x.id === editId) || {}).atts || [] : [];
      const keep = new Set((f.atts || []).filter((a) => a.id).map((a) => a.id));
      for (const d of before) if (!keep.has(d.id)) await teamTasksApi.removeDoc(d.id);
      const files = (f.atts || []).filter((a) => a.file).map((a) => a.file);
      for (let i = 0; i < files.length; i += 10) saved = fromApiTeamTask(await teamTasksApi.upload(saved.id, files.slice(i, i + 10)));
      if (before.some((d) => !keep.has(d.id)) && !files.length) saved = { ...saved, atts: saved.atts.filter((d) => keep.has(d.id)) };
    } catch (e) {
      if (saved) set((s) => ({ teamTasks: upsert(s.teamTasks, saved) }));
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

  /** Assignee / manager adds files straight from the list. */
  async attachTeamTask(id, files) {
    try {
      const res = await teamTasksApi.upload(id, files);
      set((s) => ({ teamTasks: upsert(s.teamTasks, fromApiTeamTask(res)) }));
      get().flash(`${files.length} file${files.length === 1 ? '' : 's'} attached`);
    } catch (e) {
      get().flash(msg(e));
    }
  },

  async delTeamTask(id) {
    const ok = await optimistic(set, get, (s) => ({ teamTasks: (s.teamTasks || []).filter((x) => x.id !== id) }), () => teamTasksApi.remove(id).then(() => true));
    if (ok) get().flash('Task deleted');
  },
});
