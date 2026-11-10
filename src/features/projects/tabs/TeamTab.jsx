import { useMemo } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { Avatar, DataTable, ProgressBar } from '@/components/ui';
import { AMBER, GREEN, INK, MUTED, RED, barColor } from '@/lib/color';
import { workdaysSoFar } from '@/lib/date';
import { hh, pctW } from '@/lib/format';
import { ACTIVE_STATUSES } from '../lib/view';
import s from './WorkTabs.module.css';

const OVER = 'oklch(0.55 0.15 300)';

/** Person cell (avatar + name + role · team) shared by the team-style tables. */
export function PersonCell({ m }) {
  return (
    <div className={s.person}>
      <Avatar name={m.name} h={m.h} size={30} />
      <div>
        <div className={s.personName}>{m.name}</div>
        <div className={s.personSub}>{m.role} · {m.team}</div>
      </div>
    </div>
  );
}

/** Label + value above a thin bar. */
export function Meter({ left, right, width, color, minWidth = 130 }) {
  return (
    <div className={s.meter} style={{ minWidth }}>
      <div className={s.meterHead}>{left}{right}</div>
      <ProgressBar width={width} color={color} />
    </div>
  );
}

/** Team & hours tab: one row per member with today / yesterday / week / month / period hours and allocation use. */
export default function TeamTab() {
  const setPj = useStore((st) => st.setPj);
  const scoped = useScoped();
  const { memF, mAgg, g, wk, pSet, projScoped, periodLabel } = useProjectsModel();

  const rows = useMemo(() => {
    const wdW = workdaysSoFar(wk[0], wk[1]);
    return memF.map((m) => {
      const H = mAgg(m);
      const sh = m.shift || 8;
      const active = scoped.projects.some((p) => p.status === 'Running' && p.team.includes(m.id));
      const ap = scoped.projects.filter((p) => ACTIVE_STATUSES.includes(p.status) && p.team.includes(m.id) && (!projScoped || pSet.has(p.id)));
      const al = ap.reduce((x, p) => x + (+p.alloc[m.id] || 0), 0);
      const tk = ap.reduce((x, p) => x + g(`pm:${p.id}:${m.id}`).all, 0);
      const u = al ? tk / al : 0;
      const miss = active && H.today === 0 && !projScoped;
      return {
        m, H, sh, al, tk, u, miss, projects: ap.length,
        weekExp: `of ${hh(sh * wdW)}`,
        todayBg: H.today > sh ? OVER : H.today >= sh ? GREEN : AMBER,
      };
    });
  }, [memF, mAgg, g, wk, pSet, projScoped, scoped.projects]);

  const columns = [
    { key: 'm', label: 'Member', render: (r) => <PersonCell m={r.m} /> },
    {
      key: 'today', label: 'Today', render: (r) => (
        <Meter
          left={<span className={s.b600} style={{ color: r.miss ? RED : INK }}>{r.miss ? 'Not submitted' : hh(r.H.today)}</span>}
          right={<span className={s.muted}>/ {r.sh}h</span>}
          width={pctW(r.H.today / r.sh)}
          color={r.todayBg}
        />
      ),
    },
    { key: 'yest', label: 'Yesterday', align: 'right', render: (r) => hh(r.H.yest) },
    {
      key: 'week', label: 'This week', align: 'right', render: (r) => (
        <><div className={s.b600}>{hh(r.H.week)}</div><div className={s.muted} style={{ fontSize: 11.5 }}>{r.weekExp}</div></>
      ),
    },
    { key: 'month', label: 'This month', align: 'right', render: (r) => hh(r.H.month) },
    { key: 'range', label: periodLabel, align: 'right', render: (r) => hh(r.H.range) },
    {
      key: 'alloc', label: 'Allocated vs taken', render: (r) => (
        <Meter
          minWidth={200}
          left={<span><span className={s.b600}>{hh(r.tk)}</span> <span className={s.muted}>of {hh(r.al)}</span></span>}
          right={<span style={{ color: r.u > 1 ? RED : MUTED }}>{r.al ? `${Math.round(r.u * 100)}%` : '—'}</span>}
          width={pctW(r.u)}
          color={barColor(r.u)}
        />
      ),
    },
    { key: 'projects', label: 'Projects', align: 'right', render: (r) => r.projects },
  ];

  return (
    <DataTable itemLabel="members"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.m.id}
      onRowClick={(r) => setPj({ selM: r.m.id, selP: null, mDay: null, exp: null, exp2: null })}
      empty="No team members match these filters."
      minWidth={1120}
    />
  );
}
