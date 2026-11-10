import { useMemo } from 'react';
import { useStore } from '@/store';
import { DAY } from '@/lib/date';
import { filterUsers, sortUsers } from './users.utils';

const EMPTY = [];

/**
 * Raw (un-scoped, like the original `uv()`) people data plus the derived
 * pieces shared by the three tabs.
 */
export function useUsersModel(now) {
  const users = useStore((s) => s.users) || EMPTY;
  const roles = useStore((s) => s.roles) || EMPTY;
  const audit = useStore((s) => s.audit) || EMPTY;
  const us = useStore((s) => s.us);

  const roleMap = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r])), [roles]);
  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  const counts = useMemo(() => {
    const c = { Active: 0, Invited: 0, Deactivated: 0, recent: 0 };
    users.forEach((u) => {
      c[u.status] = (c[u.status] || 0) + 1;
      if (u.status === 'Active' && u.last && now - u.last < DAY) c.recent += 1;
    });
    return c;
  }, [users, now]);

  const shown = useMemo(() => sortUsers(filterUsers(users, us || {}), roles), [users, roles, us]);

  /** Selected role id: the stored one if it still exists, else the first role. */
  const selRoleId = roleMap[us?.selRole] ? us.selRole : roles[0]?.id;

  return { users, roles, audit, us: us || {}, roleMap, userMap, counts, shown, selRoleId };
}
