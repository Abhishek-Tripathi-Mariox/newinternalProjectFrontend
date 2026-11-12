import { useState } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { curMs } from '@/domain/projects';
import { Button, ErrorText, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { DAY, dLabel, fd, parseDay, ymd } from '@/lib/date';
import { fileSize } from '@/lib/format';
import { BUG_ENVS, BUG_SEVERITY, BUG_SEVERITY_DAYS, PRIORITY_NAMES, TEAMS } from '@/config/constants';
import { BUG_STATUS_KEYS } from './workItems';
import { downloadDoc, openDoc, useFileUrl } from '@/api/files';
import { useAttach } from './hooks/useAttach';
import s from './WorkModals.module.css';
import { serverNow } from '@/lib/clock';

const SEVERITIES = Object.keys(BUG_SEVERITY);
const ACCEPT = 'image/*,video/*,.pdf,.txt,.log,.json,.zip,.doc,.docx,.xls,.xlsx,.csv';

/** Initial form (port of openBug). */
function initialForm(bug, pre, projects, milestones) {
  if (bug) return { ...bug, repDate: ymd(bug.repDate), due: bug.due ? ymd(bug.due) : '', a: bug.a || '', atts: (bug.atts || []).slice() };
  const p = projects.find((x) => x.id === pre.p) || projects.find((x) => x.status === 'Running') || projects[0] || {};
  return {
    title: '', p: p.id || '', ms: p.id ? curMs(milestones, p.id) : '', dept: 'Web', env: 'Web', sev: 'Major', prio: 'High', a: '', st: 'Open', rep: 'dn',
    repDate: ymd(serverNow()), due: ymd(serverNow() + 3 * DAY), build: '', steps: '', exp: '', act: '', link: '', atts: [],
  };
}

/** Attachment tile: image thumbnail or extension badge, with download / remove. */
function AttachmentTile({ att, onRemove }) {
  const ext = (att.name.split('.').pop() || 'file').toUpperCase().slice(0, 4);
  const img = /^image\//.test(att.type || '') && !!att.url;
  const src = useFileUrl(att, img);
  const open = (e) => { e.preventDefault(); openDoc(att); };
  const dl = (e) => { e.preventDefault(); downloadDoc(att); };
  return (
    <div className={s.att}>
      {img ? (
        <a href={att.url} target="_blank" rel="noreferrer" title="Open full size" className={s.thumb} onClick={open}>{src ? <img src={src} alt={att.name} /> : null}</a>
      ) : (
        <div className={s.extBox}><span className={s.ext}>{ext}</span></div>
      )}
      <div className={s.attFoot}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className={s.attName} title={att.name}>{att.name}</div>
          <div className={s.attSize}>{fileSize(att.size)}{att.url ? '' : ' · name only (too large to store)'}</div>
        </div>
        {att.url && <a href={att.url} download={att.name} title="Download" className={s.dl} onClick={dl}>↓</a>}
        <button type="button" className={s.rm} title="Remove" onClick={onRemove}>✕</button>
      </div>
    </div>
  );
}

/** Report / edit a bug. Props: {editId?, p?, onClose}. */
export default function BugModal({ editId, p, onClose }) {
  const saveBug = useStore((x) => x.saveBug);
  const delBug = useStore((x) => x.delBug);
  const commentBug = useStore((x) => x.commentBug);
  const milestones = useStore((x) => x.milestones);
  const bug = useStore((x) => (editId ? (x.bugs || []).find((b) => b.id === editId) : null));
  const scoped = useScoped();
  const { MEM, PRJ, msOf } = useProjectsModel();
  const attach = useAttach();
  const { projects, members } = scoped;

  const [form, setForm] = useState(() => initialForm(bug, { p }, projects, milestones));
  const [comment, setComment] = useState('');
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { const v = e.target.value; setForm((f) => ({ ...f, [k]: v })); };
  const isEdit = !!editId;

  const onP = (e) => { const v = e.target.value; setForm((f) => ({ ...f, p: v, ms: curMs(milestones, v) })); };
  // Picking a department auto-assigns the first project member from that team (if nobody is assigned yet).
  const onDept = (e) => {
    const v = e.target.value;
    setForm((f) => {
      const p2 = PRJ[f.p];
      const cand = p2 ? p2.team.filter((id) => (MEM[id] || {}).team === v) : [];
      return { ...f, dept: v, ...(!f.a && cand.length ? { a: cand[0] } : {}) };
    });
  };
  // Severity sets priority (Critical → High) and, for new bugs, the due date from the report date.
  const onSev = (e) => {
    const v = e.target.value;
    setForm((f) => ({
      ...f, sev: v, prio: v === 'Critical' ? 'High' : f.prio,
      ...(isEdit ? {} : { due: ymd((parseDay(f.repDate) || serverNow()) + BUG_SEVERITY_DAYS[v] * DAY) }),
    }));
  };
  const addFiles = (files) => attach(files, (atts) => setForm((f) => ({ ...f, atts: (f.atts || []).concat(atts) })));
  const removeAtt = (i) => setForm((f) => ({ ...f, atts: f.atts.filter((_, j) => j !== i) }));
  const addComment = async () => {
    const v = comment.trim();
    if (!v || !editId) return;
    setComment('');
    const e = await commentBug(editId, v);
    if (e) setComment(v);
  };

  const pp = PRJ[form.p];
  const aOpts = (pp ? pp.team : [])
    .map((id) => ({ value: id, label: `${(MEM[id] || {}).name} · ${(MEM[id] || {}).team}` }))
    .concat(members.filter((m) => !pp || !pp.team.includes(m.id)).map((m) => ({ value: m.id, label: `${m.name} (not on team)` })));
  const atts = form.atts || [];
  const history = (bug ? bug.log || [] : []).slice().reverse();

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const e = await saveBug(form, editId || undefined);
    setBusy(false);
    if (e) setErr(e);
    else onClose?.();
  };
  const del = async () => {
    if (busy) return;
    setBusy(true);
    const e = await delBug(editId);
    setBusy(false);
    if (e) setErr(e);
    else onClose?.();
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={720}
      title={isEdit ? `${editId} · ${bug ? bug.title : ''}` : 'Report a bug'}
      sub={isEdit ? `Reported ${fd(bug ? bug.repDate : serverNow())}` : 'Log the issue with enough detail for the developer to reproduce it'}
      footer={(
        <div className={s.footer}>
          <div>{isEdit && <Button variant="dangerOutline" onClick={del} disabled={busy}>Delete bug</Button>}</div>
          <div className={s.footRight}>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="danger" onClick={save} disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Report bug'}</Button>
          </div>
        </div>
      )}
    >
      <div className={s.grid3}>
        <Field label="Bug title" full className={s.full}>
          <Input value={form.title} onChange={set('title')} placeholder="e.g. Checkout crashes when coupon is applied" invalid={!!err && !form.title.trim()} data-autofocus />
        </Field>
        <Field label="Project"><Select value={form.p} onChange={onP} options={projects.map((x) => ({ value: x.id, label: x.name }))} /></Field>
        <Field label="Milestone"><Select value={form.ms} onChange={set('ms')} options={(msOf[form.p] || []).map((x) => ({ value: x.id, label: `${x.n}. ${x.name}` }))} /></Field>
        <Field label="Department"><Select value={form.dept} onChange={onDept} options={TEAMS} /></Field>
        <Field label="Platform"><Select value={form.env} onChange={set('env')} options={BUG_ENVS} /></Field>
        <Field label="Severity"><Select value={form.sev} onChange={onSev} options={SEVERITIES} /></Field>
        <Field label="Priority"><Select value={form.prio} onChange={set('prio')} options={PRIORITY_NAMES} /></Field>
        <Field label="Assign to"><Select value={form.a} onChange={set('a')} placeholder="Unassigned" options={aOpts} /></Field>
        <Field label="Status"><Select value={form.st} onChange={set('st')} options={BUG_STATUS_KEYS} /></Field>
        <Field label="Reported by">
          <Select value={form.rep} onChange={set('rep')} options={[{ value: 'client', label: 'Client' }].concat(members.map((m) => ({ value: m.id, label: m.name })))} />
        </Field>
        <Field label="Reported on"><Input type="date" value={form.repDate} onChange={set('repDate')} /></Field>
        <Field label="Due date"><Input type="date" value={form.due} onChange={set('due')} /></Field>
        <Field label="Build / version"><Input value={form.build} onChange={set('build')} placeholder="e.g. v2.3.1 (114)" /></Field>
        <Field label="Steps to reproduce" full className={s.full}>
          <Textarea rows={3} value={form.steps} onChange={set('steps')} placeholder={'1. Open cart\n2. Apply coupon SAVE10\n3. Tap Pay'} />
        </Field>
        <Field label="Expected result"><Textarea rows={2} value={form.exp} onChange={set('exp')} /></Field>
        <Field label="Actual result" className={s.span2}><Textarea rows={2} value={form.act} onChange={set('act')} /></Field>
        <Field label="Screenshot / recording link" full className={s.full}>
          <Input value={form.link} onChange={set('link')} placeholder="Paste a Drive, Loom or Jam link" />
        </Field>

        <div className={`${s.label} ${s.full}`} style={{ gap: 8 }}>
          <div className={s.labelRow}><span>Attachments</span><span className={s.thin}>{atts.length ? `${atts.length} file${atts.length > 1 ? 's' : ''}` : ''}</span></div>
          <label
            className={`${s.drop} ${drag ? s.dropOn : ''}`}
            onDragOver={(e) => { e.preventDefault(); if (!drag) setDrag(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false); }}
            onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          >
            <input type="file" multiple accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            <span className={s.dropTitle}>Click to add files or drag them here</span>
            <span className={s.dropSub}>Screenshots, screen recordings, logs, PDFs · several at once · up to 10 MB each</span>
          </label>
          {atts.length > 0 && (
            <div className={s.atts}>
              {atts.map((a, i) => <AttachmentTile key={`${a.name}-${a.at}-${i}`} att={a} onRemove={() => removeAtt(i)} />)}
            </div>
          )}
        </div>

        {isEdit && (
          <div className={`${s.label} ${s.full}`}>
            Activity
            <div className={s.history}>
              {history.map((e, i) => (
                <div key={i} className={s.histItem}><span>{e.t}</span><span className={s.when}>{dLabel(e.d)}</span></div>
              ))}
            </div>
            <div className={s.addRow} style={{ marginTop: 4 }}>
              <Input
                compact
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addComment(); } }}
                placeholder="Add a comment and press Enter"
              />
              <Button size="sm" onClick={addComment}>Post</Button>
            </div>
          </div>
        )}

        {err && <ErrorText className={s.full}>{err}</ErrorText>}
      </div>
    </Modal>
  );
}
