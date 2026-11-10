import { cx } from './cx';
import s from './Field.module.css';

/**
 * Labelled form field. Wraps its control in a <label> so clicking the text focuses it.
 * `full` spans all grid columns. `aside` renders content at the right of the label row.
 */
export function Field({ label, hint, error, required, full, aside, children, className, style, as }) {
  const Tag = as || 'label';
  return (
    <Tag className={cx(s.field, full && s.full, className)} style={style}>
      {(label || aside) && (
        <span className={s.labelRow}>
          <span>
            {label}
            {required && <span className={s.req} aria-hidden="true">*</span>}
          </span>
          {aside}
        </span>
      )}
      {children}
      {hint && <span className={s.hint}>{hint}</span>}
      {error && <span className={s.error} role="alert">{error}</span>}
    </Tag>
  );
}

/** Red validation / error message line. */
export function ErrorText({ children, className, style }) {
  if (!children) return null;
  return (
    <div className={cx(s.error, className)} style={style} role="alert">
      {children}
    </div>
  );
}
