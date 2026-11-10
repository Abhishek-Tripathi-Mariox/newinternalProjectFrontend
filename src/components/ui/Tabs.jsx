import { useRef } from 'react';
import { cx } from './cx';
import s from './Tabs.module.css';

/**
 * Underlined tab bar. tabs: [{key, label, count?, tone?: 'red'|'amber'}] · onChange(key).
 * Arrow keys move between tabs (WAI-ARIA tabs pattern, manual activation on Enter/Space or click).
 */
export function Tabs({ tabs = [], value, onChange, label, className, style }) {
  const ref = useRef(null);
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const btns = [...ref.current.querySelectorAll('[role=tab]')];
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const n = btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length];
    n.focus();
  };
  return (
    <div ref={ref} className={cx(s.tabs, className)} style={style} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((t) => {
        const on = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={cx(s.tab, on && s.on)}
            onClick={() => onChange?.(t.key)}
          >
            {t.label}
            {t.count != null && <span className={cx(s.count, t.tone && s[t.tone])}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
