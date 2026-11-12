import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { curMs } from '@/domain/projects';
import { Button, ErrorText, Field, Input, Modal, ProgressBar, Select } from '@/components/ui';
import { AMBER, GREEN, MUTED } from '@/lib/color';
import { parseDay, ymd } from '@/lib/date';
import { hh, pctW } from '@/lib/format';
import { ACTIVE_STATUSES } from './lib/view';
import s from './WorkModals.module.css';
import { serverNow } from '@/lib/clock';

const BLANK = { p: '', ms: '', h: '', note: '' };
const OVERTIME = 'oklch(0.55 0.15 300)';

/** Default rows: the given project, else up to 4 running projects the member is on. */
function rowsFor(projects, milestones, mid, pid) {
  if (pid) return [{ p: pid, ms: curMs(milestones, pid), h: '', note: '' }];
  const act = projects.filter((p) => p.status === 'Running' && p.team.includes(mid)).slice(0, 4);
  return act.length ? act.map((p) => ({ p: p.id, ms: curMs(milestones, p.id), h: '', note: '' })) : [{ ...BLANK }];
}

/** Log hours modal — end-of-shift breakup by project. Props: {member?, project?, date?, onClose}. */
export default function LogHoursModal({ member, project, date, onClose }) {
  const saveLog = useStore((st) => st.saveLog);
  const milestones = useStore((st) => st.milestones);
  const scoped = useScoped();
  const { MEM, PRJ, msOf } = useProjectsModel();
  const { projects, members } = scoped;
  const logs = scoped.logs || [];

  const [form, setForm] = useState(() => {
    const mid = member || (members[0] || {}).id;
    return { member: mid, date: ymd(date || serverNow()), rows: rowsFor(projects, milestones, mid, project) };
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const setRow = (i, patch) => setForm((f) => ({ ...f, rows: f.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const removeRow = (i) => setForm((f) => ({ ...f, rows: f.rows.length > 1 ? f.rows.filter((_, j) => j !== i) : [{ ...BLANK }] }));
  const onMember = (v) => setForm((f) => ({ ...f, member: v, ...(f.rows.every((r) => !+r.h) ? { rows: rowsFor(projects, milestones, v) } : {}) }));

  const projOpts = useMemo(() => {
    const mine = projects.filter((p) => p.team.includes(form.member) && p.status !== 'Cancelled');
    const others = projects.filter((p) => !p.team.includes(form.member) && ACTIVE_STATUSES.includes(p.status));
    return mine.map((p) => ({ value: p.id, label: p.name })).concat(others.map((p) => ({ value: p.id, label: `${p.name} (not on team)` })));
  }, [projects, form.member]);

  const d = form.date ? parseDay(form.date) : null;
  const ex = logs.filter((l) => l.m === form.member && l.d === d);
  const exT = ex.reduce((x, l) => x + l.h, 0);
  const sh = (MEM[form.member] || {}).shift || 8;
  const all = form.rows.reduce((x, r) => x + (+r.h || 0), 0) + exT;
  const state = all === 0 ? 'Nothing entered' : all < sh ? `Short by ${hh(sh - all)}` : all === sh ? 'Full shift' : `Overtime +${hh(all - sh)}`;
  const stateColor = all === 0 ? MUTED : all < sh ? AMBER : all === sh ? GREEN : OVERTIME;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const e = await saveLog(form);
    setBusy(false);
    if (e) setErr(e);
    else onClose?.();
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={780}
      title="Log hours"
      sub="End-of-shift breakup by project"
      footer={(
        <div className={s.footerEnd}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save hours'}</Button>
        </div>
      )}
    >
      <div className={s.auto}>
        <Field label="Team member">
          <Select value={form.member} onChange={(e) => onMember(e.target.value)} options={members.map((m) => ({ value: m.id, label: m.name }))} />
        </Field>
        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </Field>
      </div>

      {exT > 0 && (
        <div className={s.warn}>
          Already logged {hh(exT)} on this day ({ex.map((l) => `${(PRJ[l.p] || {}).name} ${hh(l.h)}`).join(', ')}). New entries are added on top.
        </div>
      )}

      <div className={s.rows}>
        <div className={`${s.logGrid} ${s.logHead}`}><span>Project</span><span>Milestone</span><span>Hours</span><span>Work done</span><span /></div>
        {form.rows.map((r, i) => (
          <div key={i} className={s.logGrid}>
            <Select
              value={r.p}
              placeholder="Select project…"
              options={projOpts}
              onChange={(e) => { const v = e.target.value; setRow(i, { p: v, ms: curMs(milestones, v) }); }}
              aria-label="Project"
            />
            <Select
              value={r.ms}
              options={(msOf[r.p] || []).map((x) => ({ value: x.id, label: `${x.n}. ${x.name}${x.status === 'Done' ? ' (done)' : ''}` }))}
              onChange={(e) => setRow(i, { ms: e.target.value })}
              aria-label="Milestone"
            />
            <Input
              type="number" min="0" max="24" step="0.5" placeholder="0" className={s.num}
              value={r.h} onChange={(e) => setRow(i, { h: e.target.value })} aria-label="Hours"
            />
            <Input value={r.note} placeholder="e.g. Checkout API" onChange={(e) => setRow(i, { note: e.target.value })} aria-label="Work done" />
            <button type="button" className={s.x} title="Remove row" onClick={() => removeRow(i)}>✕</button>
          </div>
        ))}
        <button type="button" className={s.dashed} onClick={() => setForm((f) => ({ ...f, rows: f.rows.concat({ ...BLANK }) }))}>+ Add project</button>
      </div>

      <div className={s.totalBox}>
        <div className={s.totalLine}>
          <span><span style={{ fontWeight: 700 }}>{hh(all)}</span> <span style={{ color: MUTED }}>of {sh}h shift</span></span>
          <span style={{ fontWeight: 600, color: stateColor }}>{state}</span>
        </div>
        <ProgressBar width={pctW(all / sh)} color={stateColor} />
      </div>

      <ErrorText>{err}</ErrorText>
    </Modal>
  );
}
