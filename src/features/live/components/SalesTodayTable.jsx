import { DataTable, Pill } from '@/components/ui';
import PersonCell from '@/features/attendance/shared/PersonCell';
import s from './SalesTodayTable.module.css';

const COLUMNS = [
  { key: 'name', label: 'Salesperson', render: (r) => <PersonCell name={r.name} h={r.h} /> },
  { key: 'status', label: 'Status', render: (r) => <Pill bg={r.sBg} fg={r.sFg}>{r.status}</Pill> },
  { key: 'touched', label: 'Leads touched', align: 'right', render: (r) => <b className={s.strong}>{r.touched}</b> },
  { key: 'calls', label: 'Calls', align: 'right', render: (r) => r.calls },
  { key: 'quotes', label: 'Quotes sent', align: 'right', render: (r) => r.quotes },
  { key: 'fu', label: 'Follow-ups done', align: 'right', render: (r) => r.fu },
  { key: 'od', label: 'Overdue', align: 'right', render: (r) => <b className={s.strong} style={{ color: r.odColor }}>{r.od}</b> },
];

/** "Sales today" — per salesperson activity; click opens their leads. */
export default function SalesTodayTable({ rows, onOpen }) {
  return (
    <section className={s.panel}>
      <div className={s.head}><h2 className={s.title}>Sales today</h2></div>
      <DataTable itemLabel="people" style={{ border: 0, borderRadius: 0 }} minWidth={760} columns={COLUMNS} rows={rows} onRowClick={(r) => onOpen(r.id)} />
    </section>
  );
}
