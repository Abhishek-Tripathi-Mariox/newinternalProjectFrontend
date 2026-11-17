import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store';
import { useNow } from '@/hooks/useNow';
import { Button, ConfirmButton, DataTable, DocumentList, FilterChips, HuePill, SearchInput, Select, Tabs, Toolbar } from '@/components/ui';
import { fday, sod } from '@/lib/date';
import { PRIO_HUE, STATUS_HUE, TT_STATUSES, isPreview, tabTest, teamIdsOf, viewerId, visibleTasks } from './model';
import s from './TeamTasksPage.module.css';

const STATUS_OPTS = TT_STATUSES.map((x) => ({ value: x, label: x }));
const REL_OPTS = [{ value: '', label: 'Any link' }, { value: 'project', label: 'Project tasks' }, { value: 'lead', label: 'Lead tasks' }, { value: 'none', label: 'General' }];

/** Progress note editor for the assignee (saved on blur). */
function ProgressNote({ t, onSave }) {
  const [v, setV] = useState(t.upd);
  if (!t.canStatus) return t.upd ? <div className={s.upd}>↳ {t.upd}</div> : null;
  return (
    <input
      className={s.updInput}
      value={v}
      placeholder="Add a progress note…"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== t.upd) onSave(v); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      aria-label={`Progress note for ${t.title}`}
    />
  );
}

/** /team-tasks — tasks given down the "Reports to" hierarchy; independent of projects. */
export default function TeamTasksPage() {
  const now = useNow(60000);
  const T = sod(now);
  const st = useStore(useShallow((x) => ({ teamTasks: x.teamTasks, users: x.users, roles: x.roles, viewAs: x.viewAs, auth: x.auth, me: x.me })));
  const openModal = useStore((x) => x.openModal);
  const updateTeamTask = useStore((x) => x.updateTeamTask);
  const delTeamTask = useStore((x) => x.delTeamTask);
  const attachTeamTask = useStore((x) => x.attachTeamTask);
  const [showFiles, setShowFiles] = useState(null);
  const setPj = useStore((x) => x.setPj);
  const selectLead = useStore((x) => x.selectLead);

  const me = viewerId(st);
  const team = useMemo(() => teamIdsOf(st), [st]);
  const tasks = useMemo(() => visibleTasks(st), [st]);
  const [tab, setTab] = useState('mine');
  const [status, setStatus] = useState('open');
  const [q, setQ] = useState('');
  const [who, setWho] = useState('');
  const [rel, setRel] = useState('');

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
      .filter((t) => test(t) && statusTest(t) && (!who || t.a === who) && (!rel || (rel === 'project' ? t.p : rel === 'lead' ? t.lead : !t.p && !t.lead))
        && (!qq || `${t.title} ${t.notes} ${t.aName} ${t.byName} ${t.pName} ${t.leadName}`.toLowerCase().includes(qq)))
      .sort((a, b) => (a.status === 'Done') - (b.status === 'Done') || (a.due ?? Infinity) - (b.due ?? Infinity) || rank[a.prio] - rank[b.prio] || b.at - a.at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, tab, me, team, status, q, who, rel]);

  const counts = useMemo(() => {
    const test = tabTest(tab, me, team);
    const inTab = tasks.filter(test);
    return { open: inTab.filter((t) => t.status !== 'Done').length, ...Object.fromEntries(TT_STATUSES.map((x) => [x, inTab.filter((t) => t.status === x).length])), all: inTab.length };
  }, [tasks, tab, me, team]);

  const columns = [
    {
      key: 'title', label: 'Task', render: (t) => (
        <div className={s.taskCell}>
          <div className={s.title} style={t.status === 'Done' ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{t.title}</div>
          {(t.p || t.lead) && (
            <div className={s.links}>
              {t.p && <button type="button" className={s.linkChip} onClick={() => setPj({ selP: t.p, selM: null, exp: null, exp2: null })} title="Open project">▣ {t.pName || t.p}</button>}
              {t.lead && <button type="button" className={s.linkChipLead} onClick={() => selectLead(t.lead)} title="Open lead">◆ {t.leadName || t.lead}</button>}
            </div>
          )}
          {t.notes && <div className={s.notes}>{t.notes}</div>}
          {t.atts.length > 0 && (
            <button type="button" className={s.filesBtn} onClick={() => setShowFiles(showFiles === t.id ? null : t.id)} aria-expanded={showFiles === t.id}>
              📎 {t.atts.length} file{t.atts.length === 1 ? '' : 's'} {showFiles === t.id ? '▴' : '▾'}
            </button>
          )}
          {showFiles === t.id && <DocumentList docs={t.atts} editable={false} />}
          <ProgressNote key={`${t.id}-${t.upd}`} t={t} onSave={(v) => updateTeamTask(t.id, { upd: v })} />
        </div>
      ),
    },
    { key: 'a', label: 'Assigned to', render: (t) => <span className={s.nowrap}>{t.a === me ? 'Me' : t.aName}</span> },
    { key: 'by', label: 'Given by', render: (t) => <span className={s.nowrap}>{t.by === me ? 'Me' : t.byName || '—'}</span> },
    {
      key: 'due', label: 'Due', render: (t) => {
        if (!t.due) return <span className={s.muted}>—</span>;
        const late = t.status !== 'Done' && t.due < T;
        return <span className={s.nowrap} style={late ? { color: 'var(--red, oklch(0.55 0.2 25))', fontWeight: 600 } : undefined}>{fday(t.due)}{late ? ' · overdue' : t.due === T ? ' · today' : ''}</span>;
      },
    },
    { key: 'prio', label: 'Priority', render: (t) => <HuePill hue={PRIO_HUE[t.prio]} size="sm">{t.prio}</HuePill> },
    {
      key: 'status', label: 'Status', render: (t) => (t.canStatus
        ? <Select compact value={t.status} options={STATUS_OPTS} onChange={(e) => updateTeamTask(t.id, { status: e.target.value })} aria-label={`Status of ${t.title}`} />
        : <HuePill hue={STATUS_HUE[t.status]} size="sm" dot>{t.status}</HuePill>),
    },
    {
      key: 'act', label: '', align: 'right', render: (t) => (
        <div className={s.actions}>
          {t.canEdit && (
            <label className={s.attachBtn} title="Attach files">
              📎
              <input type="file" multiple hidden onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) attachTeamTask(t.id, f.slice(0, 10)); }} />
            </label>
          )}
          {t.canEdit && <Button size="sm" variant="secondary" onClick={() => openModal('tt', { editId: t.id })}>Edit</Button>}
          {t.canDelete && <ConfirmButton size="sm" onConfirm={() => delTeamTask(t.id)} confirmLabel="Delete?">Delete</ConfirmButton>}
        </div>
      ),
    },
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
        <Button variant="primary" onClick={() => openModal('tt', {})}>+ New task</Button>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <Toolbar>
        <FilterChips items={chips} value={status} onChange={setStatus} label="Status" />
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks or people" style={{ flex: '1 1 200px', minWidth: 170 }} />
        <Select value={rel} onChange={(e) => setRel(e.target.value)} options={REL_OPTS} aria-label="Related to" />
        {tab !== 'mine' && <Select value={who} onChange={(e) => setWho(e.target.value)} options={people} aria-label="Assigned to" />}
      </Toolbar>

      <DataTable
        itemLabel="tasks"
        columns={columns}
        rows={rows}
        minWidth={960}
        resetKey={`${tab}|${status}|${who}|${q}|${rel}`}
        empty={tab === 'mine' ? 'No tasks assigned to you here.' : tab === 'team' && team.size === 0 ? 'Nobody reports to you yet — set "Reports to" on their user in Users & roles.' : 'No tasks here.'}
      />
    </div>
  );
}
