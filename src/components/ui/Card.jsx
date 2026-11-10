import { cx } from './cx';
import s from './Card.module.css';

/** White bordered panel (radius 12) with an optional title row. */
export function Card({ title, sub, action, padding, className, style, children, as: Tag = 'section', ...rest }) {
  return (
    <Tag className={cx(s.card, className)} style={padding != null ? { padding, ...style } : style} {...rest}>
      {(title || action) && (
        <div className={s.head}>
          <div className={s.titles}>
            {title && <h2 className={s.title}>{title}</h2>}
            {sub && <div className={s.sub}>{sub}</div>}
          </div>
          {action && <div className={s.action}>{action}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}
