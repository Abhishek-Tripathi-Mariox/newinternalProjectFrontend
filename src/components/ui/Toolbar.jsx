import { cx } from './cx';
import s from './EmptyState.module.css';

/** White filter-bar card: wraps search / selects / chips in a flexible row. */
export function Toolbar({ children, className, style, label = 'Filters' }) {
  return (
    <div className={cx(s.toolbar, className)} style={style} role="search" aria-label={label}>
      {children}
    </div>
  );
}
