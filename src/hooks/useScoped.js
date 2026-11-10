import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store';
import { scopeState } from '@/domain/permissions';

/** Fast-changing UI fields left out so the scoped view isn't rebuilt on every toast / modal edit. */
const EXCLUDED = new Set(['toast', 'modal', 'alerts']);

/** All state values (no actions, no transient UI) — shallow-compared by useShallow. */
const pickState = (s) => {
  const out = {};
  for (const k in s) if (typeof s[k] !== 'function' && !EXCLUDED.has(k)) out[k] = s[k];
  return out;
};

/**
 * Role-scoped state for rendering: leads, fus, projects, milestones, crs,
 * tasks, bugs and logs filtered to what the viewed-as user may see; every
 * other (non-transient) field passed through. Actions, toast, modal and
 * alerts are not included — read those from useStore.
 * Memoised: rebuilt only when one of the state slices changes by reference.
 */
export function useScoped() {
  const state = useStore(useShallow(pickState));
  return useMemo(() => scopeState(state), [state]);
}
