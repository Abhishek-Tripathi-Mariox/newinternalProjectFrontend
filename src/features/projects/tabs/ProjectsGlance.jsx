import { useMemo, useState } from 'react';
import { DataTable, FilterChips } from '@/components/ui';
import { projectColor, tone } from '@/lib/color';
import { fd } from '@/lib/date';
import { hh, pctW } from '@/lib/format';
import { MILESTONE_STATUS, PROJECT_STATUS } from '@/config/constants';
import { HealthPill } from '../components/bits';
import { nextSort, sortProjectRows } from '../lib/projectSort';
import s from './ProjectsGlance.module.css';

const ORDER = { Running: 0, 'On hold': 1, Planning: 2, Completed: 3, Cancelled: 4 };
const VIEWS = [['active', 'Active'], ['all', 'All']];

/** One person on a project: name, ★ primary, hours logged / allocated. */
function Person({ id, name, primary, pm, logged, alloc, onOpen }) {
  return (
    <button type="button" className={s.person} onClick={(e) => { e.stopPropagation(); onOpen(id); }} title="Open member">
      <span className={s.pName}>{name}{primary ? ' ★' : ''}</span>
      {pm && <span className={s.pmTag}>PM</span>}
      <span className={s.pHours}>{hh(logged)}{alloc ? ` / ${hh(alloc)}` : ''}</span>
    </button>
  );
}

/**
 * Overview → every project in one table: status (+ hold reason), PM and team (who is on what,
 * hours logged / allocated, ★ primary), current milestone with its people, progress, hours vs
 * budget, dates, open tasks / bugs and health.
 */
export default function ProjectsGlance({ model, tasks, bugs, openProject, openMember }) {
  const [view, setView] = useState('active');
  const [sort, setSort] = useState(null); // {k, d} — header click; default: status, then due date
  const { pF, info, MEM, g, periodLabel } = model;

  const rows = useMemo(() => pF
    .filter((p) => view === 'all' || !['Completed', 'Cancelled'].includes(p.status))
    .map((p) => {
      const I = info(p);
      const done = I.ms.filter((m) => m.status === 'Done').length;
      const people = (p.team || []).map((id) => ({
        id,
        name: (MEM[id] || {}).name || id,
        primary: (p.primary || []).includes(id),
        pm: id === p.pm,
        logged: g(`pm:${p.id}:${id}`).all,
        alloc: +(p.alloc || {})[id] || 0,
      }));
      const openT = (tasks || []).filter((t) => t.p === p.id && t.st !== 'Done').length;
      const openB = (bugs || []).filter((b) => b.p === p.id && !['Closed', 'Fixed'].includes(b.st)).length;
      // Where the hours went: per milestone (all time), plus hours logged without a milestone.
      const byMs = I.ms.map((m) => ({ id: m.id, n: m.n, name: m.name, h: g(`ms:${m.id}`).all })).filter((x) => x.h > 0);
      const noMs = Math.max(0, I.used - byMs.reduce((x, m) => x + m.h, 0));
      const period = g(`p:${p.id}`);
      return { id: p.id, p, I, done, people, openT, openB, byMs, noMs, period };
    })
    .sort((a, b) => (ORDER[a.p.status] ?? 9) - (ORDER[b.p.status] ?? 9) || (a.p.due || 0) - (b.p.due || 0)),
  [pF, info, MEM, g, tasks, bugs, view]);
  const sorted = useMemo(() => sortProjectRows(rows, sort), [rows, sort]);

  const columns = [
    {
      key: 'name', label: 'Project', sortable: true, render: ({ p, I }) => (
        <div className={s.projCell}>
          <div className={s.projName}><span className={s.sq} style={{ background: projectColor(p) }} />{p.name}</div>
          <div className={s.sub}>{p.client}{p.service ? ` · ${p.service}` : ''}</div>
          <span className={s.status} style={{ background: I.st.bg, color: I.st.fg }}>{p.status}</span>
          {p.status === 'On hold' && (p.statusReason || p.statusNote) && (
            <div className={s.hold} title={p.statusNote}>{p.statusReason || 'On hold'}{p.statusNote ? ` — ${p.statusNote}` : ''}</div>
          )}
        </div>
      ),
    },
    {
      key: 'team', label: 'Team · logged / allocated', render: ({ people }) => (
        <div className={s.team}>
          {people.length ? people.map((x) => <Person key={x.id} {...x} onOpen={openMember} />) : <span className={s.muted}>No team yet</span>}
        </div>
      ),
    },
    {
      key: 'ms', label: 'Current milestone', render: ({ I, done }) => {
        const m = I.curM;
        if (!I.ms.length) return <span className={s.muted}>No milestones</span>;
        if (!m) return <span className={s.sub}>All {I.ms.length} done</span>;
        const t = tone(MILESTONE_STATUS[m.status] ?? 265);
        const who = (m.team || []).map((id) => `${(MEM[id] || {}).name || id}${(m.teamHours || {})[id] ? ` ${hh(m.teamHours[id])}` : ''}`);
        return (
          <div className={s.msCell}>
            <div className={s.msName}>{m.n}. {m.name}</div>
            <div className={s.sub}>
              <span className={s.msStatus} style={{ background: t.bg, color: t.fg }}>{m.status}</span>
              {m.due ? ` due ${fd(m.due)}` : ''}
            </div>
            <div className={s.sub}>{who.length ? `On it: ${who.join(', ')}` : 'Nobody assigned'}</div>
            <div className={s.sub}>{done} of {I.ms.length} milestones done</div>
          </div>
        );
      },
    },
    {
      key: 'hours', label: 'Hours · where they went', sortable: true, render: ({ I, byMs, noMs, period }) => (
        <div className={s.hoursCell}>
          <div><b>{hh(I.used)}</b> <span className={s.muted}>total / {I.budget ? hh(I.budget) : 'no budget'}</span></div>
          <div className={s.bar}><span style={{ width: pctW(Math.min(1, I.pct)), background: I.pct > 1 ? 'oklch(0.6 0.19 25)' : I.pct > 0.85 ? 'oklch(0.72 0.15 70)' : 'oklch(0.6 0.14 150)' }} /></div>
          <div className={s.sub}>{I.budget ? (I.used > I.budget ? `${hh(I.used - I.budget)} over` : `${hh(I.budget - I.used)} left`) : ''}</div>
          <div className={s.sub}>{periodLabel}: <b className={s.ink}>{hh(period.range)}</b> · today {hh(period.today)}</div>
          {(byMs.length > 0 || noMs > 0) && (
            <div className={s.split}>
              {byMs.map((m) => (
                <div key={m.id} className={s.splitRow} title={`${m.n}. ${m.name}`}>
                  <span className={s.splitName}>{m.n}. {m.name}</span><span className={s.splitH}>{hh(m.h)}</span>
                </div>
              ))}
              {noMs > 0 && <div className={s.splitRow}><span className={s.splitName}>No milestone</span><span className={s.splitH}>{hh(noMs)}</span></div>}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'dates', label: 'Dates (due)', sortable: true, render: ({ p, I }) => (
        <div className={s.nowrap}>
          <div className={s.sub}>Onboarded {p.start ? fd(p.start) : '—'}</div>
          <div style={{ color: I.dueColor, fontWeight: 600 }}>Due {I.dueLabel}</div>
          <div className={s.sub}>{I.dueSub}</div>
        </div>
      ),
    },
    {
      key: 'exp', label: 'Expected delivery', sortable: true, render: ({ I }) => (I.expLabel ? (
        <div className={s.nowrap}>
          <div style={{ color: I.expColor, fontWeight: 600 }}>{I.expLabel}</div>
          <div className={s.sub}>{I.expSub}</div>
        </div>
      ) : <span className={s.sub}>—</span>),
    },
    {
      key: 'work', label: 'Open', align: 'right', render: ({ openT, openB }) => (
        <div className={s.nowrap} style={{ textAlign: 'right' }}>
          <div>{openT} task{openT === 1 ? '' : 's'}</div>
          <div className={openB ? s.bugs : s.sub}>{openB} bug{openB === 1 ? '' : 's'}</div>
        </div>
      ),
    },
    {
      key: 'health', label: 'Health', sortable: true, render: ({ I }) => (
        <div title={I.why.join(' · ')}><HealthPill bg={I.hBg} fg={I.hFg}>{I.hLabel}</HealthPill></div>
      ),
    },
  ];

  return (
    <section className={s.wrap}>
      <div className={s.head}>
        <div>
          <h2 className={s.h2}>Projects at a glance</h2>
          <div className={s.sub}>Who is on which project, current milestone, hours and health — click a row to open the project.</div>
        </div>
        <FilterChips
          items={VIEWS.map(([key, label]) => ({ key, label, count: key === 'all' ? pF.length : pF.filter((p) => !['Completed', 'Cancelled'].includes(p.status)).length }))}
          value={view}
          onChange={setView}
          label="Which projects"
        />
      </div>
      <DataTable
        itemLabel="projects"
        columns={columns.map((c) => ({ ...c, tdStyle: { verticalAlign: 'top' } }))}
        rows={sorted}
        sort={sort}
        onSort={(k) => setSort((x) => nextSort(x, k))}
        minWidth={1360}
        onRowClick={(r) => openProject(r.id)}
        resetKey={view}
        empty="No projects match these filters."
      />
    </section>
  );
}
