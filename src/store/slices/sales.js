import { getSources } from '@/store/masters';
import { useSettings } from '@/store/settings';
import { dLabel, tLabel } from '@/lib/date';
import { viewUser } from '@/domain/permissions';
import { attachedMessage, MAX_FILE } from '@/domain/files';
import { openPrint, download } from '@/api/client';
import { optimistic } from '@/api/optimistic';
import {
  canView, fromApiActivity, fromApiDoc, fromApiFu, fromApiLead, fromApiQuote, salesApi, toApiFu, toApiLead, toApiQuote,
} from '@/api/sales';
import { mapById, ownerName } from '../helpers';
import { firstOwnerId } from '@/store/owners';

/** Insert or replace an item by id. */
const upsert = (arr, item, { prepend = false } = {}) => (arr.some((x) => x.id === item.id)
  ? arr.map((x) => (x.id === item.id ? item : x))
  : prepend ? [item].concat(arr) : arr.concat(item));

let reminderBusy = false;

/**
 * Sales actions: leads, quotes, follow-ups — every write goes to the API.
 * Form actions are async and resolve to an error message (server wording) or undefined;
 * quick actions update the store first and roll back if the server refuses.
 */
export const createSalesSlice = (set, get) => {
  /** Replace a lead in the store with the server's DTO (keeps children the DTO doesn't carry). */
  const mergeLeadDto = (dto) => set((s) => {
    const prev = s.leads.find((l) => l.id === dto.id);
    return { leads: upsert(s.leads, fromApiLead(dto, prev), { prepend: true }) };
  });

  /** Re-read one lead (after writes with server-side side effects). */
  const refreshLead = async (id) => {
    try {
      mergeLeadDto(await salesApi.getLead(id));
    } catch (e) {
      if (e.status === 404) set((s) => ({ leads: s.leads.filter((l) => l.id !== id), selLead: s.selLead === id ? null : s.selLead }));
    }
  };

  /** Upload File objects to a lead; returns the stored docs (or throws). */
  const uploadFiles = async (leadId, files) => {
    if (!files.length) return [];
    const docs = await salesApi.uploadDocs(leadId, files);
    return (docs || []).map(fromApiDoc);
  };

  return {
    /** Set one field on a lead (quick action). Stage/owner changes add an activity entry. */
    async setLead(id, k, v) {
      const l = get().leads.find((x) => x.id === id);
      if (!l || l[k] === v) return;
      const req = k === 'status' ? () => salesApi.setStatus(id, v)
        : k === 'owner' ? () => salesApi.setOwner(id, v)
          : () => salesApi.updateLead(id, { [k === 'service' ? 'services' : k]: v });
      const res = await optimistic(set, get, (s) => ({
        leads: s.leads.map((x) => {
          if (x.id !== id) return x;
          const n = { ...x, [k]: v };
          if (k === 'status') n.acts = (x.acts || []).concat({ t: Date.now(), kind: 'status', text: `Stage: ${x.status} → ${v}` });
          if (k === 'owner') {
            n.firstOwner = x.firstOwner || x.owner;
            n.acts = (x.acts || []).concat({ t: Date.now(), kind: 'owner', text: `Transferred ${ownerName(x.owner)} → ${ownerName(v)}` });
          }
          return n;
        }),
      }), req);
      if (!res) return;
      if (k === 'owner' && !res.activities) {
        // Transferred out of this user's scope — the server no longer shows it to them.
        set((s) => ({ leads: s.leads.filter((x) => x.id !== id), selLead: s.selLead === id ? null : s.selLead }));
        return;
      }
      mergeLeadDto(res);
    },

    /** Log an activity on a lead (quick action). */
    async logAct(id, kind, text) {
      const acts = await optimistic(
        set, get,
        (s) => ({ leads: mapById(s.leads, id, (l) => ({ ...l, acts: (l.acts || []).concat({ t: Date.now(), kind, text }) })) }),
        () => salesApi.addActivity(id, kind, text),
      );
      if (acts) set((s) => ({ leads: mapById(s.leads, id, (l) => ({ ...l, acts: acts.map(fromApiActivity).sort((a, b) => a.t - b.t) })) }));
    },

    /** Apply owner/status to every selected lead. */
    async bulk(k, v) {
      const ids = get().selIds;
      if (!v || !ids.length) return;
      const now = Date.now();
      const res = await optimistic(set, get, (s) => ({
        leads: s.leads.map((l) => {
          if (!ids.includes(l.id) || l[k] === v) return l;
          if (k === 'status') return { ...l, status: v, acts: (l.acts || []).concat({ t: now, kind: 'status', text: `Stage: ${l.status} → ${v}` }) };
          return {
            ...l, owner: v, firstOwner: l.firstOwner || l.owner,
            acts: (l.acts || []).concat({ t: now, kind: 'owner', text: `Transferred ${ownerName(l.owner)} → ${ownerName(v)}` }),
          };
        }),
      }), () => salesApi.bulk({ ids, [k]: v }), { resync: ['sales'] });
      if (!res) return;
      get().flash(res.message || `${ids.length} leads ${k === 'owner' ? `assigned to ${ownerName(v)}` : `moved to ${v}`}`);
      // Owner transfers can move leads out of an executive's scope — reload what the server shows.
      if (k === 'owner') get().resync(['sales']).catch(() => {});
    },

    /**
     * Create / update a lead from the lead modal form
     * `{company, contact, email, phone, service, source, owner, value, notes, atts}`.
     * `atts`: stored docs (with id) and new ones (with `file`) — new files are uploaded, removed /
     * re-kinded stored docs are deleted / updated.
     */
    async saveLead(m, editId = m.editId) {
      if (!m.company.trim() || !m.contact.trim()) return 'Company and contact person are required.';
      if (!(m.service || '').trim()) return 'Pick at least one service.';
      const S = get();
      const vu = viewUser(S);
      const form = { ...m };
      if (!editId && vu && vu.role === 'r-se' && vu.ownerId) form.owner = vu.ownerId;
      const atts = m.atts || [];
      let id = editId;
      try {
        if (editId) {
          await salesApi.updateLead(editId, toApiLead(form, false));
          const old = (S.leads.find((l) => l.id === editId) || {}).docs || [];
          const keep = new Map(atts.filter((a) => a.id).map((a) => [a.id, a]));
          await Promise.all(old.filter((d) => d.id).map((d) => {
            const a = keep.get(d.id);
            if (!a) return salesApi.removeDoc(d.id);
            return a.kind !== d.kind ? salesApi.setDocKind(d.id, a.kind) : null;
          }));
        } else {
          id = (await salesApi.createLead(toApiLead(form, true))).id;
        }
      } catch (e) {
        return e.message;
      }
      let uploadErr = '';
      const fresh = atts.filter((a) => !a.id && a.file);
      if (fresh.length) {
        try {
          const docs = await uploadFiles(id, fresh.map((a) => a.file));
          await Promise.all(docs.map((d, i) => (fresh[i] && fresh[i].kind && fresh[i].kind !== d.kind ? salesApi.setDocKind(d.id, fresh[i].kind) : null)));
        } catch (e) {
          uploadErr = e.message;
        }
      }
      await refreshLead(id);
      set({ modal: null, selLead: id });
      get().flash(uploadErr || (editId ? 'Lead updated' : 'Lead added'));
      return undefined;
    },

    /** Initial lead-modal form (original openLeadModal). */
    leadForm(l) {
      if (l) return { editId: l.id, company: l.company, contact: l.contact, email: l.email || '', phone: l.phone || '', service: l.service, source: l.source, owner: l.owner, value: String(l.value || ''), notes: l.notes || '', atts: (l.docs || []).slice() };
      const vu = viewUser(get());
      return { editId: null, atts: [], company: '', contact: '', email: '', phone: '', service: '', source: getSources()[0], owner: (vu && vu.ownerId) || firstOwnerId(), value: '', notes: '' };
    },

    /** Merge `dropId` into `keepId` (contact info, notes, docs, quotes, activity, follow-ups) on the server. */
    async mergeLead(keepId, dropId) {
      const S = get();
      const d = S.leads.find((l) => l.id === dropId);
      if (!d || !S.leads.some((l) => l.id === keepId)) return;
      let res;
      try {
        res = await salesApi.merge(keepId, dropId);
      } catch (e) {
        get().flash(e.message);
        return;
      }
      set((s) => ({
        leads: s.leads.filter((l) => l.id !== dropId),
        fus: s.fus.map((f) => (f.leadId === dropId ? { ...f, leadId: keepId } : f)),
        selIds: s.selIds.filter((x) => x !== dropId),
        selLead: keepId,
      }));
      mergeLeadDto(res);
      get().flash(`${d.id} merged into ${keepId}`);
    },

    /**
     * Save a quote from the quote modal form `{items:[{d,q,r}], disc, gst, valid, terms}`.
     * `send` marks it Sent, opens the printable PDF and may move the lead to Proposal Sent.
     */
    async saveQuote(leadId, m, qid = null, send = false) {
      const items = m.items.filter((i) => i.d.trim() && +i.r > 0);
      if (!items.length) return 'Add at least one line with a description and a rate.';
      const l = get().leads.find((x) => x.id === leadId);
      if (!l) return undefined;
      const early = send && ['New', 'Contacted', 'Qualified'].includes(l.status);
      let q;
      try {
        const body = toApiQuote({ ...m, items }, send);
        q = fromApiQuote(qid ? await salesApi.updateQuote(leadId, qid, body) : await salesApi.createQuote(leadId, body));
      } catch (e) {
        return e.message;
      }
      set((s) => ({ leads: mapById(s.leads, leadId, (x) => ({ ...x, quotes: upsert(x.quotes || [], q) })), modal: null, selLead: leadId }));
      if (send) {
        const ok = await openPrint(salesApi.quotePrintPath(leadId, q.id)).catch(() => false);
        if (!ok) get().flash('Allow pop-ups to download the quote PDF');
      }
      await refreshLead(leadId);
      get().flash(send ? `${q.id} sent${early ? ' · stage → Proposal Sent' : ''}` : `${q.id} saved as draft`);
      return undefined;
    },

    /** Open a quote's printable PDF view. */
    async printQuote(leadId, qid) {
      const ok = await openPrint(salesApi.quotePrintPath(leadId, qid)).catch((e) => { get().flash(e.message); return true; });
      if (!ok) get().flash('Allow pop-ups to download the quote PDF');
    },

    /** Mark a quote Viewed / Accepted / Declined. Accepting wins the lead at the quote's net value. */
    async setQuote(lid, qid, st) {
      const now = Date.now();
      const k = { Viewed: 'viewedAt', Accepted: 'acceptedAt', Declined: 'declinedAt' }[st];
      const res = await optimistic(set, get, (s) => ({
        leads: mapById(s.leads, lid, (l) => ({ ...l, quotes: (l.quotes || []).map((x) => (x.id === qid ? { ...x, status: st, [k]: now } : x)) })),
      }), () => salesApi.quoteStatus(lid, qid, st));
      if (!res) return;
      await refreshLead(lid);
      get().flash(`Quote ${st.toLowerCase()}${st === 'Accepted' ? ' · lead marked Won' : ''}`);
    },

    /** Download the leads CSV for the given list filters (server applies scope + filters). */
    async exportLeads(query) {
      try {
        await download('/leads/export.csv', query);
        get().flash('Leads exported');
      } catch (e) {
        get().flash(e.message);
      }
    },

    async toggleFu(id) {
      const res = await optimistic(set, get, (s) => ({ fus: mapById(s.fus, id, (f) => ({ ...f, done: !f.done })) }), () => salesApi.toggleFu(id));
      if (res) set((s) => ({ fus: upsert(s.fus, fromApiFu(res)) }));
    },

    async delFu(id) {
      const ok = await optimistic(set, get, (s) => ({ fus: s.fus.filter((f) => f.id !== id) }), () => salesApi.deleteFu(id).then(() => true));
      if (ok) get().flash('Follow-up deleted');
    },

    /**
     * Create / update a follow-up from the modal form
     * `{type, title, leadId, owner, date, time, dur, prio, remind, meet:boolean, meetUrl, attendees, notes}`.
     * (Opening Google Calendar is done by the modal — it needs the click gesture.)
     */
    async saveFu(m, editId = m.editId) {
      if (!m.title.trim()) return 'Add a title.';
      if (!m.date || !m.time) return 'Pick a date and time.';
      let saved;
      try {
        const body = toApiFu(m);
        saved = fromApiFu(editId ? await salesApi.updateFu(editId, body) : await salesApi.createFu(body));
      } catch (e) {
        return e.message;
      }
      set((s) => ({ fus: upsert(s.fus, saved), modal: null }));
      get().flash(editId ? 'Follow-up updated' : `${m.type} scheduled · ${dLabel(saved.due)} ${tLabel(saved.due)}`);
      return undefined;
    },

    /** Upload File objects to a lead (drawer documents) and flash the count. */
    async addLeadDocs(leadId, files) {
      const list = Array.from(files || []);
      const ok = list.filter((f) => f.size <= MAX_FILE);
      const skipped = list.length - ok.length;
      if (!ok.length) { get().flash(attachedMessage(0, skipped)); return; }
      try {
        const docs = await uploadFiles(leadId, ok);
        set((s) => ({ leads: mapById(s.leads, leadId, (l) => ({ ...l, docs: (l.docs || []).concat(docs) })) }));
        get().flash(attachedMessage(docs.length, skipped));
      } catch (e) {
        get().flash(e.message);
      }
    },

    /** Transform a lead's stored docs: fn(docs) → docs. Removals / kind changes are saved to the server. */
    async setLeadDocs(leadId, fn) {
      const l = get().leads.find((x) => x.id === leadId);
      if (!l) return;
      const old = l.docs || [];
      const next = fn(old);
      const keep = new Map(next.filter((d) => d.id).map((d) => [d.id, d]));
      const calls = old.filter((d) => d.id).map((d) => {
        const n = keep.get(d.id);
        if (!n) return () => salesApi.removeDoc(d.id);
        return n.kind !== d.kind ? () => salesApi.setDocKind(d.id, n.kind) : null;
      }).filter(Boolean);
      if (!calls.length) return;
      await optimistic(
        set, get,
        (s) => ({ leads: mapById(s.leads, leadId, (x) => ({ ...x, docs: next })) }),
        () => Promise.all(calls.map((c) => c())).then(() => true),
        { rollback: (s) => ({ leads: mapById(s.leads, leadId, (x) => ({ ...x, docs: old })) }) },
      );
    },

    /** Raise reminder alerts for follow-ups entering their reminder window (App polls every 15 s). */
    async checkReminders() {
      if (useSettings.getState().reminderAlerts === false) return;
      if (reminderBusy || !canView(get().me, 'fu')) return;
      reminderBusy = true;
      try {
        const due = (await salesApi.dueReminders()) || [];
        const known = new Set(get().alerts);
        const hits = due.map(fromApiFu).filter((f) => !known.has(f.id));
        if (!hits.length) return;
        set((s) => ({
          fus: hits.reduce((arr, f) => upsert(arr, { ...f, notified: true }), s.fus),
          alerts: s.alerts.concat(hits.map((f) => f.id)).slice(-4),
        }));
        await salesApi.ackReminders(hits.map((f) => f.id));
      } catch {
        /* polling — try again next tick */
      } finally {
        reminderBusy = false;
      }
    },

    /** Copy text and flash 'Meet link copied' (original copy()). */
    copyMeet(t) {
      try { navigator.clipboard.writeText(t); } catch { /* ignore */ }
      get().flash('Meet link copied');
    },
  };
};
