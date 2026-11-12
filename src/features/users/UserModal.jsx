import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { Modal, Field, Input, Select, Checkbox, Button, ErrorText } from '@/components/ui';
import { RED } from '@/lib/color';
import { ago, today, ymd } from '@/lib/date';
import {
  DEPARTMENTS, MANAGER_ROLES, ROLE_DEPT, isProtectedUser,
  checkedOf, isDeliveryRole, roleSummary, valueOf,
} from './users.utils';
import s from './UserModal.module.css';

const EMPTY = [];
const DANGER_TEXT = 'oklch(0.5 0.17 25)';
const OK_TEXT = 'oklch(0.42 0.12 150)';

/** Initial form — same fields as the original `openUser()` modal state. New users report to `defaultManager`. */
function initialForm(user, defaultManager = '') {
  if (user) {
    return {
      name: user.name, email: user.email, phone: user.phone || '', title: user.title || '', role: user.role,
      dept: user.dept || 'Web', reports: user.reports || '', join: user.join ? ymd(user.join) : '', shift: String(user.shift || 8),
    };
  }
  return {
    name: '', email: '', phone: '', title: '', role: 'r-tm', dept: 'Web', reports: defaultManager,
    join: ymd(today()), shift: '8', sendInvite: true,
  };
}

/** Invite a new user or edit an existing one. Props: `{ editId?, onClose }`. */
export default function UserModal({ editId, onClose }) {
  const users = useStore((st) => st.users) || EMPTY;
  const roles = useStore((st) => st.roles) || EMPTY;
  const saveUser = useStore((st) => st.saveUser);
  const setUserStatus = useStore((st) => st.setUserStatus);
  const delUser = useStore((st) => st.delUser);
  const resetPassword = useStore((st) => st.resetPassword);
  const forceLogout = useStore((st) => st.forceLogout);

  const myId = useStore((st) => st.auth?.uid);
  const ed = editId ? users.find((u) => u.id === editId) : null;
  // New people report to whoever invites them, when that person is a manager.
  const [form, setForm] = useState(() => {
    const me = users.find((u) => u.id === myId);
    return initialForm(ed, me && MANAGER_ROLES.includes(me.role) ? me.id : '');
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const roleMap = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r])), [roles]);
  const role = roleMap[form.role];
  const delivery = isDeliveryRole(form.role);

  const roleOptions = useMemo(() => roles.map((r) => ({ value: r.id, label: r.name })), [roles]);
  const deptOptions = DEPARTMENTS.map((d) => ({ value: d, label: d }));
  const managerOptions = useMemo(
    () => [
      { value: '', label: 'Nobody' },
      ...users
        .filter((u) => u.id !== editId && u.status !== 'Deactivated' && MANAGER_ROLES.includes(u.role))
        .map((u) => ({ value: u.id, label: `${u.name} · ${roleMap[u.role]?.name || ''}` })),
    ],
    [users, editId, roleMap],
  );

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: valueOf(e) }));
  const onRole = (e) => {
    const v = valueOf(e);
    setForm((f) => {
      const dept = v === 'r-admin' ? f.dept : ROLE_DEPT[v];
      return { ...f, role: v, ...(dept ? { dept } : {}) };
    });
  };

  /** Run one async action at a time; `key` names the button showing the busy state. */
  const withBusy = (key, fn) => async () => {
    if (busy) return;
    setBusy(key);
    try { await fn(); } finally { setBusy(''); }
  };
  const save = withBusy('save', async () => {
    const error = await saveUser(form, ed ? ed.id : undefined);
    if (error) { setErr(error); return; }
    onClose();
  });
  const toggleStatus = withBusy('status', () => setUserStatus(ed.id, ed.status === 'Deactivated' ? 'Active' : 'Deactivated'));
  const remove = withBusy('remove', () => delUser(ed.id));
  const reset = withBusy('reset', () => resetPassword(ed.id));
  const signOut = withBusy('signout', () => forceLogout(ed.id));

  const nameBad = !!err && !form.name.trim();
  const emailBad = !!err && /email/i.test(err);
  const badStyle = { borderColor: RED };

  const meta = ed
    ? `${ed.email} · ${ed.status}${ed.last ? ` · last active ${ago(ed.last).toLowerCase()}` : ''}`
    : 'They’ll get an email with a link to set their password';
  const canToggle = !!ed && !isProtectedUser(ed, myId) && ed.status !== 'Invited';
  const canDelete = !!ed && !isProtectedUser(ed, myId) && ed.status !== 'Active';
  const saveLabel = ed ? 'Save changes' : form.sendInvite ? 'Send invite' : 'Add user';

  const footer = (
    <div className={s.footer}>
      <div>
        {canDelete && (
          <Button variant="dangerOutline" onClick={remove} disabled={!!busy}>
            {ed.status === 'Invited' ? 'Cancel invite' : 'Delete user'}
          </Button>
        )}
      </div>
      <div className={s.footerRight}>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={!!busy} aria-busy={busy === 'save' || undefined}>
          {busy === 'save' ? 'Saving…' : saveLabel}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal open onClose={onClose} title={ed ? 'Edit user' : 'Invite user'} sub={meta} width={640} footer={footer}>
      <div className={s.grid}>
        <Field label="Full name">
          <Input value={form.name} onChange={set('name')} style={nameBad ? badStyle : undefined} aria-invalid={nameBad || undefined} />
        </Field>
        <Field label="Work email">
          <Input
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="name@marioxsoftware.com"
            style={emailBad ? badStyle : undefined}
            aria-invalid={emailBad || undefined}
          />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="Designation">
          <Input value={form.title} onChange={set('title')} placeholder="e.g. Senior Developer" />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={onRole} options={roleOptions} />
        </Field>
        <Field label="Department">
          <Select value={form.dept} onChange={set('dept')} options={deptOptions} />
        </Field>
        <Field label="Reports to">
          <Select value={form.reports} onChange={set('reports')} options={managerOptions} />
        </Field>
        <Field label="Joining date">
          <Input type="date" value={form.join} onChange={set('join')} />
        </Field>
        {delivery && (
          <>
            <Field label="Daily shift (hours)">
              <Input type="number" min="1" max="12" step="0.5" value={form.shift} onChange={set('shift')} />
            </Field>
            <div className={s.deliveryNote}>Delivery roles are added to Team &amp; hours and can log timesheets.</div>
          </>
        )}
        <div className={`${s.full} ${s.summary}`}>
          <b>{role ? role.name : ''}</b> · {roleSummary(role)}
        </div>
        {!ed && (
          <div className={s.full}>
            <Checkbox
              checked={!!form.sendInvite}
              onChange={(e) => setForm((f) => ({ ...f, sendInvite: checkedOf(e) }))}
              label="Send an invite so they can set a password"
            />
          </div>
        )}
        {ed && (
          <div className={`${s.full} ${s.accountActions}`}>
            <Button variant="secondary" size="sm" onClick={reset} disabled={!!busy}>
              Send password reset
            </Button>
            <Button variant="secondary" size="sm" onClick={signOut} disabled={!!busy}>
              Sign out of all devices
            </Button>
            {canToggle && (
              <Button
                variant="secondary"
                size="sm"
                style={{ color: ed.status === 'Deactivated' ? OK_TEXT : DANGER_TEXT }}
                onClick={toggleStatus}
                disabled={!!busy}
              >
                {ed.status === 'Deactivated' ? 'Reactivate user' : 'Deactivate user'}
              </Button>
            )}
          </div>
        )}
        {err && (
          <div className={s.full}>
            <ErrorText>{err}</ErrorText>
          </div>
        )}
      </div>
    </Modal>
  );
}
