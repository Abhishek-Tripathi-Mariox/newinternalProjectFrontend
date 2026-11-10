import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store';
import { can } from '@/domain/permissions';

/** `(mod, act='v') => boolean` for the viewed-as user's role. */
export function useCan() {
  const s = useStore(useShallow((x) => ({ viewAs: x.viewAs, users: x.users, roles: x.roles })));
  return useCallback((mod, act) => can(s, mod, act), [s]);
}
