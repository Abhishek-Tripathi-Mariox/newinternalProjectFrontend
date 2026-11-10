import { cx } from './cx';
import s from './ProgressBar.module.css';

/** Multi-segment bar. segments: [{w: '30%' | 0.3, bg, tip}] */
export function StackedBar({ segments = [], height = 8, className, style }) {
  return (
    <div className={cx(s.stack, className)} style={{ height, borderRadius: height / 2, ...style }}>
      {segments.map((g, i) => (
        <div
          key={i}
          className={s.seg}
          title={g.tip}
          style={{ width: typeof g.w === 'number' ? `${Math.max(0, g.w * 100)}%` : g.w, background: g.bg }}
        />
      ))}
    </div>
  );
}
