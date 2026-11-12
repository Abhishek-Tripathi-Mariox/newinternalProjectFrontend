import { useStore } from '@/store';

/**
 * Sales owners (people who own leads / follow-ups), loaded from GET /sales-owners at bootstrap
 * into `state.owners` as [{ id, name, h }]. Read them through these helpers — never a constant.
 *   getOwners()  — plain read (domain code, event handlers, render-time option lists)
 *   useOwners()  — React hook that re-renders when the list changes
 */
const EMPTY = [];
export const getOwners = () => useStore.getState().owners || EMPTY;
export const useOwners = () => useStore((s) => s.owners || EMPTY);
/** Owners who can be assigned work (deactivated / deleted sales users excluded). Names of old
 *  records still resolve through getOwners(), which includes inactive owners. */
export const getActiveOwners = () => getOwners().filter((o) => !o.inactive);
export const firstOwnerId = () => (getActiveOwners()[0] || {}).id || '';
