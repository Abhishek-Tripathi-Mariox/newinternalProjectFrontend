import { dLabel, parseDay } from '@/lib/date';
import { attachedMessage } from '@/domain/files';
import { api, openPrint, toDay } from '@/api/client';
import { optimistic } from '@/api/optimistic';
import { fromApiDoc, isPending, pendingFiles, syncDocs, uploadPending } from '@/api/files';
import {
  exportLogs, fromApiBug, fromApiCr, fromApiLog, fromApiMilestone, fromApiProject, fromApiTask,
  toApiBug, toApiCr, toApiLogs, toApiMilestonePatch, toApiProject, toApiProjectPatch, toApiTask, fromApiPfu, toApiPfu,
} from '@/api/delivery';
import { mapById, patchById, memberName } from '../helpers';
import { serverNow } from '@/lib/clock';

const LINK_OK = /^https?:\/\//i;
const msg = (e) => (e && e.message) || 'Something went wrong — try again';
/** Server's client-email result (CLIENT_EMAILS) → flash suffix. Says nothing when client emails are off. */
const clientMailNote = (r) => {
  if (!r) return '';
  if (r.sent) return ` · emailed to ${r.to}`;
  if (r.reason === 'no-email') return ' · no email sent (add the client email to the project)';
  if (r.reason === 'failed') return ' · the email to the client failed';
  return '';
};
/** Replace by id, or append. */
const upsert = (arr, item) => ((arr || []).some((x) => x.id === item.id) ? arr.map((x) => (x.id === item.id ? item : x)) : (arr || []).concat(item));
const replaceMany = (arr, items) => items.reduce((a, x) => upsert(a, x), arr || []);

/** Debounced API calls for inputs that fire on every keystroke (milestone name/hours, allocation, links). */
const timers = new Map();
function debounce(key, fn, wait = 600) {
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => { timers.delete(key); fn(); }, wait));
}

/**
 * Delivery actions: projects, milestones, client portal, logs, tasks, bugs, change requests.
 * Every action calls the API (src/api/delivery.js adapters). Form saves are async and resolve to
 * an error message (the server's wording) or undefined; quick edits are optimistic.
 */
export const createDeliverySlice = (set, get) => {
  /** Merge a project detail DTO (+ its milestones when embedded). */
  const mergeProject = (dto) => {
    set((s) => {
      const prev = s.projects.find((p) => p.id === dto.id);
      const p = fromApiProject(dto, prev);
      const out = { projects: upsert(s.projects, p) };
      if (Array.isArray(dto.milestones)) {
        const ms = dto.milestones.map(fromApiMilestone);
        out.milestones = s.milestones.filter((m) => m.p !== dto.id).concat(ms);
      }
      return out;
    });
  };
  const mergeTask = (dto) => set((s) => ({ tasks: upsert(s.tasks, fromApiTask(dto)) }));
  const mergeBug = (dto) => set((s) => ({ bugs: upsert(s.bugs, fromApiBug(dto, s.bugs.find((b) => b.id === dto.id))) }));
  const mergeCr = (dto) => set((s) => ({ crs: upsert(s.crs, fromApiCr(dto, s.crs.find((c) => c.id === dto.id))) }));
  const resyncDelivery = () => get().resync(['delivery']).catch(() => {});
  const projectOf = (pid) => get().projects.find((p) => p.id === pid);

  return {
    /* ───────────── Projects ───────────── */

    /** Quick edit (status from the board / drawer). */
    updProj: (id, patch) => optimistic(set, get,
      (s) => ({ projects: patchById(s.projects, id, patch) }),
      async () => { const dto = await api.patch(`/projects/${id}`, toApiProjectPatch(patch)); mergeProject(dto); return dto; }),

    /**
     * Save the "Edit project" form. Sends only the fields that changed; returns an error message or undefined.
     * Budget comes from the milestones, and team / links / documents are edited in the drawer itself.
     */
    async editProj(id, m) {
      const p = projectOf(id);
      if (!p) return 'Project not found.';
      if (!String(m.name || '').trim()) return 'Enter a project name.';
      if (!String(m.client || '').trim()) return 'Enter the client name.';
      if (!String(m.service || '').trim()) return 'Pick at least one service.';
      if (!m.start || !m.due) return 'Pick a start date and a due date.';
      if (m.due < m.start) return 'The due date must be on or after the start date.';
      const next = { ...m, value: +m.value || 0 };
      const patch = {};
      if (m.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.clientEmail.trim())) return 'Enter a valid client email.';
      ['name', 'client', 'clientEmail', 'service', 'status', 'pm', 'value', 'prio', 'brief'].forEach((k) => {
        const v = typeof next[k] === 'string' ? next[k].trim() : next[k];
        if (v !== (p[k] ?? '')) patch[k] = v;
      });
      if (m.start !== toDay(p.start)) patch.start = m.start;
      if (m.due !== toDay(p.due)) patch.due = m.due;
      if (!Object.keys(patch).length) { set({ modal: null }); return undefined; }
      try {
        const body = toApiProjectPatch(patch);
        if (patch.start) body.startDate = patch.start;
        if (patch.due) body.dueDate = patch.due;
        mergeProject(await api.patch(`/projects/${id}`, body));
      } catch (e) {
        return msg(e);
      }
      set({ modal: null });
      get().flash(`Project updated · ${String(m.name).trim()}`);
      return undefined;
    },

    /**
     * Create a project from the new-project form
     * `{name, client, service, status, pm, start, due, budget, team[], value, prio, brief, links[{type,url}], atts}`.
     * The server generates the five template milestones and splits the budget across the team.
     */
    async saveProj(m) {
      const bad = (m.links || []).find((l) => l.url.trim() && !LINK_OK.test(l.url.trim()));
      if (bad) return `Links must start with https:// (check the ${bad.type} link).`;
      const noDate = (m.ms || []).findIndex((r) => !r.due);
      if (noDate >= 0) return `Pick a due date for milestone ${noDate + 1}.`;
      const early = (m.ms || []).findIndex((r) => m.start && r.due < m.start);
      if (early >= 0) return `Milestone ${early + 1} is due before the project starts.`;
      let dto;
      try {
        dto = await api.post('/projects', toApiProject(m));
      } catch (e) {
        return msg(e);
      }
      let upErr = '';
      try {
        await uploadPending(`/projects/${dto.id}/documents`, m.atts);
        if ((m.atts || []).some(isPending)) dto = await api.get(`/projects/${dto.id}`);
      } catch (e) {
        upErr = msg(e);
      }
      mergeProject(dto);
      set((s) => ({ modal: null, pj: { ...s.pj, selP: dto.id, selM: null } }));
      get().flash(upErr ? `Project created · ${dto.name} · files not uploaded: ${upErr}` : `Project created · ${dto.name}`);
      return undefined;
    },

    /** Local-only transform of a project's docs (fn(docs) → docs). Prefer the API actions below. */
    setProjDocs: (pid, fn) => set((s) => ({ projects: mapById(s.projects, pid, (p) => ({ ...p, docs: fn(p.docs || []) })) })),

    /** Upload files (FileList / File[]) to a project and flash the count. */
    async addProjDocs(pid, files) {
      const { atts, skipped } = pendingFiles(files);
      if (!atts.length) { get().flash(attachedMessage(0, skipped)); return; }
      try {
        const res = await uploadPending(`/projects/${pid}/documents`, atts);
        const docs = res.flat().map(fromApiDoc);
        get().setProjDocs(pid, (d) => d.concat(docs));
        get().flash(attachedMessage(docs.length, skipped));
      } catch (e) {
        get().flash(msg(e));
      } finally {
        atts.forEach((a) => URL.revokeObjectURL(a.url));
      }
    },
    /** Change a project document's kind. */
    setProjDocKind: (pid, docId, kind) => optimistic(set, get,
      (s) => ({ projects: mapById(s.projects, pid, (p) => ({ ...p, docs: (p.docs || []).map((d) => (d.id === docId ? { ...d, kind } : d)) })) }),
      () => api.patch(`/documents/${docId}`, { kind })),
    /** Delete a project document. */
    removeProjDoc: (pid, docId) => optimistic(set, get,
      (s) => ({ projects: mapById(s.projects, pid, (p) => ({ ...p, docs: (p.docs || []).filter((d) => d.id !== docId) })) }),
      () => api.del(`/documents/${docId}`)),

    /**
     * Save a project's links from the drawer editor. Valid http(s) links are stored on the
     * project (PUT /projects/:id/links, debounced while typing); incomplete ones are kept as a
     * draft in `pj.linkDraft`. Pass the full edited list (saved + draft).
     */
    setProjLinks(pid, links) {
      const ok = links.filter((l) => LINK_OK.test(l.url.trim())).map((l) => ({ type: l.type, url: l.url.trim() }));
      const rest = links.filter((l) => !LINK_OK.test(l.url.trim()));
      const before = (projectOf(pid) || {}).links || [];
      set((s) => ({ projects: mapById(s.projects, pid, (p) => ({ ...p, links: ok })), pj: { ...s.pj, linkDraft: { pid, links: rest } } }));
      if (JSON.stringify(before) === JSON.stringify(ok)) return;
      debounce(`links:${pid}`, () => {
        const cur = (projectOf(pid) || {}).links || [];
        api.put(`/projects/${pid}/links`, { links: cur }).catch((e) => { get().flash(msg(e)); resyncDelivery(); });
      });
    },

    /* ───────────── Milestones ───────────── */

    /** Milestone edit `{name, alloc, status, due}` — status at once, typing debounced. */
    /* ───────────── Project third parties & credentials ───────────── */

    /** Load a project's third parties → integ[pid] = {items, canManage, canReveal, credentialsEnabled}. */
    async loadInteg(pid) {
      try {
        const r = await api.get('/project-integrations', { projectId: pid });
        set((s) => ({ integ: { ...s.integ, [pid]: r } }));
      } catch (e) {
        set((s) => ({ integ: { ...s.integ, [pid]: { items: [], error: msg(e) } } }));
      }
    },
    /** Create / edit from the modal form {name, category, status, url, notes, creds:[{id?, label, env, value}]}. */
    async saveInteg(pid, m, editId) {
      if (!m.name.trim()) return 'Enter the third party name.';
      if (m.url.trim() && !LINK_OK.test(m.url.trim())) return 'The link must start with https://';
      const creds = (m.creds || []).filter((c) => c.id || c.label.trim() || c.value);
      const noLabel = creds.find((c) => !c.label.trim());
      if (noLabel) return 'Name each credential (e.g. API key, Password).';
      const noValue = creds.find((c) => !c.id && !c.value);
      if (noValue) return `Enter a value for "${noValue.label.trim()}".`;
      const body = {
        name: m.name.trim(), category: m.category, status: m.status, url: m.url.trim(), notes: m.notes || '',
        credentials: creds.map((c) => ({ ...(c.id ? { id: c.id } : {}), label: c.label.trim(), env: c.env, value: c.value || '' })),
      };
      try {
        const dto = editId ? await api.patch(`/project-integrations/${editId}`, body) : await api.post('/project-integrations', { projectId: pid, ...body });
        set((s) => {
          const cur = s.integ[pid] || { items: [] };
          return { modal: null, integ: { ...s.integ, [pid]: { ...cur, items: upsert(cur.items, dto) } } };
        });
        get().flash(editId ? `${dto.name} updated` : `${dto.name} added`);
        return undefined;
      } catch (e) {
        return msg(e);
      }
    },
    async delInteg(pid, id) {
      try {
        await api.del(`/project-integrations/${id}`);
        set((s) => {
          const cur = s.integ[pid] || { items: [] };
          return { integ: { ...s.integ, [pid]: { ...cur, items: cur.items.filter((x) => x.id !== id) } } };
        });
        get().flash('Third party removed');
      } catch (e) {
        get().flash(msg(e));
      }
    },
    /** Decrypt one credential (server logs the view). Resolves to the value, or null (error flashed). */
    async revealCred(id, credId) {
      try {
        return (await api.post(`/project-integrations/${id}/credentials/${credId}/reveal`)).value;
      } catch (e) {
        get().flash(msg(e));
        return null;
      }
    },

    /* ───────────── Project follow-ups ───────────── */

    /** Create / edit a project follow-up from its modal form. Returns an error message or undefined. */
    async savePfu(m, editId) {
      if (!m.pid) return 'Pick a project.';
      if (!m.title.trim()) return 'Add a title.';
      if (!m.date || !m.time) return 'Pick a date and time.';
      let saved;
      try {
        const body = toApiPfu(m);
        saved = fromApiPfu(editId ? await api.patch(`/project-follow-ups/${editId}`, body) : await api.post('/project-follow-ups', body));
      } catch (e) {
        return msg(e);
      }
      set((s) => ({ pfus: upsert(s.pfus, saved), modal: null }));
      get().flash(editId ? 'Follow-up updated' : `${m.type} scheduled · ${dLabel(saved.due)}`);
      return undefined;
    },
    async togglePfu(id) {
      const res = await optimistic(set, get, (s) => ({ pfus: mapById(s.pfus, id, (f) => ({ ...f, done: !f.done })) }), () => api.patch(`/project-follow-ups/${id}/toggle-done`));
      if (res) set((s) => ({ pfus: upsert(s.pfus, fromApiPfu(res)) }));
    },
    async delPfu(id) {
      const ok = await optimistic(set, get, (s) => ({ pfus: s.pfus.filter((f) => f.id !== id) }), () => api.del(`/project-follow-ups/${id}`).then(() => true));
      if (ok) get().flash('Follow-up deleted');
    },

    /** Add a milestone at the end of a project (PM). Returns an error message or undefined. */
    async addMs(pid, { name, due, hours }) {
      if (!due) return 'Pick a due date.';
      try {
        const dto = await api.post(`/projects/${pid}/milestones`, { name: (name || '').trim(), dueDate: due, allocHours: Math.max(0, +hours || 0) });
        set((s) => ({ milestones: upsert(s.milestones, fromApiMilestone(dto)) }));
        get().flash(`Milestone added · ${dto.name}`);
        return undefined;
      } catch (e) {
        return msg(e);
      }
    },

    /** Delete a milestone (PM; refused by the server once hours are logged on it). */
    async delMs(mid) {
      const m = get().milestones.find((x) => x.id === mid);
      try {
        const r = await api.del(`/milestones/${mid}`);
        const pid = m ? m.p : null;
        const fresh = (r.milestones || []).map(fromApiMilestone);
        set((s) => ({ milestones: s.milestones.filter((x) => x.id !== mid && x.p !== pid).concat(fresh) }));
        get().flash(`Milestone deleted${m ? ` · ${m.name}` : ''}`);
      } catch (e) {
        get().flash(msg(e));
      }
    },

    updMs(id, patch) {
      set((s) => ({ milestones: patchById(s.milestones, id, patch) }));
      const send = () => api.patch(`/milestones/${id}`, toApiMilestonePatch(patch)).catch((e) => { get().flash(msg(e)); resyncDelivery(); });
      if ('name' in patch || 'alloc' in patch) {
        const key = `ms:${id}:${Object.keys(patch).join(',')}`;
        debounce(key, () => {
          const m = get().milestones.find((x) => x.id === id);
          if (!m) return;
          const body = toApiMilestonePatch(Object.fromEntries(Object.keys(patch).map((k) => [k, m[k]])));
          if (body.name !== undefined && !body.name.trim()) return; // blur fills "Milestone n"
          api.patch(`/milestones/${id}`, body).catch((e) => { get().flash(msg(e)); resyncDelivery(); });
        });
      } else {
        send();
      }
    },

    /* ───────────── Team ───────────── */

    setAlloc(pid, mid, v) {
      set((s) => ({ projects: mapById(s.projects, pid, (p) => ({ ...p, alloc: { ...p.alloc, [mid]: v } })) }));
      debounce(`alloc:${pid}:${mid}`, () => {
        const p = projectOf(pid);
        if (!p) return;
        api.put(`/projects/${pid}/members/${mid}`, { allocHours: +p.alloc[mid] || 0 }).catch((e) => { get().flash(msg(e)); resyncDelivery(); });
      });
    },

    addMember(pid, mid) {
      if (!mid) return undefined;
      return optimistic(set, get,
        (s) => ({ projects: s.projects.map((p) => (p.id === pid && !p.team.includes(mid) ? { ...p, team: p.team.concat(mid), alloc: { ...p.alloc, [mid]: 0 } } : p)) }),
        () => api.post(`/projects/${pid}/members`, { memberId: mid }),
        { resync: ['delivery'] });
    },

    removeMember: (pid, mid) => optimistic(set, get,
      (s) => ({ projects: mapById(s.projects, pid, (p) => ({ ...p, team: p.team.filter((x) => x !== mid) })) }),
      () => api.del(`/projects/${pid}/members/${mid}`),
      { resync: ['delivery'] }),

    /* ───────────── Client portal ───────────── */

    async portalOn(pid) {
      try {
        const r = await api.post(`/projects/${pid}/portal`, { on: true });
        set((s) => ({ projects: mapById(s.projects, pid, (p) => ({ ...p, portal: { ...p.portal, on: true, token: r.token } })) }));
        get().flash(r.message || 'Client portal link is live');
      } catch (e) {
        get().flash(msg(e));
      }
    },
    async portalOff(pid) {
      try {
        const r = await api.post(`/projects/${pid}/portal`, { on: false });
        set((s) => ({ projects: mapById(s.projects, pid, (p) => ({ ...p, portal: { ...p.portal, on: false } })) }));
        get().flash(r.message || 'Client portal link turned off');
      } catch (e) {
        get().flash(msg(e));
      }
    },
    async askApproval(mid) {
      try {
        const r = await api.post(`/milestones/${mid}/ask-approval`);
        set((s) => ({ milestones: upsert(s.milestones, fromApiMilestone(r)) }));
        get().flash(r.message || 'Sent to the client for approval');
      } catch (e) {
        get().flash(msg(e));
      }
    },
    /** Client approves a milestone or requests changes (note required) — public portal endpoint. */
    async clientDecide(mid, ok, note) {
      const m = get().milestones.find((x) => x.id === mid);
      if (!m) return;
      const p = projectOf(m.p);
      const token = p && p.portal && p.portal.token;
      if (!token) { get().flash('Turn on the client portal first.'); return; }
      const n = (note || '').trim();
      try {
        const r = await api.post(`/public/portal/${token}/milestones/${mid}/decision`, { approve: !!ok, note: n });
        set((s) => ({
          milestones: patchById(s.milestones, mid, { status: r.status, appr: { ...(m.appr || {}), st: r.approval, at: serverNow(), note: n } }),
          pj: { ...s.pj, cNote: { ...s.pj.cNote, [mid]: '' } },
        }));
        get().flash(r.message || (ok ? 'Milestone approved' : 'Change request sent to the team'));
      } catch (e) {
        get().flash(msg(e));
      }
    },

    /* ───────────── Timesheets ───────────── */

    /** Log hours from the log modal form `{member, date, rows:[{p, ms, h, note}]}`. */
    async saveLog(m) {
      let rows;
      try {
        rows = await api.post('/time-logs', toApiLogs(m));
      } catch (e) {
        return msg(e);
      }
      const nl = (rows || []).map(fromApiLog);
      const tot = nl.reduce((x, l) => x + l.h, 0);
      set((s) => ({ logs: replaceMany(s.logs, nl), modal: null }));
      get().flash(`Logged ${tot}h for ${memberName(get().members, m.member) || ''} · ${dLabel(parseDay(m.date))}`);
      return undefined;
    },
    async delLog(id) {
      const r = await optimistic(set, get, (s) => ({ logs: s.logs.filter((l) => l.id !== id) }), () => api.del(`/time-logs/${id}`).then(() => true));
      if (r) get().flash('Time entry deleted');
    },
    /** Timesheet CSV for the current projects filters (server export). */
    async exportTimesheets(f) {
      try {
        await exportLogs(f);
        return true;
      } catch (e) {
        get().flash(msg(e));
        return false;
      }
    },

    /* ───────────── Tasks ───────────── */

    /** Quick task edit (status drag / checklist tick …). */
    updTask(id, patch) {
      const onlyCl = Object.keys(patch).length === 1 && 'cl' in patch;
      return optimistic(set, get,
        (s) => ({ tasks: patchById(s.tasks, id, patch) }),
        async () => {
          const dto = onlyCl
            ? await api.patch(`/tasks/${id}/checklist`, { checklist: toApiTask(patch).checklist })
            : await api.patch(`/tasks/${id}`, toApiTask(patch));
          mergeTask(dto);
          return dto;
        });
    },
    /** Save a task from the task modal form `{title, p, ms, a, st, prio, due(yyyy-mm-dd), est, desc, cl}`. */
    async saveTask(m, editId = m.editId) {
      if (!m.title.trim()) return 'Add a task title.';
      const body = toApiTask({ ...m, title: m.title.trim(), due: m.due || null });
      let dto;
      try {
        dto = editId ? await api.patch(`/tasks/${editId}`, body) : await api.post('/tasks', body);
      } catch (e) {
        return msg(e);
      }
      mergeTask(dto);
      set({ modal: null });
      const who = memberName(get().members, dto.assigneeId);
      get().flash(editId ? 'Task updated' : `Task created${who ? ` · assigned to ${who}` : ''}`);
      return undefined;
    },
    async delTask(id) {
      try {
        await api.del(`/tasks/${id}`);
      } catch (e) {
        get().flash(msg(e));
        return msg(e);
      }
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id), modal: null }));
      get().flash('Task deleted');
      return undefined;
    },

    /* ───────────── Bugs ───────────── */

    /**
     * Patch a bug. The server writes the history ("Status → X", "Assigned to Y" …). A note with an
     * empty patch is posted as a comment (`Comment: …`).
     */
    updBug(id, patch, note) {
      if (!Object.keys(patch || {}).length) {
        if (note) return get().commentBug(id, String(note).replace(/^Comment:\s*/, ''));
        return undefined;
      }
      return optimistic(set, get,
        (s) => ({ bugs: mapById(s.bugs, id, (b) => ({ ...b, ...patch })) }),
        async () => { const dto = await api.patch(`/bugs/${id}`, toApiBug(patch)); mergeBug(dto); return dto; });
    },
    /** Add a comment to a bug's activity. Resolves to an error message or undefined. */
    async commentBug(id, text) {
      try {
        mergeBug(await api.post(`/bugs/${id}/comments`, { text }));
        return undefined;
      } catch (e) {
        get().flash(msg(e));
        return msg(e);
      }
    },
    /**
     * Save a bug from the bug modal form
     * `{title, p, ms, dept, env, sev, prio, a, st, rep, repDate, due, build, steps, exp, act, link, atts}`.
     * New files in `atts` (pending) are uploaded; removed saved attachments are deleted.
     */
    async saveBug(m, editId = m.editId) {
      if (!m.title.trim()) return 'Add a short bug title.';
      const S = get();
      const body = toApiBug({ ...m, title: m.title.trim(), due: m.due || null });
      if (!body.milestoneId) delete body.milestoneId;
      if (!body.assigneeId) body.assigneeId = null;
      const old = editId ? S.bugs.find((b) => b.id === editId) : null;
      if (old) {
        const keep = new Set((m.atts || []).map((a) => a.id).filter(Boolean));
        const gone = (old.atts || []).filter((a) => a.id && !keep.has(a.id)).map((a) => a.id);
        if (gone.length) body.removeAttachmentIds = gone;
      }
      let dto;
      try {
        dto = editId ? await api.patch(`/bugs/${editId}`, body) : await api.post('/bugs', body);
      } catch (e) {
        return msg(e);
      }
      let upErr = '';
      try {
        const res = await uploadPending(`/bugs/${dto.id}/attachments`, m.atts, { withKind: false });
        if (res.length) dto = res[res.length - 1];
      } catch (e) {
        upErr = msg(e);
      }
      mergeBug(dto);
      set({ modal: null });
      const who = dto.assigneeId ? memberName(get().members, dto.assigneeId) || dto.assigneeName : '';
      const base = editId ? `${dto.id} updated` : `${dto.id} reported${who ? ` · assigned to ${who}` : ''}`;
      get().flash(upErr ? `${base} · files not uploaded: ${upErr}` : base);
      return undefined;
    },
    async delBug(id) {
      try {
        await api.del(`/bugs/${id}`);
      } catch (e) {
        get().flash(msg(e));
        return msg(e);
      }
      set((s) => ({ bugs: s.bugs.filter((b) => b.id !== id), modal: null }));
      get().flash(`${id} deleted`);
      return undefined;
    },

    /* ───────────── Change requests ───────────── */

    /**
     * Save a CR from the CR modal form
     * `{pid, title, desc, by, reqBy, hours, rate, days, prio, target, atts, team[], tasks[{t,a,h}]}`.
     * Once approved, only documents can change. `send` sends a draft to the client.
     */
    async saveCr(m, editId = m.editId, send = false) {
      const S = get();
      const old = editId ? S.crs.find((c) => c.id === editId) : null;
      const locked = old && !['Draft', 'Sent to client'].includes(old.status);
      let dto;
      try {
        if (!old) dto = await api.post('/change-requests', { projectId: m.pid, ...toApiCr(m), send: !!send });
        else if (!locked) dto = await api.patch(`/change-requests/${old.id}`, { ...toApiCr(m), ...(send ? { send: true } : {}) });
        else dto = { id: old.id };
      } catch (e) {
        return msg(e);
      }
      const mailNote = clientMailNote(dto.clientEmail);
      let upErr = '';
      try {
        await syncDocs(`/change-requests/${dto.id}/documents`, old ? old.docs : [], m.atts);
      } catch (e) {
        upErr = msg(e);
      }
      try {
        dto = await api.get(`/change-requests/${dto.id}`);
      } catch { /* keep what we have */ }
      if (dto.projectId) mergeCr(dto);
      set({ modal: null });
      const resent = send && old && old.status === 'Sent to client';
      const base = dto.id + (resent ? ` updated and re-sent to client${mailNote}` : send ? ` sent to client for approval${mailNote}` : old ? ' saved' : ' saved as draft');
      get().flash(upErr ? `${base} · files: ${upErr}` : base);
      return undefined;
    },

    /**
     * Move a CR through its workflow. acts: send · approve (PM records client approval; sig
     * {name}) · clientApprove (portal; sig {name, agree}) · reject · clientReject (note required) ·
     * start · done · delete. Approval side effects (hours, value, timeline, CR milestone, board
     * tasks) happen on the server; the delivery data is reloaded afterwards.
     * Resolves to the server's error message (callers show it) or undefined.
     */
    async crAct(id, act, note, sig) {
      const S = get();
      const c = (S.crs || []).find((x) => x.id === id);
      if (!c) return undefined;
      const nt = (note || '').trim();
      let message;
      try {
        if (act === 'delete') {
          await api.del(`/change-requests/${id}`);
          set((s) => ({ crs: s.crs.filter((x) => x.id !== id), modal: null }));
          get().flash(`${c.id} deleted`);
          return undefined;
        }
        if (act === 'clientApprove' || act === 'clientReject') {
          const p = projectOf(c.p);
          const token = p && p.portal && p.portal.on && p.portal.token;
          if (!token) return 'Turn on the client portal first.';
          const r = await api.post(`/public/portal/${token}/change-requests/${id}/decision`, act === 'clientApprove'
            ? { approve: true, name: (sig && sig.name) || '', agree: !!(sig && sig.agree), note: nt }
            : { approve: false, note: nt });
          message = r.message;
        } else {
          const r = await api.post(`/change-requests/${id}/actions`, { act, ...(nt ? { note: nt } : {}), ...(act === 'approve' ? { signer: { name: (sig && sig.name) || '' } } : {}) });
          message = r.message;
          if (r && r.id) mergeCr(r);
        }
      } catch (e) {
        return msg(e);
      }
      if (['approve', 'clientApprove', 'start', 'done', 'clientReject'].includes(act)) await resyncDelivery();
      set((s) => ({
        modal: s.modal && s.modal.kind === 'cr' ? null : s.modal,
        pj: { ...s.pj, cNote: { ...s.pj.cNote, [id]: '' }, cSig: { ...s.pj.cSig, [id]: '' }, cAgree: { ...s.pj.cAgree, [id]: false } },
      }));
      get().flash(message || `${c.id} updated`);
      return undefined;
    },

    /** Open the server's printable CR approval (PDF via the browser's print dialog). */
    async printCr(id) {
      try {
        const ok = await openPrint(`/change-requests/${id}/print`);
        if (!ok) get().flash('Allow pop-ups to download the approval PDF');
      } catch (e) {
        get().flash(msg(e));
      }
    },
  };
};
