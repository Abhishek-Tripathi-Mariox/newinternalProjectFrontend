import { cx } from './cx';
import s from './FilterChips.module.css';

/**
 * Single-select pill chips (scrolls horizontally). onChange(key).
 * items: [{key, label, count?, dot?, title?}] · tone: 'dark' (default) | 'primary'.
 * `wrap` lets chips wrap instead of scrolling.
 */
export function FilterChips({ items = [], value, onChange, tone = 'dark', wrap, label, className, style }) {
  return (
    <div className={cx(s.wrap, className)} style={style}>
      <div className={cx(s.row, wrap && s.wrapItems)} role="group" aria-label={label}>
        {items.map((it) => {
          const on = it.active ?? value === it.key;
          return (
            <button
              key={it.key}
              type="button"
              aria-pressed={on}
              title={it.title}
              className={cx(s.chip, s[tone], on && s.on)}
              onClick={() => onChange?.(it.key)}
            >
              {it.dot && <span className={s.dot} style={{ background: it.dot }} aria-hidden="true" />}
              {it.label}
              {it.count != null && <span className={s.count}>{it.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
