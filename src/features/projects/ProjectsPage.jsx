import { useMemo } from 'react';
import { Tabs } from '@/components/ui';
import { useStore } from '@/store';
import { useCan } from '@/hooks/useCan';
import { useScoped } from '@/hooks/useScoped';
import { MODULE_OF_TAB } from '@/domain/permissions';
import { hh } from '@/lib/format';
import ProjectFilters from './ProjectFilters';
import { useProjectsSummary } from './hooks/useProjectsSummary';
import OverviewTab from './tabs/OverviewTab';
import ProjectsTab from './tabs/ProjectsTab';
import MilestonesTab from './tabs/MilestonesTab';
import TasksTab from './tabs/TasksTab';
import BugsTab from './tabs/BugsTab';
import TeamTab from './tabs/TeamTab';
import CapacityTab from './tabs/CapacityTab';
import ChangeRequestsTab from './tabs/ChangeRequestsTab';
import TimesheetsTab from './tabs/TimesheetsTab';
import s from './ProjectsPage.module.css';

/** [key, label, body] in the original tab order. Counts come from useProjectsSummary. */
const TAB_DEFS = [
  ['overview', 'Overview', OverviewTab],
  ['projects', 'Projects', ProjectsTab],
  ['milestones', 'Milestones', MilestonesTab],
  ['tasks', 'Tasks', TasksTab],
  ['bugs', 'Bugs', BugsTab],
  ['team', 'Team & hours', TeamTab],
  ['cap', 'Capacity', CapacityTab],
  ['cr', 'Change requests', ChangeRequestsTab],
  ['ts', 'Timesheets', TimesheetsTab],
];

export default function ProjectsPage() {
  const tab = useStore((st) => st.pj.tab);
  const f = useStore((st) => st.pj.f);
  const setPj = useStore((st) => st.setPj);
  const can = useCan();
  const { members } = useScoped();
  const { counts, tH, running } = useProjectsSummary();

  const allowed = useMemo(() => TAB_DEFS.filter(([k]) => can(MODULE_OF_TAB[k], 'v')), [can]);
  const tabs = allowed.map(([key, label]) => (counts[key] != null ? { key, label, count: counts[key] } : { key, label }));
  const active = allowed.find(([k]) => k === tab) || allowed[0];
  const Body = active ? active[2] : null;

  const memberName = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

  const scopeNote = f.member
    ? `Project hours below show ${(memberName[f.member] || {}).name}’s time only.`
    : f.team
      ? `Project hours below show the ${f.team} team’s time only.`
      : '';

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Projects</h1>
          <div className={s.summary}>
            {counts.projects} projects · {running} running · {hh(tH)} logged today
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} value={active ? active[0] : tab} onChange={(k) => setPj({ tab: k })} />

      <ProjectFilters />
      {!!scopeNote && tab !== 'team' && <div className={s.scopeNote}>{scopeNote}</div>}

      {Body && <Body />}
    </div>
  );
}
