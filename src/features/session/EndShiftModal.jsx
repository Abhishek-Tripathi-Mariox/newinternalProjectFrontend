import { useState } from 'react';
import { useStore } from '@/store';
import { useNow } from '@/hooks/useNow';
import { curMs } from '@/domain/projects';
import { Modal, Button, IconButton, Field, Input, Select, Textarea, ErrorText } from '@/components/ui';
import { useEndShiftModel, hoursState, hx } from './useEndShiftModel';
import s from './EndShiftModal.module.css';

const EMPTY_ROW = { p: '', ms: '', h: '', note: '' };
const INTERNAL_CATS = ['Meeting', 'Learning / training', 'Code review', 'Internal tool / R&D', 'Hiring / interviews', 'Helping the team', 'Admin / documentation', 'Other'];
const EMPTY_INTERNAL = { cat: 'Meeting', h: '', note: '' };
const PM_STATUSES = ['On track', 'At risk', 'Blocked'];

/** Section heading with a muted sub-line. */
function SectionHead({ title, sub }) {
  return (
    <div>
      <div className={s.sectionTitle}>{title}</div>
      {sub && <div className={s.sectionSub}>{sub}</div>}
    </div>
  );
}

/** Project / milestone / hours / note rows. */
function DeliveryHours({ rows, setRows, m }) {
  const setRow = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i) => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ ...EMPTY_ROW }]);

  return (
    <div className={s.section}>
      <SectionHead title="Hours by project" sub="Projects you’re on are added for you. Timer hours are filled in; adjust if needed." />
      <div className={`${s.hoursGrid} ${s.hoursHead}`}><span>Project</span><span>Milestone</span><span>Hours</span><span>Work done</span><span /></div>
      {rows.map((r, i) => (
        <div key={i} className={s.hoursGrid}>
          <Select
            value={r.p}
            placeholder="Select project…"
            options={m.projOpts}
            onChange={(e) => { const v = e.target.value; setRow(i, { p: v, ms: v ? curMs(m.milestones, v) || '' : '' }); }}
          />
          <Select value={r.ms} options={m.msOptsFor(r.p)} onChange={(e) => setRow(i, { ms: e.target.value })} />
          <Input
            className={s.hoursInput}
            type="number" min="0" max="24" step="0.25" placeholder="0"
            value={r.h}
            onChange={(e) => setRow(i, { h: e.target.value })}
          />
          <Input value={r.note} placeholder="e.g. Checkout API" onChange={(e) => setRow(i, { note: e.target.value })} />
          <IconButton variant="plain" label="Remove row" onClick={() => remove(i)} />
        </div>
      ))}
      <button type="button" className={s.addRow} onClick={() => setRows(rows.concat({ ...EMPTY_ROW }))}>+ Add project</button>
    </div>
  );
}

/** Internal (non-project) work: category / hours / what was done. */
function InternalWork({ rows, setRows }) {
  const setRow = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className={s.section}>
      <SectionHead title="Internal work" sub="Time not spent on a client project — meetings, learning, reviews, hiring, internal tools…" />
      {rows.length > 0 && <div className={`${s.internalGrid} ${s.hoursHead}`}><span>Type</span><span>Hours</span><span>What did you do?</span><span /></div>}
      {rows.map((r, i) => (
        <div key={i} className={s.internalGrid}>
          <Select value={r.cat} options={INTERNAL_CATS} onChange={(e) => setRow(i, { cat: e.target.value })} aria-label="Internal work type" />
          <Input
            className={s.hoursInput}
            type="number" min="0" max="24" step="0.25" placeholder="0"
            value={r.h}
            aria-label="Internal work hours"
            onChange={(e) => setRow(i, { h: e.target.value })}
          />
          <Input value={r.note} placeholder="e.g. Sprint planning with the team, interviewed 2 candidates" aria-label="What did you do" onChange={(e) => setRow(i, { note: e.target.value })} />
          <IconButton variant="plain" label="Remove row" onClick={() => setRows(rows.filter((_, j) => j !== i))} />
        </div>
      ))}
      <button type="button" className={s.addRow} onClick={() => setRows(rows.concat({ ...EMPTY_INTERNAL }))}>+ Add internal work</button>
    </div>
  );
}

/** Live total (project + internal) vs. shift and time worked. */
function HoursTotal({ projectH, internalH, m }) {
  const total = projectH + internalH;
  const st = hoursState(total, m.shift, m.workedH);
  return (
    <div className={`${s.totalBox} ${st.over ? s.totalBoxOver : ''}`}>
      <div className={s.totalLine}>
        <span>
          <span className={s.totalH}>{hx(total)}</span> <span className={s.muted}>of {m.shift}h shift</span>
          {internalH > 0 && <span className={s.muted}> · {hx(projectH)} projects + {hx(internalH)} internal</span>}
        </span>
        <span className={s.state} style={{ color: st.color }}>{st.label}</span>
      </div>
      <div className={s.track}><div className={s.fill} style={{ width: `${Math.min(100, (total / m.shift) * 100).toFixed(1)}%`, background: st.color }} /></div>
      {st.over && (
        <div className={s.overMsg}>
          You worked {m.workedLabel} today. Logged hours can’t exceed time worked (max {hx(Math.floor(m.workedH * 100) / 100)}).
        </div>
      )}
    </div>
  );
}

/** PM status per managed project. */
function PmStatus({ pmRows, setPmRows, projectName }) {
  const setPm = (i, patch) => setPmRows(pmRows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className={s.section}>
      <SectionHead title="Projects you manage" sub="Status for today’s CEO update" />
      {pmRows.map((x, i) => (
        <div key={x.p} className={s.pmGrid}>
          <span className={s.pmName}>{projectName(x.p)}</span>
          <Select value={x.st} options={PM_STATUSES} onChange={(e) => setPm(i, { st: e.target.value })} />
          <Input value={x.note} placeholder="One line on progress or risk" onChange={(e) => setPm(i, { note: e.target.value })} />
        </div>
      ))}
    </div>
  );
}

/**
 * End shift — daily report that also checks the person out.
 * Props: the initial form computed by the store's `openEndShift`
 * (`who, sales, done, blockers, plan, outcome, calls, meetings, rows?, pmRows?`) + `onClose`.
 */
export default function EndShiftModal({ onClose, ...initial }) {
  const pid = initial.who ?? initial.pid;
  const sales = !!initial.sales;
  const now = useNow(15000);
  const submitEndShift = useStore((st) => st.submitEndShift);
  const m = useEndShiftModel(pid, sales, now);

  const [form, setForm] = useState(() => ({
    done: '', blockers: '', plan: '', outcome: '', calls: '', meetings: '',
    ...initial,
    who: pid,
    rows: sales ? [] : (initial.rows && initial.rows.length ? initial.rows : [{ ...EMPTY_ROW }]),
    pmRows: initial.pmRows || [],
    internalRows: initial.internalRows || [],
  }));
  const [err, setErr] = useState(initial.err || '');
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const bind = (k) => ({ value: form[k], onChange: (e) => set({ [k]: e.target.value }) });

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const e = await submitEndShift({ ...form, err: '' });
    // On success the session ends (this modal unmounts with it).
    if (e) { setErr(e); setBusy(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="End shift"
      sub={m.sub}
      width={820}
      footer={(
        <div className={s.footer}>
          <span className={s.footNote}>Submitting ends your shift. The report appears in Attendance.</span>
          <div className={s.footBtns}>
            <Button variant="secondary" onClick={onClose}>Keep working</Button>
            <Button variant="dark" onClick={submit} disabled={busy} aria-busy={busy || undefined}>
              {busy ? 'Submitting…' : <>Submit report &amp; end shift</>}
            </Button>
          </div>
        </div>
      )}
    >
      <div className={s.body}>
        <div className={s.stats}>
          {m.stats.map((x) => (
            <div key={x.label} className={s.stat}><div className={s.statLabel}>{x.label}</div><div className={s.statValue}>{x.value}</div></div>
          ))}
        </div>

        {!sales && (
          <>
            <DeliveryHours rows={form.rows} setRows={(rows) => set({ rows })} m={m} />
            <InternalWork rows={form.internalRows} setRows={(internalRows) => set({ internalRows })} />
            <HoursTotal
              projectH={form.rows.reduce((x, r) => x + (+r.h || 0), 0)}
              internalH={form.internalRows.reduce((x, r) => x + (+r.h || 0), 0)}
              m={m}
            />
            {form.pmRows.length > 0 && (
              <PmStatus pmRows={form.pmRows} setPmRows={(pmRows) => set({ pmRows })} projectName={m.projectName} />
            )}
            <div className={s.report}>
              <div className={s.sectionTitle}>Daily report</div>
              <Field label="What did you complete today? *">
                <Textarea className={s.taLg} placeholder="Shipped, fixed, reviewed…" {...bind('done')} />
              </Field>
              <div className={s.twoCol}>
                <Field label="Blockers"><Textarea className={s.ta} placeholder="Waiting on client, access, review…" {...bind('blockers')} /></Field>
                <Field label="Plan for tomorrow"><Textarea className={s.ta} placeholder="First thing tomorrow…" {...bind('plan')} /></Field>
              </div>
            </div>
          </>
        )}

        {sales && (
          <>
            <div className={s.section}>
              <SectionHead title="Today’s pipeline activity" sub="Pulled from your leads and follow-ups" />
              <div className={s.autoGrid}>
                {m.auto.map((x) => (
                  <div key={x.label} className={s.autoCard}><div className={s.statLabel}>{x.label}</div><div className={s.autoValue}>{x.value}</div></div>
                ))}
              </div>
            </div>
            <div className={s.report}>
              <div className={s.sectionTitle}>Daily report</div>
              <div className={s.numCols}>
                <Field label="Calls made"><Input type="number" min="0" {...bind('calls')} /></Field>
                <Field label="Meetings held"><Input type="number" min="0" {...bind('meetings')} /></Field>
              </div>
              <Field label="Summary of the day *">
                <Textarea className={s.taLg} placeholder="Key conversations, deals moved, quotes sent…" {...bind('outcome')} />
              </Field>
              <div className={s.twoCol}>
                <Field label="Hot leads & plan for tomorrow"><Textarea className={s.ta} placeholder="Who to call first, quotes to chase…" {...bind('plan')} /></Field>
                <Field label="Blockers"><Textarea className={s.ta} placeholder="Pricing approval, missing info…" {...bind('blockers')} /></Field>
              </div>
            </div>
          </>
        )}

        {err && <ErrorText>{err}</ErrorText>}
      </div>
    </Modal>
  );
}
