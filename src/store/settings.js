import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Portal-wide preferences (the original read these from component props).
 * Persisted under `mariox-portal-settings-v1`; hydrates synchronously from localStorage.
 */
export const useSettings = create(
  persist(
    (set) => ({
      /** 'INR' | 'USD' — used by lib/format.money. */
      currency: 'INR',
      /** 'Kanban' | 'Table' — initial leads view. */
      defaultLeadsView: 'Kanban',
      /** When false, follow-up reminder pop-ups are not raised. */
      reminderAlerts: true,
      set: (patch) => set(patch),
    }),
    {
      name: 'mariox-portal-settings-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ currency, defaultLeadsView, reminderAlerts }) => ({ currency, defaultLeadsView, reminderAlerts }),
    },
  ),
);
