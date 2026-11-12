import { useCallback } from 'react';
import { useStore } from '@/store';
import { attachedMessage, docKind } from '@/domain/files';
import { pendingFiles } from '@/api/files';

const isFileLike = (x) => typeof File !== 'undefined' && x instanceof File;

/**
 * Turns a FileList into pending attachments (uploaded by the store's save action, see
 * api/files.pendingFiles), hands them to `apply(atts)` and flashes the original
 * "N files attached · M skipped (over 10 MB)" message.
 */
export function useAttach() {
  const flash = useStore((s) => s.flash);
  return useCallback(
    async (input, apply) => {
      const list = Array.from(input || []);
      if (!list.length) return;
      let atts = list;
      let skipped = 0;
      if (list.some(isFileLike)) ({ atts, skipped } = pendingFiles(list));
      atts = atts.map((a) => (a.kind ? a : { ...a, kind: docKind(a.name) }));
      if (atts.length) apply(atts);
      flash(attachedMessage(atts.length, skipped));
    },
    [flash],
  );
}
