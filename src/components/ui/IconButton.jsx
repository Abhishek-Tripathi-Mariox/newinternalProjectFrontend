import { cx } from './cx';
import s from './IconButton.module.css';

/**
 * Square icon-only button (default ✕). `label` is required for accessibility
 * (aria-label + tooltip). variant: 'soft' (grey square, default) | 'plain' (bare, red on hover).
 */
export function IconButton({ label, onClick, children = '✕', variant = 'soft', size, className, style, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(s.btn, variant === 'plain' && s.plain, size === 'lg' && s.lg, className)}
      style={style}
      {...rest}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
