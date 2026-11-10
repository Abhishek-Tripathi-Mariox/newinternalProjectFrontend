import { useStore } from '@/store';
import { useSession } from './useSession';
import s from './Banners.module.css';

/** Yellow strip shown while a Super Admin previews another user's role. */
export default function PreviewBanner() {
  const { previewing, me } = useSession();
  const setViewAs = useStore((x) => x.setViewAs);
  if (!previewing) return null;
  return (
    <div className={s.preview} role="status">
      <span>
        Previewing as <b>{me.name}</b> · {me.roleName}. The menu, tabs and buttons show only what this role is allowed to use.
      </span>
      <button type="button" className={s.exit} onClick={() => setViewAs(null)}>Exit preview</button>
    </div>
  );
}
