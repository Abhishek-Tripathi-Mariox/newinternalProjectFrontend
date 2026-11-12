import { create } from 'zustand';
import { emptyData, initialUiState } from './initialState';
import { createUiSlice } from './slices/ui';
import { createSalesSlice } from './slices/sales';
import { createDeliverySlice } from './slices/delivery';
import { createPeopleSlice } from './slices/people';
import { createWorkdaySlice } from './slices/workday';
import { createSessionSlice } from './slices/session';

export { registerNavigate } from './navigation';

/**
 * The portal store: data loaded from the API, UI state and every action.
 *
 * Data flow: sign-in → bootstrap() loads each domain from the API (src/api/*). Actions call the
 * API; form saves await the server and return its error message (the UI's wording), quick edits
 * update the screen immediately and roll back if the server rejects them. Nothing is stored in
 * the browser — the database is the single source of truth.
 * Components read the role-scoped view through `useScoped()`.
 */
export const useStore = create((set, get) => ({
  ...emptyData(),
  ...initialUiState(),
  ...createUiSlice(set, get),
  ...createSalesSlice(set, get),
  ...createDeliverySlice(set, get),
  ...createPeopleSlice(set, get),
  ...createWorkdaySlice(set, get),
  // Last: session owns login / logout / bootstrap.
  ...createSessionSlice(set, get),
}));
