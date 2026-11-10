import { useCallback, useMemo } from 'react';
import { AvatarStack, DataTable, FilterChips, Pill, SegmentedControl } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { avatarOf } from '@/domain/projects';
import { AMBER, GREEN, INK, MUTED, RED, barColor, projectColor, tone } from '@/lib/color';
import { DAY, fd, fday } from '@/lib/date';
import { hh, pctW } from '@/lib/format';
import { MILESTONE_STATUS } from '@/config/constants';
import { Dot, Meter, MilestoneNumber, ProjectName, UsedOf } from '../components/bits';
import { useProjectNav } from '../hooks/useProjectNav';
import { NEUTRAL_DOT, msOverdue } from '../lib/view';
import s from './tabs.module.css';

const VIEWS = [['stage', 'By stage'], ['list', 'All milestones']];
const MS_KEYS = Object.keys(MILESTONE_STATUS);
const msTone = (k) => tone(MILESTONE_STATUS[k] ?? 265);

function StageColumn({ col, onOpen }) {
  return (
    <div className={s.stage}>
      <div className={s.stageHead}>
        <div className={s.stageTitleRow}>
          <span className={s.stageTitle}>
            <span className={s.stageNum} style={{ background: col.nBg }}>
              {col.n}
            </span>
            {col.title}
          </span>
          <span className={s.stageCount}>{col.count}</span>
        </div>
        <span className={s.stageSub}>{col.sub}</span>
      </div>
      {col.cards.map((r) => (
        <button type="button" key={r.id} className={s.stageCard} onClick={() => onOpen(r.id, r.exp)}>
          <div className={s.minw}>
            <div className={s.stageCardName}>
              <Dot color={r.color} />
              {r.name}
            </div>
            <div className={s.stageCardClient}>{r.client}</div>
          </div>
          <div className={s.spread}>
            <Pill bg={r.t.bg} fg={r.t.fg} dot={r.t.dot} size="sm">
              {r.msStatus}
            </Pill>
            <span className={s.small} style={{ color: r.dueColor }}>
              {r.dueSub}
            </span>
          </div>
          <Meter left={<UsedOf used={r.used} of={`/ ${r.alloc}`} />} right={<span className={s.muted}>{r.pStatus}</span>} width={r.barW} color={r.barBg} />
        </button>
      ))}
      {!col.cards.length && <div className={s.stageEmpty}>No projects at this stage.</div>}
    </div>
  );
}

const listColumns = [
  {
    key: 'name',
    label: 'Milestone',
    render: (r) => (
      <span className={s.msName}>
        <MilestoneNumber milestone={r.m} current={r.current} />
        <span className={s.nowrapStrong}>{r.m.name}</span>
      </span>
    ),
  },
  { key: 'project', label: 'Project', render: (r) => <ProjectName color={r.color} name={r.p.name} className={s.nowrap} /> },
  {
    key: 'status',
    label: 'Status',
    render: (r) => (
      <Pill bg={r.t.bg} fg={r.t.fg} dot={r.t.dot}>
        {r.m.status}
      </Pill>
    ),
  },
  { key: 'alloc', label: 'Allocated', align: 'right', render: (r) => hh(r.m.alloc) },
  { key: 'used', label: 'Logged', align: 'right', render: (r) => <b>{hh(r.used)}</b> },
  {
    key: 'progress',
    label: 'Progress',
    render: (r) => (
      <Meter
        className={s.wide170}
        left={<span className={s.muted}>{r.pctLabel}</span>}
        right={<span style={{ color: r.remColor }}>{r.rem}</span>}
        width={r.barW}
        color={r.barBg}
      />
    ),
  },
  {
    key: 'due',
    label: 'Due',
    render: (r) => (
      <div className={s.nowrap}>
        <div className={s.dueLabel} style={{ color: r.dueColor }}>
          {fd(r.m.due)}
        </div>
        <div className={s.cellSub}>{r.dueSub}</div>
      </div>
    ),
  },
  { key: 'people', label: 'Worked by', render: (r) => <AvatarStack people={r.people} max={5} /> },
];

/** Projects → Milestones: which stage each project is on, or every milestone with status chips. */
export default function MilestonesTab() {
  const model = useProjectsModel();
  const { milestones, members } = useScoped();
  const msView = useStore((st) => st.pj.msView) || 'stage';
  const msSt = useStore((st) => st.pj.msSt) || '';
  const setPj = useStore((st) => st.setPj);
  const { openProject } = useProjectNav();
  const { pF, msOf, msPeople, g, info, T } = model;
  const isList = msView === 'list';

  const avatar = useCallback((id) => avatarOf(members, id), [members]);
  const msAll = useMemo(() => pF.flatMap((p) => (msOf[p.id] || []).map((m) => ({ m, p }))), [pF, msOf]);
  const overBudget = useCallback((m) => g(`ms:${m.id}`).all > m.alloc && m.alloc > 0, [g]);

  const stages = useMemo(() => {
    if (isList) return [];
    const stageMap = {};
    pF.filter((p) => p.status !== 'Cancelled').forEach((p) => {
      const I = info(p);
      const k = I.curM ? I.curM.n : 'done';
      (stageMap[k] = stageMap[k] || []).push(I);
    });
    const maxN = Math.max(5, ...milestones.map((m) => m.n));
    const keys = [...Array.from({ length: maxN }, (_, i) => i + 1), 'done'];
    return keys.map((k) => {
      const list = (stageMap[k] || []).sort((a, b) => a.p.due - b.p.due);
      const names = {};
      milestones.filter((m) => m.n === k).forEach((m) => (names[m.name] = (names[m.name] || 0) + 1));
      const done = k === 'done';
      return {
        key: String(k),
        n: done ? '✓' : k,
        title: done ? 'All done' : `Milestone ${k}`,
        sub: done ? 'Every milestone completed' : Object.keys(names).sort((a, b) => names[b] - names[a])[0] || '',
        nBg: done ? GREEN : 'oklch(0.5 0.17 265)',
        count: list.length + (list.length === 1 ? ' project' : ' projects'),
        cards: list.map((I) => {
          const m = I.curM;
          const used = m ? g(`ms:${m.id}`).all : I.used;
          const al = m ? m.alloc : I.budget;
          const pct = al ? used / al : 0;
          const od = m && m.due < T;
          return {
            id: I.p.id,
            exp: m ? `ms:${m.id}` : null,
            name: I.p.name,
            client: I.p.client,
            color: projectColor(I.p),
            msStatus: m ? m.status : 'Delivered',
            t: m ? msTone(m.status) : tone(150),
            used: hh(used),
            alloc: hh(al),
            barW: pctW(pct),
            barBg: barColor(pct),
            pStatus: I.p.status,
            dueSub: m ? (od ? `Overdue ${Math.round((T - m.due) / DAY)}d` : `Due ${fday(m.due)}`) : 'Done',
            dueColor: od ? RED : MUTED,
          };
        }),
      };
    });
  }, [isList, pF, info, milestones, g, T]);

  const chips = useMemo(
    () => [
      { key: '', label: 'All', count: msAll.length, dot: NEUTRAL_DOT },
      ...MS_KEYS.map((k) => ({ key: k, label: k, count: msAll.filter((x) => x.m.status === k).length, dot: msTone(k).dot })),
      { key: 'Overdue', label: 'Overdue', count: msAll.filter((x) => msOverdue(x.m, T)).length, dot: RED },
      { key: 'Over', label: 'Over allocation', count: msAll.filter((x) => overBudget(x.m)).length, dot: AMBER },
    ],
    [msAll, T, overBudget],
  );

  const rows = useMemo(() => {
    if (!isList) return [];
    return msAll
      .filter((x) => !msSt || (msSt === 'Overdue' ? msOverdue(x.m, T) : msSt === 'Over' ? overBudget(x.m) : x.m.status === msSt))
      .map(({ m, p }) => {
        const used = g(`ms:${m.id}`).all;
        const pct = m.alloc ? used / m.alloc : 0;
        const rem = m.alloc - used;
        const od = msOverdue(m, T);
        const I = info(p);
        return {
          id: m.id,
          m,
          p,
          used,
          t: msTone(m.status),
          current: !!I.curM && I.curM.id === m.id,
          color: projectColor(p),
          pctLabel: `${Math.round(pct * 100)}% used`,
          rem: rem >= 0 ? `${hh(rem)} left` : `${hh(-rem)} over`,
          remColor: rem < 0 ? RED : MUTED,
          barW: pctW(pct),
          barBg: m.status === 'Done' && pct <= 1 ? GREEN : barColor(pct),
          dueSub: od ? 'Overdue' : m.status === 'Done' ? 'Done' : `in ${Math.round((m.due - T) / DAY)}d`,
          dueColor: od ? RED : INK,
          people: (msPeople[m.id] || []).slice(0, 5).map(avatar),
        };
      });
  }, [isList, msAll, msSt, T, overBudget, g, info, msPeople, avatar]);

  return (
    <div className={s.stack}>
      <div className={s.bar}>
        <div className={s.note}>{isList ? 'Every milestone across the filtered projects' : 'Which milestone each project is on right now'}</div>
        <SegmentedControl options={VIEWS} value={msView} onChange={(v) => setPj({ msView: v })} />
      </div>

      {!isList ? (
        <div className={s.stages}>
          {stages.map((col) => (
            <StageColumn key={col.key} col={col} onOpen={openProject} />
          ))}
        </div>
      ) : (
        <>
          <FilterChips items={chips} value={msSt} onChange={(k) => setPj({ msSt: k })} tone="dark" />
          <DataTable itemLabel="milestones"
            columns={listColumns}
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => openProject(r.p.id, `ms:${r.m.id}`)}
            empty="No milestones match these filters."
            minWidth={1100}
          />
        </>
      )}
    </div>
  );
}
