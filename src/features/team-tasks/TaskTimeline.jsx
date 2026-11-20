import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { Button } from '@/components/ui';
import { teamTasksApi } from '@/api/teamTasks';
import { dateTime, ago } from '@/lib/date';
import s from './TaskTimeline.module.css';

const ICON = { created: '＋', status: '●', note: '✎', comment: '💬', attach: '📎', detach: '🗑', edit: '✏', assign: '⇄' };

/** One line of the timeline: who did what. */
function describe(e) {
  switch (e.kind) {
    case 'created': return <>gave this task to <b>{e.to}</b></>;
    case 'status':
      return e.meta && e.meta.reopened
        ? <>reopened it · <b>{e.from}</b> → <b>{e.to}</b></>
        : <>changed status <b>{e.from}</b> → <b>{e.to}</b></>;
    case 'note': return <>updated the progress note</>;
    case 'comment': return <>commented</>;
    case 'attach': {
      const f = (e.meta && e.meta.files) || [];
      return <>added {f.length} file{f.length === 1 ? '' : 's'}: <b>{f.map((x) => x.name).join(', ')}</b></>;
    }
    case 'detach': {
      const f = (e.meta && e.meta.files) || [];
      return <>removed file <b>{f.map((x) => x.name).join(', ')}</b></>;
    }
    case 'assign': return <>reassigned <b>{e.from}</b> → <b>{e.to}</b></>;
    case 'edit': {
      const ch = (e.meta && e.meta.changes) || [];
      return (
        <>
          edited the task
          <ul className={s.changes}>
            {ch.map((c) => (
              <li key={c.field}>
                {c.label}{c.field === 'notes' ? ' updated' : <>: <s>{c.from || '—'}</s> → <b>{c.to || '—'}</b></>}
              </li>
            ))}
          </ul>
        </>
      );
    }
    default: return e.kind;
  }
}

/**
 * Team task timeline: every status change (with why it was reopened), progress note, comment,
 * file added / removed, edit and reassignment — plus a comment box. Reloads when `version` changes.
 */
export default function TaskTimeline({ taskId, version, me, onCommented }) {
  const flash = useStore((x) => x.flash);
  const [events, setEvents] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    teamTasksApi.activity(taskId).then((r) => { if (live) setEvents(r || []); }).catch(() => { if (live) setEvents([]); });
    return () => { live = false; };
  }, [taskId, version]);

  const send = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      setEvents((await teamTasksApi.comment(taskId, v)) || []);
      setText('');
      onCommented?.();
    } catch (e) {
      flash(e.message || 'Couldn’t add the comment');
    }
    setBusy(false);
  };

  return (
    <div className={s.wrap}>
      {events == null ? (
        <div className={s.muted}>Loading timeline…</div>
      ) : events.length === 0 ? (
        <div className={s.muted}>No activity recorded yet.</div>
      ) : (
        <ol className={s.list}>
          {events.map((e) => (
            <li key={e.id} className={`${s.item} ${s[e.kind] || ''} ${e.meta && e.meta.reopened ? s.reopened : ''}`}>
              <span className={s.dot} aria-hidden>{ICON[e.kind] || '•'}</span>
              <div className={s.body}>
                <div className={s.line}>
                  <span className={s.who}>{e.by === me ? 'You' : e.byName}</span> {describe(e)}
                  <span className={s.when} title={dateTime(e.at)}>{ago(Date.parse(e.at))} · {dateTime(e.at)}</span>
                </div>
                {e.text && <div className={s.text}>{e.text}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className={s.compose}>
        <input
          className={s.input}
          value={text}
          maxLength={5000}
          placeholder="Write a comment…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          aria-label="Comment"
        />
        <Button size="sm" variant="primary" disabled={!text.trim() || busy} onClick={send}>Comment</Button>
      </div>
    </div>
  );
}
