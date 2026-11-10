import { cx } from './cx';
import s from './EmptyState.module.css';

/**
 * Empty / no-results message. With only `title` it's the muted one-liner used under tables
 * ("No leads match these filters."). Adding `sub` makes the title bold (page-level empty).
 * variant: 'plain' (default) | 'boxed' (white card) | 'dashed' (kanban drop hint).
 */
export function EmptyState({ title, sub, action, variant = 'plain', className, style }) {
  return (
    <div className={cx(s.empty, variant !== 'plain' && s[variant], className)} style={style}>
      {title && <div className={sub ? s.strong : s.title}>{title}</div>}
      {sub && <div className={s.sub}>{sub}</div>}
      {action}
    </div>
  );
}
