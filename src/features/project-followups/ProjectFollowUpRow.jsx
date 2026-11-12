import { memo } from 'react';
import { useStore } from '@/store';
import { Avatar, Pill } from '@/components/ui';
import { serverNow } from '@/lib/clock';
import { useCopyMeet } from '@/features/followups/useCopyMeet';
import DoneCheck from '@/features/followups/components/DoneCheck';
import MeetLink from '@/features/followups/components/MeetLink';
import { describePfu } from './model';
import s from '@/features/followups/components/FollowUpRow.module.css';

/**
 * One project follow-up. `full` = page list row (aligned with ProjectFollowUpListHeader);
 * `compact` = project-drawer row: check · title/meta · Meet.
 */
function ProjectFollowUpRow({ fu, project, members, compact = false, now }) {
  const togglePfu = useStore((st) => st.togglePfu);
  const delPfu = useStore((st) => st.delPfu);
  const openModal = useStore((st) => st.openModal);
  const setPj = useStore((st) => st.setPj);
  const copyMeet = useCopyMeet();
  const d = describePfu(fu, project, members, now ?? serverNow());
  const toggle = () => togglePfu(fu.id);
  const edit = () => openModal('pfu', { editId: fu.id });
  const titleCls = fu.done ? s.titleDone : '';

  if (compact) {
    return (
      <div className={s.lead}>
        <DoneCheck done={fu.done} onToggle={toggle} title="Mark done" />
        <button type="button" className={s.plainBtn} onClick={edit}>
          <div className={`${s.leadTitle} ${titleCls}`}>{fu.title}</div>
          <div className={s.meta} style={{ color: d.dueColor }}>
            <span className={s.metaType} style={{ color: d.type.fg }}>{fu.type}</span> · {d.dueDate} {d.dueTime} · {d.owner.name}
          </div>
        </button>
        {fu.meet ? <MeetLink href={fu.meet} plain /> : <span />}
      </div>
    );
  }

  return (
    <div className={`${s.grid} ${s.row}`} role="row">
      <div className={s.cellCheck}><DoneCheck done={fu.done} onToggle={toggle} /></div>
      <div className={s.cell}>
        <div className={s.titleWrap}>
          <span className={s.typeTag} style={{ background: d.type.bg, color: d.type.fg }}>{fu.type}</span>
          <button type="button" className={`${s.plainBtn} ${s.rowTitle} ${titleCls}`} onClick={edit} title="Edit follow-up">
            {fu.title}
          </button>
        </div>
      </div>
      <div className={s.cell}>
        <button type="button" className={s.linkBtn} onClick={() => project && setPj({ selP: project.id, selM: null })} title={d.client}>
          {d.projectName}
        </button>
      </div>
      <div className={s.cell}>
        <span className={s.owner}>
          <Avatar name={d.owner.name} h={d.owner.h} ini={d.owner.ini} size={24} style={{ fontSize: 10, fontWeight: 600 }} />
          {d.owner.name}
        </span>
      </div>
      <div className={`${s.cell} ${s.nowrap}`} style={{ color: d.dueColor }}>
        <div className={s.dueDate}>{d.dueDate}</div>
        <div className={s.dueTime}>{d.dueTime}{d.durLabel}</div>
      </div>
      <div className={s.cell}><Pill bg={d.prio.bg} fg={d.prio.fg}>{fu.prio}</Pill></div>
      <div className={`${s.cell} ${s.remind}`}>{d.remindLabel}</div>
      <div className={`${s.cell} ${s.actionsCell}`}>
        <div className={s.actions}>
          {fu.meet && (
            <>
              <MeetLink href={fu.meet} />
              <button type="button" className={s.ghostBtn} onClick={() => copyMeet(fu.meet)}>Copy link</button>
            </>
          )}
          <a href={d.calUrl} target="_blank" rel="noreferrer" className={s.ghostBtn}>Calendar ↗</a>
          <button type="button" className={s.delBtn} title="Delete" aria-label="Delete follow-up" onClick={() => delPfu(fu.id)}>✕</button>
        </div>
      </div>
    </div>
  );
}

export default memo(ProjectFollowUpRow);

export function ProjectFollowUpListHeader() {
  return (
    <div className={`${s.grid} ${s.head}`} role="row">
      <div className={s.cellCheck} />
      <div className={s.cell}>Follow-up</div>
      <div className={s.cell}>Project</div>
      <div className={s.cell}>Owner</div>
      <div className={s.cell}>Due</div>
      <div className={s.cell}>Priority</div>
      <div className={s.cell}>Reminder</div>
      <div className={`${s.cell} ${s.actionsCell} ${s.right}`}>Actions</div>
    </div>
  );
}
