import { Avatar } from '@/components/ui';
import s from './shared.module.css';

/**
 * Avatar with an optional presence dot in the bottom-right corner.
 * Used by Live now (team table), Reports timeline and the attendance tables.
 */
export default function StatusAvatar({ name, h, size = 30, ini, dot, className }) {
  return (
    <span className={`${s.avatarWrap} ${className || ''}`} style={{ width: size, height: size }}>
      <Avatar name={name} h={h} size={size} ini={ini} />
      {dot && <span className={s.presence} style={{ background: dot }} />}
    </span>
  );
}
