import { useMemo } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { Button, DataTable, FilterChips, KanbanBoard, SegmentedControl, Select } from '@/components/ui';
import { projectColor, MUTED, INK, RED, BLUE } from '@/lib/color';
import { hh } from '@/lib/format';
import { TASK_STATUS } from '@/config/constants';
import TaskCard, { MiniAvatar, TaskStatusSelect } from '../components/TaskCard';
import {
  TASK_STATUS_KEYS, isTaskOpen, memberAvatar, msShort, prioTone, statusDot, taskChecklist, taskDue, taskFilters, taskSort,
} from '../workItems';
import s from './WorkTabs.module.css';

const NEUTRAL = 'oklch(0.7 0.01 265)';
const VIEWS = [['board', 'Board'], ['list', 'List']];

/** Tasks tab: summary, quick-filter chips, Kanban board (drag between statuses) or list. */
export default function TasksTab() {
  const pj = useStore((st) => st.pj);
  const setPj = useStore((st) => st.setPj);
  const setPjF = useStore((st) => st.setPjF);
  const openModal = useStore((st) => st.openModal);
  const updTask = useStore((st) => st.updTask);
  const flash = useStore((st) => st.flash);
  const scoped = useScoped();
  const { T, MEM, PRJ, MSS, q, wk } = useProjectsModel();
  const f = pj.f;
  const tF = pj.tF || '';
  const view = pj.tView === 'list' ? 'list' : 'board';

  const { shown, chips, summary } = useMemo(() => {
    const pTs = new Set(scoped.projects.filter((p) => (!f.project || p.id === f.project) && (!f.status || p.status === f.status)).map((p) => p.id));
    const base = (scoped.tasks || []).filter((t) => pTs.has(t.p) && (!f.member || t.a === f.member) && (!f.team || (MEM[t.a] || {}).team === f.team) &&
      (!q || `${t.title} ${(PRJ[t.p] || {}).name || ''} ${(MEM[t.a] || {}).name || ''}`.toLowerCase().includes(q)));
    const F = taskFilters(T, wk[1]);
    const n = (k) => base.filter(F[k]).length;
    return {
      base,
      shown: base.filter(F[tF] || F['']),
      summary: `${base.filter(isTaskOpen).length} open · ${n('overdue')} overdue · ${base.filter((t) => t.st === 'Done').length} done`,
      chips: [
        { key: '', label: 'All', count: base.length, dot: NEUTRAL },
        { key: 'overdue', label: 'Overdue', count: n('overdue'), dot: RED },
        { key: 'week', label: 'Due this week', count: n('week'), dot: BLUE },
        { key: 'high', label: 'High priority', count: n('high'), dot: 'oklch(0.62 0.15 25)' },
        { key: 'blocked', label: 'Blocked', count: n('blocked'), dot: statusDot(TASK_STATUS.Blocked) },
        { key: 'unassigned', label: 'Unassigned', count: n('unassigned'), dot: NEUTRAL },
      ],
    };
  }, [scoped.projects, scoped.tasks, f.project, f.status, f.member, f.team, q, MEM, PRJ, T, wk, tF]);

  const columns = useMemo(() => TASK_STATUS_KEYS.map((k) => {
    const items = shown.filter((t) => t.st === k).sort(taskSort);
    return {
      key: k, name: k, dot: statusDot(TASK_STATUS[k]), count: items.length, items, addLabel: 'Add task here',
      onAdd: () => openModal('task', { p: f.project || undefined, a: f.member || undefined, st: k }),
    };
  }), [shown, openModal, f.project, f.member]);

  const rows = useMemo(
    () => shown.slice().sort((a, b) => TASK_STATUS_KEYS.indexOf(a.st) - TASK_STATUS_KEYS.indexOf(b.st) || taskSort(a, b)),
    [shown],
  );

  const onMove = (id, k) => {
    const t = (scoped.tasks || []).find((x) => x.id === id);
    if (t && t.st !== k) {
      updTask(id, { st: k });
      flash(`${t.title} → ${k}`);
    }
  };
  const openTask = (t) => openModal('task', { editId: t.id });

  const listColumns = [
    {
      key: 'task', label: 'Task', render: (t) => {
        const done = t.st === 'Done';
        const cl = taskChecklist(t);
        return (
          <>
            <div className={s.b600} style={{ textDecoration: done ? 'line-through' : 'none', color: done ? MUTED : INK }}>{t.title}</div>
            {cl.has && <div className={s.small}>Checklist {cl.label}</div>}
          </>
        );
      },
    },
    {
      key: 'project', label: 'Project · milestone', render: (t) => (
        <>
          <div className={`${s.inline} ${s.b500}`}><span className={s.sq} style={{ background: projectColor(PRJ[t.p]) }} />{PRJ[t.p] ? PRJ[t.p].name : '—'}</div>
          <div className={s.indent}>{msShort(MSS[t.ms])}</div>
        </>
      ),
    },
    {
      key: 'a', label: 'Assignee', render: (t) => {
        const av = memberAvatar(t.a ? MEM[t.a] : null);
        return <div className={s.inline}><MiniAvatar av={av} />{av.name}</div>;
      },
    },
    { key: 'st', label: 'Status', render: (t) => <TaskStatusSelect task={t} /> },
    {
      key: 'prio', label: 'Priority', render: (t) => {
        const pt = prioTone(t.prio);
        return <span className={s.statePill} style={{ background: pt.bg, color: pt.fg, borderRadius: 5, fontSize: 11 }}>{t.prio}</span>;
      },
    },
    {
      key: 'due', label: 'Due', render: (t) => {
        const d = taskDue(t, T);
        return <span className={`${s.nowrap} ${s.b500}`} style={{ color: d.color }}>{d.label}</span>;
      },
    },
    { key: 'est', label: 'Estimate', align: 'right', render: (t) => (t.est ? hh(t.est) : '—') },
  ];

  return (
    <div className={s.stack}>
      <div className={s.bar}>
        <div className={s.group}>
          <Select
            unstyled
            className={s.projectSelect}
            aria-label="Project"
            value={f.project}
            onChange={(e) => setPjF({ project: e.target.value })}
            options={[{ value: '', label: 'All projects' }, ...scoped.projects.map((p) => ({ value: p.id, label: p.name }))]}
          />
          <span className={s.summary}>{summary}</span>
        </div>
        <div className={s.group}>
          <SegmentedControl options={VIEWS} value={view} onChange={(v) => setPj({ tView: v })} />
          <Button variant="primary" onClick={() => openModal('task', { p: f.project || undefined, a: f.member || undefined })}>+ New task</Button>
        </div>
      </div>

      <FilterChips items={chips} value={tF} onChange={(v) => setPj({ tF: v })} tone="dark" />

      {view === 'board' ? (
        <KanbanBoard
          columns={columns}
          getId={(t) => t.id}
          renderCard={(t) => <TaskCard task={t} />}
          onMove={onMove}
          minColWidth={272}
          emptyText="Drop tasks here"
        />
      ) : (
        <DataTable itemLabel="tasks"
          columns={listColumns}
          rows={rows}
          rowKey={(t) => t.id}
          onRowClick={openTask}
          minWidth={1080}
          empty="No tasks match these filters."
        />
      )}
    </div>
  );
}
