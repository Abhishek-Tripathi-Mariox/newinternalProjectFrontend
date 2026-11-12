import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { Button, Checkbox, ErrorText, Field, Input, Modal, Select, Textarea, Toggle } from '@/components/ui';
import { FU_TYPES, PRIORITY_NAMES, REMINDERS } from '@/config/constants';
import { RED } from '@/lib/color';
import { HOUR, MINUTE, hm, ymd } from '@/lib/date';
import { genMeet } from '@/lib/random';
import { serverNow } from '@/lib/clock';
import { useCopyMeet } from '@/features/followups/useCopyMeet';
import { TYPE_NAMES, typeDefaults } from '@/features/followups/model';
import { pfCalendarLink } from './model';
import s from '@/features/followups/FollowUpModal.module.css';

const PRIO_OPTS = PRIORITY_NAMES.map((p) => ({ value: p, label: p }));
const REMIND_OPTS = REMINDERS.map(([v, l]) => ({ value: String(v), label: l }));
const DUR_OPTS = [
  { value: '0', label: '—' }, { value: '15', label: '15 min' }, { value: '30', label: '30 min' },
  { value: '45', label: '45 min' }, { value: '60', label: '1 hour' }, { value: '90', label: '1.5 hours' },
];

function initialForm({ editId, pid, date }, pfus, projects, myMember) {
  const f = editId && pfus.find((x) => x.id === editId);
  if (f) {
    return {
      pid: f.p, type: f.type, title: f.title, owner: f.owner, date: ymd(f.due), time: hm(f.due), dur: String(f.dur || 0),
      prio: f.prio, remind: String(f.remind), meet: !!f.meet, meetUrl: f.meet || genMeet(), attendees: f.attendees || '',
      notes: f.notes || '', openCal: false,
    };
  }
  const p = projects.find((x) => x.id === pid) || null;
  const t = Math.ceil((serverNow() + 30 * MINUTE) / HOUR) * HOUR;
  return {
    pid: p ? p.id : '', type: 'Meeting', title: '', owner: myMember || (p && p.pm) || '', date: date || ymd(t), time: hm(t),
    dur: '45', prio: 'Medium', remind: '10', meet: true, meetUrl: genMeet(), attendees: p ? p.clientEmail || '' : '', notes: '', openCal: false,
  };
}

/** Create / edit a project follow-up (ModalHost kind 'pfu'). Props: {editId?, pid?, date?, onClose}. */
export default function ProjectFollowUpModal({ editId, pid, date, onClose }) {
  const pfus = useStore((st) => st.pfus);
  const savePfu = useStore((st) => st.savePfu);
  const myMember = useStore((st) => ((st.users || []).find((u) => st.auth && u.id === st.auth.uid) || {}).memberId);
  const { projects, members } = useScoped();
  const copyMeet = useCopyMeet();

  const [form, setForm] = useState(() => initialForm({ editId, pid, date }, pfus || [], projects, myMember));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const isEdit = !!editId;

  const projOpts = useMemo(
    () => [{ value: '', label: 'Pick a project…' }].concat(
      projects.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: `${p.name} · ${p.client}` })),
    ),
    [projects],
  );
  const proj = projects.find((p) => p.id === form.pid) || null;
  const ownerOpts = useMemo(() => {
    const active = members.filter((m) => !m.inactive || m.id === form.owner);
    // Project team first, then everyone else.
    const team = proj ? active.filter((m) => (proj.team || []).includes(m.id)) : [];
    const rest = active.filter((m) => !team.includes(m));
    return [{ value: '', label: 'Pick a person…' }]
      .concat(team.map((m) => ({ value: m.id, label: `${m.name} · on project` })))
      .concat(rest.map((m) => ({ value: m.id, label: m.name })));
  }, [members, proj, form.owner]);

  const patch = (p) => setForm((f) => ({ ...f, ...p }));
  const bind = (k) => ({ value: form[k], onChange: (e) => patch({ [k]: e && e.target ? e.target.value : e }) });
  const pickType = (t) => setForm((f) => {
    const d = typeDefaults(t);
    return { ...f, type: t, dur: d.dur, remind: d.remind, meet: isEdit ? f.meet : d.meet };
  });
  const onProject = (e) => {
    const id = e && e.target ? e.target.value : e;
    const p = projects.find((x) => x.id === id);
    setForm((f) => ({ ...f, pid: id, attendees: f.attendees || (p && p.clientEmail) || '', owner: f.owner || (p && p.pm) || '' }));
  };

  const save = async () => {
    if (busy) return;
    if (!form.pid) return setErr('Pick a project.');
    if (!form.title.trim()) return setErr('Add a title.');
    if (!form.date || !form.time) return setErr('Pick a date and time.');
    const { openCal, ...data } = form;
    const cal = openCal ? window.open('', '_blank') : null;
    setBusy(true);
    const e = await savePfu(data, editId || undefined);
    setBusy(false);
    if (e) {
      if (cal) cal.close();
      return setErr(e);
    }
    if (cal) {
      const due = new Date(`${form.date}T${form.time}`).getTime();
      cal.location.href = pfCalendarLink({
        title: form.title.trim(), due, dur: +form.dur, notes: form.notes, meet: form.meet ? form.meetUrl.trim() : '', attendees: form.attendees,
      }, proj);
    }
    onClose();
  };

  const footer = (
    <div className={s.footer}>
      <Checkbox checked={form.openCal} onChange={() => patch({ openCal: !form.openCal })} label="Also open in Google Calendar" />
      <div className={s.footerBtns}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy} aria-busy={busy}>{isEdit ? 'Save changes' : 'Schedule'}</Button>
      </div>
    </div>
  );

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit project follow-up' : 'New project follow-up'} width={580} footer={footer}>
      <div className={s.body}>
        <div className={s.types} role="radiogroup" aria-label="Type">
          {TYPE_NAMES.map((t) => {
            const on = form.type === t;
            const h = FU_TYPES[t];
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                className={s.typeBtn}
                onClick={() => pickType(t)}
                style={on ? { background: `oklch(0.95 0.04 ${h})`, color: `oklch(0.38 0.12 ${h})`, borderColor: `oklch(0.62 0.13 ${h})` } : undefined}
              >
                {t}
              </button>
            );
          })}
        </div>

        <Field label="Title">
          <Input {...bind('title')} placeholder="e.g. Sprint demo with client, UAT sign-off call" autoFocus style={err && !form.title.trim() ? { borderColor: RED } : undefined} />
        </Field>

        <div className={s.grid2}>
          <Field label="Project">
            <Select value={form.pid} onChange={onProject} options={projOpts} />
          </Field>
          <Field label="Assign to">
            <Select {...bind('owner')} options={ownerOpts} />
          </Field>
        </div>

        <div className={s.grid3}>
          <Field label="Date"><Input type="date" {...bind('date')} /></Field>
          <Field label="Time"><Input type="time" {...bind('time')} /></Field>
          <Field label="Duration"><Select {...bind('dur')} options={DUR_OPTS} /></Field>
        </div>

        <div className={s.grid2}>
          <Field label="Priority"><Select {...bind('prio')} options={PRIO_OPTS} /></Field>
          <Field label="Reminder"><Select {...bind('remind')} options={REMIND_OPTS} /></Field>
        </div>

        <div className={s.meetBox}>
          <div className={s.meetHead}>
            <div>
              <div className={s.meetTitle}>Google Meet</div>
              <div className={s.meetSub}>Attach a video link to this follow-up</div>
            </div>
            <Toggle checked={form.meet} onChange={() => patch({ meet: !form.meet })} />
          </div>
          {form.meet && (
            <>
              <div className={s.meetRow}>
                <Input {...bind('meetUrl')} placeholder="https://meet.google.com/xxx-xxxx-xxx" className={s.meetInput} />
                <a href="https://meet.google.com/new" target="_blank" rel="noreferrer" className={s.createMeet}>Create in Meet ↗</a>
                <Button variant="secondary" size="sm" onClick={() => copyMeet(form.meetUrl)}>Copy</Button>
              </div>
              <Field label="Guests (comma separated emails)">
                <Input {...bind('attendees')} placeholder="client@company.com" />
              </Field>
            </>
          )}
        </div>

        <Field label="Notes">
          <Textarea {...bind('notes')} rows={3} placeholder="Agenda, decisions needed, what to show…" />
        </Field>

        {err && <ErrorText>{err}</ErrorText>}
      </div>
    </Modal>
  );
}
