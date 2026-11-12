import { create } from 'zustand';
import { api } from '@/api/client';

/**
 * Portal-wide settings (server: GET/PUT /settings), loaded by api/masters.loadMasters after
 * sign-in. Nothing is stored in the browser. `set(patch)` applies the change immediately and saves
 * it (Super Admin only on the server); a rejection rolls it back and resolves to the error message.
 */
export const useSettings = create((set, get) => ({
  /** 'INR' | 'USD' — used by lib/format.money. */
  currency: 'INR',
  /** 'Kanban' | 'Table' — initial leads view. */
  defaultLeadsView: 'Kanban',
  /** When false, follow-up reminder pop-ups are not raised. */
  reminderAlerts: true,
  async set(patch) {
    const prev = Object.fromEntries(Object.keys(patch).map((k) => [k, get()[k]]));
    set(patch);
    try {
      const saved = await api.put('/settings', patch);
      if (saved) {
        const { currency, defaultLeadsView, reminderAlerts } = saved;
        set({ currency, defaultLeadsView, reminderAlerts });
      }
      return undefined;
    } catch (e) {
      set(prev);
      return e.message;
    }
  },
}));
