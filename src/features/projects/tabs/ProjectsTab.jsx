import { useCallback, useMemo } from 'react';
import { AvatarStack, DataTable, FilterChips, KanbanBoard, Pill, SegmentedControl } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { avatarOf } from '@/domain/projects';
import { tone } from '@/lib/color';
import { hh } from '@/lib/format';
import { PROJECT_STATUS } from '@/config/constants';
import ProjectCard from '../components/ProjectCard';
import { HealthPill, Meter, ProjectName, UsedOf } from '../components/bits';
import { useProjectNav } from '../hooks/useProjectNav';
import { projectRow } from '../lib/projectRow';
import { NEUTRAL_DOT, STATUS_KEYS } from '../lib/view';
import s from './tabs.module.css';

const VIEWS = [['board', 'Board'], ['table', 'Table']];
const statusRank = (k) => STATUS_KEYS.indexOf(k);

function tableColumns(periodLabel) {
  return [
    {
      key: 'project',
      label: 'Project',
      render: (r) => (
        <>
          <ProjectName color={r.color} name={r.name} bold />
          <div className={`${s.cellSub} ${s.cellSubIndent}`}>
            {r.client} · <span className={s.mono}>{r.id}</span>
          </div>
        </>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <Pill bg={r.I.st.bg} fg={r.I.st.fg} dot={r.I.st.dot}>
          {r.p.status}
        </Pill>
      ),
    },
    {
      key: 'ms',
      label: 'Current milestone',
      render: (r) => (
        <>
          <div className={s.nowrapStrong}>{r.msName}</div>
          <div className={s.cellSub}>{r.msStep}</div>
        </>
      ),
    },
    { key: 'team', label: 'Team', render: (r) => <AvatarStack people={r.team} max={4} /> },
    {
      key: 'hours',
      label: 'Hours used / budget',
      render: (r) => (
        <Meter className={s.wide180} left={<UsedOf used={r.usedLabel} of={r.budgetLabel} />} right={<span className={s.muted}>{r.pctLabel}</span>} width={r.barW} color={r.barBg} />
      ),
    },
    { key: 'today', label: 'Today', align: 'right', render: (r) => <b>{r.today}</b> },
    { key: 'week', label: 'This week', align: 'right', render: (r) => r.week },
    { key: 'range', label: periodLabel, align: 'right', render: (r) => r.rangeH },
    {
      key: 'due',
      label: 'Due',
      render: (r) => (
        <div className={s.nowrap}>
          <div className={s.dueLabel} style={{ color: r.I.dueColor }}>
            {r.I.dueLabel}
          </div>
          <div className={s.cellSub}>{r.I.dueSub}</div>
        </div>
      ),
    },
    {
      key: 'health',
      label: 'Health',
      render: (r) => (
        <HealthPill bg={r.I.hBg} fg={r.I.hFg}>
          {r.I.hLabel}
        </HealthPill>
      ),
    },
  ];
}

/** Projects → Projects: status chips + Board (drag to change status) / Table. */
export default function ProjectsTab() {
  const model = useProjectsModel();
  const { members } = useScoped();
  const status = useStore((st) => st.pj.f.status);
  const pView = useStore((st) => st.pj.pView);
  const setPj = useStore((st) => st.setPj);
  const setPjF = useStore((st) => st.setPjF);
  const updProj = useStore((st) => st.updProj);
  const flash = useStore((st) => st.flash);
  const { openProject } = useProjectNav();

  const avatar = useCallback((id) => avatarOf(members, id), [members]);
  const { pBase, pF, g, hk, periodLabel, PRJ } = model;

  const chips = useMemo(
    () => [
      { key: '', label: 'All', count: pBase.length, dot: NEUTRAL_DOT },
      ...STATUS_KEYS.map((k) => ({ key: k, label: k, count: pBase.filter((p) => p.status === k).length, dot: tone(PROJECT_STATUS[k]).dot })),
    ],
    [pBase],
  );

  const isBoard = pView === 'board';

  const rows = useMemo(
    () =>
      isBoard
        ? []
        : pF
            .slice()
            .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.due - b.due)
            .map((p) => projectRow(p, model, avatar)),
    [isBoard, pF, model, avatar],
  );

  const columns = useMemo(() => {
    if (!isBoard) return [];
    // A selected status chip narrows the board to that one column (same as the table).
    // With "All", every status column shows so cards can be dragged between them.
    return STATUS_KEYS.filter((k) => !status || k === status).map((k) => {
      const c = pBase.filter((p) => p.status === k);
      return {
        key: k,
        name: k,
        dot: tone(PROJECT_STATUS[k]).dot,
        count: c.length,
        meta: `${hh(c.reduce((x, p) => x + g(hk(p)).range, 0))} · ${periodLabel.toLowerCase()}`,
        items: c.map((p) => projectRow(p, model, avatar)),
      };
    });
  }, [isBoard, status, pBase, g, hk, periodLabel, model, avatar]);

  const onMove = useCallback(
    (id, k) => {
      const p = PRJ[id];
      if (p && p.status !== k) {
        updProj(id, { status: k });
        flash(`${p.name} → ${k}`);
      }
    },
    [PRJ, updProj, flash],
  );

  const tableCols = useMemo(() => tableColumns(periodLabel), [periodLabel]);

  return (
    <div className={s.stack}>
      <div className={s.bar}>
        <FilterChips className={s.barChips} items={chips} value={status} onChange={(k) => setPjF({ status: k })} tone="dark" />
        <SegmentedControl options={VIEWS} value={isBoard ? 'board' : 'table'} onChange={(v) => setPj({ pView: v })} />
      </div>

      {isBoard ? (
        <KanbanBoard
          columns={columns}
          getId={(r) => r.id}
          renderCard={(r) => <ProjectCard row={r} onOpen={openProject} />}
          onMove={onMove}
          minColWidth={270}
        />
      ) : (
        <DataTable itemLabel="projects"
          columns={tableCols}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => openProject(r.id)}
          empty="No projects match these filters."
          minWidth={1180}
        />
      )}
    </div>
  );
}
