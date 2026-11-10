import { cx } from './cx';
import s from './Field.module.css';

/** Multi-line input (vertical resize). onChange receives the native event. */
export function Textarea({ invalid, rows = 3, className, ...rest }) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cx(s.control, s.textarea, invalid && s.invalid, className)}
      {...rest}
    />
  );
}
