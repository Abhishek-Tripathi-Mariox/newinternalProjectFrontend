import { useCallback, useMemo } from 'react';
import { DataTable, FilterChips, KanbanBoard, Pill, SegmentedControl } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { avatarOf } from '@/domain/projects';
import { tone } from '@/lib/color';
import { hh } from '@/lib/format';
import { fd } from '@/lib/date';
import { PRIORITIES, PROJECT_STATUS } from '@/config/constants';
import ProjectCard from '../components/ProjectCard';
import { HealthPill, Meter, ProjectName, UsedOf } from '../components/bits';
import { useProjectNav } from '../hooks/useProjectNav';
import { projectRow } from '../lib/projectRow';
import { NEUTRAL_DOT, STATUS_KEYS } from '../lib/view';
import s from './tabs.module.css';

const VIEWS = [['board', 'Board'], ['table', 'Table']];
const statusRank = (k) => STATUS_KEYS.indexOf(k);

function tableColumns(periodLabel, openMember) {
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
          {(r.service || r.value) && (
            <div className={`${s.cellSub} ${s.cellSubIndent}`}>{[r.service, r.value].filter(Boolean).join(' · ')}</div>
          )}
          <div className={`${s.cellSub} ${s.cellSubIndent}`}>
            <span style={{ color: tone(PRIORITIES[r.prio] ?? 265).fg, fontWeight: 600 }}>{r.prio} priority</span>
          </div>
        </>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <>
          <Pill bg={r.I.st.bg} fg={r.I.st.fg} dot={r.I.st.dot}>
            {r.p.status}
          </Pill>
          {(r.p.statusReason || r.p.statusNote) && (
            <div className={s.cellSub} style={{ color: 'oklch(0.45 0.12 55)', maxWidth: 200, whiteSpace: 'normal' }} title={r.p.statusNote}>
              {r.p.statusReason || 'Note'}{r.p.statusNote ? ` — ${r.p.statusNote}` : ''}
            </div>
          )}
        </>
      ),
    },
    {
      key: 'ms',
      label: 'Current milestone',
      render: (r) => (
        <>
          <div className={s.nowrapStrong}>{r.msName}</div>
          <div className={s.cellSub}>{r.msStep}</div>
          {r.msPeople.length > 0 && <div className={s.cellSub}>On it: {r.msPeople.join(', ')}</div>}
        </>
      ),
    },
    {
      key: 'team',
      label: 'PM & team (logged / alloc.)',
      render: (r) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 200 }}>
          {r.pmName && (
            <button type="button" className={s.personBtn} onClick={(e) => { e.stopPropagation(); openMember(r.p.pm); }}>
              <span className={s.cellSub}>PM</span> <b style={{ fontSize: 12.5 }}>{r.pmName}</b>
            </button>
          )}
          {r.people.map((x) => (
            <button key={x.id} type="button" className={s.personBtn} onClick={(e) => { e.stopPropagation(); openMember(x.id); }} title={x.primary ? 'Primary developer' : undefined}>
              <span style={{ fontSize: 12.5 }}>{x.name}{x.primary ? ' ★' : ''}</span>
              <span className={s.cellSub}> · {hh(x.logged)}{x.alloc ? ` / ${hh(x.alloc)}` : ''}</span>
            </button>
          ))}
          {!r.pmName && r.people.length === 0 && <span className={s.cellSub}>No team yet</span>}
        </div>
      ),
    },
    {
      key: 'hours',
      label: 'Hours / budget',
      render: (r) => (
        <Meter className={s.wide180} left={<UsedOf used={r.usedLabel} of={r.budgetLabel} />} right={<span className={s.muted}>{r.pctLabel}</span>} width={r.barW} color={r.barBg} />
      ),
    },
    { key: 'today', label: 'Today', align: 'right', render: (r) => <b>{r.today}</b> },
    { key: 'week', label: 'This week', align: 'right', render: (r) => r.week },
    // The period filter column — skipped when it would repeat "This week".
    ...(periodLabel === 'This week' ? [] : [{ key: 'range', label: periodLabel, align: 'right', render: (r) => r.rangeH }]),
    {
      key: 'due',
      label: 'Due',
      render: (r) => (
        <div className={s.nowrap}>
          <div className={s.dueLabel} style={{ color: r.I.dueColor }}>
            {r.I.dueLabel}
          </div>
          <div className={s.cellSub}>{r.I.dueSub}</div>
          <div className={s.cellSub}>Onboarded {r.p.start ? fd(r.p.start) : '—'}</div>
        </div>
      ),
    },
    {
      key: 'open',
      label: 'Open',
      align: 'right',
      render: (r) => (
        <div className={s.nowrap}>
          <div>{r.openT} task{r.openT === 1 ? '' : 's'}</div>
          <div className={s.cellSub} style={r.openB ? { color: 'oklch(0.52 0.18 25)', fontWeight: 600 } : undefined}>{r.openB} bug{r.openB === 1 ? '' : 's'}</div>
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

/** Multi-line cells: align every cell to the top so rows read straight across under their headers. */
const topAligned = (cols) => cols.map((c) => ({ ...c, tdStyle: { verticalAlign: 'top', ...(c.tdStyle || {}) } }));

/** Projects → Projects: status chips + Board (drag to change status) / Table. */
export default function ProjectsTab() {
  const model = useProjectsModel();
  const { members } = useScoped();
  const status = useStore((st) => st.pj.f.status);
  const pView = useStore((st) => st.pj.pView);
  const setPj = useStore((st) => st.setPj);
  const setPjF = useStore((st) => st.setPjF);
  const updProj = useStore((st) => st.updProj);
  const openModal = useStore((st) => st.openModal);
  const flash = useStore((st) => st.flash);
  const { openProject, openMember } = useProjectNav();

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
        // Dropping a card on "On hold" asks why first.
        if (k === 'On hold') { openModal('pstatus', { pid: id, status: 'On hold' }); return; }
        updProj(id, { status: k });
        flash(`${p.name} → ${k}`);
      }
    },
    [PRJ, updProj, flash, openModal],
  );

  const tableCols = useMemo(() => topAligned(tableColumns(periodLabel, openMember)), [periodLabel, openMember]);

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
          minWidth={1500}
        />
      )}
    </div>
  );
}
