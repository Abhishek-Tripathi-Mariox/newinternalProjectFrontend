import { cx } from './cx';
import s from './Stat.module.css';

/** Compact grey stat tile (label / value / optional sub). */
export function Stat({ label, value, sub, color, className, style }) {
  return (
    <div className={cx(s.stat, className)} style={style}>
      <div className={s.label}>{label}</div>
      <div className={s.value} style={color ? { color } : undefined}>{value}</div>
      {sub && <div className={s.sub}>{sub}</div>}
    </div>
  );
}

/** Grid of Stat tiles. items: [{label, value, sub?, color?}]. `cols` fixes the column count. */
export function StatGrid({ items = [], cols, min = 110, className, style }) {
  const tpl = cols ? `repeat(${cols}, minmax(0, 1fr))` : `repeat(auto-fit, minmax(${min}px, 1fr))`;
  return (
    <div className={cx(s.grid, className)} style={{ gridTemplateColumns: tpl, ...style }}>
      {items.map((it) => (
        <Stat key={it.label} {...it} />
      ))}
    </div>
  );
}
