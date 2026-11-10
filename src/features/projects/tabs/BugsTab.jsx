import { useMemo } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { Button, DataTable, FilterChips, KanbanBoard, KpiCard, KpiGrid, SegmentedControl, Select } from '@/components/ui';
import { projectColor, GREEN, INK, MUTED, RED } from '@/lib/color';
import { DAY } from '@/lib/date';
import { BUG_ENVS, BUG_SEVERITY, BUG_STATUS, TEAMS } from '@/config/constants';
import BugCard, { BugStatusSelect, SeverityTag } from '../components/BugCard';
import { MiniAvatar } from '../components/TaskCard';
import {
  BUG_STATUS_KEYS, attachmentLabel, bugAge, bugClosedAt, bugDue, bugFilters, bugReported, bugReporter, bugSort, memberAvatar, msShort, statusDot,
} from '../workItems';
import s from './WorkTabs.module.css';

const NEUTRAL = 'oklch(0.7 0.01 265)';
const OPEN_DOT = 'oklch(0.62 0.15 250)';
const CRIT_DOT = 'oklch(0.62 0.17 25)';
const REOPEN_DOT = 'oklch(0.62 0.15 300)';
const VIEWS = [['board', 'Board'], ['list', 'List']];

/** Bugs tab: KPIs, dept/severity/platform/reporter filters, period toggle, quick chips, board or list. */
export default function BugsTab() {
  const pj = useStore((st) => st.pj);
  const setPj = useStore((st) => st.setPj);
  const openModal = useStore((st) => st.openModal);
  const updBug = useStore((st) => st.updBug);
  const flash = useStore((st) => st.flash);
  const scoped = useScoped();
  const { T, MEM, PRJ, MSS, q, inR, periodLabel } = useProjectsModel();
  const f = pj.f;
  const bf = useMemo(() => pj.bf || {}, [pj.bf]);
  const bQ = pj.bQ ?? 'open';
  const allTime = pj.bAllTime !== false;
  const view = pj.bView === 'list' ? 'list' : 'board';
  const setBf = (k) => (e) => setPj({ bf: { ...(useStore.getState().pj.bf || {}), [k]: e.target.value } });

  const m = useMemo(() => {
    const pTs = new Set(scoped.projects.filter((p) => (!f.project || p.id === f.project) && (!f.status || p.status === f.status)).map((p) => p.id));
    const all = (scoped.bugs || []).filter((b) => pTs.has(b.p) && (!f.member || b.a === f.member) && (!f.team || b.dept === f.team) &&
      (!bf.dept || b.dept === bf.dept) && (!bf.sev || b.sev === bf.sev) && (!bf.env || b.env === bf.env) && (!bf.rep || b.rep === bf.rep) &&
      (!q || `${b.id} ${b.title} ${(PRJ[b.p] || {}).name || ''} ${(MEM[b.a] || {}).name || ''}`.toLowerCase().includes(q)));
    const set = allTime ? all : all.filter((b) => inR(b.repDate));
    const F = bugFilters(T);
    const n = (k) => set.filter(F[k]).length;
    const closed = set.filter(F.closed);
    const avgFix = closed.length
      ? Math.round(closed.reduce((x, b) => x + Math.max(0, bugClosedAt(b, T) - b.repDate), 0) / closed.length / DAY * 10) / 10
      : 0;
    const go = (k) => () => setPj({ bQ: k });
    return {
      set,
      shown: set.filter(F[bQ] || F.open).sort(bugSort),
      kpis: [
        { label: 'Open bugs', value: n('open'), sub: `${set.length} reported in total`, dot: OPEN_DOT, color: INK, onClick: go('open') },
        { label: 'Critical open', value: n('critical'), sub: 'Fix within 1 day', dot: CRIT_DOT, color: n('critical') ? RED : INK, onClick: go('critical') },
        { label: 'Overdue', value: n('overdue'), sub: 'Past due date', dot: RED, color: n('overdue') ? RED : INK, onClick: go('overdue') },
        { label: 'Reopened', value: n('reopened'), sub: 'Failed retest', dot: REOPEN_DOT, color: INK, onClick: go('reopened') },
        { label: 'Closed', value: closed.length, sub: closed.length ? `Avg ${avgFix} days to close` : '—', dot: GREEN, color: INK, onClick: go('closed') },
      ],
      chips: [
        { key: 'open', label: 'Open', count: n('open'), dot: OPEN_DOT },
        { key: '', label: 'All', count: set.length, dot: NEUTRAL },
        { key: 'critical', label: 'Critical', count: n('critical'), dot: CRIT_DOT },
        { key: 'overdue', label: 'Overdue', count: n('overdue'), dot: RED },
        { key: 'reopened', label: 'Reopened', count: n('reopened'), dot: REOPEN_DOT },
        { key: 'unassigned', label: 'Unassigned', count: n('unassigned'), dot: NEUTRAL },
        { key: 'closed', label: 'Closed', count: closed.length, dot: GREEN },
      ],
    };
  }, [scoped.projects, scoped.bugs, f.project, f.status, f.member, f.team, bf, q, PRJ, MEM, allTime, inR, T, bQ, setPj]);

  // The board shows the bugs matching the selected chip. Status columns stay visible as drop
  // targets (drag to Fixed / Closed), except when the chip is itself a status.
  const columns = useMemo(() => {
    const only = { closed: 'Closed', reopened: 'Reopened' }[bQ];
    return BUG_STATUS_KEYS.filter((k) => !only || k === only).map((k) => {
      const items = m.shown.filter((b) => b.st === k);
      return { key: k, name: k, dot: statusDot(BUG_STATUS[k]), count: items.length, items };
    });
  }, [m.shown, bQ]);

  const onMove = (id, k) => {
    const b = (scoped.bugs || []).find((x) => x.id === id);
    if (b && b.st !== k) {
      updBug(id, { st: k }, `Status → ${k}`);
      flash(`${id} → ${k}`);
    }
  };

  const listColumns = [
    {
      key: 'bug', label: 'Bug', render: (b) => {
        const n = (b.atts || []).length;
        return (
          <div style={{ maxWidth: 340 }}>
            <div className={s.inline} style={{ whiteSpace: 'normal' }}>
              <span className={s.mono}>{b.id}</span>
              <span className={s.b600} style={{ textDecoration: b.st === 'Closed' ? 'line-through' : 'none', color: b.st === 'Closed' ? MUTED : INK }}>{b.title}</span>
            </div>
            <div className={s.small}>
              {b.env} · {b.prio} priority{n > 0 && <> · <span className={s.attLink}>{attachmentLabel(n)}</span></>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'p', label: 'Project', render: (b) => (
        <>
          <div className={`${s.inline} ${s.b500}`}><span className={s.sq} style={{ background: projectColor(PRJ[b.p]) }} />{PRJ[b.p] ? PRJ[b.p].name : '—'}</div>
          <div className={s.indent}>{msShort(MSS[b.ms])}</div>
        </>
      ),
    },
    { key: 'dept', label: 'Department', render: (b) => <span className={s.nowrap}>{b.dept}</span> },
    { key: 'sev', label: 'Severity', render: (b) => <SeverityTag sev={b.sev} /> },
    { key: 'st', label: 'Status', render: (b) => <BugStatusSelect bug={b} /> },
    {
      key: 'a', label: 'Assigned to', render: (b) => {
        const av = memberAvatar(b.a ? MEM[b.a] : null);
        return <div className={s.inline}><MiniAvatar av={av} />{av.name}</div>;
      },
    },
    {
      key: 'rep', label: 'Reported', render: (b) => (
        <div className={s.nowrap}><div className={s.b500}>{bugReported(b)}</div><div className={s.small}>by {bugReporter(b, MEM)}</div></div>
      ),
    },
    {
      key: 'due', label: 'Due', render: (b) => {
        const d = bugDue(b, T);
        return <span className={`${s.nowrap} ${s.b500}`} style={{ color: d.color }}>{d.label}</span>;
      },
    },
    { key: 'age', label: 'Age', render: (b) => <span className={`${s.nowrap} ${s.muted}`}>{bugAge(b, T)}</span> },
  ];

  return (
    <div className={s.stack}>
      <KpiGrid min={140}>
        {m.kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </KpiGrid>

      <div className={s.bar}>
        <div className={s.group}>
          <Select compact aria-label="Department" value={bf.dept || ''} onChange={setBf('dept')} options={[{ value: '', label: 'All departments' }, ...TEAMS]} />
          <Select compact aria-label="Severity" value={bf.sev || ''} onChange={setBf('sev')} options={[{ value: '', label: 'All severities' }, ...Object.keys(BUG_SEVERITY)]} />
          <Select compact aria-label="Platform" value={bf.env || ''} onChange={setBf('env')} options={[{ value: '', label: 'All platforms' }, ...BUG_ENVS]} />
          <Select
            compact
            aria-label="Reported by"
            value={bf.rep || ''}
            onChange={setBf('rep')}
            options={[{ value: '', label: 'Reported by anyone' }, { value: 'client', label: 'Reported by client' }, ...scoped.members.map((x) => ({ value: x.id, label: x.name }))]}
          />
          <SegmentedControl
            options={[['all', 'All time'], ['period', periodLabel]]}
            value={allTime ? 'all' : 'period'}
            onChange={(v) => setPj({ bAllTime: v === 'all' })}
          />
        </div>
        <div className={s.group}>
          <SegmentedControl options={VIEWS} value={view} onChange={(v) => setPj({ bView: v })} />
          <Button variant="danger" onClick={() => openModal('bug', { p: f.project || undefined })}>+ Report bug</Button>
        </div>
      </div>

      <FilterChips items={m.chips} value={bQ} onChange={(v) => setPj({ bQ: v })} tone="dark" />

      {view === 'list' ? (
        <DataTable itemLabel="bugs"
          columns={listColumns}
          rows={m.shown}
          rowKey={(b) => b.id}
          onRowClick={(b) => openModal('bug', { editId: b.id })}
          minWidth={1240}
          empty="No bugs match these filters."
        />
      ) : (
        <KanbanBoard
          columns={columns}
          getId={(b) => b.id}
          renderCard={(b) => <BugCard bug={b} />}
          onMove={onMove}
          minColWidth={260}
          emptyText="Drop bugs here"
        />
      )}
    </div>
  );
}

