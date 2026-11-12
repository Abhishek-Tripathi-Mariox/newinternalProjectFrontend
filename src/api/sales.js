/**
 * Sales API: bootstrap loader, endpoint calls and DTO adapters (leads, activities, quotes,
 * documents, follow-ups, sales owners). Adapters keep the store shapes from CONTRACT.md.
 */
import { api, getAll, iso, ms } from './client';

/* ───────────── permissions ───────────── */

/** Can the principal view module `mod`? (Super Admin: everything.) */
export const canView = (me, mod) => {
  if (!me) return false;
  if (me.isSuper || (me.role && me.role.id === 'r-super')) return true;
  const p = me.role && me.role.perms && me.role.perms[mod];
  return !!(p && p.v);
};

/* ───────────── adapters: API → store ───────────── */

export const fromApiOwner = (o) => ({ id: o.id, name: o.name, h: o.hue, ...(o.active === false ? { inactive: true } : {}) });

export const fromApiDoc = (d) => ({
  id: d.id, name: d.name, size: d.size, type: d.mime || '', at: ms(d.createdAt), kind: d.kind, url: d.url,
});

export const fromApiActivity = (a) => ({ id: a.id, t: ms(a.at), kind: a.kind, text: a.text });

export const fromApiQuote = (q) => {
  const out = {
    id: q.id, created: ms(q.createdAt), status: q.status, items: q.items || [], disc: q.discountPct || 0, gst: q.gst !== false,
    valid: q.validDays, terms: q.terms || '', total: q.total, net: q.net,
  };
  ['sentAt', 'viewedAt', 'acceptedAt', 'declinedAt'].forEach((k) => { if (q[k]) out[k] = ms(q[k]); });
  return out;
};

const byT = (a, b) => a.t - b.t;

/** Lead DTO (optionally with activities / quotes / documents) → store lead. */
export function fromApiLead(d, prev) {
  const l = {
    id: d.id,
    company: d.company,
    contact: d.contact,
    email: d.email || '',
    phone: d.phone || '',
    service: (d.services || []).join(', '),
    source: d.source,
    owner: d.ownerId,
    firstOwner: d.firstOwnerId || d.ownerId,
    status: d.status,
    value: Number(d.value) || 0,
    created: ms(d.createdAt),
    notes: d.notes || '',
    docs: d.documents ? d.documents.map(fromApiDoc) : (prev && prev.docs) || [],
    acts: d.activities ? d.activities.map(fromApiActivity).sort(byT) : (prev && prev.acts) || [],
    quotes: d.quotes ? d.quotes.map(fromApiQuote).sort((a, b) => a.created - b.created) : (prev && prev.quotes) || [],
  };
  return l;
}

/** Follow-up DTO → store follow-up. */
export const fromApiFu = (f) => ({
  id: f.id,
  type: f.type,
  title: f.title,
  leadId: f.leadId || '',
  owner: f.ownerId,
  due: ms(f.dueAt),
  dur: f.durationMin || 0,
  remind: f.remindMin || 0,
  prio: f.priority,
  meet: f.meetUrl || '',
  attendees: f.attendees || '',
  notes: f.notes || '',
  done: !!f.done,
  notified: !!f.notified,
});

/* ───────────── adapters: store form → API body ───────────── */

/** Lead modal form → POST/PATCH /leads body. `withOwner` only on create (transfers use PATCH /owner). */
export const toApiLead = (m, withOwner) => ({
  company: (m.company || '').trim(),
  contact: (m.contact || '').trim(),
  email: (m.email || '').trim(),
  phone: (m.phone || '').trim(),
  services: m.service || '',
  source: m.source || undefined,
  ...(withOwner && m.owner ? { ownerId: m.owner } : {}),
  value: +m.value || 0,
  notes: m.notes || '',
});

/** Quote modal form → quote body. */
export const toApiQuote = (m, send) => ({
  items: (m.items || []).map((i) => ({ d: String(i.d || ''), q: +i.q || 0, r: +i.r || 0 })),
  discountPct: +m.disc || 0,
  gst: !!m.gst,
  validDays: +m.valid || 15,
  terms: m.terms || '',
  send: !!send,
});

/** Follow-up modal form → POST/PATCH /follow-ups body. */
export function toApiFu(m) {
  const due = new Date(`${m.date}T${m.time}`);
  return {
    type: m.type,
    title: m.title || '',
    leadId: m.leadId || null,
    ownerId: m.owner || undefined,
    dueAt: Number.isNaN(due.getTime()) ? undefined : due.toISOString(),
    durationMin: +m.dur || 0,
    remindMin: +m.remind || 0,
    priority: m.prio,
    meetUrl: m.meet ? (m.meetUrl || '').trim() : '',
    attendees: m.attendees || '',
    notes: m.notes || '',
  };
}

/* ───────────── loader ───────────── */

const LEAD_INCLUDE = 'activities,quotes,documents';

/** Bootstrap: sales owners, leads (with activity, quotes, documents) and follow-ups the role may see. */
export async function loadSales(me) {
  const [owners, leads, fus] = await Promise.all([
    api.get('/sales-owners').catch(() => []),
    canView(me, 'leads') ? getAll('/leads', { include: LEAD_INCLUDE }) : [],
    canView(me, 'fu') ? getAll('/follow-ups', { tab: 'all' }) : [],
  ]);
  return {
    owners: (owners || []).map(fromApiOwner),
    leads: leads.map((d) => fromApiLead(d)),
    fus: fus.map(fromApiFu),
  };
}

/* ───────────── endpoint helpers ───────────── */

const enc = encodeURIComponent;

export const salesApi = {
  getLead: (id) => api.get(`/leads/${enc(id)}`),
  createLead: (body) => api.post('/leads', body),
  updateLead: (id, body) => api.patch(`/leads/${enc(id)}`, body),
  setStatus: (id, status) => api.patch(`/leads/${enc(id)}/status`, { status }),
  setOwner: (id, ownerId) => api.patch(`/leads/${enc(id)}/owner`, { ownerId }),
  addActivity: (id, kind, text) => api.post(`/leads/${enc(id)}/activities`, { kind, text }),
  bulk: (body) => api.post('/leads/bulk', body),
  merge: (keepId, dropId) => api.post('/leads/merge', { keepId, dropId }),
  uploadDocs: (id, files) => api.upload(`/leads/${enc(id)}/documents`, files),
  setDocKind: (docId, kind) => api.patch(`/documents/${enc(docId)}`, { kind }),
  removeDoc: (docId) => api.del(`/documents/${enc(docId)}`),
  createQuote: (id, body) => api.post(`/leads/${enc(id)}/quotes`, body),
  updateQuote: (id, qid, body) => api.patch(`/leads/${enc(id)}/quotes/${enc(qid)}`, body),
  sendQuote: (id, qid) => api.post(`/leads/${enc(id)}/quotes/${enc(qid)}/send`),
  quoteStatus: (id, qid, status) => api.post(`/leads/${enc(id)}/quotes/${enc(qid)}/status`, { status }),
  quotePrintPath: (id, qid) => `/leads/${enc(id)}/quotes/${enc(qid)}/print`,
  createFu: (body) => api.post('/follow-ups', body),
  updateFu: (id, body) => api.patch(`/follow-ups/${enc(id)}`, body),
  toggleFu: (id) => api.patch(`/follow-ups/${enc(id)}/toggle-done`),
  deleteFu: (id) => api.del(`/follow-ups/${enc(id)}`),
  dueReminders: () => api.get('/follow-ups/due-reminders'),
  ackReminders: (ids) => api.post('/follow-ups/due-reminders/ack', { ids }),
};

/** Lead-list filters (store `lf` + sort + range) → GET /leads/export.csv query. */
export function toApiLeadQuery(lf, sort, rg, staleDays) {
  const day = (t) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return {
    q: (lf.q || '').trim() || undefined,
    status: lf.status || undefined,
    owner: lf.owner || undefined,
    source: lf.source || undefined,
    service: lf.service || undefined,
    flag: lf.flag || undefined,
    from: rg ? day(rg[0]) : undefined,
    to: rg ? day(rg[1] - 1) : undefined,
    staleDays: staleDays || undefined,
    sort: sort && sort.k ? `${sort.d < 0 ? '-' : ''}${sort.k}` : undefined,
  };
}

export { iso };
