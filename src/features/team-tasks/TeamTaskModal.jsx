import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { can } from '@/domain/permissions';
import { Button, ErrorText, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { teamTasksApi } from '@/api/teamTasks';
import { ymd } from '@/lib/date';
import { TT_STATUSES, isPreview, previewAssignees, viewerId } from './model';

const PRIO_OPTS = ['High', 'Medium', 'Low'].map((p) => ({ value: p, label: p }));
const STATUS_OPTS = TT_STATUSES.map((p) => ({ value: p, label: p }));

/** Create / edit a team task (ModalHost kind 'tt'). Props: {editId?, assignee?, onClose}. */
export default function TeamTaskModal({ editId, assignee, projectId, leadId, onClose }) {
  const st = useStore(useShallow((x) => ({ teamTasks: x.teamTasks, users: x.users, roles: x.roles, viewAs: x.viewAs, auth: x.auth, me: x.me })));
  const saveTeamTask = useStore((x) => x.saveTeamTask);
  const editing = editId ? (st.teamTasks || []).find((t) => t.id === editId) : null;
  const { projects, leads } = useScoped();
  const canProjects = useStore((x) => can(x, 'projects', 'v'));
  const canLeads = useStore((x) => can(x, 'leads', 'v'));
  const preview = isPreview(st);

  const [people, setPeople] = useState(() => (preview ? previewAssignees(st) : null));
  const [form, setForm] = useState(() => (editing
    ? { title: editing.title, notes: editing.notes, prio: editing.prio, due: editing.due ? ymd(editing.due) : '', a: editing.a, status: editing.status, p: editing.p, lead: editing.lead }
    : { title: '', notes: '', prio: 'Medium', due: '', a: assignee || '', status: '', p: projectId || '', lead: leadId || '' }));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preview) return undefined;
    let live = true;
    teamTasksApi.assignees().then((r) => { if (live) setPeople(r); }).catch((e) => { if (live) { setPeople([]); setErr(e.message); } });
    return () => { live = false; };
  }, [preview]);

  const me = viewerId(st);
  const opts = useMemo(() => {
    const list = (people || []).slice();
    if (editing && !list.some((p) => p.id === editing.a)) list.push({ id: editing.a, name: editing.aName });
    return [{ value: '', label: people ? 'Pick a person…' : 'Loading…' }].concat(
      list.map((p) => ({ value: p.id, label: p.id === me || p.self ? `${p.name} (me)` : p.role ? `${p.name} · ${p.role}` : p.name })),
    );
  }, [people, editing, me]);
  const onlySelf = people && people.length === 1;
  const projOpts = useMemo(() => {
    const list = (projects || []).filter((p) => !['Completed', 'Cancelled'].includes(p.status) || p.id === form.p)
      .slice().sort((a, b) => a.name.localeCompare(b.name));
    if (editing && editing.p && !list.some((p) => p.id === editing.p)) list.push({ id: editing.p, name: editing.pName, client: '' });
    return [{ value: '', label: 'No project' }].concat(list.map((p) => ({ value: p.id, label: p.client ? `${p.name} · ${p.client}` : p.name })));
  }, [projects, form.p, editing]);
  const leadOpts = useMemo(() => {
    const list = (leads || []).slice().sort((a, b) => (a.company || a.contact || '').localeCompare(b.company || b.contact || ''));
    if (editing && editing.lead && !list.some((l) => l.id === editing.lead)) list.push({ id: editing.lead, company: editing.leadName });
    return [{ value: '', label: 'No lead' }].concat(list.map((l) => ({
      value: l.id, label: `${l.company || l.contact || l.id}${l.contact && l.company && l.contact !== l.company ? ` · ${l.contact}` : ''} (${l.id})`,
    })));
  }, [leads, editing]);
  const showProject = canProjects || !!form.p;
  const showLead = canLeads || !!form.lead;

  const bind = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e && e.target ? e.target.value : e })) });

  const save = async () => {
    if (busy) return;
    if (!form.title.trim()) return setErr('Add a title.');
    if (!form.a) return setErr('Pick who this task is for.');
    setBusy(true);
    const e = await saveTeamTask(form, editId || undefined);
    setBusy(false);
    if (e) return setErr(e);
    onClose();
  };

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={save} disabled={busy} aria-busy={busy}>{editing ? 'Save changes' : 'Give task'}</Button>
    </div>
  );

  return (
    <Modal open onClose={onClose} title={editing ? 'Edit task' : 'New task'} width={560} footer={footer}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Task">
          <Input {...bind('title')} placeholder="e.g. Prepare the release checklist" autoFocus />
        </Field>
        <Field label="Details">
          <Textarea {...bind('notes')} rows={4} placeholder="What needs to be done, links, acceptance…" />
        </Field>
        {(showProject || showLead) && (
          <div style={{ display: 'grid', gridTemplateColumns: showProject && showLead ? '1fr 1fr' : '1fr', gap: 12 }}>
            {showProject && <Field label="Related project (optional)"><Select {...bind('p')} options={projOpts} /></Field>}
            {showLead && <Field label="Related lead (optional)"><Select {...bind('lead')} options={leadOpts} /></Field>}
          </div>
        )}
        <Field label="Assign to">
          <Select {...bind('a')} options={opts} />
        </Field>
        {onlySelf && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: -8 }}>Nobody reports to you yet, so you can only add tasks for yourself. Set &quot;Reports to&quot; on a user in Users &amp; roles to give them tasks.</div>}
        <div style={{ display: 'grid', gridTemplateColumns: editing ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12 }}>
          <Field label="Due date"><Input type="date" {...bind('due')} /></Field>
          <Field label="Priority"><Select {...bind('prio')} options={PRIO_OPTS} /></Field>
          {editing && <Field label="Status"><Select {...bind('status')} options={STATUS_OPTS} /></Field>}
        </div>
        {err && <ErrorText>{err}</ErrorText>}
      </div>
    </Modal>
  );
}
