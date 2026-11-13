import { memo, useMemo } from 'react';
import { Button, Input, SearchInput, Select, Toolbar } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { PROJECT_PERIOD_PRESETS, TEAMS } from '@/config/constants';
import { DEFAULT_PROJECT_FILTER, STATUS_KEYS, val } from './lib/view';
import { PROJECT_DUE_PRESETS, PROJECT_START_PRESETS } from '@/domain/projects';
import s from './ProjectsPage.module.css';

const withAll = (label, list) => [{ value: '', label }, ...list];

/** Shared filter bar above every Projects tab (search, period, status, team, member, project). */
function ProjectFilters() {
  const f = useStore((st) => st.pj.f);
  const setPjF = useStore((st) => st.setPjF);
  const setPj = useStore((st) => st.setPj);
  const { members, projects } = useScoped();

  const opts = useMemo(
    () => ({
      period: PROJECT_PERIOD_PRESETS.map(([value, label]) => ({ value, label })),
      start: PROJECT_START_PRESETS.map(([value, label]) => ({ value, label })),
      due: PROJECT_DUE_PRESETS.map(([value, label]) => ({ value, label })),
      status: withAll('All statuses', STATUS_KEYS.map((k) => ({ value: k, label: k }))),
      team: withAll('All teams', TEAMS.map((t) => ({ value: t, label: t }))),
      member: withAll('All members', members.map((m) => ({ value: m.id, label: m.name }))),
      project: withAll('All projects', projects.map((p) => ({ value: p.id, label: p.name }))),
    }),
    [members, projects],
  );

  const set = (k) => (e) => setPjF({ [k]: val(e) });
  const nAct = ['q', 'status', 'team', 'member', 'project', 'start', 'due'].filter((k) => f[k]).length + (f.date !== 'week' ? 1 : 0);

  return (
    <Toolbar>
      <SearchInput className={s.search} value={f.q} onChange={set('q')} placeholder="Search project, client or member" />
      <Select compact inline value={f.date} onChange={set('date')} title="Hours period" options={opts.period} />
      {f.date === 'custom' && (
        <>
          <Input compact inline type="date" value={f.from} onChange={set('from')} />
          <Input compact inline type="date" value={f.to} onChange={set('to')} />
        </>
      )}
      <Select compact inline value={f.status} onChange={set('status')} options={opts.status} />
      <Select compact inline value={f.team} onChange={set('team')} options={opts.team} />
      <Select compact inline value={f.member} onChange={set('member')} options={opts.member} />
      <Select compact inline value={f.project} onChange={set('project')} options={opts.project} />
      <Select compact inline value={f.start || ''} onChange={set('start')} title="When the project started (onboarded)" aria-label="Onboarded" options={opts.start} />
      {f.start === 'custom' && (
        <>
          <Input compact inline type="date" aria-label="Onboarded from" value={f.startFrom || ''} onChange={set('startFrom')} />
          <Input compact inline type="date" aria-label="Onboarded to" value={f.startTo || ''} onChange={set('startTo')} />
        </>
      )}
      <Select compact inline value={f.due || ''} onChange={set('due')} title="Project due date" aria-label="Due" options={opts.due} />
      {f.due === 'custom' && (
        <>
          <Input compact inline type="date" aria-label="Due from" value={f.dueFrom || ''} onChange={set('dueFrom')} />
          <Input compact inline type="date" aria-label="Due to" value={f.dueTo || ''} onChange={set('dueTo')} />
        </>
      )}
      {nAct > 0 && (
        <Button variant="link" onClick={() => setPj({ f: { ...DEFAULT_PROJECT_FILTER } })}>
          Clear filters
        </Button>
      )}
    </Toolbar>
  );
}

export default memo(ProjectFilters);
