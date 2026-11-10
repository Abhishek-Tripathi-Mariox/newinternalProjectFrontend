import { useMemo } from 'react';
import { Button, SectionTitle, StackedBar } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { dLabel } from '@/lib/date';
import { hh, pctW } from '@/lib/format';
import TaskCard from '../components/TaskCard';
import BugCard from '../components/BugCard';
import { TASK_STATUS_KEYS, bugSort, isBugOpen, isTaskOpen, taskSort } from '../workItems';
import { useProjectNav } from '../hooks/useProjectNav';
import { taskColor } from '../lib/view';
import s from './drawer.module.css';

const SHOWN = 6;
const CLEAR_F = { member: '', team: '', status: '', q: '' };

/** Tasks summary: status distribution bar, legend and the top open tasks. */
export function TasksSection({ project: sp }) {
  const { tasks } = useScoped();
  const { openModal, goTab } = useProjectNav();

  const { ptk, open } = useMemo(() => {
    const list = (tasks || []).filter((t) => t.p === sp.id);
    return { ptk: list, open: list.filter(isTaskOpen).sort(taskSort) };
  }, [tasks, sp.id]);

  const counts = TASK_STATUS_KEYS.map((k) => [k, ptk.filter((t) => t.st === k).length]);
  const openBoard = () => goTab('tasks', { project: sp.id, ...CLEAR_F }, { selP: null, tF: '' });

  return (
    <section className={s.section}>
      <SectionTitle
        title="Tasks"
        action={
          <div className={s.actionsRow}>
            <Button size="sm" variant="secondary" onClick={() => openModal('task', { p: sp.id })}>
              + Add task
            </Button>
            <Button size="sm" variant="secondary" onClick={openBoard}>
              Open task board →
            </Button>
          </div>
        }
      />
      <StackedBar segments={counts.map(([k, n]) => ({ w: pctW(ptk.length ? n / ptk.length : 0), bg: taskColor(k), tip: `${k}: ${n}` }))} />
      <div className={s.legend}>
        {counts.map(([k, n]) => (
          <span key={k} className={s.legendItem}>
            <span className={s.sq} style={{ background: taskColor(k) }} />
            {k} <span className={s.legendN}>{n}</span>
          </span>
        ))}
      </div>
      {open.slice(0, SHOWN).map((t) => (
        <TaskCard key={t.id} task={t} compact />
      ))}
      {open.length > SHOWN && (
        <button type="button" className={s.linkBtn} onClick={openBoard}>
          + {open.length - SHOWN} more open tasks on the board
        </button>
      )}
      {open.length === 0 && <div className={s.empty}>No open tasks on this project.</div>}
    </section>
  );
}

/** Bugs summary: open / critical / closed counts and the most severe open bugs. */
export function BugsSection({ project: sp }) {
  const { bugs } = useScoped();
  const { openModal, goTab } = useProjectNav();

  const { all, open } = useMemo(() => {
    const list = (bugs || []).filter((b) => b.p === sp.id);
    return { all: list, open: list.filter(isBugOpen).sort(bugSort) };
  }, [bugs, sp.id]);

  const sum = `${open.length} open · ${open.filter((b) => b.sev === 'Critical').length} critical · ${all.filter((b) => b.st === 'Closed').length} closed`;

  return (
    <section className={s.section}>
      <SectionTitle
        title={
          <>
            Bugs <span className={s.h3sub}>{sum}</span>
          </>
        }
        action={
          <div className={s.actionsRow}>
            <Button size="sm" variant="dangerOutline" onClick={() => openModal('bug', { p: sp.id })}>
              + Report bug
            </Button>
            <Button size="sm" variant="secondary" onClick={() => goTab('bugs', { project: sp.id, ...CLEAR_F }, { selP: null, bQ: 'open' })}>
              All bugs →
            </Button>
          </div>
        }
      />
      {open.slice(0, SHOWN).map((b) => (
        <BugCard key={b.id} bug={b} compact />
      ))}
      {open.length === 0 && <div className={s.empty}>No open bugs on this project.</div>}
    </section>
  );
}

/** Last 8 time entries with a shortcut to log hours on this project. */
export function RecentLogsSection({ project: sp, model }) {
  const { logs } = useScoped();
  const openModal = useStore((st) => st.openModal);
  const recent = useMemo(() => logs.filter((l) => l.p === sp.id).sort((a, b) => b.d - a.d).slice(0, 8), [logs, sp.id]);
  return (
    <section>
      <SectionTitle
        title="Recent time entries"
        action={
          <Button size="sm" variant="secondary" onClick={() => openModal('log', { project: sp.id, member: sp.team[1] || sp.team[0] })}>
            + Log hours
          </Button>
        }
      />
      {recent.map((l) => (
        <RecentRow key={l.id} l={l} model={model} />
      ))}
      {recent.length === 0 && <div className={s.empty}>No hours logged yet.</div>}
    </section>
  );
}

function RecentRow({ l, model }) {
  return (
    <div className={s.recent}>
      <span className={s.recentDate}>{dLabel(l.d)}</span>
      <div className={s.minw}>
        <span className={s.b5}>{(model.MEM[l.m] || {}).name}</span> <span className={s.muted}>· {(model.MSS[l.ms] || {}).name || '—'}</span>
        <div className={s.recentNote}>{l.note}</div>
      </div>
      <span className={s.b6}>{hh(l.h)}</span>
    </div>
  );
}
