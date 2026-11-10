import { cx } from './cx';
import s from './Field.module.css';

/**
 * Filter-bar search box (grey, flexible width). onChange receives the native event
 * (same as Input) — read `e.target.value`.
 */
export function SearchInput({ value, onChange, placeholder = 'Search', className, style, ...rest }) {
  return (
    <input
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={rest['aria-label'] || placeholder}
      className={cx(s.control, s.compact, s.search, className)}
      style={style}
      {...rest}
    />
  );
}
