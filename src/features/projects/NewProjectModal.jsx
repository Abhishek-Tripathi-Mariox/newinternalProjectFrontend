import { useState } from 'react';
import { Button, DocumentsPanel, ErrorText, Field, Input, LinksEditor, Modal, Select, Textarea } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { DAY, today, ymd } from '@/lib/date';
import { MILESTONE_TEMPLATE, PRIORITY_NAMES } from '@/config/constants';
import { getServices, useMasters, useServices } from '@/store/masters';
import AddChip from '@/features/leads/components/AddChip';
import ToggleChip from './components/ToggleChip';
import { STATUS_KEYS } from './lib/view';
import s from './modals.module.css';

const DEFAULT_PM = 'mj';

/** Due date of template milestone i, spread between start and due like the server does. */
function spreadDue(start, due, i) {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${due}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return due || start || '';
  const cum = MILESTONE_TEMPLATE.fractions.slice(0, i + 1).reduce((x, f) => x + f, 0);
  const days = Math.floor(((b - a) / DAY) * cum + 0.5);
  return new Date(a + days * DAY).toISOString().slice(0, 10);
}

/** The five default milestones; `auto` rows follow the project dates until their date is edited. */
const templateRows = (start, due) => MILESTONE_TEMPLATE.names.map((name, i) => ({ key: i, name, due: spreadDue(start, due, i), hours: '', auto: true }));
const respread = (rows, start, due) => rows.map((r, i) => (r.auto ? { ...r, due: i < MILESTONE_TEMPLATE.fractions.length ? spreadDue(start, due, i) : due } : r));
let rowKey = 100;

function initialForm(members) {
  const T = today();
  return {
    name: '',
    client: '',
    clientEmail: '',
    service: '',
    status: 'Planning',
    pm: members.some((m) => m.id === DEFAULT_PM) ? DEFAULT_PM : (members[0] || {}).id || '',
    start: ymd(T),
    due: ymd(T + 60 * DAY),
    team: [],
    value: '',
    prio: 'Medium',
    brief: '',
    links: [{ type: 'Figma', url: '' }],
    atts: [],
    ms: templateRows(ymd(T), ymd(T + 60 * DAY)),
  };
}

/** Existing project → form values (edit mode). */
function editForm(p) {
  return {
    name: p.name || '',
    client: p.client || '',
    clientEmail: p.clientEmail || '',
    service: p.service || '',
    status: p.status,
    pm: p.pm || '',
    start: p.start ? ymd(p.start) : '',
    due: p.due ? ymd(p.due) : '',
    value: p.value ? String(p.value) : '',
    prio: p.prio || 'Medium',
    brief: p.brief || '',
  };
}

/**
 * "New project" / "Edit project" modal (ModalHost kind 'proj'; pass `editId` to edit).
 * New: five template milestones are created by the store. Edit: budget, team, links and documents
 * stay in the drawer (budget = the milestones' hours).
 */
export default function NewProjectModal({ editId, onClose }) {
  const { members } = useScoped();
  const saveProj = useStore((st) => st.saveProj);
  const editProj = useStore((st) => st.editProj);
  const editing = useStore((st) => (editId ? st.projects.find((p) => p.id === editId) : null));
  const isEdit = !!editId;
  const [form, setForm] = useState(() => (editing ? editForm(editing) : initialForm(members)));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setDate = (k) => (e) => setForm((f) => {
    const next = { ...f, [k]: e.target.value };
    return next.ms ? { ...next, ms: respread(next.ms, next.start, next.due) } : next;
  });
  const setMs = (key, patch) => setForm((f) => ({ ...f, ms: f.ms.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const addMs = () => setForm((f) => ({ ...f, ms: f.ms.concat({ key: rowKey++, name: '', due: f.due, hours: '', auto: false }) }));
  const removeMs = (key) => setForm((f) => ({ ...f, ms: f.ms.filter((r) => r.key !== key) }));
  const msTotal = (form.ms || []).reduce((x, r) => x + (+r.hours || 0), 0);
  const services = form.service.split(', ').filter(Boolean);
  const toggleService = (sv) => {
    const list = getServices();
    const next = services.includes(sv) ? services.filter((x) => x !== sv) : list.filter((x) => x === sv || services.includes(x));
    setForm((f) => ({ ...f, service: next.join(', ') }));
    setErr('');
  };
  const serviceList = useServices();
  const addService = useMasters((st) => st.addService);
  const addServiceChip = (text) => {
    const name = addService(text);
    if (name && !services.includes(name)) toggleService(name);
    return !!name;
  };
  const toggleMember = (id) => setForm((f) => ({ ...f, team: f.team.includes(id) ? f.team.filter((x) => x !== id) : f.team.concat(id) }));

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const e = isEdit ? await editProj(editId, form) : await saveProj(form);
    setBusy(false);
    if (e) setErr(e);
    else onClose?.();
  };

  const footer = (
    <div className={s.footer}>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={save} disabled={busy}>
        {isEdit ? (busy ? 'Saving…' : 'Save changes') : busy ? 'Creating…' : 'Create project'}
      </Button>
    </div>
  );

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit project · ${editId}` : 'New project'} width={600} footer={footer}>
      <div className={s.grid2}>
        <Field label="Project name">
          <Input value={form.name} onChange={set('name')} data-autofocus />
        </Field>
        <Field label="Client">
          <Input value={form.client} onChange={set('client')} />
        </Field>
        <Field
          full
          label={
            <>
              Client email <span className={s.light}>· change requests and milestone reviews are emailed here</span>
            </>
          }
        >
          <Input type="email" value={form.clientEmail} onChange={set('clientEmail')} placeholder="e.g. owner@clientcompany.com" />
        </Field>
        <Field
          as="div"
          full
          label={
            <>
              Services <span className={s.light}>· pick one or more</span>
            </>
          }
        >
          <div className={s.chips}>
            {serviceList.map((sv) => (
              <ToggleChip key={sv} mark on={services.includes(sv)} onClick={() => toggleService(sv)}>
                {sv}
              </ToggleChip>
            ))}
            <AddChip onAdd={addServiceChip} />
          </div>
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={set('status')} options={STATUS_KEYS} />
        </Field>
        <Field label="Project manager">
          <Select value={form.pm} onChange={set('pm')} options={members.map((m) => ({ value: m.id, label: m.name }))} />
        </Field>
        <Field label="Start date">
          <Input type="date" value={form.start} onChange={setDate('start')} />
        </Field>
        <Field label="Due date">
          <Input type="date" value={form.due} onChange={setDate('due')} />
        </Field>
        {!isEdit && (
        <Field as="div" full label="Team">
          <div className={s.chips}>
            {members
              .filter((m) => m.id !== form.pm)
              .map((m) => (
                <ToggleChip key={m.id} on={form.team.includes(m.id)} onClick={() => toggleMember(m.id)}>
                  {m.name}
                </ToggleChip>
              ))}
          </div>
        </Field>
        )}
        <Field label="Contract value (₹)">
          <Input type="number" min="0" step="10000" value={form.value} onChange={set('value')} placeholder="e.g. 1500000" />
        </Field>
        <Field label="Priority">
          <Select value={form.prio} onChange={set('prio')} options={PRIORITY_NAMES} />
        </Field>
        <Field full label="Project brief">
          <Textarea value={form.brief} onChange={set('brief')} rows={3} placeholder="Scope summary, key features, client expectations…" />
        </Field>
        {!isEdit && (
        <>
        <div className={s.full}>
          <LinksEditor links={form.links} onChange={(links) => setForm((f) => ({ ...f, links }))} />
        </div>
        <div className={s.full}>
          <DocumentsPanel docs={form.atts} onChange={(fn) => setForm((f) => ({ ...f, atts: fn(f.atts || []) }))} />
        </div>
        <div className={`${s.full} ${s.groupLabel}`}>
          <div className={s.row}>
            <span>Milestones</span>
            <span className={s.light}>
              {form.ms.length} milestone{form.ms.length === 1 ? '' : 's'} · budget {msTotal}h
            </span>
          </div>
          <div className={s.msHead}>
            <span>Name</span>
            <span>Due date</span>
            <span>Hours</span>
            <span />
          </div>
          {form.ms.map((r, i) => (
            <div key={r.key} className={s.msRow}>
              <Input value={r.name} placeholder={`Milestone ${i + 1}`} aria-label={`Milestone ${i + 1} name`} onChange={(e) => setMs(r.key, { name: e.target.value })} />
              <Input type="date" value={r.due} aria-label={`Milestone ${i + 1} due date`} onChange={(e) => setMs(r.key, { due: e.target.value, auto: false })} />
              <Input type="number" min="0" step="1" value={r.hours} placeholder="0" aria-label={`Milestone ${i + 1} hours`} onChange={(e) => setMs(r.key, { hours: e.target.value })} />
              <button type="button" className={s.removeBtn} aria-label={`Remove milestone ${i + 1}`} onClick={() => removeMs(r.key)}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className={s.addBtn} onClick={addMs}>
            + Add milestone
          </button>
          <span className={s.note}>The project budget is the total of these hours. You can rename, re-date, add or remove milestones later too.</span>
        </div>
        </>
        )}
        {isEdit && (
          <div className={`${s.full} ${s.note}`}>
            Budget hours come from the milestones; team, links and documents are edited in the project panel.
          </div>
        )}
        {err && <ErrorText className={s.full}>{err}</ErrorText>}
      </div>
    </Modal>
  );
}
