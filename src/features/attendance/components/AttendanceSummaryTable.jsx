import { DataTable } from '@/components/ui';
import PersonCell from '../shared/PersonCell';
import s from './AttendanceSummaryTable.module.css';

const COLUMNS = [
  { key: 'name', label: 'Person', render: (r) => <PersonCell name={r.name} h={r.person.h} sub={r.role} /> },
  { key: 'present', label: 'Days present', align: 'right', render: (r) => r.present },
  { key: 'absent', label: 'Absent', align: 'right', render: (r) => <b className={s.b6} style={{ color: r.absColor }}>{r.absent}</b> },
  { key: 'late', label: 'Late', align: 'right', render: (r) => <b className={s.b6} style={{ color: r.lateColor }}>{r.late}</b> },
  { key: 'avgIn', label: 'Avg login', render: (r) => r.avgIn },
  { key: 'avgOut', label: 'Avg logout', render: (r) => r.avgOut },
  { key: 'brk', label: 'Break time', align: 'right', render: (r) => r.brk },
  { key: 'avg', label: 'Avg per day', align: 'right', render: (r) => r.avg },
  { key: 'total', label: 'Total worked', align: 'right', render: (r) => <b className={s.b7}>{r.total}</b> },
];

/** Period summary: one row per person; click drills into that person. */
export default function AttendanceSummaryTable({ rows, empty, onOpen }) {
  return (
    <DataTable itemLabel="people"
      minWidth={980}
      columns={COLUMNS}
      rows={rows}
      onRowClick={onOpen}
      empty={empty ? 'Nobody matches these filters.' : null}
    />
  );
}
