import { useStore } from '@/store';
import { Avatar, Button, Input } from '@/components/ui';
import { valueOf } from '../users.utils';
import PermissionMatrix from './PermissionMatrix';
import s from './RolesTab.module.css';

/** Left column: role list with active-user counts + "New custom role". */
function RoleList({ roles, users, selId, onSelect, onNew }) {
  return (
    <div className={s.list}>
      {roles.map((r) => {
        const n = users.filter((u) => u.role === r.id && u.status !== 'Deactivated').length;
        return (
          <button
            key={r.id}
            type="button"
            className={r.id === selId ? `${s.roleBtn} ${s.roleOn}` : s.roleBtn}
            onClick={() => onSelect(r.id)}
          >
            <span className={s.roleHead}>
              <span className={s.roleName}>
                <span className={s.dot} style={{ background: `oklch(0.62 0.15 ${r.h})` }} />
                {r.name}
              </span>
              <span className={s.count}>{n} users</span>
            </span>
            <span className={s.roleDesc}>{r.desc || ''}</span>
          </button>
        );
      })}
      <button type="button" className={s.newBtn} onClick={onNew}>
        + New custom role
      </button>
    </div>
  );
}

/** Right column: name/description, actions, permission matrix, members. */
function RoleEditor({ role, users }) {
  const updRole = useStore((st) => st.updRole);
  const duplicateRole = useStore((st) => st.duplicateRole);
  const deleteRole = useStore((st) => st.deleteRole);
  const openModal = useStore((st) => st.openModal);
  const locked = !!role.locked;
  const members = users.filter((u) => u.role === role.id);
  const canDelete = !locked && !members.length;

  return (
    <div className={s.editor}>
      <div className={s.editorHead}>
        <div className={s.names}>
          {locked ? (
            <>
              <div className={s.lockedName}>{role.name}</div>
              <div className={s.lockedDesc}>{role.desc || ''}</div>
            </>
          ) : (
            <>
              <Input
                className={s.nameInput}
                value={role.name}
                onChange={(e) => {
                  const name = valueOf(e);
                  updRole(role.id, (r) => ({ ...r, name }));
                }}
              />
              <Input
                className={s.descInput}
                value={role.desc || ''}
                placeholder="Short description"
                onChange={(e) => {
                  const desc = valueOf(e);
                  updRole(role.id, (r) => ({ ...r, desc }));
                }}
              />
            </>
          )}
        </div>
        <div className={s.headActions}>
          {locked && <span className={s.lockTag}>System role · locked</span>}
          <Button variant="secondary" size="sm" onClick={() => duplicateRole(role.id)}>
            Duplicate
          </Button>
          {canDelete && (
            <Button variant="dangerOutline" size="sm" onClick={() => deleteRole(role.id)}>
              Delete role
            </Button>
          )}
        </div>
      </div>

      <PermissionMatrix role={role} />

      <div className={s.members}>
        <div className={s.membersTitle}>
          Users with this role <span className={s.membersCount}>{members.length ? `· ${members.length}` : ''}</span>
        </div>
        {members.length ? (
          <div className={s.chips}>
            {members.map((u) => (
              <button key={u.id} type="button" className={s.chip} onClick={() => openModal('user', { editId: u.id })}>
                <Avatar name={u.name} h={u.h ?? 265} size={22} />
                {u.name}
              </button>
            ))}
          </div>
        ) : (
          <div className={s.none}>Nobody has this role yet.</div>
        )}
      </div>
    </div>
  );
}

/** Roles & permissions tab. */
export default function RolesTab({ model }) {
  const { roles, users, roleMap, selRoleId } = model;
  const setUs = useStore((st) => st.setUs);
  const newRole = useStore((st) => st.newRole);
  const role = roleMap[selRoleId];

  return (
    <div className={s.layout}>
      <RoleList roles={roles} users={users} selId={selRoleId} onSelect={(id) => setUs({ selRole: id })} onNew={() => newRole()} />
      {role && <RoleEditor key={role.id} role={role} users={users} />}
    </div>
  );
}
