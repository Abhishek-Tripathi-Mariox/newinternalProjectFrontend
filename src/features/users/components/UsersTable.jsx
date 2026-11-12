import { useMemo } from 'react';
import { useStore } from '@/store';
import { DataTable, Avatar, Pill, HuePill, Button, ActionMenu } from '@/components/ui';
import { toneStrong } from '@/lib/color';
import { ago, dLabel } from '@/lib/date';
import { STATUS_HUE, isProtectedUser, projectsText } from '../users.utils';
import s from './UsersTable.module.css';

const EMPTY = [];

/** Users table: primary Edit button + ⋯ menu (resend invite, preview as, deactivate / reactivate). */
export default function UsersTable({ rows, model, now }) {
  const { roleMap, userMap } = model;
  const leads = useStore((st) => st.leads) || EMPTY;
  const projects = useStore((st) => st.projects) || EMPTY;
  const openModal = useStore((st) => st.openModal);
  const myId = useStore((st) => st.auth?.uid);
  const setViewAs = useStore((st) => st.setViewAs);
  const resendInvite = useStore((st) => st.resendInvite);
  const setUserStatus = useStore((st) => st.setUserStatus);

  const columns = useMemo(() => {
    const edit = (u) => openModal('user', { editId: u.id });
    return [
      {
        key: 'user',
        label: 'User',
        // An explicit share (instead of "whatever is left") so extra width on big screens
        // spreads across all columns rather than opening a gap after the name.
        width: '24%',
        render: (u) => (
          <button type="button" className={s.userBtn} onClick={() => edit(u)} title={`${u.name} · ${u.email}`}>
            <Avatar name={u.name} h={u.h ?? 265} size={32} />
            <span className={s.userText}>
              <span className={s.name}>{u.name}</span>
              <span className={s.email}>{u.email}</span>
            </span>
          </button>
        ),
      },
      {
        key: 'role',
        label: 'Role',
        width: '18%',
        render: (u) => {
          const r = roleMap[u.role] || { name: '—', h: 265 };
          const t = toneStrong(r.h);
          return (
            <div className={s.stack}>
              <Pill bg={t.bg} fg={t.fg} className={s.rolePill}>{r.name}</Pill>
              {u.title && <span className={s.sub} title={u.title}>{u.title}</span>}
            </div>
          );
        },
      },
      { key: 'dept', label: 'Department', width: '11%', render: (u) => <span className={s.cell}>{u.dept || '—'}</span> },
      {
        key: 'reports',
        label: 'Reports to',
        width: '12%',
        render: (u) => <span className={s.soft}>{u.reports && userMap[u.reports] ? userMap[u.reports].name : '—'}</span>,
      },
      { key: 'projects', label: 'Projects', width: '12%', render: (u) => <span className={s.soft}>{projectsText(u, leads, projects)}</span> },
      {
        key: 'status',
        label: 'Status',
        width: '11%',
        render: (u) => (
          <div className={s.stack}>
            <HuePill hue={STATUS_HUE[u.status] ?? 265} dot>
              {u.status}
            </HuePill>
            <span className={s.sub} title="Last active">
              {u.status === 'Invited' ? `Invited ${dLabel(u.invited || now).toLowerCase()}` : ago(u.last, now)}
            </span>
          </div>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        align: 'right',
        width: 100,
        render: (u) => {
          const deactivated = u.status === 'Deactivated';
          const more = [
            {
              key: 'resend',
              label: 'Resend invite',
              hidden: u.status !== 'Invited',
              onClick: () => resendInvite(u.id),
            },
            {
              key: 'preview',
              label: 'Preview',
              title: 'See the portal as this user',
              hidden: !(u.status === 'Active' && !isProtectedUser(u, myId)),
              onClick: () => setViewAs(u.id),
            },
            {
              key: 'status',
              label: deactivated ? 'Reactivate' : 'Deactivate',
              danger: !deactivated,
              hidden: !(!isProtectedUser(u, myId) && u.status !== 'Invited'),
              onClick: () => setUserStatus(u.id, deactivated ? 'Active' : 'Deactivated'),
            },
          ];
          return (
            <div className={s.actions}>
              <Button variant="secondary" size="sm" onClick={() => edit(u)}>
                Edit
              </Button>
              {more.some((m) => !m.hidden) ? (
                <ActionMenu items={more} label={`More actions for ${u.name}`} />
              ) : (
                <span className={s.menuSpacer} aria-hidden="true" />
              )}
            </div>
          );
        },
      },
    ];
  }, [roleMap, userMap, leads, projects, now, openModal, setViewAs, resendInvite, setUserStatus, myId]);

  return (
    <DataTable
      itemLabel="users"
      className={s.table}
      columns={columns}
      rows={rows}
      rowKey={(u) => u.id}
      rowStyle={(u) => (u.status === 'Deactivated' ? { opacity: 0.6 } : undefined)}
      empty="No users match these filters."
    />
  );
}
