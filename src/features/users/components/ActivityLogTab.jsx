import { HuePill, Pagination, usePagination } from '@/components/ui';
import { dLabel, tLabel } from '@/lib/date';
import { LOG_KIND_HUE } from '../users.utils';
import s from './ActivityLogTab.module.css';

/** Audit trail of user / role / access changes, newest first, paginated. */
export default function ActivityLogTab({ audit }) {
  const pager = usePagination(audit);
  return (
    <div className={s.card}>
      {pager.pageItems.map((e, i) => (
        <div key={`${e.d}-${pager.start + i}`} className={s.row}>
          <span className={s.when}>
            {dLabel(e.d)} {tLabel(e.d)}
          </span>
          <span>
            <span className={s.actor}>{e.actor}</span> {e.text}
          </span>
          <HuePill hue={LOG_KIND_HUE[e.kind] ?? 265}>{e.kind}</HuePill>
        </div>
      ))}
      {!audit.length && <div className={s.empty}>No activity yet.</div>}
      <Pagination {...pager} label="entries" />
    </div>
  );
}
