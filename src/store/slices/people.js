import { fetchAudit, fromApiRole, fromApiUser, peopleApi, toApiUser } from '@/api/people';

/** Full link the admin shares (no email service yet): opens the public set-password page. */
const accountLink = (page, email, token) =>
  `${window.location.origin}/${page}?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

const EMPTY_PERM = { v: false, c: false, e: false, d: false, scope: 'all' };
const LOCKED_MSG = 'Super Admin is a locked system role';
const NAME_DEBOUNCE = 600;

/** Pending name / description / hue edits per role (typed into the Roles tab), sent after a pause. */
const roleTimers = {};

/**
 * Users, roles, permissions and the audit log — all backed by the API
 * (/users, /roles, /audit-logs). Form saves resolve to an error message or undefined;
 * quick edits (permission toggles, role names) update the screen first and roll back on failure.
 * There's no email service: invite / reset tokens returned by the API are shown in a copyable note.
 */
export const createPeopleSlice = (set, get) => {
  const userById = (id) => get().users.find((x) => x.id === id);
  const roleById = (id) => (get().roles || []).find((r) => r.id === id);
  const isLocked = (roleId) => !!(roleById(roleId) || {}).locked;

  /** Put a server user into the store (replace by id or append). */
  const mergeUser = (dto) => {
    const u = fromApiUser(dto);
    set((s) => ({ users: s.users.some((x) => x.id === u.id) ? s.users.map((x) => (x.id === u.id ? { ...x, ...u } : x)) : s.users.concat(u) }));
    return u;
  };
  const mergeRole = (dto) => {
    const r = fromApiRole(dto);
    set((s) => ({ roles: s.roles.some((x) => x.id === r.id) ? s.roles.map((x) => (x.id === r.id ? r : x)) : s.roles.concat(r) }));
    return r;
  };
  /** Refresh the activity log after a write (the server writes the audit entries). */
  const refreshAudit = () => fetchAudit().then((audit) => set({ audit })).catch(() => {});

  /** Optimistic role update: apply locally, send `body`, roll back + flash on failure. */
  async function patchRole(roleId, applyFn, body) {
    const prev = roleById(roleId);
    if (!prev) return;
    set((s) => ({ roles: s.roles.map((r) => (r.id === roleId ? applyFn(r) : r)) }));
    try {
      mergeRole(await peopleApi.updateRole(roleId, body));
      refreshAudit();
    } catch (e) {
      set((s) => ({ roles: s.roles.map((r) => (r.id === roleId ? prev : r)) }));
      get().flash(e.message);
    }
  }

  return {
    /** One-time secret to hand over (invite / reset link) — shown by components/layout/SecretNote. */
    secretNote: null,
    clearSecretNote: () => set({ secretNote: null }),

    /**
     * Invite / add / edit a user from the user modal form
     * `{name, email, phone, title, role, dept, reports, join(yyyy-mm-dd), shift, sendInvite}`.
     * Resolves to an error message or undefined. Delivery / sales roles get linked member /
     * owner records on the server, so those domains are reloaded.
     */
    async saveUser(m, editId = m.editId) {
      const S = get();
      if (!m.name.trim()) return 'Enter the person’s name.';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email.trim())) return 'Enter a valid work email.';
      if (S.users.some((u) => u.id !== editId && u.email.toLowerCase() === m.email.trim().toLowerCase())) return 'Someone already uses this email.';
      const old = editId ? userById(editId) : null;
      let res;
      try {
        res = old
          ? await peopleApi.updateUser(old.id, toApiUser(m))
          : await peopleApi.createUser({ ...toApiUser(m), sendInvite: !!m.sendInvite });
      } catch (e) {
        return e.message;
      }
      const u = mergeUser(res);
      set({ modal: null });
      if (old) {
        get().flash('User updated');
      } else if (m.sendInvite) {
        if (res.emailSent) get().flash(`Invite emailed to ${u.email}`);
        else if (res.inviteToken) {
          get().flash(`Invite created for ${u.email}`);
          set({ secretNote: { title: `Invite for ${u.name}`, sub: `The invite email couldn’t be sent — share this one-time link with ${u.email}. It opens a page where they set their password (valid 7 days).`, value: accountLink('accept-invite', u.email, res.inviteToken) } });
        }
      } else {
        get().flash(res.emailSent ? `${u.name} added — set-password link emailed` : `${u.name} added`);
        if (!res.emailSent && res.resetToken) set({ secretNote: { title: `Set-password link for ${u.name}`, sub: `The email couldn’t be sent — share this one-time link with ${u.email} so they can set a password (valid 24 hours).`, value: accountLink('reset-password', u.email, res.resetToken) } });
      }
      refreshAudit();
      // Delivery / sales roles get linked member / owner records, which live in other domains.
      const linked = (r) => ['r-pm', 'r-tl', 'r-tm', 'r-qa', 'r-sm', 'r-se'].includes(r);
      const names = [];
      if (linked(m.role) || (old && linked(old.role))) names.push('delivery', 'sales');
      if (names.length && get().resync) get().resync(names).catch(() => {});
      return undefined;
    },

    /** Activate / deactivate a user. Closes the user modal if open. */
    async setUserStatus(id, st) {
      const u = userById(id);
      if (!u) return;
      try {
        const dto = st === 'Deactivated' ? await peopleApi.deactivate(id) : await peopleApi.reactivate(id);
        mergeUser(dto);
        set((s) => ({ modal: s.modal && s.modal.kind === 'user' ? null : s.modal }));
        get().flash(`${u.name} ${st.toLowerCase()}`);
        refreshAudit();
      } catch (e) {
        get().flash(e.message);
      }
    },

    /** Delete a user or cancel an invite. */
    async delUser(id) {
      const u = userById(id);
      if (!u) return;
      try {
        await peopleApi.deleteUser(id);
        set((s) => ({ users: s.users.filter((x) => x.id !== id), modal: null }));
        get().flash(u.status === 'Invited' ? 'Invite cancelled' : 'User deleted');
        refreshAudit();
      } catch (e) {
        get().flash(e.message);
      }
    },

    async resendInvite(id) {
      const u = userById(id);
      if (!u) return;
      try {
        const res = await peopleApi.resendInvite(id);
        if (res.emailSent) get().flash(`New invite emailed to ${u.email}`);
        else {
          get().flash(`New invite created for ${u.email}`);
          set({ secretNote: { title: `New invite for ${u.name}`, sub: `The email couldn’t be sent — share this one-time link with ${u.email} (the previous link no longer works).`, value: accountLink('accept-invite', u.email, res.inviteToken) } });
        }
        refreshAudit();
      } catch (e) {
        get().flash(e.message);
      }
    },
    async resetPassword(id) {
      const u = userById(id);
      if (!u) return;
      try {
        const res = await peopleApi.resetPassword(id);
        if (res.emailSent) get().flash(`Password reset link emailed to ${u.email}`);
        else {
          get().flash(`Password reset link created for ${u.email}`);
          set({ secretNote: { title: `Password reset for ${u.name}`, sub: `The email couldn’t be sent — share this one-time link with ${u.email} (valid 24 hours).`, value: accountLink('reset-password', u.email, res.resetToken) } });
        }
        refreshAudit();
      } catch (e) {
        get().flash(e.message);
      }
    },
    async forceLogout(id) {
      const u = userById(id);
      if (!u) return;
      try {
        await peopleApi.forceLogout(id);
        get().flash(`${u.name} signed out everywhere`);
        refreshAudit();
      } catch (e) {
        get().flash(e.message);
      }
    },

    // Roles
    /**
     * Transform a role: fn(role) → role (rename / describe, typed live in the Roles tab).
     * Applied immediately; changed name / description / hue are sent after a short pause.
     */
    updRole(id, fn) {
      const prev = roleById(id);
      if (!prev) return;
      const next = fn(prev);
      set((s) => ({ roles: s.roles.map((r) => (r.id === id ? next : r)) }));
      clearTimeout(roleTimers[id]);
      roleTimers[id] = setTimeout(async () => {
        const cur = roleById(id);
        if (!cur) return;
        const body = {};
        if (cur.name.trim()) body.name = cur.name.trim();
        body.description = (cur.desc || '').trim();
        if (cur.h != null) body.hue = Math.round(cur.h) % 361;
        try {
          const dto = await peopleApi.updateRole(id, body);
          // Keep what's being typed; take everything else from the server.
          set((s) => ({ roles: s.roles.map((r) => (r.id === id ? { ...fromApiRole(dto), name: r.name, desc: r.desc } : r)) }));
          refreshAudit();
        } catch (e) {
          get().flash(e.message);
        }
      }, NAME_DEBOUNCE);
    },

    /** New role based on Team Member's permissions; selects it on the Roles tab. */
    async newRole() {
      try {
        const r = mergeRole(await peopleApi.createRole({}));
        set((s) => ({ us: { ...s.us, tab: 'roles', selRole: r.id } }));
        refreshAudit();
      } catch (e) {
        get().flash(e.message);
      }
    },

    async duplicateRole(roleId) {
      if (!roleById(roleId)) return;
      try {
        const r = mergeRole(await peopleApi.duplicateRole(roleId));
        set((s) => ({ us: { ...s.us, selRole: r.id } }));
        refreshAudit();
      } catch (e) {
        get().flash(e.message);
      }
    },

    /** Delete a role (UI only allows unlocked roles with no users). */
    async deleteRole(roleId) {
      if (!roleById(roleId)) return;
      try {
        await peopleApi.deleteRole(roleId);
        clearTimeout(roleTimers[roleId]);
        set((s) => ({ roles: s.roles.filter((r) => r.id !== roleId), us: { ...s.us, selRole: null } }));
        get().flash('Role deleted');
        refreshAudit();
      } catch (e) {
        get().flash(e.message);
      }
    },

    /**
     * Toggle a permission cell. Turning View off clears Create/Edit/Delete;
     * turning any other on also turns View on (the server applies the same rules).
     */
    togglePerm(roleId, mod, act) {
      if (isLocked(roleId)) { get().flash(LOCKED_MSG); return Promise.resolve(); }
      const r = roleById(roleId);
      if (!r) return Promise.resolve();
      const x = { ...EMPTY_PERM, ...r.perms[mod] };
      x[act] = !x[act];
      if (act === 'v' && !x.v) { x.c = false; x.e = false; x.d = false; }
      if (act !== 'v' && x[act]) x.v = true;
      return patchRole(roleId, (ro) => ({ ...ro, perms: { ...ro.perms, [mod]: x } }), { perms: { [mod]: { [act]: x[act] } } });
    },

    /** Set the record scope ('all'|'team'|'own') of a module; requires View. */
    setPermScope(roleId, mod, scope) {
      if (isLocked(roleId)) { get().flash(LOCKED_MSG); return Promise.resolve(); }
      const r = roleById(roleId);
      if (!r || !(r.perms[mod] && r.perms[mod].v)) { get().flash('Turn on View first'); return Promise.resolve(); }
      return patchRole(roleId, (ro) => ({ ...ro, perms: { ...ro.perms, [mod]: { ...EMPTY_PERM, ...ro.perms[mod], scope } } }), { perms: { [mod]: { scope } } });
    },
  };
};
