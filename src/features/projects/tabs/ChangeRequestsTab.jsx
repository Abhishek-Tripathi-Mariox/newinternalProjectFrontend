import { useMemo } from 'react';
import { Button, DataTable, FilterChips, KpiCard } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useIsPM } from '@/hooks/useIsPM';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { hh, money } from '@/lib/format';
import { CR_STATUS } from '@/config/constants';
import { Meter, ProjectName } from '../components/bits';
import { useCrContext } from '../hooks/useCrContext';
import { useProjectNav } from '../hooks/useProjectNav';
import { crView } from '../lib/cr';
import { CR_LIVE } from '../lib/view';
import s from './tabs.module.css';

const CHIPS = [
  ['', 'All'],
  ['Draft', 'Draft'],
  ['Sent to client', 'Waiting for client'],
  ['Approved', 'Approved'],
  ['In progress', 'In progress'],
  ['Done', 'Done'],
  ['Rejected', 'Rejected'],
];

const columns = [
  {
    key: 'title',
    label: 'Change request',
    render: (r) => (
      <div className={s.crTitle}>
        <div className={s.cellTitle}>{r.title}</div>
        <div className={s.cellSub}>
          <span className={s.mono}>{r.id}</span> · raised {r.raised}
          {r.docs && ` · ${r.docs}`}
        </div>
      </div>
    ),
  },
  { key: 'project', label: 'Project', render: (r) => <ProjectName color={r.color} name={r.project} className={s.nowrap} /> },
  { key: 'by', label: 'Requested by', render: (r) => <span className={s.crBy}>{r.by}</span> },
  {
    key: 'status',
    label: 'Status',
    render: (r) => (
      <span className={s.badge} style={{ background: r.sBg, color: r.sFg }}>
        {r.status}
      </span>
    ),
  },
  { key: 'hours', label: 'Hours', align: 'right', render: (r) => <b>{r.hours}</b> },
  { key: 'amount', label: 'Value', align: 'right', render: (r) => <b className={s.nowrap}>{r.amount}</b> },
  { key: 'days', label: 'Timeline', align: 'right', render: (r) => r.days },
  {
    key: 'progress',
    label: 'Progress',
    render: (r) => (
      <div className={s.wide170}>
        {r.hasUsed && <Meter left={r.used} width={r.barW} color={r.barBg} />}
        {r.track && <span className={s.cellSub}>{r.track}</span>}
        {r.over && <div className={s.overL}>{r.overL}</div>}
      </div>
    ),
  },
  {
    key: 'profit',
    label: 'Profit',
    render: (r) => (
      <div className={s.profit} style={{ color: r.profitColor }}>
        {r.moneyL}
        {r.sigL && <div className={s.sigL}>✓ {r.sigL}</div>}
      </div>
    ),
  },
];

/** Projects → Change requests: KPIs, status chips and the CR table. */
export default function ChangeRequestsTab() {
  const { pSet } = useProjectsModel();
  const { crs, projects } = useScoped();
  const crSt = useStore((st) => st.pj.crSt) || '';
  const fProject = useStore((st) => st.pj.f.project);
  const setPj = useStore((st) => st.setPj);
  const isPM = useIsPM();
  const ctx = useCrContext();
  const { openCr } = useProjectNav();

  const crAll = useMemo(() => (crs || []).filter((c) => pSet.has(c.p)).sort((a, b) => b.raised - a.raised), [crs, pSet]);

  const kpis = useMemo(() => {
    const apr = crAll.filter((c) => CR_LIVE.includes(c.status));
    return [
      ['Waiting for client', crAll.filter((c) => c.status === 'Sent to client').length, 'Sent, not answered yet'],
      ['Approved hours', hh(apr.reduce((x, c) => x + c.hours, 0)), `${apr.length} approved CR${apr.length === 1 ? '' : 's'}`],
      ['Added contract value', money(apr.reduce((x, c) => x + (c.amount || 0), 0)), 'From approved CRs'],
      ['Rejected', crAll.filter((c) => c.status === 'Rejected').length, 'Declined by the client'],
    ];
  }, [crAll]);

  const chips = useMemo(
    () =>
      CHIPS.map(([key, label]) => ({
        key,
        label,
        count: key ? crAll.filter((c) => c.status === key).length : crAll.length,
        dot: `oklch(0.62 0.14 ${CR_STATUS[key] ?? 265})`,
      })),
    [crAll],
  );

  const rows = useMemo(() => crAll.filter((c) => !crSt || c.status === crSt).map((c) => crView(c, ctx)), [crAll, crSt, ctx]);
  const canAdd = projects.some((p) => isPM(p));

  return (
    <div className={s.stack}>
      <div className={s.grid170}>
        {kpis.map(([label, value, sub]) => (
          <KpiCard key={label} label={label} value={value} sub={sub} />
        ))}
      </div>
      <div className={s.bar}>
        <FilterChips items={chips} value={crSt} onChange={(k) => setPj({ crSt: k })} tone="dark" />
        {canAdd && <Button variant="primary" onClick={() => openCr(fProject || '')}>+ New change request</Button>}
      </div>
      <DataTable itemLabel="change requests" columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => openCr(r.c.p, r.id)} empty="No change requests here." minWidth={1060} />
    </div>
  );
}
