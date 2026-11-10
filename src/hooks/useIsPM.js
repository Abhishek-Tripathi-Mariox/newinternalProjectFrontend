import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store';
import { isPMof } from '@/domain/permissions';

/** `(project) => boolean`: can the viewer manage this project as its PM? */
export function useIsPM() {
  const s = useStore(useShallow((x) => ({ viewAs: x.viewAs, users: x.users })));
  return useCallback((p) => isPMof(s, p), [s]);
}
