import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store';
import { useCurrentUser } from '@/hooks';
import { viewUser } from '@/domain/permissions';

/**
 * Shell-level identity (original `sess` / `me` blocks), built on useCurrentUser():
 * - auth / user / pid / isSuper from useCurrentUser
 * - me: identity shown in the sidebar footer (previewed user, else the signed-in user)
 * - previewing: a Super Admin is previewing someone else
 */
export function useSession() {
  const { authUser, user, pid, isSuper } = useCurrentUser();
  const { auth, users, roles, viewAs } = useStore(
    useShallow((s) => ({ auth: s.auth, users: s.users, roles: s.roles, viewAs: s.viewAs })),
  );
  return useMemo(() => {
    const roleName = (id) => ((roles || []).find((r) => r.id === id) || {}).name || '';
    const va = viewUser({ users, viewAs });
    const meU = va || authUser || { name: 'Super Admin', h: 265, role: 'r-super' };
    const own = !!(auth && viewAs && auth.uid === viewAs);
    // The real (signed-in) account decides who may preview — not the user being previewed —
    // so a Super Admin previewing a PM still has the picker to switch back.
    const authIsSuper = !!authUser && authUser.role === 'r-super';
    return {
      auth: authUser,
      user,
      isSuper,
      authIsSuper,
      pid,
      viewAs,
      roleName,
      me: { ...meU, roleName: roleName(meU.role) || 'Super Admin' },
      previewing: !!va && !own,
      canPreview: !auth || authIsSuper,
    };
  }, [authUser, user, pid, isSuper, auth, users, roles, viewAs]);
}
