import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useNow } from '@/hooks/useNow';
import { Button, EmptyState, Pagination, SearchInput, Select, Tabs, Toolbar, usePagination } from '@/components/ui';
import { PRIORITY_NAMES } from '@/config/constants';
import { sod } from '@/lib/date';
import { FU_TABS, TYPE_NAMES, tabTest } from '@/features/followups/model';
import ProjectFollowUpRow, { ProjectFollowUpListHeader } from './ProjectFollowUpRow';
import { EMPTY_PF, filterPfus, hasPfFilters } from './model';
import s from '@/features/followups/FollowUpsPage.module.css';
import ls from '@/features/followups/components/FollowUpList.module.css';

const TYPE_OPTS = [{ value: '', label: 'All types' }, ...TYPE_NAMES.map((t) => ({ value: t, label: t }))];
const PRIO_OPTS = [{ value: '', label: 'All priorities' }, ...PRIORITY_NAMES.map((p) => ({ value: p, label: p }))];

/** /project-follow-ups — client meetings, calls, tasks and reminders across projects. */
export default function ProjectFollowUpsPage() {
  const { projects, members, pfus } = useScoped();
  const openModal = useStore((st) => st.openModal);
  const now = useNow();
  const T = sod(now);
  const [tab, setTab] = useState('today');
  const [f, setF] = useState(EMPTY_PF);
  const on = (k) => (e) => setF((x) => ({ ...x, [k]: e && e.target ? e.target.value : e }));

  const projectsById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const filtered = useMemo(() => filterPfus(pfus || [], f, projectsById), [pfus, f, projectsById]);
  const tabs = useMemo(
    () => FU_TABS.map((t) => ({ key: t.key, label: t.label, count: filtered.filter((x) => t.test(x, T, now)).length, tone: t.key === 'overdue' ? 'red' : undefined })),
    [filtered, T, now],
  );
  const rows = useMemo(() => {
    const test = tabTest(tab);
    return filtered.filter((x) => test(x, T, now)).sort((a, b) => (tab === 'completed' ? b.due - a.due : a.due - b.due));
  }, [filtered, tab, T, now]);
  const pager = usePagination(rows);

  const projOpts = [{ value: '', label: 'All projects' }].concat(projects.map((p) => ({ value: p.id, label: p.name })));
  const ownerOpts = [{ value: '', label: 'All owners' }].concat(members.filter((m) => !m.inactive).map((m) => ({ value: m.id, label: m.name })));

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Project follow-ups</h1>
          <div className={s.sub}>Client meetings, calls, tasks and reminders across your projects</div>
        </div>
        <Button variant="primary" onClick={() => openModal('pfu', { pid: f.project || undefined })}>+ New follow-up</Button>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <Toolbar>
        <SearchInput value={f.q} onChange={on('q')} placeholder="Search title, project or client" style={{ flex: '1 1 200px', minWidth: 170 }} />
        <Select value={f.project} onChange={on('project')} options={projOpts} aria-label="Project" />
        <Select value={f.owner} onChange={on('owner')} options={ownerOpts} aria-label="Owner" />
        <Select value={f.type} onChange={on('type')} options={TYPE_OPTS} aria-label="Type" />
        <Select value={f.priority} onChange={on('priority')} options={PRIO_OPTS} aria-label="Priority" />
        {hasPfFilters(f) && <Button variant="link" onClick={() => setF(EMPTY_PF)}>Clear filters</Button>}
      </Toolbar>

      <div className={ls.card}>
        <div className={ls.inner} role="table">
          <ProjectFollowUpListHeader />
          {pager.pageItems.map((x) => <ProjectFollowUpRow key={x.id} fu={x} project={projectsById[x.p]} members={members} now={now} />)}
        </div>
        {rows.length === 0 && <EmptyState title="No project follow-ups here." />}
        <Pagination {...pager} label="follow-ups" />
      </div>
    </div>
  );
}
