import { MINUTE } from '@/lib/date';
import { useSettings } from '@/store/settings';
import { canAccessPath, firstAllowedTarget } from '@/domain/permissions';
import { navigate, currentPath } from '../navigation';
import { serverNow } from '@/lib/clock';

/** Defaults merged into attendance / report filters (original AF0 / RF0). */
export const ATT_FILTER_DEFAULT = { range: 'today', date: '', team: '', q: '', person: '', exp: '' };
export const REP_FILTER_DEFAULT = { person: '', range: 'today', date: '', tab: 'timeline', tday: 0, tmode: 'day', tteam: '' };

let toastTimer = null;

/** UI state actions: toast, modal, filters, selection, preview-as. */
export const createUiSlice = (set, get) => ({
  /** Show a toast for 2.4s. */
  flash(msg) {
    clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: '' }), 2400);
  },

  openModal: (kind, props = {}) => set({ modal: { kind, props } }),
  closeModal: () => set({ modal: null }),

  dismissAlert: (id) => set((s) => ({ alerts: s.alerts.filter((x) => x !== id) })),

  /** Raise reminder alerts for follow-ups entering their reminder window (call every 15s). */
  checkReminders() {
    if (useSettings.getState().reminderAlerts === false) return;
    const now = serverNow();
    const due = (f) => !f.done && !f.notified && f.remind > 0 && now >= f.due - f.remind * MINUTE && now < f.due + 5 * MINUTE;
    // Project follow-ups: only the owner gets the pop-up.
    const me = get().auth && (get().users || []).find((u) => u.id === get().auth.uid);
    const myMember = me && me.memberId;
    const hits = get().fus.filter(due).concat((get().pfus || []).filter((f) => due(f) && f.owner === myMember));
    if (!hits.length) return;
    const ids = new Set(hits.map((f) => f.id));
    set((s) => ({
      fus: s.fus.map((f) => (ids.has(f.id) ? { ...f, notified: true } : f)),
      pfus: (s.pfus || []).map((f) => (ids.has(f.id) ? { ...f, notified: true } : f)),
      alerts: s.alerts.concat(hits.map((f) => f.id)).slice(-4),
    }));
  },

  // Filters & view settings
  setLf: (patch) => set((s) => ({ lf: { ...s.lf, ...patch } })),
  setFf: (patch) => set((s) => ({ ff: { ...s.ff, ...patch } })),
  setFuTab: (fuTab) => set({ fuTab }),
  setSort: (sort) => set({ sort }),
  setLeadView: (leadView) => set({ leadView }),
  setStaleDays: (staleDays) => set({ staleDays }),
  setPj: (patch) => set((s) => ({ pj: { ...s.pj, ...patch } })),
  setPjF: (patch) => set((s) => ({ pj: { ...s.pj, f: { ...s.pj.f, ...patch } } })),
  setLiveF: (liveF) => set({ liveF }),
  setAttF: (patch) => set((s) => ({ attF: { ...ATT_FILTER_DEFAULT, ...s.attF, ...patch } })),
  setRepF: (patch) => set((s) => ({ repF: { ...REP_FILTER_DEFAULT, ...s.repF, ...patch } })),
  setUs: (patch) => set((s) => ({ us: { ...s.us, ...patch } })),

  // Lead selection
  selectLead: (selLead) => set({ selLead }),
  toggleSel: (id) => set((s) => ({ selIds: s.selIds.includes(id) ? s.selIds.filter((x) => x !== id) : s.selIds.concat(id) })),
  setSelIds: (selIds) => set({ selIds }),

  /**
   * Preview the portal as another user (null = back to own view). Moves to the
   * first page that user can open if the current one is not allowed.
   */
  setViewAs(id, quiet) {
    set({ viewAs: id || null });
    get().fixAccess();
    if (quiet) return;
    const u = (get().users || []).find((x) => x.id === id);
    get().flash(u ? `Previewing as ${u.name}` : 'Back to your own view');
  },

  /** If the current route is not allowed for the viewer, go to the first allowed one. */
  fixAccess() {
    const s = get();
    if (canAccessPath(s, currentPath())) return;
    const hit = firstAllowedTarget(s);
    if (!hit) return;
    if (hit.tab) set((st) => ({ pj: { ...st.pj, tab: hit.tab, selP: null, selM: null } }));
    navigate(hit.path);
  },
});
