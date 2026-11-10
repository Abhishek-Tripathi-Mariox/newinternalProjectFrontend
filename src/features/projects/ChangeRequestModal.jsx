import { useEffect, useMemo, useState } from 'react';
import { Button, DocumentList, ErrorText, Field, FileDropzone, Input, Modal, Select, Textarea, docSummary } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useIsPM } from '@/hooks/useIsPM';
import { costOf, crMoney, crRate } from '@/domain/projects';
import { clock, dLabel, dateTime, fd } from '@/lib/date';
import { h1, inr, money } from '@/lib/format';
import { PRIORITY_NAMES } from '@/config/constants';
import ToggleChip from './components/ToggleChip';
import { useAttach } from './hooks/useAttach';
import { usePrintCr } from './hooks/usePrintCr';
import { ACTIVE_STATUSES, CR_LIVE, crStatusLabel } from './lib/view';
import s from './modals.module.css';

const CR_HINT = 'Client email, revised scope, wireframes, estimate sheet · up to 10 MB each';
const BLANK_TASK = { t: '', a: '', h: '' };
const RED_TEXT = 'oklch(0.5 0.17 25)';

/** Form state for a new CR or an existing one (same field names as the original modal). */
function initialForm(p, cr, milestones) {
  if (cr) {
    return {
      pid: p.id, title: cr.title, desc: cr.desc || '', by: cr.by, reqBy: cr.reqBy || '', hours: String(cr.hours), rate: String(cr.rate),
      days: String(cr.days || 0), prio: cr.prio || 'Medium', target: cr.target || 'new', atts: (cr.docs || []).slice(), team: (cr.team || []).slice(),
      tasks: (cr.tasks || []).map((t) => ({ t: t.t, a: t.a, h: String(t.h) })), note: '', sigName: '',
    };
  }
  return {
    pid: p ? p.id : '', title: '', desc: '', by: 'Client', reqBy: p ? p.client : '', hours: '', rate: String(p ? crRate(milestones, p) : 1500), days: '0',
    prio: 'Medium', target: 'new', atts: [], team: [], tasks: [{ ...BLANK_TASK }], note: '', sigName: '',
  };
}

/**
 * Change request modal (ModalHost kind 'cr', props {pid?, editId?}).
 * Read-only for non-PMs and once approved (documents can still be added).
 */
export default function ChangeRequestModal({ pid: pidProp, editId, onClose }) {
  const { projects, members, milestones, crs } = useScoped();
  const logs = useStore((st) => st.logs);
  const allMilestones = useStore((st) => st.milestones);
  const allMembers = useStore((st) => st.members);
  const saveCr = useStore((st) => st.saveCr);
  const crAct = useStore((st) => st.crAct);
  const flash = useStore((st) => st.flash);
  const isPM = useIsPM();
  const attach = useAttach();
  const pdf = usePrintCr();

  const crE = editId ? (crs || []).find((c) => c.id === editId) || null : null;
  const startPid = pidProp || (crE && crE.p) || (projects.find((p) => ACTIVE_STATUSES.includes(p.status) && isPM(p)) || {}).id;
  const [form, setForm] = useState(() => initialForm(projects.find((p) => p.id === startPid), crE, milestones));
  const [err, setErr] = useState('');

  const crP = projects.find((p) => p.id === form.pid) || null;

  useEffect(() => {
    if (!startPid || !projects.some((p) => p.id === startPid)) {
      flash('Pick a project first');
      onClose?.();
    }
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locked = !!crE && !['Draft', 'Sent to client'].includes(crE.status);
  const can = !!crP && isPM(crP);
  const ro = !(can && !locked);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setTask = (i, k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({
      ...f,
      tasks: f.tasks.map((x, j) => (j === i ? { ...x, [k]: v } : x)),
      team: k === 'a' && v && !f.team.includes(v) ? f.team.concat(v) : f.team,
    }));
  };

  const onPid = (e) => {
    const v = e.target.value;
    const p = projects.find((x) => x.id === v);
    setForm((f) => ({ ...f, pid: v, reqBy: p && f.by === 'Client' ? p.client : f.reqBy, rate: p ? String(crRate(milestones, p)) : f.rate, target: 'new' }));
  };
  const onBy = (e) => {
    const v = e.target.value;
    const pmName = (members.find((x) => x.id === (crP || {}).pm) || {}).name || '';
    setForm((f) => ({ ...f, by: v, reqBy: v === 'Client' ? (crP ? crP.client : '') : pmName }));
  };
  const toggleTeam = (id) => {
    if (ro) return;
    setForm((f) => ({ ...f, team: f.team.includes(id) ? f.team.filter((x) => x !== id) : f.team.concat(id) }));
  };

  const projOpts = projects.filter((p) => ACTIVE_STATUSES.includes(p.status) && isPM(p)).map((p) => ({ value: p.id, label: `${p.name} · ${p.client}` }));
  const targetOpts = [{ value: 'new', label: 'A new CR milestone (tracked separately)' }].concat(
    milestones
      .filter((x) => crP && x.p === crP.id && x.status !== 'Done' && !x.cr)
      .sort((a, b) => a.n - b.n)
      .map((x) => ({ value: x.id, label: `Add to milestone ${x.n} · ${x.name}` })),
  );
  const teamOpts = crP ? crP.team.concat(members.filter((x) => !crP.team.includes(x.id)).map((x) => x.id)) : [];
  const memberOpts = [{ value: '', label: 'Assign to…' }, ...members.map((x) => ({ value: x.id, label: `${x.name} · ${x.team}` }))];

  // Live cost / profit panel (original crm money block).
  const money$ = useMemo(() => {
    const tH = form.tasks.reduce((x, t) => x + (+t.h || 0), 0);
    const est = +form.hours || 0;
    const amt = est * (+form.rate || 0);
    const fake = { hours: est, amount: amt, tasks: form.tasks.map((t) => ({ a: t.a, h: +t.h || 0 })), team: form.team, ms: crE ? crE.ms : null };
    const mo = crMoney(fake, { logs, milestones: allMilestones, members: allMembers });
    const live = !!crE && CR_LIVE.includes(crE.status) && mo.cost != null;
    const pr = live ? mo.profit : mo.estProfit;
    const mg = amt ? Math.round((pr / amt) * 100) : 0;
    return {
      amt,
      taskSum: `${form.tasks.filter((t) => t.t).length} tasks · ${h1(tH)} of ${h1(est)} estimate`,
      taskSumColor: tH > est && est ? RED_TEXT : 'var(--muted)',
      cost: money(live ? mo.cost : mo.estCost),
      costL: live ? 'Cost so far' : 'Estimated cost',
      profit: money(pr),
      profitL: live ? 'Profit so far' : 'Estimated profit',
      margin: `${mg}% margin`,
      color: pr < 0 ? RED_TEXT : mg < 20 ? 'oklch(0.5 0.12 70)' : 'oklch(0.42 0.12 150)',
      live,
      used: live ? `${h1(mo.used)} logged of ${h1(est)}` : '',
      overL: live && mo.over ? `${h1(mo.used - est)} over the estimate` : '',
    };
  }, [form.tasks, form.hours, form.rate, form.team, crE, logs, allMilestones, allMembers]);

  if (!crP) return null;

  const save = (send) => {
    const e = saveCr(form, crE ? crE.id : null, send);
    if (e) setErr(e);
    else onClose?.();
  };
  const act = (a, ...args) => {
    const e = crAct(crE.id, a, ...args);
    if (e) setErr(e);
    else onClose?.();
  };

  const showDraft = can && (!crE || crE.status === 'Draft');
  const showSave = can && !!crE && crE.status !== 'Draft';
  const showDecide = can && !!crE && crE.status === 'Sent to client';
  const showDel = can && !!crE && ['Draft', 'Rejected'].includes(crE.status);

  const footer = (
    <div className={s.footer}>
      {showDel && (
        <Button variant="ghost" className={s.del} onClick={() => act('delete')}>
          Delete
        </Button>
      )}
      <span className={s.spacer} />
      <Button variant="ghost" onClick={onClose}>
        Close
      </Button>
      {showDraft && (
        <>
          <Button onClick={() => save(false)}>Save draft</Button>
          <Button variant="primary" onClick={() => save(true)}>
            Send to client
          </Button>
        </>
      )}
      {showSave && <Button onClick={() => save(false)}>Save</Button>}
      {showDecide && (
        <>
          <Button variant="dangerOutline" onClick={() => act('reject', form.note)}>
            Mark rejected
          </Button>
          <Button variant="primary" className={s.green} onClick={() => act('approve', form.note, { name: form.sigName || '' })}>
            Mark approved
          </Button>
        </>
      )}
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      width={700}
      title={crE ? `${crE.id} · ${crStatusLabel(crE.status)}` : 'New change request'}
      sub={`${crP.name} · ${crP.client}`}
      footer={footer}
    >
      {(locked || !can) && (
        <div className={s.lock}>
          {locked
            ? `Approved change requests are locked. Hours, value and timeline were added to the project on ${fd(crE.decidedAt)}. You can still add documents.`
            : 'Only the project manager can edit change requests.'}
        </div>
      )}
      {!crE && (
        <Field label="Project">
          <Select value={form.pid} onChange={onPid} options={projOpts} />
        </Field>
      )}
      <Field label="Title">
        <Input value={form.title} onChange={set('title')} disabled={ro} placeholder="e.g. Add wallet & cashback" data-autofocus />
      </Field>
      <Field label="What changes and why">
        <Textarea value={form.desc} onChange={set('desc')} disabled={ro} rows={3} placeholder="Scope of the change, screens affected, acceptance criteria" />
      </Field>
      <div className={s.grid3}>
        <Field label="Raised by">
          <Select value={form.by} onChange={onBy} disabled={ro} options={['Client', 'Internal']} />
        </Field>
        <Field label="Requested by">
          <Input value={form.reqBy} onChange={set('reqBy')} disabled={ro} />
        </Field>
        <Field label="Priority">
          <Select value={form.prio} onChange={set('prio')} disabled={ro} options={PRIORITY_NAMES} />
        </Field>
      </div>
      <div className={s.grid4}>
        <Field label="Estimated hours">
          <Input type="number" min="0" step="1" value={form.hours} onChange={set('hours')} disabled={ro} />
        </Field>
        <Field label="Rate (₹ per hour)">
          <Input type="number" min="0" step="50" value={form.rate} onChange={set('rate')} disabled={ro} />
        </Field>
        <Field label="Adds to timeline (days)">
          <Input type="number" min="0" step="1" value={form.days} onChange={set('days')} disabled={ro} />
        </Field>
        <div className={s.tile}>
          <div className={s.tileLabel}>CR value</div>
          <div className={s.tileValue}>{inr(money$.amt)}</div>
        </div>
      </div>

      {crE && crE.sig && (
        <div className={s.signed}>
          <div>
            <div className={s.signedKicker}>Approved by</div>
            <div className={s.signedName}>{crE.sig.name}</div>
            <div className={s.signedMeta}>
              {dateTime(crE.sig.at)} · {crE.sig.via}
            </div>
          </div>
          <Button variant="primary" className={s.green} onClick={() => pdf(crE)}>
            Download approval PDF
          </Button>
        </div>
      )}

      <Field as="div" label="Who works on it">
        <div className={s.chips}>
          {teamOpts.map((id) => {
            const mm = members.find((x) => x.id === id) || {};
            const on = form.team.includes(id);
            return (
              <ToggleChip key={id} on={on} onClick={() => toggleTeam(id)} title={mm.team + (crP.team.includes(id) ? '' : ' · not on project')}>
                {on ? '✓ ' : ''}
                {mm.name}
              </ToggleChip>
            );
          })}
        </div>
      </Field>

      <Field
        as="div"
        label="Work breakdown · becomes tasks on the board when approved"
        aside={
          <span className={s.strong} style={{ color: money$.taskSumColor }}>
            {money$.taskSum}
          </span>
        }
      >
        {form.tasks.map((t, i) => (
          <div key={i} className={s.taskRow}>
            <Input value={t.t} onChange={setTask(i, 't')} disabled={ro} placeholder="Task, e.g. Wallet screens · Android" />
            <Select value={t.a} onChange={setTask(i, 'a')} disabled={ro} options={memberOpts} />
            <Input type="number" min="0" value={t.h} onChange={setTask(i, 'h')} disabled={ro} placeholder="h" className={s.right} />
            <span className={s.taskCost}>{t.a && +t.h ? money(+t.h * costOf(allMembers, t.a)) : ''}</span>
            {!ro ? (
              <button type="button" className={s.removeBtn} title="Remove" onClick={() => setForm((f) => ({ ...f, tasks: f.tasks.filter((_, j) => j !== i) }))}>
                ✕
              </button>
            ) : (
              <span />
            )}
          </div>
        ))}
        {!ro && (
          <button type="button" className={s.addBtn} onClick={() => setForm((f) => ({ ...f, tasks: f.tasks.concat({ ...BLANK_TASK }) }))}>
            + Add task
          </button>
        )}
      </Field>

      <div className={s.profitGrid}>
        <div className={s.ptile}>
          <div className={s.tileLabel}>{money$.costL}</div>
          <div className={s.ptileValue}>{money$.cost}</div>
        </div>
        <div className={s.ptile}>
          <div className={s.tileLabel}>{money$.profitL}</div>
          <div className={s.ptileValue} style={{ color: money$.color }}>
            {money$.profit}
          </div>
          <div className={s.ptileSub} style={{ color: money$.color }}>
            {money$.margin}
          </div>
        </div>
        {money$.live && (
          <div className={s.ptile}>
            <div className={s.tileLabel}>Hours</div>
            <div className={s.ptileValue}>{money$.used}</div>
            {money$.overL && <div className={s.overText}>{money$.overL}</div>}
          </div>
        )}
      </div>

      <Field label="When approved, add the hours to">
        <Select value={form.target} onChange={set('target')} disabled={ro} options={targetOpts} />
      </Field>

      <div className={s.groupLabel}>
        <div className={s.docsHead}>
          <span>Documents</span>
          <span className={s.light}>{docSummary(form.atts)}</span>
        </div>
        <FileDropzone hint={CR_HINT} onFiles={(files) => attach(files, (atts) => setForm((f) => ({ ...f, atts: f.atts.concat(atts) })))} />
        <DocumentList
          docs={form.atts}
          onKind={(i, kind) => setForm((f) => ({ ...f, atts: f.atts.map((x, j) => (j === i ? { ...x, kind } : x)) }))}
          onRemove={(i) => setForm((f) => ({ ...f, atts: f.atts.filter((_, j) => j !== i) }))}
        />
      </div>

      {showDecide && (
        <div className={s.decide}>
          <Field label="Client person who approved (required to approve)">
            <Input value={form.sigName} onChange={set('sigName')} placeholder="e.g. Rahul Khanna" />
          </Field>
          <Field label="How / comment (saved in history)">
            <Input value={form.note} onChange={set('note')} placeholder="e.g. Approved by email, 9 Nov" />
          </Field>
        </div>
      )}

      {crE && (
        <div className={s.groupLabel}>
          <div className={s.histTitle}>History</div>
          <div className={s.hist}>
            {(crE.hist || [])
              .slice()
              .reverse()
              .map((x, i) => (
                      <div key={`${x.t}-${i}`} className={s.histItem}>
                  <span className={s.histDot} />
                  <div>
                    <div className={s.histText}>{x.text}</div>
                    <div className={s.histWhen}>
                      {dLabel(x.t)} · {clock(x.t)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {err && <ErrorText>{err}</ErrorText>}
    </Modal>
  );
}
