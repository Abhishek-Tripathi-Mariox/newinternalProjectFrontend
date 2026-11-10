import { useCallback } from 'react';
import { useStore } from '@/store';
import { printCr } from '@/domain/projects';

/** Hook returning a stable "download approval PDF" handler (flashes when pop-ups are blocked). */
export function usePrintCr() {
  const projects = useStore((st) => st.projects);
  const members = useStore((st) => st.members);
  const flash = useStore((st) => st.flash);
  return useCallback(
    (c) => {
      if (printCr(c, { projects, members }) === false) flash('Allow pop-ups to download the approval PDF');
    },
    [projects, members, flash],
  );
}
