import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store';
import { authUser, sessionUser, pidOf } from '@/domain/permissions';

/**
 * Signed-in session info (original `sess`):
 *  - authUser: the logged-in user (null when signed out)
 *  - user: effective user — the previewed user when a Super Admin previews a non-admin
 *  - pid: person id for attendance/timers (null for Super Admin and clients)
 *  - isSuper: effective user is a Super Admin
 */
export function useCurrentUser() {
  const s = useStore(useShallow((x) => ({ auth: x.auth, viewAs: x.viewAs, users: x.users })));
  return useMemo(() => {
    const au = authUser(s);
    const user = sessionUser(s);
    const isSuper = !!user && user.role === 'r-super';
    const pid = user && !isSuper && user.role !== 'r-client' ? pidOf(user) : null;
    return { authUser: au, user, pid, isSuper };
  }, [s]);
}
