import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { Modal, Field, Input, Select, Checkbox, Button, ErrorText } from '@/components/ui';
import { RED } from '@/lib/color';
import { ago, today, ymd } from '@/lib/date';
import {
  DEPARTMENTS, MANAGER_ROLES, OWNER_ID, ROLE_DEPT,
  checkedOf, isDeliveryRole, roleSummary, valueOf,
} from './users.utils';
import s from './UserModal.module.css';

const EMPTY = [];
const DANGER_TEXT = 'oklch(0.5 0.17 25)';
const OK_TEXT = 'oklch(0.42 0.12 150)';

/** Initial form — same fields as the original `openUser()` modal state. */
function initialForm(user) {
  if (user) {
    return {
      name: user.name, email: user.email, phone: user.phone || '', title: user.title || '', role: user.role,
      dept: user.dept || 'Web', reports: user.reports || '', join: user.join ? ymd(user.join) : '', shift: String(user.shift || 8),
    };
  }
  return {
    name: '', email: '', phone: '', title: '', role: 'r-tm', dept: 'Web', reports: 'u-mj',
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

  const ed = editId ? users.find((u) => u.id === editId) : null;
  const [form, setForm] = useState(() => initialForm(ed));
  const [err, setErr] = useState('');

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

  const save = () => {
    const error = saveUser(form, ed ? ed.id : undefined);
    if (error) return setErr(error);
    onClose();
  };
  const toggleStatus = () => {
    setUserStatus(ed.id, ed.status === 'Deactivated' ? 'Active' : 'Deactivated');
    onClose();
  };
  const remove = () => {
    delUser(ed.id);
    onClose();
  };

  const nameBad = !!err && !form.name.trim();
  const emailBad = !!err && /email/i.test(err);
  const badStyle = { borderColor: RED };

  const meta = ed
    ? `${ed.email} · ${ed.status}${ed.last ? ` · last active ${ago(ed.last).toLowerCase()}` : ''}`
    : 'They’ll get an email to set their password';
  const canToggle = !!ed && ed.id !== OWNER_ID && ed.status !== 'Invited';
  const canDelete = !!ed && ed.id !== OWNER_ID && ed.status !== 'Active';
  const saveLabel = ed ? 'Save changes' : form.sendInvite ? 'Send invite' : 'Add user';

  const footer = (
    <div className={s.footer}>
      <div>
        {canDelete && (
          <Button variant="dangerOutline" onClick={remove}>
            {ed.status === 'Invited' ? 'Cancel invite' : 'Delete user'}
          </Button>
        )}
      </div>
      <div className={s.footerRight}>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save}>
          {saveLabel}
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
              label="Email an invite link so they can set a password"
            />
          </div>
        )}
        {ed && (
          <div className={`${s.full} ${s.accountActions}`}>
            <Button variant="secondary" size="sm" onClick={() => resetPassword(ed.id)}>
              Send password reset
            </Button>
            <Button variant="secondary" size="sm" onClick={() => forceLogout(ed.id)}>
              Sign out of all devices
            </Button>
            {canToggle && (
              <Button
                variant="secondary"
                size="sm"
                style={{ color: ed.status === 'Deactivated' ? OK_TEXT : DANGER_TEXT }}
                onClick={toggleStatus}
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
