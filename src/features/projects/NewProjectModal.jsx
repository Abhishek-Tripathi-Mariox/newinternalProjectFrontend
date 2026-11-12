import { useState } from 'react';
import { Button, DocumentsPanel, ErrorText, Field, Input, LinksEditor, Modal, Select, Textarea } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { DAY, today, ymd } from '@/lib/date';
import { PRIORITY_NAMES } from '@/config/constants';
import { getServices, useMasters, useServices } from '@/store/masters';
import AddChip from '@/features/leads/components/AddChip';
import ToggleChip from './components/ToggleChip';
import { STATUS_KEYS } from './lib/view';
import s from './modals.module.css';

const DEFAULT_PM = 'mj';

function initialForm(members) {
  const T = today();
  return {
    name: '',
    client: '',
    service: '',
    status: 'Planning',
    pm: members.some((m) => m.id === DEFAULT_PM) ? DEFAULT_PM : (members[0] || {}).id || '',
    start: ymd(T),
    due: ymd(T + 60 * DAY),
    budget: '600',
    team: [],
    value: '',
    prio: 'Medium',
    brief: '',
    links: [{ type: 'Figma', url: '' }],
    atts: [],
  };
}

/** "New project" modal (ModalHost kind 'proj'). Five template milestones are created by the store. */
export default function NewProjectModal({ onClose }) {
  const { members } = useScoped();
  const saveProj = useStore((st) => st.saveProj);
  const [form, setForm] = useState(() => initialForm(members));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
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
    const e = await saveProj(form);
    setBusy(false);
    if (e) setErr(e);
    else onClose?.();
  };

  const footer = (
    <div className={s.footer}>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={save} disabled={busy}>
        {busy ? 'Creating…' : 'Create project'}
      </Button>
    </div>
  );

  return (
    <Modal open onClose={onClose} title="New project" width={600} footer={footer}>
      <div className={s.grid2}>
        <Field label="Project name">
          <Input value={form.name} onChange={set('name')} data-autofocus />
        </Field>
        <Field label="Client">
          <Input value={form.client} onChange={set('client')} />
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
        <Field label="Budget (hours)">
          <Input type="number" min="0" step="10" value={form.budget} onChange={set('budget')} />
        </Field>
        <Field label="Start date">
          <Input type="date" value={form.start} onChange={set('start')} />
        </Field>
        <Field label="Due date">
          <Input type="date" value={form.due} onChange={set('due')} />
        </Field>
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
        <Field label="Contract value (₹)">
          <Input type="number" min="0" step="10000" value={form.value} onChange={set('value')} placeholder="e.g. 1500000" />
        </Field>
        <Field label="Priority">
          <Select value={form.prio} onChange={set('prio')} options={PRIORITY_NAMES} />
        </Field>
        <Field full label="Project brief">
          <Textarea value={form.brief} onChange={set('brief')} rows={3} placeholder="Scope summary, key features, client expectations…" />
        </Field>
        <div className={s.full}>
          <LinksEditor links={form.links} onChange={(links) => setForm((f) => ({ ...f, links }))} />
        </div>
        <div className={s.full}>
          <DocumentsPanel docs={form.atts} onChange={(fn) => setForm((f) => ({ ...f, atts: fn(f.atts || []) }))} />
        </div>
        <div className={`${s.full} ${s.note}`}>
          Five milestones are created (Discovery &amp; UI/UX, two development phases, QA &amp; UAT, Launch) with the budget split 15 / 30 / 30 / 15 / 10%. You can edit them
          after creating the project.
        </div>
        {err && <ErrorText className={s.full}>{err}</ErrorText>}
      </div>
    </Modal>
  );
}
