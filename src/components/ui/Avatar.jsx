import { avatarTone } from '@/lib/color';
import { initials } from '@/lib/format';
import { cx } from './cx';
import s from './Avatar.module.css';

/** Round initials avatar coloured from hue `h` (or explicit bg/fg). */
export function Avatar({ name = '', h = 265, size = 28, ini, bg, fg, title, className, style }) {
  const t = avatarTone(h);
  return (
    <span
      className={cx(s.avatar, className)}
      title={title ?? name}
      aria-label={name || undefined}
      role={name ? 'img' : undefined}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.38)),
        background: bg || t.bg,
        color: fg || t.fg,
        ...style,
      }}
    >
      {ini || initials(name)}
    </span>
  );
}

/** Overlapping avatars; shows "+n" beyond `max`. people: [{name, h | bg+fg, ini}] */
export function AvatarStack({ people = [], max = 4, size = 24, className, style }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className={cx(s.stack, className)} style={style}>
      {shown.map((p, i) => (
        <Avatar key={p.id || `${p.name}-${i}`} name={p.name} h={p.h} bg={p.bg} fg={p.fg} ini={p.ini} size={size} className={s.ring} />
      ))}
      {extra > 0 && (
        <span
          className={cx(s.avatar, s.ring, s.more)}
          style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) }}
          title={people.slice(max).map((p) => p.name).join(', ')}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
