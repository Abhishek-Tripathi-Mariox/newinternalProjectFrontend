import { useMemo } from 'react';
import { useStore } from '@/store';
import { KpiGrid, KpiCard, Toolbar, SearchInput, Select } from '@/components/ui';
import { GREEN, AMBER } from '@/lib/color';
import { DEPARTMENTS, USER_STATUSES, valueOf } from '../users.utils';
import UsersTable from './UsersTable';
import s from './UsersTab.module.css';

const GREY_DOT = 'oklch(0.7 0.01 265)';

/** Users tab: KPI cards (click = status filter), filter bar and the users table. */
export default function UsersTab({ model, now }) {
  const { users, roles, us, counts, shown } = model;
  const setUs = useStore((s) => s.setUs);

  const setStatus = (status) => () => setUs({ tab: 'users', status });
  const kpis = [
    { label: 'All users', value: users.length, sub: `${roles.length} roles`, dot: GREY_DOT, onClick: setStatus(''), status: '' },
    { label: 'Active', value: counts.Active, sub: `${counts.recent} active in last 24h`, dot: GREEN, onClick: setStatus('Active'), status: 'Active' },
    { label: 'Pending invites', value: counts.Invited, sub: 'Not accepted yet', dot: AMBER, onClick: setStatus('Invited'), status: 'Invited' },
    { label: 'Deactivated', value: counts.Deactivated, sub: 'No portal access', dot: GREY_DOT, onClick: setStatus('Deactivated'), status: 'Deactivated' },
  ];

  const roleOptions = useMemo(
    () => [{ value: '', label: 'All roles' }, ...roles.map((r) => ({ value: r.id, label: r.name }))],
    [roles],
  );
  const deptOptions = [{ value: '', label: 'All departments' }, ...DEPARTMENTS.map((d) => ({ value: d, label: d }))];
  const statusOptions = [{ value: '', label: 'All statuses' }, ...USER_STATUSES.map((v) => ({ value: v, label: v }))];
  const hasActive = !!(us.q || us.role || us.dept || us.status);
  const set = (k) => (e) => setUs({ [k]: valueOf(e) });

  return (
    <>
      <KpiGrid min={150}>
        {kpis.map(({ status, ...k }) => (
          <KpiCard key={k.label} {...k} active={!!status && us.status === status} />
        ))}
      </KpiGrid>
      <Toolbar className={s.filters}>
        <SearchInput
          value={us.q || ''}
          onChange={set('q')}
          placeholder="Search name, email or designation"
          className={s.search}
        />
        <Select value={us.role || ''} onChange={set('role')} options={roleOptions} aria-label="Role" compact className={s.select} />
        <Select value={us.dept || ''} onChange={set('dept')} options={deptOptions} aria-label="Department" compact className={s.select} />
        <Select value={us.status || ''} onChange={set('status')} options={statusOptions} aria-label="Status" compact className={s.select} />
        {hasActive && (
          <button type="button" className={s.clear} onClick={() => setUs({ q: '', role: '', dept: '', status: '' })}>
            Clear filters
          </button>
        )}
      </Toolbar>
      <UsersTable rows={shown} model={model} now={now} />
    </>
  );
}
