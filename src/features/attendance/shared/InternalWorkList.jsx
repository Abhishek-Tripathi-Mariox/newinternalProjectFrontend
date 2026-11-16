import { hh } from '@/lib/format';
import { sumH } from './internalWork';
import s from './InternalWorkList.module.css';

/**
 * Internal work entries (category · hours · what was done). `showDate` adds the day on each
 * line (multi-day lists); `title` false hides the heading.
 */
export default function InternalWorkList({ items, title = 'Internal work', showDate = false, compact = false }) {
  if (!items || !items.length) return null;
  return (
    <div className={compact ? s.wrapCompact : s.wrap}>
      {title && (
        <div className={s.head}>
          <span className={s.title}>{title}</span>
          <span className={s.total}>{hh(sumH(items))}</span>
        </div>
      )}
      {items.map((e) => (
        <div key={e.id} className={s.line}>
          {showDate && <span className={s.date}>{new Date(e.d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
          <span className={s.cat}>{e.cat}</span>
          <span className={s.h}>{hh(e.h)}</span>
          <span className={s.note}>{e.note || '—'}</span>
        </div>
      ))}
    </div>
  );
}
