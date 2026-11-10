import { create } from 'zustand';
import { buildInitialState, STORAGE_KEYS } from '@/data/seed';
import { createUiSlice } from './slices/ui';
import { createSalesSlice } from './slices/sales';
import { createDeliverySlice } from './slices/delivery';
import { createPeopleSlice } from './slices/people';
import { createWorkdaySlice } from './slices/workday';

export { registerNavigate } from './navigation';

/**
 * The portal store: all data (leads … reports), UI state and every action.
 * Actions always operate on the FULL (unscoped) state; components read the
 * role-scoped view through `useScoped()`.
 */
export const useStore = create((set, get) => ({
  ...buildInitialState(),
  ...createUiSlice(set, get),
  ...createSalesSlice(set, get),
  ...createDeliverySlice(set, get),
  ...createPeopleSlice(set, get),
  ...createWorkdaySlice(set, get),
}));

/* ------------------------------------------------------------------ *
 * Persistence — write each localStorage key only when one of its
 * slices changed by reference (like the original componentDidUpdate).
 * ------------------------------------------------------------------ */

const STORAGE_FULL = 'Browser storage is full · remove some large attachments to keep saving';

/**
 * [key, state fields, serialise(state) → value | undefined (skip) | null (remove)]
 */
const PERSISTED = [
  [STORAGE_KEYS.sales, ['leads', 'fus'], (s) => ({ leads: s.leads, fus: s.fus })],
  [STORAGE_KEYS.projects, ['members', 'projects', 'milestones', 'logs', 'tasks', 'bugs', 'crs'],
    (s) => ({ members: s.members, projects: s.projects, milestones: s.milestones, logs: s.logs, tasks: s.tasks, bugs: s.bugs, crs: s.crs })],
  [STORAGE_KEYS.users, ['users', 'roles', 'audit'], (s) => ({ users: s.users, roles: s.roles, audit: s.audit })],
  [STORAGE_KEYS.att, ['attLog'], (s) => s.attLog || []],
  [STORAGE_KEYS.auth, ['auth'], (s) => s.auth || null],
  [STORAGE_KEYS.reports, ['reports'], (s) => s.reports || undefined],
  [STORAGE_KEYS.live, ['live'], (s) => s.live || undefined],
];

function write(key, value) {
  try {
    if (value === undefined) return;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    useStore.getState().flash(STORAGE_FULL);
  }
}

function persist(state, prev) {
  PERSISTED.forEach(([key, fields, serialise]) => {
    if (!prev || fields.some((f) => state[f] !== prev[f])) write(key, serialise(state));
  });
}

if (typeof window !== 'undefined') {
  // Initial write (the original persisted seeded data / today's live board on first update).
  persist(useStore.getState(), null);
  useStore.subscribe(persist);
  // Restore page access for a stored non-admin session (original componentDidMount → setViewAs(viewAs, true)).
  setTimeout(() => {
    const s = useStore.getState();
    if (s.viewAs && s.auth) s.fixAccess();
  }, 0);
}
