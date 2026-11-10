import { useCallback } from 'react';
import { useStore } from '@/store';
import { copyText } from '@/lib/download';

/** Copy a Meet link to the clipboard and confirm with the original toast. */
export function useCopyMeet() {
  const flash = useStore((s) => s.flash);
  return useCallback((url) => {
    copyText(url || '');
    flash('Meet link copied');
  }, [flash]);
}
