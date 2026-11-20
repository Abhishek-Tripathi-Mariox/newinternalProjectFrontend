import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store';
import { useNow } from '@/hooks/useNow';
import { Avatar, Button, DataTable, FilterChips, HuePill, KanbanBoard, KanbanCard, SearchInput, SegmentedControl, Select, Tabs, Toolbar } from '@/components/ui';
import { fday, sod } from '@/lib/date';
import { PRIO_HUE, STATUS_HUE, TT_STATUSES, isPreview, tabTest, teamIdsOf, ttPerm, viewerId, visibleTasks } from './model';
import TaskDrawer from './TaskDrawer';
import s from './TeamTasksPage.module.css';

const VIEWS = [['list', 'List'], ['board', 'Board']];
const VIEW_KEY = 'mx.teamTasks.view';
const readView = () => { try { return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list'; } catch { return 'list'; } };
const REL_OPTS = [{ value: '', label: 'Any link' }, { value: 'project', label: 'Project tasks' }, { value: 'lead', label: 'Lead tasks' }, { value: 'none', label: 'General' }];

/** One board card: title, links, due / estimate / priority, assignee, files and comments. */
function BoardCard({ t, me, T, onOpen }) {
  const late = t.due && t.status !== 'Done' && t.due < T;
  return (
    <KanbanCard onClick={onOpen} className={s.card}>
      <div className={s.cardTop}>
        <span className={s.cardId}>{t.id}</span>
        <HuePill hue={PRIO_HUE[t.prio]} size="sm">{t.prio}</HuePill>
      </div>
      <div className={`${s.cardTitle} ${t.status === 'Done' ? s.titleDone : ''}`}>{t.title}</div>
      {(t.p || t.lead) && (
        <div className={s.cardLinks}>
          {t.p && <span className={s.linkChip}>▣ {t.pName || t.p}</span>}
          {t.lead && <span className={s.linkChipLead}>◆ {t.leadName || t.lead}</span>}
        </div>
      )}
      {t.upd && <div className={s.cardUpd}>↳ {t.upd}</div>}
      <div className={s.cardFoot}>
        <span className={s.person} title={`Assigned to ${t.aName}${t.byName ? ` · given by ${t.byName}` : ''}`}>
          <Avatar name={t.aName || '—'} size={20} />
          <span className={s.cardWho}>{t.a === me ? 'Me' : t.aName}</span>
        </span>
        <span className={s.cardMeta}>
          {t.due ? <span className={late ? s.late : undefined}>{late ? '⚠ ' : ''}{fday(t.due)}</span> : null}
          {t.est ? <span>{t.est}h</span> : null}
          {t.atts.length > 0 && <span>📎 {t.atts.length}</span>}
          {t.comments > 0 && <span>💬 {t.comments}</span>}
        </span>
      </div>
    </KanbanCard>
  );
}

/** Name + small avatar ("Me" for the viewer). */
const Person = ({ id, name, me }) => (
  <span className={s.person}>
    <Avatar name={name || '—'} size={22} />
    <span className={s.nowrap}>{id === me ? 'Me' : name || '—'}</span>
  </span>
);

/** /team-tasks — tasks given down the "Reports to" hierarchy; independent of projects. */
export default function TeamTasksPage() {
  const now = useNow(60000);
  const T = sod(now);
  const st = useStore(useShallow((x) => ({ teamTasks: x.teamTasks, users: x.users, roles: x.roles, viewAs: x.viewAs, auth: x.auth, me: x.me })));
  const openModal = useStore((x) => x.openModal);

  const me = viewerId(st);
  // Who added a file: "Me", the assignee (labelled), the person who gave the task, or anyone else by name.
  const uploader = (t, d) => {
    if (!d.by) return d.byName || '';
    if (d.by === me) return t.a === me ? 'me (assignee)' : 'me';
    return d.byName || ((st.users || []).find((u) => u.id === d.by) || {}).name || 'someone else';
  };
  const team = useMemo(() => teamIdsOf(st), [st]);
  const perm = useMemo(() => ttPerm(st), [st]);
  const tasks = useMemo(() => visibleTasks(st), [st]);
  const [tab, setTab] = useState('mine');
  const [status, setStatus] = useState('open');
  const [q, setQ] = useState('');
  const [who, setWho] = useState('');
  const [rel, setRel] = useState('');
  const [sel, setSel] = useState(null); // task id open in the drawer
  const [reopenAs, setReopenAs] = useState(null); // board drag out of Done → drawer asks why
  const [view, setViewState] = useState(readView);
  const setView = (v) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ } };
  const updateTeamTask = useStore((x) => x.updateTeamTask);
  const flash = useStore((x) => x.flash);
  const openTask = (id, reopen = null) => { setReopenAs(reopen); setSel(id); };
  // Board drag: change status; reopening a Done task opens the drawer to ask why.
  const moveTask = (id, to) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    if (!t.canStatus) { flash('Only the assignee or whoever gave this task can change its status.'); return; }
    if (t.status === 'Done') { openTask(id, to); return; }
    if (to === 'Reopened') { flash('Only a Done task can be reopened — drag it from Done.'); return; }
    updateTeamTask(id, { status: to });
  };
  const selTask = sel ? tasks.find((t) => t.id === sel) : null;
  const statusTest = (t) => (status === 'open' ? t.status !== 'Done' : status === 'all' ? true : t.status === status);
  const tabs = useMemo(() => [
    ['mine', 'Assigned to me'], ['given', 'Given by me'], ['team', 'My team'], ['all', 'All'],
  ].map(([key, label]) => {
    const test = tabTest(key, me, team);
    return { key, label, count: tasks.filter((t) => test(t) && t.status !== 'Done').length };
  }), [tasks, me, team]);

  const people = useMemo(() => {
    const m = new Map();
    tasks.forEach((t) => m.set(t.a, t.aName));
    return [{ value: '', label: 'Everyone' }].concat([...m].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })));
  }, [tasks]);

  const rows = useMemo(() => {
    const test = tabTest(tab, me, team);
    const qq = q.trim().toLowerCase();
    const rank = { High: 0, Medium: 1, Low: 2 };
    return tasks
      .filter((t) => test(t) && (view === 'board' || statusTest(t)) && (!who || t.a === who) && (!rel || (rel === 'project' ? t.p : rel === 'lead' ? t.lead : !t.p && !t.lead))
        && (!qq || `${t.title} ${t.notes} ${t.aName} ${t.byName} ${t.pName} ${t.leadName}`.toLowerCase().includes(qq)))
      .sort((a, b) => (a.status === 'Done') - (b.status === 'Done') || (a.due ?? Infinity) - (b.due ?? Infinity) || rank[a.prio] - rank[b.prio] || b.at - a.at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, tab, me, team, status, q, who, rel, view]);

  const counts = useMemo(() => {
    const test = tabTest(tab, me, team);
    const inTab = tasks.filter(test);
    return { open: inTab.filter((t) => t.status !== 'Done').length, ...Object.fromEntries(TT_STATUSES.map((x) => [x, inTab.filter((t) => t.status === x).length])), all: inTab.length };
  }, [tasks, tab, me, team]);

  const columns = [
    {
      key: 'title', label: 'Task', render: (t) => (
        <div className={s.taskCell}>
          <div className={`${s.title} ${t.status === 'Done' ? s.titleDone : ''}`}>{t.title}</div>
          <div className={s.metaLine}>
            {t.p && <span className={s.linkChip}>▣ {t.pName || t.p}</span>}
            {t.lead && <span className={s.linkChipLead}>◆ {t.leadName || t.lead}</span>}
            {t.atts.length > 0 && <span className={s.meta} title="Files">📎 {t.atts.length}</span>}
            {t.comments > 0 && <span className={s.meta} title="Comments">💬 {t.comments}</span>}
            {t.upd && <span className={s.upd} title={t.upd}>↳ {t.upd}</span>}
          </div>
        </div>
      ),
    },
    { key: 'a', label: 'Assigned to', render: (t) => <Person id={t.a} name={t.aName} me={me} /> },
    { key: 'by', label: 'Given by', render: (t) => <Person id={t.by} name={t.byName} me={me} /> },
    {
      key: 'due', label: 'Due', render: (t) => {
        if (!t.due) return <span className={s.muted}>—</span>;
        const late = t.status !== 'Done' && t.due < T;
        return <span className={`${s.nowrap} ${late ? s.late : ''}`}>{fday(t.due)}{late ? ' · overdue' : t.due === T ? ' · today' : ''}</span>;
      },
    },
    { key: 'est', label: 'Est.', align: 'right', render: (t) => (t.est ? <span className={s.nowrap}>{t.est}h</span> : <span className={s.muted}>—</span>) },
    { key: 'prio', label: 'Priority', render: (t) => <HuePill hue={PRIO_HUE[t.prio]} size="sm">{t.prio}</HuePill> },
    { key: 'status', label: 'Status', render: (t) => <HuePill hue={STATUS_HUE[t.status]} size="sm" dot>{t.status}</HuePill> },
    { key: 'go', label: '', align: 'right', render: () => <span className={s.chev} aria-hidden>›</span> },
  ];

  const chips = [
    { key: 'open', label: 'Open', count: counts.open },
    ...TT_STATUSES.map((x) => ({ key: x, label: x, count: counts[x], dot: `oklch(0.62 0.14 ${STATUS_HUE[x]})` })),
    { key: 'all', label: 'All', count: counts.all },
  ];

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.h1}>Team tasks</h1>
          <div className={s.sub}>Give work to people who report to you — separate from project tasks.{isPreview(st) ? ' (Preview)' : ''}</div>
        </div>
        {perm.c && <Button variant="primary" onClick={() => openModal('tt', {})}>+ New task</Button>}
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <Toolbar>
        <SegmentedControl options={VIEWS} value={view} onChange={setView} />
        {view === 'list' && <FilterChips items={chips} value={status} onChange={setStatus} label="Status" />}
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks or people" style={{ flex: '1 1 200px', minWidth: 170 }} />
        <Select value={rel} onChange={(e) => setRel(e.target.value)} options={REL_OPTS} aria-label="Related to" />
        {tab !== 'mine' && <Select value={who} onChange={(e) => setWho(e.target.value)} options={people} aria-label="Assigned to" />}
      </Toolbar>

      {view === 'board' ? (
        <KanbanBoard
          label="Team tasks board"
          minColWidth={300}
          onMove={moveTask}
          renderCard={(t) => <BoardCard t={t} me={me} T={T} onOpen={() => openTask(t.id)} />}
          columns={TT_STATUSES.map((st) => {
            const items = rows.filter((t) => t.status === st);
            const est = items.reduce((x, t) => x + (+t.est || 0), 0);
            return {
              key: st,
              name: st,
              dot: `oklch(0.62 0.14 ${STATUS_HUE[st]})`,
              items,
              meta: est ? `${Math.round(est * 10) / 10}h est.` : null,
              emptyText: st === 'Done' ? 'Drop finished tasks here' : st === 'Reopened' ? 'Drag a Done task here to reopen it' : 'Nothing here',
              ...(st === 'To do' && perm.c ? { onAdd: () => openModal('tt', {}), addLabel: 'New task' } : {}),
            };
          })}
        />
      ) : (
      <DataTable
        itemLabel="tasks"
        columns={columns}
        rows={rows}
        minWidth={900}
        onRowClick={(t) => openTask(t.id)}
        resetKey={`${tab}|${status}|${who}|${q}|${rel}`}
        empty={tab === 'mine' ? 'No tasks assigned to you here.' : tab === 'team' && team.size === 0 ? 'Nobody reports to you yet — set "Reports to" on their user in Users & roles.' : 'No tasks here.'}
      />
      )}
      {selTask && <TaskDrawer key={`${selTask.id}|${reopenAs || ''}`} t={selTask} me={me} T={T} uploader={uploader} reopenAs={reopenAs} onClose={() => { setSel(null); setReopenAs(null); }} />}
    </div>
  );
}
