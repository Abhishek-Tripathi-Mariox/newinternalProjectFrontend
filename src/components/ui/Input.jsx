import { cx } from './cx';
import s from './Field.module.css';

/**
 * Text input with the portal style. Native props pass through; onChange receives the native event.
 * `invalid` → red border · `compact` → 34px filter-bar height · `mono` → monospace.
 */
export function Input({ invalid, compact, mono, inline, className, type = 'text', ...rest }) {
  return (
    <input
      type={type}
      aria-invalid={invalid || undefined}
      className={cx(s.control, compact && s.compact, invalid && s.invalid, mono && s.mono, inline && s.inline, className)}
      {...rest}
    />
  );
}
