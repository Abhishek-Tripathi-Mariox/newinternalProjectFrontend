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
const templateRows = (start, due) => MILESTONE_TEMPLATE.names.map((name, i) => ({ key: i, name, due: spreadDue(start, due, i), hours: '', auto: true, team: [] }));
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
    budget: '',
    team: [],
    primary: [],
    value: '',
    prio: 'Medium',
    brief: '',
    links: [{ type: 'Figma', url: '' }],
    atts: [],
    ms: templateRows(ymd(T), ymd(T + 60 * DAY)),
  };
}

/** Existing project → form values (edit mode), with its milestones as editable rows. */
function editForm(p, milestones) {
  const ms = milestones.filter((m) => m.p === p.id).sort((a, b) => a.n - b.n)
    .map((m) => ({ key: m.id, id: m.id, name: m.name, due: m.due ? ymd(m.due) : '', hours: String(m.alloc || 0), auto: false, cr: !!m.cr, team: m.team || [] }));
  return {
    ms,
    team: (p.team || []).filter((x) => x !== p.pm),
    primary: p.primary || [],
    budget: p.budgetHours != null ? String(p.budgetHours) : '', // '' = no budget set (no limit)
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
  const { members, logs } = useScoped();
  const allMilestones = useStore((st) => st.milestones);
  const saveProj = useStore((st) => st.saveProj);
  const editProj = useStore((st) => st.editProj);
  const editing = useStore((st) => (editId ? st.projects.find((p) => p.id === editId) : null));
  const isEdit = !!editId;
  const [form, setForm] = useState(() => (editing ? editForm(editing, allMilestones) : initialForm(members)));
  const [startServices] = useState(() => (editing ? String(editing.service || '').split(', ').filter(Boolean) : []));
  const loggedOn = (mid) => !!mid && (logs || []).some((l) => l.ms === mid);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setDate = (k) => (e) => setForm((f) => {
    const next = { ...f, [k]: e.target.value };
    return next.ms ? { ...next, ms: respread(next.ms, next.start, next.due) } : next;
  });
  const setMs = (key, patch) => setForm((f) => ({ ...f, ms: f.ms.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const addMs = () => setForm((f) => ({ ...f, ms: f.ms.concat({ key: rowKey++, name: '', due: f.due, hours: '', auto: false, team: [] }) }));
  const [teamRow, setTeamRow] = useState(null); // milestone row whose team picker is open
  // Picking someone who is not on the project team adds them to it as well.
  const toggleMsMember = (key, id) => setForm((f) => {
    const row = f.ms.find((r) => r.key === key) || {};
    const adding = !(row.team || []).includes(id);
    return {
      ...f,
      team: adding && id !== f.pm && !f.team.includes(id) ? f.team.concat(id) : f.team,
      ms: f.ms.map((r) => (r.key === key ? { ...r, team: adding ? (r.team || []).concat(id) : r.team.filter((x) => x !== id) } : r)),
    };
  });
  const memberName = (id) => (members.find((m) => m.id === id) || {}).name || id;
  const removeMs = (key) => setForm((f) => ({ ...f, ms: f.ms.filter((r) => r.key !== key) }));
  const msTotal = (form.ms || []).reduce((x, r) => x + (+r.hours || 0), 0);
  const budgetN = Math.max(0, +form.budget || 0);
  const overBy = budgetN > 0 ? msTotal - budgetN : 0;
  /** Split the budget across the milestones: template shares for the 5 defaults, else evenly; whole hours, remainder on the last. */
  const distribute = () => setForm((f) => {
    const B = Math.max(0, Math.round(+f.budget || 0));
    const n = f.ms.length;
    if (!B || !n) return f;
    const tpl = n === MILESTONE_TEMPLATE.fractions.length ? MILESTONE_TEMPLATE.fractions : null;
    let left = B;
    const ms = f.ms.map((r, i) => {
      const h = i === n - 1 ? left : Math.round(B * (tpl ? tpl[i] : 1 / n));
      left -= h;
      return { ...r, hours: String(Math.max(0, h)) };
    });
    return { ...f, ms };
  });
  const services = form.service.split(', ').filter(Boolean);
  // Services already on the project but not in the master list stay pickable while the form is open.
  const toggleService = (sv) => {
    const list = getServices().concat(startServices.filter((x) => !getServices().includes(x)));
    const next = services.includes(sv) ? services.filter((x) => x !== sv) : list.filter((x) => x === sv || services.includes(x));
    setForm((f) => ({ ...f, service: next.join(', ') }));
    setErr('');
  };
  const masterServices = useServices();
  const serviceList = masterServices.concat(startServices.filter((x) => !masterServices.includes(x)));
  const addService = useMasters((st) => st.addService);
  const addServiceChip = (text) => {
    const name = addService(text);
    if (name && !services.includes(name)) toggleService(name);
    return !!name;
  };
  // Taking someone off the project team also takes them off its milestones.
  const toggleMember = (id) => setForm((f) => (f.team.includes(id)
    ? { ...f, team: f.team.filter((x) => x !== id), primary: (f.primary || []).filter((x) => x !== id), ms: (f.ms || []).map((r) => ({ ...r, team: (r.team || []).filter((x) => x !== id) })) }
    : { ...f, team: f.team.concat(id) }));
  const otherMembers = members.filter((m) => m.id !== form.pm && (!m.inactive || form.team.includes(m.id)));
  const projectTeam = [form.pm].concat(form.team).filter(Boolean);
  const togglePrimary = (id) => setForm((f) => ({ ...f, primary: (f.primary || []).includes(id) ? f.primary.filter((x) => x !== id) : (f.primary || []).concat(id) }));
  // Milestone pickers: the project team first, then every other active delivery person.
  const msChoices = projectTeam.concat(members.filter((m) => !m.inactive && !projectTeam.includes(m.id)).map((m) => m.id));

  const save = async () => {
    if (busy) return;
    if (overBy > 0) {
      setErr(`Milestone hours (${msTotal}h) are more than the budget (${budgetN}h). Reduce them or raise the budget.`);
      return;
    }
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
        <Field label="Budget (hours)">
          <Input type="number" min="0" step="5" value={form.budget} onChange={set('budget')} placeholder="e.g. 400" />
        </Field>
        <Field label="Start date">
          <Input type="date" value={form.start} onChange={setDate('start')} />
        </Field>
        <Field label="Due date">
          <Input type="date" value={form.due} onChange={setDate('due')} />
        </Field>
        <Field
          as="div"
          full
          label={
            <>
              Team <span className={s.light}>· the project manager is always on the team</span>
            </>
          }
        >
          {otherMembers.length ? (
            <div className={s.chips}>
              {otherMembers.map((m) => (
                <ToggleChip key={m.id} on={form.team.includes(m.id)} onClick={() => toggleMember(m.id)}>
                  {m.name}
                </ToggleChip>
              ))}
            </div>
          ) : (
            <div className={s.note}>
              No other delivery people yet. Invite developers, designers or QA from <b>Users &amp; roles</b> — they show up here once they accept.
            </div>
          )}
          {projectTeam.length > 0 && (
            <div className={s.primaryRow}>
              <span className={s.light}>Primary developer:</span>
              {projectTeam.map((id) => (
                <ToggleChip key={id} on={(form.primary || []).includes(id)} onClick={() => togglePrimary(id)} title="Main person responsible for building this project">
                  {(form.primary || []).includes(id) ? '★ ' : '☆ '}{memberName(id)}
                </ToggleChip>
              ))}
            </div>
          )}
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
        {!isEdit && (
        <>
        <div className={s.full}>
          <LinksEditor links={form.links} onChange={(links) => setForm((f) => ({ ...f, links }))} />
        </div>
        <div className={s.full}>
          <DocumentsPanel docs={form.atts} onChange={(fn) => setForm((f) => ({ ...f, atts: fn(f.atts || []) }))} />
        </div>
        </>
        )}
        <div className={`${s.full} ${s.groupLabel}`}>
          <div className={s.row}>
            <span>Milestones</span>
            <span className={s.light}>
              {form.ms.length} milestone{form.ms.length === 1 ? '' : 's'} · {msTotal}h{budgetN > 0 ? ` of ${budgetN}h budget` : ''}
              {budgetN > 0 && form.ms.length > 0 && (
                <>
                  {' · '}
                  <button type="button" className={s.addBtn} onClick={distribute} title="Split the budget across these milestones">
                    Distribute budget
                  </button>
                </>
              )}
            </span>
          </div>
          <div className={s.msHead}>
            <span>Name</span>
            <span>Due date</span>
            <span>Hours</span>
            <span>Team</span>
            <span />
          </div>
          {form.ms.map((r, i) => (
            <div key={r.key} className={s.msRow}>
              <Input value={r.name} placeholder={`Milestone ${i + 1}`} aria-label={`Milestone ${i + 1} name`} onChange={(e) => setMs(r.key, { name: e.target.value })} />
              <Input type="date" value={r.due} aria-label={`Milestone ${i + 1} due date`} onChange={(e) => setMs(r.key, { due: e.target.value, auto: false })} />
              <Input type="number" min="0" step="1" value={r.hours} placeholder="0" aria-label={`Milestone ${i + 1} hours`} onChange={(e) => setMs(r.key, { hours: e.target.value })} />
              <button
                type="button"
                className={`${s.teamBtn} ${teamRow === r.key ? s.teamBtnOn : ''}`}
                aria-expanded={teamRow === r.key}
                title={(r.team || []).length ? (r.team || []).map(memberName).join(', ') : 'Pick who works on this milestone'}
                onClick={() => setTeamRow(teamRow === r.key ? null : r.key)}
              >
                {(r.team || []).length ? `👥 ${r.team.length}` : '+ Team'}
              </button>
              {r.cr || loggedOn(r.id) ? (
                <span className={s.removeBtn} title={r.cr ? 'Change-request milestone — can’t be removed' : 'Hours are logged on this milestone — it can’t be removed'}>🔒</span>
              ) : (
                <button type="button" className={s.removeBtn} aria-label={`Remove milestone ${i + 1}`} onClick={() => removeMs(r.key)}>
                  ✕
                </button>
              )}
              {teamRow === r.key && (
                <div className={s.msTeam}>
                  {msChoices.length ? msChoices.map((id) => (
                    <ToggleChip key={id} on={(r.team || []).includes(id)} onClick={() => toggleMsMember(r.key, id)}>
                      {memberName(id)}{projectTeam.includes(id) ? '' : ' +'}
                    </ToggleChip>
                  )) : <span className={s.light}>No delivery people yet — invite them from Users &amp; roles.</span>}
                  {msChoices.some((id) => !projectTeam.includes(id)) && <span className={s.light}>“+” = joins the project team when picked.</span>}
                </div>
              )}
            </div>
          ))}
          <button type="button" className={s.addBtn} onClick={addMs}>
            + Add milestone
          </button>
          {overBy > 0 && (
            <div className={s.overAlert} role="alert">
              Milestone hours are {overBy}h more than the budget ({msTotal}h of {budgetN}h). Reduce the hours or raise the budget.
            </div>
          )}
          {budgetN > 0 && overBy < 0 && msTotal > 0 && (
            <div className={s.underNote}>
              {-overBy}h of the budget is not assigned to a milestone yet.
            </div>
          )}
          <span className={s.note}>
            {budgetN > 0 ? 'Use “Distribute budget” to split it, or type hours per milestone.' : 'Without a budget, the milestone hours add up to the project budget.'}
            {isEdit ? ' Links and documents are edited in the project panel.' : ' You can rename, re-date, add or remove milestones later too.'}
          </span>
        </div>
        {err && <ErrorText className={s.full}>{err}</ErrorText>}
      </div>
    </Modal>
  );
}
