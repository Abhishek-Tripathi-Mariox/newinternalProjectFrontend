import { makeFollowUp } from '@/data/seed/sales';
import { OWNERS } from '@/config/constants';
import { getSources } from '@/store/masters';
import { dLabel, tLabel } from '@/lib/date';
import { money } from '@/lib/format';
import { viewUser } from '@/domain/permissions';
import { qTotals, printQuote } from '@/domain/quotes';
import { calendarUrl } from '@/domain/leads';
import { attachedMessage } from '@/domain/files';
import { mapById, ownerName } from '../helpers';

/** Sales actions: leads, quotes, follow-ups. */
export const createSalesSlice = (set, get) => ({
  /** Set one field on a lead. Stage/owner changes add an activity entry. */
  setLead(id, k, v) {
    set((s) => ({
      leads: s.leads.map((l) => {
        if (l.id !== id || l[k] === v) return l;
        const n = { ...l, [k]: v };
        if (k === 'status') n.acts = (l.acts || []).concat({ t: Date.now(), kind: 'status', text: `Stage: ${l.status} → ${v}` });
        if (k === 'owner') {
          n.firstOwner = l.firstOwner || l.owner;
          n.acts = (l.acts || []).concat({ t: Date.now(), kind: 'owner', text: `Transferred ${ownerName(l.owner)} → ${ownerName(v)}` });
        }
        return n;
      }),
    }));
  },

  logAct: (id, kind, text) => set((s) => ({ leads: mapById(s.leads, id, (l) => ({ ...l, acts: (l.acts || []).concat({ t: Date.now(), kind, text }) })) })),

  /** Apply owner/status to every selected lead. */
  bulk(k, v) {
    const ids = get().selIds;
    if (!v || !ids.length) return;
    ids.forEach((id) => get().setLead(id, k, v));
    get().flash(`${ids.length} leads ${k === 'owner' ? `assigned to ${ownerName(v)}` : `moved to ${v}`}`);
  },

  /**
   * Create / update a lead from the lead modal form
   * `{company, contact, email, phone, service, source, owner, value, notes, atts}`.
   */
  saveLead(m, editId = m.editId) {
    if (!m.company.trim() || !m.contact.trim()) return 'Company and contact person are required.';
    if (!(m.service || '').trim()) return 'Pick at least one service.';
    const S = get();
    let owner = m.owner;
    const vu = viewUser(S);
    if (!editId && vu && vu.role === 'r-se' && vu.ownerId) owner = vu.ownerId;
    if (editId) {
      const o = {
        company: m.company.trim(), contact: m.contact.trim(), email: m.email.trim(), phone: m.phone.trim(), service: m.service, source: m.source,
        value: +m.value || 0, notes: m.notes, docs: (m.atts || []).slice(),
      };
      set((s) => ({ leads: mapById(s.leads, editId, (l) => ({ ...l, ...o })), modal: null, selLead: editId }));
      get().flash('Lead updated');
      return undefined;
    }
    const n = S.leads.reduce((a, l) => Math.max(a, +l.id.slice(3) || 0), 1000) + 1;
    const lead = {
      id: `MX-${n}`, company: m.company.trim(), contact: m.contact.trim(), email: m.email.trim(), phone: m.phone.trim(), service: m.service,
      source: m.source, owner, firstOwner: owner, status: 'New', value: +m.value || 0, created: Date.now(), notes: m.notes, docs: (m.atts || []).slice(),
    };
    set((s) => ({ leads: [lead].concat(s.leads), modal: null, selLead: lead.id }));
    get().flash('Lead added');
    return undefined;
  },

  /** Initial lead-modal form (original openLeadModal). */
  leadForm(l) {
    if (l) return { editId: l.id, company: l.company, contact: l.contact, email: l.email || '', phone: l.phone || '', service: l.service, source: l.source, owner: l.owner, value: String(l.value || ''), notes: l.notes || '', atts: (l.docs || []).slice() };
    const vu = viewUser(get());
    return { editId: null, atts: [], company: '', contact: '', email: '', phone: '', service: '', source: getSources()[0], owner: (vu && vu.ownerId) || OWNERS[0].id, value: '', notes: '' };
  },

  /** Merge `dropId` into `keepId` (contact info, notes, docs, quotes, activity, follow-ups). */
  mergeLead(keepId, dropId) {
    const S = get();
    const k = S.leads.find((l) => l.id === keepId);
    const d = S.leads.find((l) => l.id === dropId);
    if (!k || !d) return;
    const m = {
      ...k, email: k.email || d.email, phone: k.phone || d.phone, notes: [k.notes, d.notes].filter(Boolean).join('\n\n'),
      docs: (k.docs || []).concat(d.docs || []), quotes: (k.quotes || []).concat(d.quotes || []),
      acts: (k.acts || []).concat(d.acts || [], [{ t: Date.now(), kind: 'note', text: `Merged ${d.id} (${d.company}) into this lead` }]),
    };
    set((s) => ({
      leads: s.leads.filter((l) => l.id !== dropId).map((l) => (l.id === keepId ? m : l)),
      fus: s.fus.map((f) => (f.leadId === dropId ? { ...f, leadId: keepId } : f)),
      selIds: s.selIds.filter((x) => x !== dropId),
      selLead: keepId,
    }));
    get().flash(`${d.id} merged into ${keepId}`);
  },

  /**
   * Save a quote from the quote modal form `{items:[{d,q,r}], disc, gst, valid, terms}`.
   * `send` marks it Sent, opens the printable PDF and may move the lead to Proposal Sent.
   */
  saveQuote(leadId, m, qid = null, send = false) {
    const items = m.items.filter((i) => i.d.trim() && +i.r > 0);
    if (!items.length) return 'Add at least one line with a description and a rate.';
    const l = get().leads.find((x) => x.id === leadId);
    if (!l) return undefined;
    const qs = l.quotes || [];
    const now = Date.now();
    const old = qid && qs.find((q) => q.id === qid);
    const q = { ...(old || { id: `Q-${l.id.slice(3)}-${qs.length + 1}`, created: now, status: 'Draft' }), items, disc: +m.disc || 0, gst: !!m.gst, valid: +m.valid || 15, terms: m.terms };
    const t = qTotals(q);
    q.total = t.total;
    q.net = t.net;
    if (send) { q.status = 'Sent'; q.sentAt = now; }
    const early = send && ['New', 'Contacted', 'Qualified'].includes(l.status);
    const acts = (l.acts || []).concat(
      { t: now, kind: 'quote', text: `${old ? 'Updated quote ' : 'Created quote '}${q.id} · ${money(q.total)}` },
      send ? [{ t: now + 1, kind: 'quote', text: `Sent quote ${q.id} to ${l.email || l.contact}` }] : [],
      early ? [{ t: now + 2, kind: 'status', text: `Stage: ${l.status} → Proposal Sent` }] : [],
    );
    const nl = { ...l, quotes: old ? qs.map((x) => (x.id === q.id ? q : x)) : qs.concat(q), acts, ...(early ? { status: 'Proposal Sent' } : {}) };
    set((s) => ({ leads: s.leads.map((x) => (x.id === l.id ? nl : x)), modal: null, selLead: l.id }));
    if (send && !printQuote(nl, q)) get().flash('Allow pop-ups to download the quote PDF');
    get().flash(send ? `${q.id} sent${early ? ' · stage → Proposal Sent' : ''}` : `${q.id} saved as draft`);
    return undefined;
  },

  /** Mark a quote Viewed / Accepted / Declined. Accepting wins the lead at the quote's net value. */
  setQuote(lid, qid, st) {
    const now = Date.now();
    const k = { Viewed: 'viewedAt', Accepted: 'acceptedAt', Declined: 'declinedAt' }[st];
    set((s) => ({
      leads: s.leads.map((l) => {
        if (l.id !== lid) return l;
        const q = (l.quotes || []).find((x) => x.id === qid);
        if (!q) return l;
        const won = st === 'Accepted' && l.status !== 'Won';
        return {
          ...l,
          quotes: l.quotes.map((x) => (x.id === qid ? { ...q, status: st, [k]: now } : x)),
          acts: (l.acts || []).concat({ t: now, kind: 'quote', text: `Quote ${qid} ${st.toLowerCase()}` }, won ? [{ t: now + 1, kind: 'status', text: `Stage: ${l.status} → Won` }] : []),
          ...(won ? { status: 'Won', value: Math.round(q.net || q.total) } : {}),
        };
      }),
    }));
    get().flash(`Quote ${st.toLowerCase()}${st === 'Accepted' ? ' · lead marked Won' : ''}`);
  },

  toggleFu: (id) => set((s) => ({ fus: mapById(s.fus, id, (f) => ({ ...f, done: !f.done })) })),

  delFu(id) {
    set((s) => ({ fus: s.fus.filter((f) => f.id !== id) }));
    get().flash('Follow-up deleted');
  },

  /**
   * Create / update a follow-up from the modal form
   * `{type, title, leadId, owner, date, time, dur, prio, remind, meet:boolean, meetUrl, attendees, notes, openCal}`.
   */
  saveFu(m, editId = m.editId) {
    if (!m.title.trim()) return 'Add a title.';
    if (!m.date || !m.time) return 'Pick a date and time.';
    const S = get();
    const due = new Date(`${m.date}T${m.time}`).getTime();
    const o = {
      type: m.type, title: m.title.trim(), leadId: m.leadId, owner: m.owner, due, dur: +m.dur, prio: m.prio, remind: +m.remind,
      meet: m.meet ? m.meetUrl.trim() : '', attendees: m.attendees, notes: m.notes, notified: false,
    };
    let fus;
    let saved;
    if (editId) {
      fus = S.fus.map((f) => (f.id === editId ? (saved = { ...f, ...o }) : f));
    } else {
      const n = S.fus.reduce((a, f) => Math.max(a, +f.id.slice(1) || 0), 0) + 1;
      saved = makeFollowUp({ id: `F${n}`, ...o });
      fus = S.fus.concat(saved);
    }
    if (m.openCal && saved) window.open(calendarUrl(saved, S.leads.find((l) => l.id === saved.leadId)), '_blank');
    set({ fus, modal: null });
    get().flash(editId ? 'Follow-up updated' : `${m.type} scheduled · ${dLabel(due)} ${tLabel(due)}`);
    return undefined;
  },

  /** Append read attachments (domain/files.readFiles) to a lead and flash the count. */
  addLeadDocs(leadId, atts, skipped = 0) {
    get().setLeadDocs(leadId, (docs) => docs.concat(atts));
    get().flash(attachedMessage(atts.length, skipped));
  },

  /** Transform a lead's docs: fn(docs) → docs. */
  setLeadDocs: (leadId, fn) => set((s) => ({ leads: mapById(s.leads, leadId, (l) => ({ ...l, docs: fn(l.docs || []) })) })),

  /** Copy text and flash 'Meet link copied' (original copy()). */
  copyMeet(t) {
    try { navigator.clipboard.writeText(t); } catch { /* ignore */ }
    get().flash('Meet link copied');
  },
});
