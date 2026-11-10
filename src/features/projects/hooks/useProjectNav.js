import { useCallback, useMemo } from 'react';
import { useStore } from '@/store';

/**
 * Navigation helpers for the Projects feature: open drawers, switch tabs with
 * filter patches, and open the CR / task / bug / log modals with the props the
 * ModalHost contract expects.
 */
export function useProjectNav() {
  const setPj = useStore((s) => s.setPj);
  const openModal = useStore((s) => s.openModal);

  const openProject = useCallback(
    (id, exp = null) => setPj({ selP: id, selM: null, exp: exp || null, exp2: null, pDay: null }),
    [setPj],
  );
  const openMember = useCallback((id) => setPj({ selM: id, selP: null, mDay: null, exp: null, exp2: null }), [setPj]);

  /** Switch Projects sub-tab, optionally patching the shared filter and other pj keys. */
  const goTab = useCallback(
    (tab, fPatch, extra) => {
      const { pj } = useStore.getState();
      setPj({ tab, ...(extra || {}), ...(fPatch ? { f: { ...pj.f, ...fPatch } } : {}) });
    },
    [setPj],
  );

  const openCr = useCallback((pid, editId) => openModal('cr', { pid: pid || undefined, editId: editId || undefined }), [openModal]);

  return useMemo(() => ({ openProject, openMember, goTab, openCr, openModal }), [openProject, openMember, goTab, openCr, openModal]);
}
