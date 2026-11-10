import { cx } from './cx';
import s from './Toggle.module.css';

/** On/off switch. onChange(nextBoolean). Provide `label` (aria-label) when there's no visible label. */
export function Toggle({ checked, onChange, label, disabled, className, style, ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      className={cx(s.toggle, checked && s.on, className)}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked);
      }}
      {...rest}
    >
      <span className={s.knob} aria-hidden="true" />
    </button>
  );
}
