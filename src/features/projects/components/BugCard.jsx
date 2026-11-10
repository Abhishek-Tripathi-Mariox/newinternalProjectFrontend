import { memo } from 'react';
import { useStore } from '@/store';
import { Select } from '@/components/ui';
import { projectColor, tone } from '@/lib/color';
import { today } from '@/lib/date';
import { BUG_STATUS } from '@/config/constants';
import { BUG_STATUS_KEYS, bugDue, memberAvatar, sevTone } from '../workItems';
import { MiniAvatar } from './TaskCard';
import s from './WorkCard.module.css';

/** Status dropdown used in bug list rows; logs "Status → X" and flashes "BUG-1001 → X". */
export function BugStatusSelect({ bug, className }) {
  const updBug = useStore((st) => st.updBug);
  const flash = useStore((st) => st.flash);
  const t = tone(BUG_STATUS[bug.st] ?? 265);
  return (
    <Select
      unstyled
      aria-label="Status"
      className={`${s.statusSelect} ${className || ''}`}
      value={bug.st}
      style={{ background: t.bg, color: t.fg }}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const v = e.target.value;
        updBug(bug.id, { st: v }, `Status → ${v}`);
        flash(`${bug.id} → ${v}`);
      }}
      options={BUG_STATUS_KEYS}
    />
  );
}

/** Severity tag (Critical / Major / Minor / Trivial). */
export function SeverityTag({ sev }) {
  const v = sevTone(sev);
  return <span className={s.tag} style={{ background: v.bg, color: v.fg }}>{sev}</span>;
}

/**
 * Bug card (port of `bCard`).
 * - default: Kanban board card with a severity-coloured left edge
 * - `compact`: one-line row used in the member drawer.
 * Clicking opens the bug modal.
 */
function BugCard({ bug, compact = false }) {
  const openModal = useStore((st) => st.openModal);
  const project = useStore((st) => st.projects.find((p) => p.id === bug.p));
  const member = useStore((st) => (bug.a ? st.members.find((m) => m.id === bug.a) : null));
  const due = bugDue(bug, today());
  const open = () => openModal('bug', { editId: bug.id });
  const pName = project ? project.name : '—';

  if (compact) {
    return (
      <button type="button" className={s.compact} onClick={open}>
        <span className={s.cMain}>
          <span className={s.cTitle}>{bug.title}</span>
          <span className={s.cSub}>
            <span className={s.sq} style={{ background: projectColor(project) }} />
            {bug.id} · {pName} · {bug.st}
          </span>
        </span>
        <SeverityTag sev={bug.sev} />
        <span className={s.cDue} style={{ color: due.color }}>{due.label}</span>
      </button>
    );
  }

  return (
    <div
      className={`${s.card} ${s.bug}`}
      style={{ borderLeftColor: sevTone(bug.sev).dot }}
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && open()}
    >
      <div className={s.idLine}><span className={s.mono}>{bug.id}</span><span>{pName}</span></div>
      <div className={s.title}>{bug.title}</div>
      <div className={s.row}>
        <SeverityTag sev={bug.sev} />
        <span className={s.meta}>{bug.dept} · {bug.env}</span>
      </div>
      <div className={s.between}>
        <span className={`${s.meta} ${s.due}`} style={{ color: due.color }}>{due.label}</span>
        <MiniAvatar av={memberAvatar(member)} />
      </div>
    </div>
  );
}

export default memo(BugCard);
export { BugCard };
