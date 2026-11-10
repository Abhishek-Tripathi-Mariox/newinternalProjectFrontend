import { useId } from 'react';
import { cx } from './cx';
import s from './Toggle.module.css';

/**
 * Square checkbox (portal style). onChange(nextBoolean). `checked` may be 'mixed' for a
 * partial "select all". Clicks don't propagate (safe inside clickable rows).
 */
export function Checkbox({ checked, onChange, label, title, disabled, className, style }) {
  const id = useId();
  const mixed = checked === 'mixed';
  const toggle = (e) => {
    e.stopPropagation();
    if (!disabled) onChange?.(mixed ? true : !checked);
  };
  const box = (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? 'mixed' : !!checked}
      aria-labelledby={label ? id : undefined}
      aria-label={label ? undefined : title}
      title={title}
      disabled={disabled}
      className={cx(s.box, checked === true && s.checked, mixed && s.mixed)}
      onClick={toggle}
    >
      <span aria-hidden="true">{mixed ? '–' : checked ? '✓' : ''}</span>
    </button>
  );
  if (!label) return <span className={className} style={style}>{box}</span>;
  return (
    <span className={cx(s.check, className)} style={style}>
      {box}
      <span id={id} onClick={toggle}>{label}</span>
    </span>
  );
}
