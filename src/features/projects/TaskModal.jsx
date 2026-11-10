import { useState } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { curMs } from '@/domain/projects';
import { Button, ErrorText, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { GREEN, INK, MUTED } from '@/lib/color';
import { DAY, fd, ymd } from '@/lib/date';
import { PRIORITY_NAMES } from '@/config/constants';
import { TASK_STATUS_KEYS } from './workItems';
import s from './WorkModals.module.css';

/** Initial form (port of openTask). */
function initialForm(task, pre, projects, milestones) {
  if (task) {
    return {
      title: task.title, p: task.p, ms: task.ms, a: task.a || '', st: task.st, prio: task.prio,
      due: task.due ? ymd(task.due) : '', est: String(task.est || ''), desc: task.desc || '', cl: (task.cl || []).slice(),
    };
  }
  const p = projects.find((x) => x.id === pre.p) || projects.find((x) => x.status === 'Running') || projects[0] || {};
  return {
    title: '', p: p.id || '', ms: p.id ? curMs(milestones, p.id) : '', a: pre.a || '', st: pre.st || 'To do', prio: 'Medium',
    due: ymd(Date.now() + 3 * DAY), est: '', desc: '', cl: [],
  };
}

/** Create / edit a task, with checklist. Props: {editId?, p?, a?, st?, onClose}. */
export default function TaskModal({ editId, p, a, st, onClose }) {
  const saveTask = useStore((x) => x.saveTask);
  const delTask = useStore((x) => x.delTask);
  const milestones = useStore((x) => x.milestones);
  const task = useStore((x) => (editId ? (x.tasks || []).find((t) => t.id === editId) : null));
  const scoped = useScoped();
  const { MEM, msOf } = useProjectsModel();
  const { projects, members } = scoped;

  const [form, setForm] = useState(() => initialForm(task, { p, a, st }, projects, milestones));
  const [newItem, setNewItem] = useState('');
  const [err, setErr] = useState('');
  const set = (k) => (e) => { const v = e.target.value; setForm((f) => ({ ...f, [k]: v })); };
  const setCl = (fn) => setForm((f) => ({ ...f, cl: fn(f.cl) }));
  const addItem = () => {
    const v = newItem.trim();
    if (!v) return;
    setCl((c) => c.concat({ t: v, done: false }));
    setNewItem('');
  };

  const pp = projects.find((x) => x.id === form.p);
  const aOpts = (pp ? pp.team : [])
    .map((id) => ({ value: id, label: `${(MEM[id] || {}).name} · ${(MEM[id] || {}).role}` }))
    .concat(members.filter((m) => !pp || !pp.team.includes(m.id)).map((m) => ({ value: m.id, label: `${m.name} (not on team)` })));
  const doneN = form.cl.filter((x) => x.done).length;
  const isEdit = !!editId;

  const save = () => {
    const e = saveTask(form, editId || undefined);
    if (e) setErr(e);
    else onClose?.();
  };
  const del = () => { delTask(editId); onClose?.(); };

  return (
    <Modal
      open
      onClose={onClose}
      width={640}
      title={isEdit ? 'Edit task' : 'New task'}
      sub={isEdit && task ? `${task.id} · created ${fd(task.created || Date.now())}` : undefined}
      footer={(
        <div className={s.footer}>
          <div>{isEdit && <Button variant="dangerOutline" onClick={del}>Delete task</Button>}</div>
          <div className={s.footRight}>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save}>{isEdit ? 'Save changes' : 'Create task'}</Button>
          </div>
        </div>
      )}
    >
      <div className={s.grid2}>
        <Field label="Task title" full className={s.full}>
          <Input value={form.title} onChange={set('title')} placeholder="e.g. Payment gateway integration" invalid={!!err && !form.title.trim()} data-autofocus />
        </Field>
        <Field label="Project">
          <Select
            value={form.p}
            options={projects.map((x) => ({ value: x.id, label: x.name }))}
            onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, p: v, ms: curMs(milestones, v) })); }}
          />
        </Field>
        <Field label="Milestone">
          <Select value={form.ms} onChange={set('ms')} options={(msOf[form.p] || []).map((x) => ({ value: x.id, label: `${x.n}. ${x.name}` }))} />
        </Field>
        <Field label="Assign to">
          <Select value={form.a} onChange={set('a')} placeholder="Unassigned" options={aOpts} />
        </Field>
        <Field label="Status">
          <Select value={form.st} onChange={set('st')} options={TASK_STATUS_KEYS} />
        </Field>
        <Field label="Priority">
          <Select value={form.prio} onChange={set('prio')} options={PRIORITY_NAMES} />
        </Field>
        <div className={s.pair}>
          <Field label="Due date"><Input type="date" value={form.due} onChange={set('due')} /></Field>
          <Field label="Estimate (h)"><Input type="number" min="0" step="0.5" className={s.num} value={form.est} onChange={set('est')} /></Field>
        </div>
        <Field label="Description" full className={s.full}>
          <Textarea rows={3} value={form.desc} onChange={set('desc')} placeholder="Details, acceptance criteria, links…" />
        </Field>

        <div className={`${s.label} ${s.full}`}>
          <span>Checklist <span className={s.thin}>{form.cl.length ? `(${doneN} of ${form.cl.length} done)` : ''}</span></span>
          <div className={s.check}>
            {form.cl.map((it, i) => (
              <div key={i} className={s.checkItem}>
                <button
                  type="button"
                  className={s.box}
                  aria-pressed={it.done}
                  aria-label={it.done ? 'Mark not done' : 'Mark done'}
                  style={{ borderColor: it.done ? GREEN : 'oklch(0.8 0.01 265)', background: it.done ? GREEN : '#fff' }}
                  onClick={() => setCl((c) => c.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
                >
                  {it.done ? '✓' : ''}
                </button>
                <span className={s.itemText} style={{ color: it.done ? MUTED : INK, textDecoration: it.done ? 'line-through' : 'none' }}>{it.t}</span>
                <button type="button" className={s.rm} aria-label="Remove item" onClick={() => setCl((c) => c.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <div className={s.addRow}>
              <Input
                compact
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                placeholder="Add a checklist item and press Enter"
              />
              <Button size="sm" onClick={addItem}>Add</Button>
            </div>
          </div>
        </div>

        {err && <ErrorText className={s.full}>{err}</ErrorText>}
      </div>
    </Modal>
  );
}
