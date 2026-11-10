import { DataTable, FilterChips, Pill } from '@/components/ui';
import PersonCell from '@/features/attendance/shared/PersonCell';
import PersonControls from './PersonControls';
import s from './TeamTable.module.css';

/** The table sits inside this section's card, so drop its own frame. */
const FLAT = { border: 0, borderRadius: 0 };

const COLUMNS = [
  { key: 'person', label: 'Person', render: (p) => <PersonCell name={p.name} h={p.h} sub={p.role} dot={p.dot} size={30} /> },
  { key: 'status', label: 'Status', render: (p) => <Pill bg={p.sBg} fg={p.sFg}>{p.status}</Pill> },
  {
    key: 'doing',
    label: 'Working on',
    render: (p) => (
      <div className={s.doing}>
        <div className={s.doingTitle}>{p.doing}</div>
        <div className={s.doingSub}>{p.doingSub}</div>
      </div>
    ),
  },
  {
    key: 'today',
    label: 'Today',
    render: (p) => (
      <div className={s.today}>
        <div className={s.todayHead}><span className={s.todayH}>{p.today}</span><span className={s.muted}>{p.shift}</span></div>
        <div className={s.track}><div className={s.fill} style={{ width: p.barW, background: p.barBg }} /></div>
      </div>
    ),
  },
  { key: 'in', label: 'Checked in', render: (p) => <span className={s.inLabel} style={{ color: p.inColor }}>{p.inLabel}</span> },
  { key: 'controls', label: 'Controls', align: 'right', render: (p) => <PersonControls row={p} /> },
];

/** "Team right now" — status per person with live controls. */
export default function TeamTable({ rows, chips, activeChip, onChip, className }) {
  return (
    <section className={`${s.panel} ${className || ''}`}>
      <div className={s.head}>
        <h2 className={s.title}>Team right now</h2>
        <FilterChips items={chips} value={activeChip} onChange={onChip} tone="dark" />
      </div>
      <DataTable itemLabel="people" pageSize={25}
        className={s.table}
        style={FLAT}
        minWidth={940}
        columns={COLUMNS}
        rows={rows}
        empty="Nobody in this group right now."
      />
      <div className={s.foot}>
        Team members use the same check-in, break and timer controls from their own login. Stopping a timer adds the time to their timesheet automatically.
      </div>
    </section>
  );
}
