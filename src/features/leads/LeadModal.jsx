import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { Button, DocumentsPanel, ErrorText, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { getServices, getSources, useMasters, useServices, useSources } from '@/store/masters';
import { findDuplicateLeads } from '@/domain/leads';
import { viewUser } from '@/domain/permissions';
import { attachedMessage, docKind, MAX_FILE } from '@/domain/files';
import { ownerOf, val } from './leadUtils';
import AddChip from './components/AddChip';
import { closeIfStillOpen } from './closeIfStillOpen';
import s from './LeadModal.module.css';
import { firstOwnerId, getActiveOwners } from '@/store/owners';
import { serverNow } from '@/lib/clock';

const ownerOpts = () => getActiveOwners().map((o) => ({ value: o.id, label: o.name }));

/** Initial form (port of the original openLeadModal). */
function initialForm(lead, vu) {
  if (lead) {
    return {
      company: lead.company, contact: lead.contact, email: lead.email || '', phone: lead.phone || '', service: lead.service,
      source: lead.source, owner: lead.owner, value: String(lead.value || ''), notes: lead.notes || '', atts: (lead.docs || []).slice(),
    };
  }
  return {
    company: '', contact: '', email: '', phone: '', service: '', source: getSources()[0],
    owner: (vu && vu.ownerId) || firstOwnerId(), value: '', notes: '', atts: [],
  };
}

/**
 * Multi-select service chips; keeps the services-list order in the stored "A, B" string
 * (values no longer in the list are kept at the end). "+ Add service" creates and selects one.
 */
function ServiceChips({ value, onChange }) {
  const services = useServices();
  const addService = useMasters((st) => st.addService);
  const cur = (value || '').split(', ').filter(Boolean);
  const all = services.concat(cur.filter((x) => !services.includes(x)));
  /** Selected values in list order (fresh list, so a just-added service is included). */
  const ordered = (sel) => {
    const list = getServices();
    const rank = (x) => (list.includes(x) ? list.indexOf(x) : list.length);
    return sel.slice().sort((x, y) => rank(x) - rank(y));
  };
  const toggle = (sv) => onChange(ordered(cur.includes(sv) ? cur.filter((x) => x !== sv) : cur.concat(sv)).join(', '));
  const add = (text) => {
    const name = addService(text);
    if (!name) return false;
    if (!cur.includes(name)) onChange(ordered(cur.concat(name)).join(', '));
    return true;
  };
  return (
    <div className={s.chips} role="group" aria-label="Services">
      {all.map((sv) => {
        const on = cur.includes(sv);
        return (
          <button key={sv} type="button" aria-pressed={on} className={`${s.chip} ${on ? s.chipOn : ''}`} onClick={() => toggle(sv)}>
            <span className={s.mark}>{on ? '✓' : ''}</span>{sv}
          </button>
        );
      })}
      <AddChip onAdd={add} />
    </div>
  );
}

/** Locked owner display (exec creating a lead, or editing an existing lead). */
const LockedOwner = ({ name, note }) => (
  <div className={s.locked}><span>{name}</span><span className={s.lockedNote}>{note}</span></div>
);

/** New / edit lead dialog. Props: {editId?, onClose}. */
export default function LeadModal({ editId, onClose }) {
  const leads = useStore((st) => st.leads);
  const users = useStore((st) => st.users);
  const viewAs = useStore((st) => st.viewAs);
  const saveLead = useStore((st) => st.saveLead);
  const flash = useStore((st) => st.flash);
  const selectLead = useStore((st) => st.selectLead);
  const closeModal = useStore((st) => st.closeModal);

  const vu = useMemo(() => viewUser({ users, viewAs }), [users, viewAs]);
  const isExec = !!(vu && vu.role === 'r-se');
  const isEdit = !!editId;
  const [form, setForm] = useState(() => initialForm(editId ? leads.find((l) => l.id === editId) : null, vu));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: val(e) }));
  const sources = useSources();
  const addSource = useMasters((st) => st.addSource);
  const sourceOpts = sources.includes(form.source) || !form.source ? sources : sources.concat(form.source);
  const dups = useMemo(() => findDuplicateLeads(form, leads, editId).slice(0, 3), [form, leads, editId]);
  const ownerName = form.owner ? ownerOf(form.owner).name : '';

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const e = await saveLead(form, editId || undefined);
    setBusy(false);
    if (e) return setErr(e);
    closeIfStillOpen('lead', onClose);
  };
  /** New files are kept as File objects and uploaded by saveLead after the lead is saved. */
  const addFiles = (files) => {
    const list = Array.from(files || []);
    const ok = list.filter((f) => f.size <= MAX_FILE);
    const atts = ok.map((f) => ({ name: f.name, size: f.size, type: f.type || '', at: serverNow(), kind: docKind(f.name), url: '', file: f }));
    if (atts.length) setForm((f) => ({ ...f, atts: (f.atts || []).concat(atts) }));
    flash(attachedMessage(atts.length, list.length - ok.length));
  };
  const openExisting = (id) => { closeModal(); selectLead(id); };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit lead · ${editId}` : 'New lead'}
      width={560}
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy} aria-busy={busy}>{isEdit ? 'Save changes' : 'Add lead'}</Button>
        </>
      )}
    >
      <div className={s.grid}>
        <Field label="Company"><Input value={form.company} onChange={set('company')} /></Field>
        <Field label="Contact person"><Input value={form.contact} onChange={set('contact')} /></Field>
        <Field label="Email"><Input value={form.email} onChange={set('email')} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={set('phone')} /></Field>
        <Field as="div" full label={<>Services <span className={s.hintInline}>· pick one or more</span></>}>
          <ServiceChips value={form.service} onChange={(service) => { setForm((f) => ({ ...f, service })); setErr(''); }} />
        </Field>
        <Field label="Source"><Select
          value={form.source}
          onChange={set('source')}
          options={sourceOpts}
          createLabel="Add source"
          onCreate={(label) => {
            const name = addSource(label);
            if (name) setForm((f) => ({ ...f, source: name }));
            return name;
          }}
        /></Field>
        <Field label={isEdit ? 'Owner' : isExec ? 'Owner' : 'Assign lead to'} as={isEdit || isExec ? 'div' : undefined}>
          {isEdit ? <LockedOwner name={ownerName} note="Use Transfer in the lead" />
            : isExec ? <LockedOwner name={ownerName} note="Assigned to you" />
              : <Select value={form.owner} onChange={set('owner')} options={ownerOpts()} />}
        </Field>
        <Field label="Est. value (₹)"><Input type="number" value={form.value} onChange={set('value')} /></Field>
        <Field full label="Notes"><Textarea value={form.notes} onChange={set('notes')} rows={3} /></Field>
        <div className={s.full}>
          <DocumentsPanel docs={form.atts} onAddFiles={addFiles} onChange={(fn) => setForm((f) => ({ ...f, atts: fn(f.atts || []) }))} />
        </div>
        {dups.length > 0 && (
          <div className={`${s.full} ${s.dups}`}>
            <div className={s.dupTitle}>This lead may already exist</div>
            {dups.map((l) => (
              <div key={l.id} className={s.dupRow}>
                <span className={s.dupText}><b>{l.id}</b> · {l.company} · {l.contact} · {l.status} · {ownerOf(l.owner).name}</span>
                <Button size="sm" onClick={() => openExisting(l.id)}>Open existing</Button>
              </div>
            ))}
          </div>
        )}
        {err && <ErrorText className={s.full}>{err}</ErrorText>}
      </div>
    </Modal>
  );
}
