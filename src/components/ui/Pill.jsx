import { tone } from '@/lib/color';
import { cx } from './cx';
import s from './Pill.module.css';

/**
 * Small status label. size: 'md' (rounded status pill, default) | 'sm' (square-ish tag) | 'xs'.
 * `dot` = colour of a leading dot (omit for none).
 */
export function Pill({ bg, fg, dot, size = 'md', title, className, style, children }) {
  return (
    <span className={cx(s.pill, s[size], className)} style={{ background: bg, color: fg, ...style }} title={title}>
      {dot && <span className={s.dot} style={{ background: dot }} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Pill coloured from a single hue via lib/color.tone(). `dot` (boolean) shows the hue dot. */
export function HuePill({ hue = 265, dot, size, className, style, title, children }) {
  const t = tone(hue);
  return (
    <Pill bg={t.bg} fg={t.fg} dot={dot ? t.dot : undefined} size={size} className={className} style={style} title={title}>
      {children}
    </Pill>
  );
}
