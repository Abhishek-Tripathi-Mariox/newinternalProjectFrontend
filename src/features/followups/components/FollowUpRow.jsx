import { memo } from 'react';
import { useStore } from '@/store';
import { Avatar, Pill } from '@/components/ui';
import { useCopyMeet } from '../useCopyMeet';
import { describeFollowUp } from '../model';
import DoneCheck from './DoneCheck';
import MeetLink from './MeetLink';
import s from './FollowUpRow.module.css';
import { serverNow } from '@/lib/clock';

/**
 * One follow-up, rendered in one of four layouts:
 *  - `full` (default) — the Follow-ups list row (grid aligned with `FollowUpListHeader`)
 *  - `lead` (also `compact`) — Lead drawer row: check · title/meta · "Meet ↗"
 *  - `agenda` — Dashboard "Today's agenda": time · title/meta · "Join Meet"
 *  - `day` — Calendar selected-day panel: check · time · title/type/company/owner · "Join Meet"
 *
 * Reads the lead from the store and dispatches store actions itself, so callers only pass `fu`.
 */
function FollowUpRow({ fu, compact = false, variant, now, className = '' }) {
  const lead = useStore((st) => (fu.leadId ? st.leads.find((l) => l.id === fu.leadId) : undefined));
  const toggleFu = useStore((st) => st.toggleFu);
  const delFu = useStore((st) => st.delFu);
  const selectLead = useStore((st) => st.selectLead);
  const openModal = useStore((st) => st.openModal);
  const copyMeet = useCopyMeet();

  const v = variant || (compact ? 'lead' : 'full');
  const d = describeFollowUp(fu, lead, now ?? serverNow());
  const toggle = () => toggleFu(fu.id);
  const edit = () => openModal('fu', { editId: fu.id });
  const openLead = () => lead && selectLead(lead.id);
  const titleCls = `${fu.done ? s.titleDone : ''}`;

  if (v === 'agenda') {
    return (
      <div className={`${s.agenda} ${className}`}>
        <div className={s.agendaTime} style={{ color: d.dueColor }}>{d.dueTime}</div>
        <button type="button" className={s.plainBtn} onClick={edit}>
          <div className={s.agendaTitle}>{fu.title}</div>
          <div className={s.meta}>
            <span className={s.metaType} style={{ color: d.type.fg }}>{fu.type}</span> · {d.company} · {d.owner.name}
          </div>
        </button>
        {fu.meet ? <MeetLink href={fu.meet} /> : <span />}
      </div>
    );
  }

  if (v === 'lead') {
    return (
      <div className={`${s.lead} ${className}`}>
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

  if (v === 'day') {
    return (
      <div className={`${s.day} ${className}`}>
        <DoneCheck done={fu.done} onToggle={toggle} className={s.dayCheck} />
        <div className={s.dayTime} style={{ color: d.dueColor }}>{d.dueTime}</div>
        <div className={s.dayBody}>
          <button type="button" className={`${s.plainBtn} ${s.dayTitle} ${titleCls}`} onClick={edit}>{fu.title}</button>
          <div className={s.dayMeta}>
            <span className={s.typeTag} style={{ background: d.type.bg, color: d.type.fg }}>{fu.type}</span>
            <button type="button" className={s.linkBtn} onClick={openLead}>{d.company}</button>
            <span>· {d.owner.name}</span>
          </div>
          {fu.meet && <MeetLink href={fu.meet} className={s.dayMeet} />}
        </div>
      </div>
    );
  }

  // full list row
  return (
    <div className={`${s.grid} ${s.row} ${className}`} role="row">
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
        <button type="button" className={s.linkBtn} onClick={openLead}>{d.company}</button>
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
      <div className={s.cell}>
        <Pill bg={d.prio.bg} fg={d.prio.fg}>{fu.prio}</Pill>
      </div>
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
          <button type="button" className={s.delBtn} title="Delete" aria-label="Delete follow-up" onClick={() => delFu(fu.id)}>✕</button>
        </div>
      </div>
    </div>
  );
}

export default memo(FollowUpRow);

/** Column header row aligned with the `full` variant. */
export function FollowUpListHeader() {
  return (
    <div className={`${s.grid} ${s.head}`} role="row">
      <div className={s.cellCheck} />
      <div className={s.cell}>Follow-up</div>
      <div className={s.cell}>Lead</div>
      <div className={s.cell}>Owner</div>
      <div className={s.cell}>Due</div>
      <div className={s.cell}>Priority</div>
      <div className={s.cell}>Reminder</div>
      <div className={`${s.cell} ${s.actionsCell} ${s.right}`}>Actions</div>
    </div>
  );
}
