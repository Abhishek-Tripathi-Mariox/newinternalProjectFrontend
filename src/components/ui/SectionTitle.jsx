import { cx } from './cx';
import s from './SectionTitle.module.css';

/** h3 section heading with a muted summary and/or an action on the right. */
export function SectionTitle({ title, sub, action, as: Tag = 'h3', className, style }) {
  return (
    <div className={cx(s.row, className)} style={style}>
      <Tag className={s.title}>{title}</Tag>
      {(sub || action) && (
        <div className={s.right}>
          {sub && <span className={s.sub}>{sub}</span>}
          {action}
        </div>
      )}
    </div>
  );
}
