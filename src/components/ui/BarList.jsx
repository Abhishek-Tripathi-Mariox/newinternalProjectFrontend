import { ProgressBar } from './ProgressBar';
import { cx } from './cx';
import s from './ProgressBar.module.css';

/**
 * Label · bar · value rows (e.g. "Leads by status").
 * items: [{key?, label, value, w (0..1 or '%'), color, dot?, onClick?, title?}]
 */
export function BarList({ items = [], labelWidth, className, style, empty }) {
  if (!items.length && empty) return <div style={{ fontSize: 13, color: 'var(--muted)', padding: '8px 4px' }}>{empty}</div>;
  return (
    <div className={cx(s.list, className)} style={style}>
      {items.map((it, i) => {
        const Tag = it.onClick ? 'button' : 'div';
        return (
          <Tag
            key={it.key ?? `${it.label}-${i}`}
            type={it.onClick ? 'button' : undefined}
            onClick={it.onClick}
            title={it.title}
            className={s.row}
            style={labelWidth ? { gridTemplateColumns: `${labelWidth}px minmax(0,1fr) auto` } : undefined}
          >
            <span className={s.label}>
              {it.dot && <span className={s.dot} style={{ background: it.dot }} aria-hidden="true" />}
              {it.label}
            </span>
            <ProgressBar
              value={typeof it.w === 'number' ? it.w : undefined}
              width={typeof it.w === 'string' ? it.w : undefined}
              color={it.color || it.dot}
              height={8}
            />
            <span className={s.value}>{it.value}</span>
          </Tag>
        );
      })}
    </div>
  );
}
