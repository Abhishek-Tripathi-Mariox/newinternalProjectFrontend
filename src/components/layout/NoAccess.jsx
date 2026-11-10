import { useSession } from './useSession';
import s from './Banners.module.css';

/** Shown in place of a page the current (previewed) role may not view. */
export default function NoAccess() {
  const { me } = useSession();
  return (
    <div className={s.noAccess} role="alert">
      <h1 className={s.naTitle}>No access to this page</h1>
      <div className={s.naSub}>
        The {me.roleName} role can&apos;t view this section. Change it in Users &amp; roles → Roles &amp; permissions.
      </div>
    </div>
  );
}
