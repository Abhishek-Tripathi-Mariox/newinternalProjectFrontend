import { EmptyState, Pagination, usePagination } from '@/components/ui';
import FollowUpRow, { FollowUpListHeader } from './FollowUpRow';
import s from './FollowUpList.module.css';

/** List view: header + `full` rows, horizontally scrollable on narrow screens. */
export default function FollowUpList({ rows, now }) {
  const pager = usePagination(rows);
  return (
    <div className={s.card}>
      <div className={s.inner} role="table">
        <FollowUpListHeader />
        {pager.pageItems.map((f) => <FollowUpRow key={f.id} fu={f} now={now} />)}
      </div>
      {rows.length === 0 && <EmptyState title="No follow-ups here." />}
      <Pagination {...pager} label="follow-ups" />
    </div>
  );
}
