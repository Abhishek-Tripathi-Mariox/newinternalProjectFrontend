import { TEAMS } from '@/config/constants';
import { parseDay } from '@/lib/date';
import { randomHue } from '@/lib/random';
import { mapById } from '../helpers';

const DELIVERY_ROLES = ['r-pm', 'r-tl', 'r-tm', 'r-qa'];
const EMPTY_PERM = { v: false, c: false, e: false, d: false, scope: 'all' };
const LOCKED_MSG = 'Super Admin is a locked system role';

const newRoleId = () => `r-${Date.now().toString(36)}`;
const deepClone = (x) => JSON.parse(JSON.stringify(x));

/** Users, roles, permissions and the audit log. Audit actor is always 'CEO', as in the original. */
export const createPeopleSlice = (set, get) => {
  const roleName = (id) => ((get().roles || []).find((r) => r.id === id) || {}).name || '';
  const userById = (id) => get().users.find((x) => x.id === id);
  /** Update one module's permission cell on a role (cell is normalised first). */
  const setPerm = (roleId, mod, fn) => get().updRole(roleId, (r) => ({ ...r, perms: { ...r.perms, [mod]: fn({ ...EMPTY_PERM, ...r.perms[mod] }) } }));
  const isLocked = (roleId) => !!((get().roles || []).find((r) => r.id === roleId) || {}).locked;

  return {
    /** Prepend an audit-log entry. */
    addAudit: (text, kind) => set((s) => ({ audit: [{ d: Date.now(), actor: 'CEO', text, kind }].concat(s.audit || []) })),

    /**
     * Invite / add / edit a user from the user modal form
     * `{name, email, phone, title, role, dept, reports, join(yyyy-mm-dd), shift, sendInvite}`.
     * Delivery roles get (or keep) a linked team member record.
     */
    saveUser(m, editId = m.editId) {
      const S = get();
      if (!m.name.trim()) return 'Enter the person’s name.';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email.trim())) return 'Enter a valid work email.';
      if (S.users.some((u) => u.id !== editId && u.email.toLowerCase() === m.email.trim().toLowerCase())) return 'Someone already uses this email.';
      const delivery = DELIVERY_ROLES.includes(m.role);
      const team = TEAMS.includes(m.dept) ? m.dept : 'Web';
      const shift = +m.shift || 8;
      const base = {
        name: m.name.trim(), email: m.email.trim(), phone: m.phone.trim(), title: m.title.trim(), role: m.role, dept: m.dept, reports: m.reports,
        join: m.join ? parseDay(m.join) : null, shift,
      };
      let { members } = S;
      const old = editId ? S.users.find((u) => u.id === editId) : null;
      let memberId = old ? old.memberId : null;
      if (delivery && !memberId) {
        memberId = `m${Date.now().toString(36)}`;
        members = members.concat({ id: memberId, name: base.name, role: base.title || roleName(m.role), team, h: randomHue(), shift });
      } else if (memberId) {
        members = members.map((x) => (x.id === memberId ? { ...x, name: base.name, role: base.title || x.role, team: delivery ? team : x.team, shift } : x));
      }
      if (old) {
        set((s) => ({ users: mapById(s.users, old.id, (u) => ({ ...u, ...base, memberId })), members, modal: null }));
        if (old.role !== m.role) get().addAudit(`changed ${base.name} from ${roleName(old.role)} to ${roleName(m.role)}`, 'Role');
        else get().addAudit(`updated ${base.name}’s profile`, 'Profile');
        get().flash('User updated');
      } else {
        const u = { id: `u-${Date.now().toString(36)}`, status: m.sendInvite ? 'Invited' : 'Active', invited: Date.now(), last: 0, h: randomHue(), memberId, ...base };
        set((s) => ({ users: s.users.concat(u), members, modal: null }));
        get().addAudit(`${m.sendInvite ? 'invited ' : 'added '}${base.name} as ${roleName(m.role)}`, 'Invite');
        get().flash(m.sendInvite ? `Invite sent to ${base.email}` : `${base.name} added`);
      }
      return undefined;
    },

    /** Activate / deactivate a user. Closes the user modal if open. */
    setUserStatus(id, st) {
      const u = userById(id);
      if (!u) return;
      set((s) => ({ users: mapById(s.users, id, (x) => ({ ...x, status: st })), modal: s.modal && s.modal.kind === 'user' ? null : s.modal }));
      get().addAudit(`${st === 'Deactivated' ? 'deactivated ' : 'reactivated '}${u.name}`, 'Access');
      get().flash(`${u.name} ${st.toLowerCase()}`);
    },

    /** Delete a user or cancel an invite. */
    delUser(id) {
      const u = userById(id);
      if (!u) return;
      set((s) => ({ users: s.users.filter((x) => x.id !== id), modal: null }));
      get().addAudit(`${u.status === 'Invited' ? 'cancelled the invite for ' : 'deleted '}${u.name}`, 'Access');
      get().flash(u.status === 'Invited' ? 'Invite cancelled' : 'User deleted');
    },

    resendInvite(id) {
      const u = userById(id);
      if (!u) return;
      get().addAudit(`resent the invite to ${u.name}`, 'Invite');
      get().flash(`Invite re-sent to ${u.email}`);
    },
    resetPassword(id) {
      const u = userById(id);
      if (!u) return;
      get().addAudit(`sent a password reset to ${u.name}`, 'Access');
      get().flash(`Password reset link sent to ${u.email}`);
    },
    forceLogout(id) {
      const u = userById(id);
      if (!u) return;
      get().addAudit(`signed ${u.name} out of all devices`, 'Access');
      get().flash(`${u.name} signed out everywhere`);
    },

    // Roles
    /** Transform a role: fn(role) → role (e.g. rename / describe). */
    updRole: (id, fn) => set((s) => ({ roles: s.roles.map((r) => (r.id === id ? fn(r) : r)) })),

    /** New role based on Team Member's permissions; selects it on the Roles tab. */
    newRole() {
      const S = get();
      const id = newRoleId();
      const base = S.roles.find((r) => r.id === 'r-tm') || S.roles[S.roles.length - 1];
      set((s) => ({
        roles: s.roles.concat({ id, name: 'New role', desc: '', h: randomHue(), perms: deepClone(base.perms) }),
        us: { ...s.us, tab: 'roles', selRole: id },
      }));
      get().addAudit('created a new role', 'Role');
    },

    duplicateRole(roleId) {
      const sr = get().roles.find((r) => r.id === roleId);
      if (!sr) return;
      const id = newRoleId();
      set((s) => ({ roles: s.roles.concat({ ...deepClone(sr), id, name: `${sr.name} (copy)`, locked: false }), us: { ...s.us, selRole: id } }));
      get().addAudit(`created role ${sr.name} (copy)`, 'Role');
    },

    /** Delete a role (UI only allows unlocked roles with no users). */
    deleteRole(roleId) {
      const sr = get().roles.find((r) => r.id === roleId);
      if (!sr) return;
      set((s) => ({ roles: s.roles.filter((r) => r.id !== roleId), us: { ...s.us, selRole: null } }));
      get().addAudit(`deleted role ${sr.name}`, 'Role');
      get().flash('Role deleted');
    },

    /**
     * Toggle a permission cell. Turning View off clears Create/Edit/Delete;
     * turning any other on also turns View on. Locked roles flash instead.
     */
    togglePerm(roleId, mod, act) {
      if (isLocked(roleId)) { get().flash(LOCKED_MSG); return; }
      setPerm(roleId, mod, (x) => {
        x[act] = !x[act];
        if (act === 'v' && !x.v) { x.c = false; x.e = false; x.d = false; }
        if (act !== 'v' && x[act]) x.v = true;
        return x;
      });
    },

    /** Set the record scope ('all'|'team'|'own') of a module; requires View. */
    setPermScope(roleId, mod, scope) {
      if (isLocked(roleId)) { get().flash(LOCKED_MSG); return; }
      const r = get().roles.find((x) => x.id === roleId);
      if (!r || !(r.perms[mod] && r.perms[mod].v)) { get().flash('Turn on View first'); return; }
      setPerm(roleId, mod, (x) => ({ ...x, scope }));
    },
  };
};
