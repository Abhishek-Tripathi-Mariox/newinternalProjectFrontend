import { memo } from 'react';
import { useStore } from '@/store';
import { Select } from '@/components/ui';
import { projectColor, tone, INK, MUTED } from '@/lib/color';
import { hh } from '@/lib/format';
import { today } from '@/lib/date';
import { TASK_STATUS } from '@/config/constants';
import { TASK_STATUS_KEYS, memberAvatar, msShort, prioTone, taskChecklist, taskDue } from '../workItems';
import s from './WorkCard.module.css';

/** Resolve the project / milestone / assignee a task points at (cheap per-card selectors). */
function useTaskRefs(task) {
  const project = useStore((st) => st.projects.find((p) => p.id === task.p));
  const ms = useStore((st) => st.milestones.find((m) => m.id === task.ms));
  const member = useStore((st) => (task.a ? st.members.find((m) => m.id === task.a) : null));
  return { project, ms, assignee: memberAvatar(member) };
}

/** Status dropdown used in list rows; changes the task and flashes "Title → Status". */
export function TaskStatusSelect({ task, className }) {
  const updTask = useStore((st) => st.updTask);
  const flash = useStore((st) => st.flash);
  const t = tone(TASK_STATUS[task.st] ?? 265);
  return (
    <Select
      unstyled
      aria-label="Status"
      className={`${s.statusSelect} ${className || ''}`}
      value={task.st}
      style={{ background: t.bg, color: t.fg }}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const v = e.target.value;
        updTask(task.id, { st: v });
        flash(`${task.title} → ${v}`);
      }}
      options={TASK_STATUS_KEYS}
    />
  );
}

/** Small round initials badge. */
export function MiniAvatar({ av }) {
  return <span className={s.av} title={av.name} style={{ background: av.bg, color: av.fg }}>{av.ini}</span>;
}

/**
 * Task card (port of `tCard`).
 * - default: Kanban board card (project, title, priority, milestone, due, estimate, checklist, assignee)
 * - `compact`: one-line row used in the member drawer.
 * Clicking opens the task modal.
 */
function TaskCard({ task, compact = false }) {
  const openModal = useStore((st) => st.openModal);
  const filterProject = useStore((st) => st.pj.f.project);
  const { project, ms, assignee } = useTaskRefs(task);
  const due = taskDue(task, today());
  const pt = prioTone(task.prio);
  const done = task.st === 'Done';
  const open = () => openModal('task', { editId: task.id });
  const pColor = projectColor(project);

  if (compact) {
    return (
      <button type="button" className={s.compact} onClick={open}>
        <span className={s.cMain}>
          <span className={s.cTitle}>{task.title}</span>
          <span className={s.cSub}>
            <span className={s.sq} style={{ background: pColor }} />
            {project ? project.name : '—'} · {task.st}
          </span>
        </span>
        <span className={s.tag} style={{ background: pt.bg, color: pt.fg }}>{task.prio}</span>
        <span className={s.cDue} style={{ color: due.color }}>{due.label}</span>
      </button>
    );
  }

  const cl = taskChecklist(task);
  return (
    <div className={s.card} onClick={open} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open()}>
      {!filterProject && (
        <div className={s.projectLine}>
          <span className={s.sq} style={{ background: pColor }} />
          {project ? project.name : '—'}
        </div>
      )}
      <div className={s.title} style={{ textDecoration: done ? 'line-through' : 'none', color: done ? MUTED : INK }}>{task.title}</div>
      <div className={s.row}>
        <span className={s.tag} style={{ background: pt.bg, color: pt.fg }}>{task.prio}</span>
        <span className={s.meta}>{msShort(ms)}</span>
      </div>
      <div className={s.between}>
        <div className={s.metaRow}>
          <span className={s.due} style={{ color: due.color }}>{due.label}</span>
          {!!task.est && <span>{hh(task.est)}</span>}
          {cl.has && <span>☑ {cl.label}</span>}
        </div>
        <MiniAvatar av={assignee} />
      </div>
    </div>
  );
}

export default memo(TaskCard);
export { TaskCard };
