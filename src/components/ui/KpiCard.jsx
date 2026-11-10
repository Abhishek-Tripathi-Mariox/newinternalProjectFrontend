import { cx } from './cx';
import s from './KpiCard.module.css';

/** KPI tile. Renders as a button when `onClick` is given. */
export function KpiCard({ label, value, sub, subColor, dot, color, onClick, title, active, className, style }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      aria-pressed={onClick && active != null ? !!active : undefined}
      className={cx(s.card, className)}
      style={active ? { borderColor: 'var(--primary-ring)', ...style } : style}
    >
      <span className={s.label}>
        {dot && <span className={s.dot} style={{ background: dot }} aria-hidden="true" />}
        {label}
      </span>
      <span className={s.value} style={color ? { color } : undefined}>{value}</span>
      {sub != null && sub !== '' && <span className={s.sub} style={subColor ? { color: subColor } : undefined}>{sub}</span>}
    </Tag>
  );
}

/** Responsive auto-fit grid for KPI cards. */
export function KpiGrid({ children, min = 180, gap, className, style }) {
  return (
    <div className={cx(s.grid, className)} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap, ...style }}>
      {children}
    </div>
  );
}
