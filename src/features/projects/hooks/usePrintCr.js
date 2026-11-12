import { useCallback } from 'react';
import { useStore } from '@/store';

/** Hook returning a stable "download approval PDF" handler (server print view; flashes when pop-ups are blocked). */
export function usePrintCr() {
  const printCr = useStore((st) => st.printCr);
  return useCallback((c) => printCr(c.id), [printCr]);
}
