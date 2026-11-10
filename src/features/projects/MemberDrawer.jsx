import { useMemo } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { Avatar, Button, Drawer, ProgressBar, StatGrid } from '@/components/ui';
import { INK, MUTED, RED, barColor, projectColor, tone } from '@/lib/color';
import { DAY, NOON, fday, longDay, parseDay, sod, workdaysSoFar, ymd } from '@/lib/date';
import { hh, pctW } from '@/lib/format';
import { PROJECT_STATUS } from '@/config/constants';
import TaskCard from './components/TaskCard';
import BugCard from './components/BugCard';
import { bugSort, isBugOpen, isBugOverdue, isTaskOpen, isTaskOverdue, taskSort } from './workItems';
import { ACTIVE_STATUSES } from './lib/view';
import { memberProjectDetail } from './lib/logs';
import s from './MemberDrawer.module.css';

const STATUS_ORDER = Object.keys(PROJECT_STATUS);

/** Day health: [label, hue]. */
function dayHealth(dt, sh, day, T) {
  if (dt === 0) return new Date(day).getDay() === 0 ? ['Weekly off', 265] : day > T ? ['Upcoming', 265] : ['Not submitted', 25];
  if (dt < sh) return [`Short by ${hh(sh - dt)}`, 70];
  if (dt === sh) return ['Full shift', 150];
  return [`Overtime +${hh(dt - sh)}`, 300];
}

/** Member drawer (reads pj.selM): stats, daily breakup, tasks, bugs, allocation by project, 14-day history. */
export default function MemberDrawer() {
  const pj = useStore((st) => st.pj);
  const setPj = useStore((st) => st.setPj);
  const openModal = useStore((st) => st.openModal);
  const scoped = useScoped();
  const { T, MEM, PRJ, MSS, msOf, g, wk } = useProjectsModel();
  const sm = MEM[pj.selM];
  const day = pj.mDay || T;

  const d = useMemo(() => {
    if (!sm) return null;
    const logs = scoped.logs || [];
    const sh = sm.shift || 8;
    const H = g(`m:${sm.id}`);
    const wdW = workdaysSoFar(wk[0], wk[1]);
    const dl = logs.filter((l) => l.m === sm.id && l.d === day);
    const dt = dl.reduce((x, l) => x + l.h, 0);
    const ap = scoped.projects.filter((p) => p.team.includes(sm.id)).sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
    const act = ap.filter((p) => ACTIVE_STATUSES.includes(p.status));
    const al = act.reduce((x, p) => x + (+p.alloc[sm.id] || 0), 0);
    const tk = act.reduce((x, p) => x + g(`pm:${p.id}:${sm.id}`).all, 0);
    const days = Array.from({ length: 14 }, (_, i) => sod(T - i * DAY + NOON));
    const yd = sod(T - DAY + NOON);
    const dayMax = Math.max(10, ...days.map((x) => g(`d:${sm.id}:${x}`).all));
    const used = new Set();
    const hist = days.map((x) => {
      const L = logs.filter((l) => l.m === sm.id && l.d === x);
      const t = L.reduce((a, l) => a + l.h, 0);
      const sun = new Date(x).getDay() === 0;
      const by = {};
      L.forEach((l) => { by[l.p] = (by[l.p] || 0) + l.h; used.add(l.p); });
      return {
        d: x,
        label: x === T ? 'Today' : x === yd ? 'Yesterday' : fday(x),
        sun,
        total: t ? hh(t) : sun ? 'Off' : '—',
        totalColor: !t && !sun && x < T ? RED : t > sh ? 'oklch(0.5 0.15 300)' : INK,
        segs: Object.keys(by).map((pid) => ({ pid, w: pctW(by[pid] / dayMax), bg: projectColor(PRJ[pid]), tip: `${(PRJ[pid] || {}).name || ''} · ${hh(by[pid])}` })),
      };
    });
    const tasks = (scoped.tasks || []).filter((t) => t.a === sm.id && isTaskOpen(t)).sort(taskSort);
    const bugs = (scoped.bugs || []).filter((b) => b.a === sm.id && isBugOpen(b)).sort(bugSort);
    return {
      sh, dl, dt, ap, al, tk, hist,
      health: dayHealth(dt, sh, day, T),
      stats: [
        { label: 'Today', value: hh(H.today), sub: `of ${sh}h`, color: INK },
        { label: 'Yesterday', value: hh(H.yest), sub: '', color: INK },
        { label: 'This week', value: hh(H.week), sub: `of ${hh(sh * wdW)}`, color: INK },
        { label: 'This month', value: hh(H.month), sub: '', color: INK },
        { label: 'All time', value: hh(H.all), sub: '', color: INK },
      ],
      legend: Array.from(used).map((pid) => ({ pid, name: (PRJ[pid] || {}).name, color: projectColor(PRJ[pid]) })),
      tasks,
      taskSum: `${tasks.length} open · ${tasks.filter((t) => isTaskOverdue(t, T)).length} overdue`,
      bugs,
      bugSum: `${bugs.length} open · ${bugs.filter((b) => isBugOverdue(b, T)).length} overdue`,
    };
  }, [sm, scoped, g, wk, day, T, PRJ]);

  if (!sm || !d) return null;

  const close = () => setPj({ selM: null, mDay: null });
  const setDay = (v) => setPj({ mDay: v });
  const shift = (n) => () => setDay(sod(day + n * DAY + NOON));
  const openP = (pid, exp) => setPj({ selP: pid, selM: null, exp: exp || null, exp2: null, pDay: null });
  const shiftLabel = `${d.sh}h shift`;

  const header = (
    <div className={s.head}>
      <Avatar name={sm.name} h={sm.h} size={44} />
      <div style={{ minWidth: 0 }}>
        <h2 className={s.name}>{sm.name}</h2>
        <div className={s.sub}>{sm.role} · {sm.team} team · {shiftLabel}</div>
      </div>
    </div>
  );

  return (
    <Drawer
      open
      onClose={close}
      width={680}
      header={header}
      label={sm.name}
      actions={<Button size="sm" onClick={() => openModal('log', { member: sm.id, date: day })}>+ Log hours</Button>}
    >
      <div className={s.body}>
        <StatGrid items={d.stats} min={110} />

        <section className={s.box}>
          <div className={s.boxHead}>
            <div><h3 className={s.h3}>Daily breakup</h3><div className={s.muted} style={{ marginTop: 2 }}>{longDay(day)}</div></div>
            <div className={s.dayNav}>
              <button type="button" className={s.navBtn} title="Previous day" onClick={shift(-1)}>‹</button>
              <input type="date" className={s.dateInput} value={ymd(day)} onChange={(e) => { const v = parseDay(e.target.value); if (v) setDay(v); }} />
              <button type="button" className={s.navBtn} title="Next day" onClick={shift(1)}>›</button>
            </div>
          </div>
          {d.dl.map((l) => {
            const p = PRJ[l.p];
            return (
              <div key={l.id} className={s.dayRow}>
                <button type="button" className={s.plain} onClick={() => openP(l.p)}>
                  <div className={s.projName}><span className={s.sq} style={{ background: projectColor(p) }} />{p ? p.name : '—'}</div>
                  <div className={s.projSub}>{(MSS[l.ms] || {}).name || '—'} · {l.note || '—'}</div>
                </button>
                <ProgressBar width={pctW(l.h / d.sh)} color={projectColor(p)} />
                <span className={s.hours}>{hh(l.h)}</span>
              </div>
            );
          })}
          {d.dl.length === 0 && <div className={s.dayEmpty}>No hours logged on this day.</div>}
          <div className={s.dayFoot}>
            <span><span style={{ fontWeight: 700 }}>{hh(d.dt)}</span> <span style={{ color: MUTED }}>of {shiftLabel}</span></span>
            <span className={s.health} style={{ background: `oklch(0.95 0.04 ${d.health[1]})`, color: `oklch(0.45 0.14 ${d.health[1]})` }}>{d.health[0]}</span>
          </div>
        </section>

        <section>
          <div className={s.secHead}><h3 className={s.h3}>Assigned tasks</h3><span className={s.muted}>{d.taskSum}</span></div>
          {d.tasks.map((t) => <TaskCard key={t.id} task={t} compact />)}
          {d.tasks.length === 0 && <div className={s.none}>No open tasks assigned.</div>}
        </section>

        <section>
          <div className={s.secHead}><h3 className={s.h3}>Assigned bugs</h3><span className={s.muted}>{d.bugSum}</span></div>
          {d.bugs.map((b) => <BugCard key={b.id} bug={b} compact />)}
          {d.bugs.length === 0 && <div className={s.none}>No open bugs assigned.</div>}
        </section>

        <section>
          <h3 className={s.h3} style={{ marginBottom: 6 }}>Allocated vs taken, by project</h3>
          <div className={s.scroll}>
            <div className={s.allocTable}>
              <div className={`${s.grid} ${s.gridHead}`}>
                <span>Project</span><span>Status</span><span className={s.right}>Allocated</span><span className={s.right}>Taken</span><span>Remaining</span><span />
              </div>
              {d.ap.map((p) => (
                <AllocRow
                  key={p.id}
                  p={p}
                  mid={sm.id}
                  g={g}
                  isOpen={pj.exp === `mp:${p.id}`}
                  onToggle={() => setPj({ exp: pj.exp === `mp:${p.id}` ? null : `mp:${p.id}` })}
                  onOpen={() => openP(p.id, `pm:${sm.id}`)}
                  detail={pj.exp === `mp:${p.id}` ? memberProjectDetail(scoped.logs || [], msOf[p.id], p.id, sm.id) : null}
                />
              ))}
              <div className={`${s.grid} ${s.allocFoot}`}>
                <span style={{ fontWeight: 600 }}>Active projects total</span>
                <span />
                <span className={s.right} style={{ fontWeight: 600 }}>{hh(d.al)}</span>
                <span className={s.right} style={{ fontWeight: 700 }}>{hh(d.tk)}</span>
                <span style={{ fontSize: 12, color: d.tk > d.al ? RED : MUTED, gridColumn: 'span 2' }}>
                  {d.al ? `${Math.round(d.tk / d.al * 100)}% of allocation used` : ''}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className={s.secHead}><h3 className={s.h3}>Last 14 days</h3><span className={s.muted}>Click a day to see its breakup</span></div>
          {d.hist.map((h) => {
            const sel = h.d === day;
            return (
              <button key={h.d} type="button" className={s.hist} style={sel ? { background: 'oklch(0.96 0.02 265)' } : undefined} onClick={() => setDay(h.d)}>
                <span style={{ fontSize: 12.5, fontWeight: sel ? 700 : 500, color: h.sun ? MUTED : INK }}>{h.label}</span>
                <span className={s.histBar}>
                  {h.segs.map((sg) => <span key={sg.pid} className={s.histSeg} title={sg.tip} style={{ width: sg.w, background: sg.bg }} />)}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, textAlign: 'right', color: h.totalColor }}>{h.total}</span>
              </button>
            );
          })}
          <div className={s.legend}>
            {d.legend.map((l) => (
              <span key={l.pid} className={s.legendItem}><span className={s.sq} style={{ background: l.color }} />{l.name}</span>
            ))}
          </div>
        </section>
      </div>
    </Drawer>
  );
}

/** One project row in the allocation table with its expandable by-date detail. */
function AllocRow({ p, mid, g, isOpen, onToggle, onOpen, detail }) {
  const a = +p.alloc[mid] || 0;
  const t = g(`pm:${p.id}:${mid}`).all;
  const r = a - t;
  const u = a ? t / a : 0;
  const st = tone(PROJECT_STATUS[p.status] ?? 265);
  return (
    <div className={s.allocItem}>
      <div className={`${s.grid} ${s.allocRow}`}>
        <button type="button" className={s.projBtn} title="Open project" onClick={onOpen}>
          <span className={s.sq} style={{ background: projectColor(p) }} />{p.name}
        </button>
        <span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 12, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', background: st.bg, color: st.fg }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot }} />{p.status}
          </span>
        </span>
        <span className={s.right}>{hh(a)}</span>
        <span className={s.right} style={{ fontWeight: 600 }}>{hh(t)}</span>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4, color: r < 0 ? RED : MUTED }}>{r >= 0 ? `${hh(r)} left` : `${hh(-r)} over`}</div>
          <ProgressBar width={pctW(u)} color={barColor(u)} />
        </div>
        <button type="button" className={s.toggle} style={{ background: isOpen ? 'oklch(0.95 0.03 265)' : '#fff' }} onClick={onToggle}>
          {isOpen ? 'Hide ▴' : 'By date ▾'}
        </button>
      </div>
      {isOpen && detail && (
        <div className={s.detailWrap}>
          <div className={s.detail}>
            <div className={s.muted}>{detail.sum}</div>
            {detail.groups.map((gr) => (
              <div key={gr.id}>
                <div className={s.groupHead}><span>{gr.name}</span><span>{gr.total} <span style={{ fontWeight: 400, color: MUTED }}>· {gr.days}</span></span></div>
                {gr.rows.map((e) => (
                  <div key={e.id} className={s.entry}>
                    <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{e.date}</span>
                    <span className={s.ellipsis}>{e.note}</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{e.h}</span>
                  </div>
                ))}
              </div>
            ))}
            {detail.empty && <div className={s.muted}>No hours logged yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
