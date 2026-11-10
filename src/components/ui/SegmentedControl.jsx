import { cx } from './cx';
import s from './SegmentedControl.module.css';

/** iOS-style segmented switch. options: [[value, label], …] · onChange(value). */
export function SegmentedControl({ options = [], value, onChange, size, label, className, style }) {
  return (
    <div className={cx(s.seg, size === 'sm' && s.sm, className)} style={style} role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} className={cx(s.btn, value === v && s.on)} onClick={() => onChange?.(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}
