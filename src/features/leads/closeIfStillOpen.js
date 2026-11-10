import { useStore } from '@/store';

/** After a successful save: close the modal unless the store action already did. */
export function closeIfStillOpen(kind, onClose) {
  const m = useStore.getState().modal;
  if (m && m.kind === kind) onClose?.();
}
