import { api, getAll, dayMs, ms } from './client';
import { fromApiDoc } from './files';

/**
 * Team tasks API (/team-tasks): tasks given down the "Reports to" hierarchy, independent of projects.
 * Store shape: {id, title, notes, prio, status, due (day ms|null), est (hours|null), p / pName (optional project),
 * lead / leadName (optional sales lead), a (assignee user id), aName,
 * by (creator user id), byName, upd (progress note), doneAt, at (created ms), canEdit, canDelete, canStatus}.
 */
export const fromApiTeamTask = (t) => ({
  id: t.id,
  title: t.title,
  notes: t.notes || '',
  prio: t.priority,
  status: t.status,
  due: dayMs(t.dueDate),
  est: t.estimateHours ?? null,
  p: t.projectId || '',
  pName: t.projectName || '',
  lead: t.leadId || '',
  leadName: t.leadName || '',
  a: t.assigneeId,
  aName: t.assigneeName || '',
  by: t.createdBy,
  byName: t.creatorName || '',
  upd: t.updateNote || '',
  doneAt: ms(t.doneAt),
  at: ms(t.createdAt) || 0,
  comments: t.comments || 0,
  events: t.events || 0,
  canEdit: !!t.canEdit,
  canDelete: !!t.canDelete,
  canStatus: !!t.canUpdateStatus,
  atts: (t.attachments || []).map((d) => ({
    ...fromApiDoc(d),
    by: d.uploadedBy,
    // Who added it — the assignee and the task giver are labelled.
    byName: d.uploadedBy === t.assigneeId ? `${t.assigneeName || 'assignee'} (assignee)`
      : d.uploadedBy === t.createdBy ? `${t.creatorName || 'task giver'} (gave the task)` : d.uploaderName || '',
  })),
});

/** Modal form → API body. */
export const toApiTeamTask = (f) => ({
  title: f.title.trim(),
  notes: f.notes || '',
  priority: f.prio,
  dueDate: f.due || null,
  estimateHours: f.est === '' || f.est == null ? null : +f.est,
  projectId: f.p || null,
  leadId: f.lead || null,
  assigneeId: f.a,
  ...(f.status ? { status: f.status } : {}),
  ...(f.reopenWhy && f.reopenWhy.trim() ? { comment: f.reopenWhy.trim() } : {}),
});

export const teamTasksApi = {
  create: (body) => api.post('/team-tasks', body),
  update: (id, body) => api.patch(`/team-tasks/${id}`, body),
  remove: (id) => api.del(`/team-tasks/${id}`),
  upload: (id, files, title = '') => api.upload(`/team-tasks/${id}/attachments`, files, title.trim() ? { title: title.trim() } : {}),
  removeDoc: (docId) => api.del(`/documents/${docId}`),
  assignees: () => api.get('/team-tasks/assignees'),
  activity: (id) => api.get(`/team-tasks/${id}/activity`),
  comment: (id, text) => api.post(`/team-tasks/${id}/comments`, { text }),
};

/** Bootstrap: every team task the user may see (staff only; clients get none). */
export async function loadTeamTasks(me) {
  if (!me || (me.role && me.role.id === 'r-client')) return { teamTasks: [] };
  // Optional module: if it can't load, the rest of the portal still opens (the page shows no tasks).
  try {
    return { teamTasks: (await getAll('/team-tasks')).map(fromApiTeamTask) };
  } catch {
    return { teamTasks: [] };
  }
}

