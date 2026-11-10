import { pctW } from '@/lib/format';
import { BLUE } from '@/lib/color';
import { cx } from './cx';
import s from './ProgressBar.module.css';

/**
 * Horizontal bar. Pass `value` as a 0..1 fraction (clamped) or `width` as a CSS
 * percentage string ('42%').
 */
export function ProgressBar({ value, width, color = BLUE, height = 6, track, label, className, style }) {
  const w = width ?? pctW(value ?? 0);
  return (
    <div
      className={cx(s.track, className)}
      style={{ height, borderRadius: height / 2, background: track, ...style }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(parseFloat(w) || 0)}
    >
      <div className={s.fill} style={{ width: w, background: color, borderRadius: height / 2 }} />
    </div>
  );
}
