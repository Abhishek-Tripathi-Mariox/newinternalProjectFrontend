import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { Button, Checkbox, Field, Input, Modal, Select, Textarea, Toggle, ErrorText } from '@/components/ui';
import { FU_TYPES, PRIORITY_NAMES, REMINDERS } from '@/config/constants';
import { RED } from '@/lib/color';
import { HOUR, MINUTE, hm, ymd } from '@/lib/date';
import { genMeet } from '@/lib/random';
import { calendarLink } from './calendarLink';
import { useCopyMeet } from './useCopyMeet';
import { TYPE_NAMES, typeDefaults } from './model';
import s from './FollowUpModal.module.css';
import { firstOwnerId, getActiveOwners } from '@/store/owners';
import { serverNow } from '@/lib/clock';

const OWNER_OPTS = () => getActiveOwners().map((o) => ({ value: o.id, label: o.name }));
const PRIO_OPTS = PRIORITY_NAMES.map((p) => ({ value: p, label: p }));
const REMIND_OPTS = REMINDERS.map(([v, l]) => ({ value: String(v), label: l }));
const DUR_OPTS = [
  { value: '0', label: '—' }, { value: '15', label: '15 min' }, { value: '30', label: '30 min' },
  { value: '45', label: '45 min' }, { value: '60', label: '1 hour' }, { value: '90', label: '1.5 hours' },
];

/** Initial form — port of the original openFu / editFu. */
function initialForm({ editId, leadId, date }, fus, leads) {
  const f = editId && fus.find((x) => x.id === editId);
  if (f) {
    return {
      type: f.type, title: f.title, leadId: f.leadId || '', owner: f.owner, date: ymd(f.due), time: hm(f.due),
      dur: String(f.dur || 0), prio: f.prio, remind: String(f.remind), meet: !!f.meet, meetUrl: f.meet || genMeet(),
      attendees: f.attendees || '', notes: f.notes || '', openCal: false,
    };
  }
  const l = leads.find((x) => x.id === leadId);
  const t = Math.ceil((serverNow() + 30 * MINUTE) / HOUR) * HOUR;
  return {
    type: 'Meeting', title: '', leadId: leadId || '', owner: l ? l.owner : firstOwnerId(),
    date: date || ymd(t), time: hm(t), dur: '45', prio: 'Medium', remind: '10', meet: true, meetUrl: genMeet(),
    attendees: l ? l.email || '' : '', notes: '', openCal: false,
  };
}

/** Create / edit a follow-up. Props: {editId?, leadId?, date?, onClose}. */
export default function FollowUpModal({ editId, leadId, date, onClose }) {
  const allFus = useStore((st) => st.fus);
  const saveFu = useStore((st) => st.saveFu);
  const { leads } = useScoped();
  const copyMeet = useCopyMeet();

  const [form, setForm] = useState(() => initialForm({ editId, leadId, date }, allFus, leads));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const isEdit = !!editId;

  const leadOpts = useMemo(
    () => [{ value: '', label: 'No lead (internal)' }].concat(
      leads.slice().sort((a, b) => a.company.localeCompare(b.company))
        .map((l) => ({ value: l.id, label: `${l.company} · ${l.contact}` })),
    ),
    [leads],
  );

  const patch = (p) => setForm((f) => ({ ...f, ...p }));
  const bind = (k) => ({ value: form[k], onChange: (e) => patch({ [k]: e && e.target ? e.target.value : e }) });

  const pickType = (t) => setForm((f) => {
    const d = typeDefaults(t);
    return { ...f, type: t, dur: d.dur, remind: d.remind, meet: isEdit ? f.meet : d.meet };
  });

  const onLead = (e) => {
    const id = e && e.target ? e.target.value : e;
    const l = leads.find((x) => x.id === id);
    patch(l ? { leadId: id, owner: l.owner, attendees: l.email } : { leadId: id });
  };

  const save = async () => {
    if (busy) return;
    // Same checks as the store (kept here so the title border reacts instantly).
    if (!form.title.trim()) return setErr('Add a title.');
    if (!form.date || !form.time) return setErr('Pick a date and time.');
    // openCal is handled here: the tab is opened during the click (pop-up blockers), filled after the save.
    const { openCal, ...data } = form;
    const cal = openCal ? window.open('', '_blank') : null;
    setBusy(true);
    const e = await saveFu(data, editId || undefined);
    setBusy(false);
    if (e) {
      if (cal) cal.close();
      return setErr(e);
    }
    if (cal) {
      const due = new Date(`${form.date}T${form.time}`).getTime();
      const saved = {
        title: form.title.trim(), due, dur: +form.dur, notes: form.notes,
        meet: form.meet ? form.meetUrl.trim() : '', attendees: form.attendees,
      };
      cal.location.href = calendarLink(saved, leads.find((l) => l.id === form.leadId));
    }
    onClose();
  };

  const footer = (
    <div className={s.footer}>
      <Checkbox
        checked={form.openCal}
        onChange={() => patch({ openCal: !form.openCal })}
        label="Also open in Google Calendar"
      />
      <div className={s.footerBtns}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={busy} aria-busy={busy}>{isEdit ? 'Save changes' : 'Schedule'}</Button>
      </div>
    </div>
  );

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit follow-up' : 'New follow-up'} width={580} footer={footer}>
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
          <Input
            {...bind('title')}
            placeholder="e.g. Proposal walkthrough"
            autoFocus
            style={err && !form.title.trim() ? { borderColor: RED } : undefined}
          />
        </Field>

        <div className={s.grid2}>
          <Field label="Lead">
            <Select value={form.leadId} onChange={onLead} options={leadOpts} />
          </Field>
          <Field label="Assign to">
            <Select {...bind('owner')} options={OWNER_OPTS()} />
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
                <Input
                  {...bind('meetUrl')}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  className={s.meetInput}
                />
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
          <Textarea {...bind('notes')} rows={3} placeholder="Agenda, talking points…" />
        </Field>

        {err && <ErrorText>{err}</ErrorText>}
      </div>
    </Modal>
  );
}
