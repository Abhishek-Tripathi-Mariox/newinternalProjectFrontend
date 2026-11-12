import { api, ApiError, onExpired, refreshSession, setAccessToken } from '@/api/client';
import { loadAll, reload } from '@/api/loaders';
import { firstAllowedTarget, pidOf } from '@/domain/permissions';
import { liveBase } from '@/domain/live';
import { emptyData, initialUiState } from '../initialState';
import { navigate } from '../navigation';
import { serverNow } from '@/lib/clock';

/**
 * Session: restore on page load, sign in / out, and load all data from the API.
 *   boot: 'pending' | 'ready' | 'error' — App shows a splash until it isn't 'pending'.
 *   me:   the signed-in principal from the API ({id, role, pid, perms…}).
 *   auth: { uid } — kept for existing selectors (authUser, sessionUser).
 */
export const createSessionSlice = (set, get) => ({
  boot: 'pending',
  bootError: '',
  me: null,
  auth: null,

  /** Load everything the signed-in user may see. */
  async bootstrap() {
    const me = get().me;
    const data = await loadAll(me);
    set({ ...data, boot: 'ready', bootError: '' });
  },

  /** Re-fetch some domains: get().resync(['delivery']) — used after writes with wide side effects. */
  async resync(names) {
    const data = await reload(get().me, names);
    set(data);
  },

  /** On page load: use the refresh cookie to restore the session, then bootstrap. */
  async restoreSession() {
    onExpired(() => get().endSession('Your session expired — sign in again'));
    const s = await refreshSession();
    if (!s) return set({ boot: 'ready' });
    try {
      await get().startSession(s.user, { landing: false });
    } catch (e) {
      set({ boot: 'error', bootError: e.message });
    }
  },

  /** Shared by login + restore: store the principal, load data, set the landing page. */
  async startSession(me, { landing }) {
    const sup = me.role && me.role.id === 'r-super';
    set({ me, auth: { uid: me.id, at: serverNow() }, viewAs: sup ? null : me.id, boot: 'pending' });
    await get().bootstrap();
    if (landing) {
      const hit = sup ? { path: '/live' } : firstAllowedTarget(get()) || { path: '/live' };
      if (hit.tab) set((s) => ({ pj: { ...s.pj, tab: hit.tab, selP: null, selM: null } }));
      navigate(hit.path);
    } else {
      get().fixAccess();
    }
  },

  /** Sign in. Returns an error message, or undefined on success. */
  async login(email, pw) {
    let res;
    try {
      res = await api.post('/auth/login', { email: (email || '').trim(), password: pw || '' });
    } catch (e) {
      return e instanceof ApiError ? e.message : 'Sign-in failed — try again';
    }
    setAccessToken(res.accessToken);
    try {
      await get().startSession(res.user, { landing: true });
    } catch (e) {
      set({ boot: 'error', bootError: e.message });
      return e.message;
    }
    get().flash(`Welcome, ${res.user.name.split(' ')[0]}`);
    // Logging in starts the workday for staff (original behaviour).
    const pid = res.user.role.id === 'r-super' ? null : pidOf(res.user);
    const a = pid && liveBase(get().live).att[pid];
    if (pid && res.user.role.id !== 'r-client' && (!a || a.out) && get().checkIn) await get().checkIn(pid);
    return undefined;
  },

  /**
   * Accept an invite with the one-time token from the admin's link: sets the password, activates the
   * account and signs in. Returns an error message or undefined.
   */
  async acceptInvite(email, token, password) {
    let res;
    try {
      res = await api.post('/auth/accept-invite', { email, token, password });
    } catch (e) {
      return e instanceof ApiError ? e.message : 'Couldn’t set your password — try again';
    }
    if (res && res.accessToken) {
      setAccessToken(res.accessToken);
      try {
        await get().startSession(res.user, { landing: true });
      } catch (e) {
        set({ boot: 'error', bootError: e.message });
        return e.message;
      }
      get().flash(`Welcome, ${res.user.name.split(' ')[0]} — your account is ready`);
    } else {
      navigate('/');
      get().flash('Password set — sign in to continue');
    }
    return undefined;
  },

  /** Set a new password with a reset link's token, then send the user to sign in. */
  async resetPassword(email, token, password) {
    try {
      await api.post('/auth/reset-password', { email, token, password });
    } catch (e) {
      return e instanceof ApiError ? e.message : 'Couldn’t reset your password — try again';
    }
    navigate('/');
    get().flash('Password updated — sign in with your new password');
    return undefined;
  },

  /** Sign out. Staff still checked in must submit the end-of-shift report first (original rule). */
  async logout() {
    const S = get();
    const me = S.me;
    if (me && me.role.id !== 'r-super' && me.role.id !== 'r-client') {
      const pid = pidOf(me);
      const a = liveBase(S.live).att[pid];
      if (a && !a.out) {
        get().flash('Submit your end-of-shift report to log out');
        get().openEndShift(pid);
        return;
      }
    }
    await get().endSession();
  },

  /** Clear the session locally and on the server; wipe all loaded data from memory. */
  async endSession(message) {
    try { await api.post('/auth/logout'); } catch { /* already signed out */ }
    setAccessToken(null);
    set({ ...emptyData(), ...initialUiState(), me: null, auth: null, boot: 'ready' });
    navigate('/live');
    if (message) get().flash(message);
  },
});
