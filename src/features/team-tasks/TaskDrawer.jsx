import { useState } from 'react';
import { useStore } from '@/store';
import { Button, ConfirmButton, DocumentList, Drawer, FileDropzone, HuePill, Select } from '@/components/ui';
import { dateTime, fday } from '@/lib/date';
import { PRIO_HUE, STATUS_HUE, statusChoices } from './model';
import TaskTimeline from './TaskTimeline';
import s from './TaskDrawer.module.css';


/** Small labelled fact in the header grid. */
const Fact = ({ label, children }) => (
  <div>
    <div className={s.factLabel}>{label}</div>
    <div className={s.factValue}>{children}</div>
  </div>
);

/**
 * One team task in a side drawer: facts, details, progress note, files (with title), and the
 * timeline with comments. Reopening a Done task asks why.
 */
export default function TaskDrawer({ t, me, T, onClose, uploader, reopenAs }) {
  const openModal = useStore((x) => x.openModal);
  const updateTeamTask = useStore((x) => x.updateTeamTask);
  const delTeamTask = useStore((x) => x.delTeamTask);
  const attachTeamTask = useStore((x) => x.attachTeamTask);
  const removeTeamTaskDoc = useStore((x) => x.removeTeamTaskDoc);
  const setPj = useStore((x) => x.setPj);
  const selectLead = useStore((x) => x.selectLead);

  const [note, setNote] = useState(t.upd || '');
  const [reopen, setReopen] = useState(reopenAs && t.status === 'Done' ? { status: reopenAs, text: '' } : null); // {status, text}
  const [pending, setPending] = useState(null); // {files, title}
  const [busy, setBusy] = useState(false);

  const late = t.due && t.status !== 'Done' && t.due < T;
  const bump = () => useStore.setState((x) => ({ teamTasks: (x.teamTasks || []).map((y) => (y.id === t.id ? { ...y, comments: (y.comments || 0) + 1, events: (y.events || 0) + 1 } : y)) }));

  const changeStatus = (v) => {
    if (v === t.status) return;
    if (t.status === 'Done') { setReopen({ status: v, text: '' }); return; }
    updateTeamTask(t.id, { status: v });
  };
  const saveReopen = async () => {
    if (!reopen.text.trim()) return;
    if (await updateTeamTask(t.id, { status: reopen.status, comment: reopen.text.trim() })) setReopen(null);
  };
  const upload = async () => {
    if (!pending || busy) return;
    setBusy(true);
    const ok = await attachTeamTask(t.id, pending.files, pending.title);
    setBusy(false);
    if (ok) setPending(null);
  };

  const header = (
    <div className={s.head}>
      <div className={s.headMeta}>
        <span className={s.mono}>{t.id}</span>
        {t.p && <button type="button" className={s.chip} onClick={() => { onClose(); setPj({ selP: t.p, selM: null, exp: null, exp2: null }); }}>▣ {t.pName || t.p}</button>}
        {t.lead && <button type="button" className={`${s.chip} ${s.chipLead}`} onClick={() => { onClose(); selectLead(t.lead); }}>◆ {t.leadName || t.lead}</button>}
      </div>
      <h2 className={`${s.title} ${t.status === 'Done' ? s.done : ''}`}>{t.title}</h2>
    </div>
  );

  const actions = (
    <>
      {t.canEdit && <Button size="sm" onClick={() => openModal('tt', { editId: t.id })}>Edit</Button>}
      {t.canDelete && <ConfirmButton size="sm" onConfirm={() => { delTeamTask(t.id); onClose(); }} confirmLabel="Delete?">Delete</ConfirmButton>}
    </>
  );

  return (
    <Drawer open onClose={onClose} width={640} header={header} actions={actions} label={t.title}>
      <div className={s.body}>
        {/* Status bar */}
        <div className={s.statusBar}>
          <div className={s.statusLeft}>
            <span className={s.factLabel}>Status</span>
            {t.canStatus
              ? <Select compact value={t.status} options={statusChoices(t.status)} onChange={(e) => changeStatus(e.target.value)} aria-label="Status" />
              : <HuePill hue={STATUS_HUE[t.status]} dot>{t.status}</HuePill>}
          </div>
          {t.status === 'Done' && t.doneAt && <span className={s.doneAt}>✓ Done {dateTime(t.doneAt)}</span>}
        </div>
        {reopen && (
          <div className={s.reopen}>
            <div className={s.reopenHead}>Reopen as <b>{reopen.status}</b> — why?</div>
            <input
              className={s.input}
              autoFocus
              maxLength={5000}
              value={reopen.text}
              placeholder="e.g. Login still fails on Android, screenshots missing…"
              onChange={(e) => setReopen({ ...reopen, text: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') saveReopen(); if (e.key === 'Escape') setReopen(null); }}
            />
            <div className={s.row}>
              <Button size="sm" variant="primary" disabled={!reopen.text.trim()} onClick={saveReopen}>Reopen task</Button>
              <Button size="sm" variant="secondary" onClick={() => setReopen(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Facts */}
        <div className={s.facts}>
          <Fact label="Assigned to">{t.a === me ? 'Me' : t.aName}</Fact>
          <Fact label="Given by">{t.by === me ? 'Me' : t.byName || '—'}</Fact>
          <Fact label="Due">
            {t.due ? <span className={late ? s.late : undefined}>{fday(t.due)}{late ? ' · overdue' : t.due === T ? ' · today' : ''}</span> : '—'}
          </Fact>
          <Fact label="Estimate">{t.est ? `${t.est}h` : '—'}</Fact>
          <Fact label="Priority"><HuePill hue={PRIO_HUE[t.prio]} size="sm">{t.prio}</HuePill></Fact>
          <Fact label="Created">{t.at ? dateTime(t.at) : '—'}</Fact>
        </div>

        {/* Details */}
        <section className={s.section}>
          <h3 className={s.h3}>Details</h3>
          {t.notes ? <div className={s.notes}>{t.notes}</div> : <div className={s.muted}>No details added.</div>}
        </section>

        {/* Progress note */}
        <section className={s.section}>
          <h3 className={s.h3}>Progress note</h3>
          {t.canStatus ? (
            <div className={s.row}>
              <input
                className={s.input}
                value={note}
                maxLength={5000}
                placeholder="Where is it at? e.g. API done, UI pending"
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && note !== t.upd) updateTeamTask(t.id, { upd: note }); }}
              />
              <Button size="sm" variant="secondary" disabled={note === (t.upd || '')} onClick={() => updateTeamTask(t.id, { upd: note })}>Save</Button>
            </div>
          ) : t.upd ? <div className={s.notes}>{t.upd}</div> : <div className={s.muted}>No progress note yet.</div>}
        </section>

        {/* Files */}
        <section className={s.section}>
          <h3 className={s.h3}>Files <span className={s.count}>{t.atts.length}</span></h3>
          {t.canStatus && !pending && (
            <FileDropzone compact hint="Screenshots, docs, sheets · up to 10 MB each" onFiles={(files) => setPending({ files: Array.from(files).slice(0, 10), title: '' })} />
          )}
          {pending && (
            <div className={s.pending}>
              <div className={s.pendingFiles}>📎 {pending.files.map((f) => f.name).join(', ')}</div>
              <input
                className={s.input}
                autoFocus
                maxLength={200}
                value={pending.title}
                placeholder="Title (optional) — e.g. Login screen design"
                onChange={(e) => setPending({ ...pending, title: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') upload(); if (e.key === 'Escape') setPending(null); }}
              />
              <div className={s.row}>
                <Button size="sm" variant="primary" disabled={busy} onClick={upload}>{busy ? 'Uploading…' : 'Upload'}</Button>
                <Button size="sm" variant="secondary" onClick={() => setPending(null)}>Cancel</Button>
              </div>
            </div>
          )}
          {t.atts.length > 0 ? (
            <DocumentList
              docs={t.atts.map((d) => ({ ...d, byName: uploader(t, d) }))}
              editable={false}
              canRemove={(d) => t.canEdit || (t.canStatus && d.by === me)}
              onRemove={(_, d) => removeTeamTaskDoc(t.id, d)}
            />
          ) : !t.canStatus && <div className={s.muted}>No files.</div>}
        </section>

        {/* Timeline */}
        <section className={s.section}>
          <h3 className={s.h3}>Timeline &amp; comments <span className={s.count}>{t.events || 0}</span></h3>
          <TaskTimeline taskId={t.id} me={me} version={`${t.status}|${t.upd}|${t.atts.length}|${t.events}|${t.a}|${t.title}`} onCommented={bump} />
        </section>
      </div>
    </Drawer>
  );
}
