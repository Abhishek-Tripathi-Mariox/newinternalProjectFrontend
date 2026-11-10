import { useMemo } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { FilterChips, Pagination, SegmentedControl, usePagination } from '@/components/ui';
import { BLUE, GREEN, MUTED, RED } from '@/lib/color';
import { DAY, NOON, fday, sod, workdaysBetween } from '@/lib/date';
import { hh, pctW } from '@/lib/format';
import { Meter, PersonCell } from './TeamTab';
import s from './WorkTabs.module.css';

const WEEKS = [[0, 'This week'], [1, 'Next week'], [2, 'In 2 weeks']];
const STATES = { over: ['Overbooked', 25], full: ['Fully booked', 250], free: ['Has free time', 150] };

/** Heat-cell colours by booked/shift ratio. */
function heat(h, sh) {
  const r = h / sh;
  return {
    label: h < 0.05 ? '—' : hh(h),
    bg: r > 1.1 ? 'oklch(0.93 0.06 25)' : r >= 0.85 ? 'oklch(0.94 0.035 250)' : r > 0 ? 'oklch(0.95 0.04 150)' : 'oklch(0.97 0.004 85)',
    fg: r > 1.1 ? 'oklch(0.45 0.16 25)' : r >= 0.85 ? 'oklch(0.42 0.12 250)' : r > 0 ? 'oklch(0.42 0.11 150)' : MUTED,
  };
}

/**
 * Capacity tab: for the chosen week, spreads each member's remaining project
 * hours evenly up to the project's due date and compares with their shift.
 */
export default function CapacityTab() {
  const pj = useStore((st) => st.pj);
  const setPj = useStore((st) => st.setPj);
  const scoped = useScoped();
  const { T, wk, memF, info, g } = useProjectsModel();
  const capW = pj.capW ?? 1;
  const capF = pj.capF || '';

  const v = useMemo(() => {
    const cw0 = wk[0] + capW * 7 * DAY;
    const cDays = Array.from({ length: 7 }, (_, i) => sod(cw0 + i * DAY + NOON)).filter((d) => new Date(d).getDay() !== 0);
    const capProj = scoped.projects.filter((p) => p.status === 'Running' || p.status === 'Planning');
    const pEnd = (p) => (p.due < T ? T + 13 * DAY : p.due);
    const rate = {};
    capProj.forEach((p) => {
      const I = info(p);
      const left = workdaysBetween(Math.max(T, p.start), pEnd(p));
      const remB = Math.max(0, I.budget - I.used);
      p.team.forEach((mid) => {
        const a = +(p.alloc || {})[mid] || 0;
        const rem = a ? Math.max(0, a - g(`pm:${p.id}:${mid}`).all) : remB / p.team.length;
        rate[`${p.id}:${mid}`] = rem / left;
      });
    });
    const on = (p, d) => d >= sod(p.start) && d <= pEnd(p);
    const all = memF.map((m) => {
      const sh = m.shift || 8;
      const cap = sh * cDays.length;
      const mp = capProj.filter((p) => p.team.includes(m.id));
      const per = cDays.map((d) => mp.filter((p) => on(p, d)).reduce((x, p) => x + rate[`${p.id}:${m.id}`], 0));
      const booked = per.reduce((a, b) => a + b, 0);
      const u = cap ? booked / cap : 0;
      const k = u > 1.1 ? 'over' : u >= 0.85 ? 'full' : 'free';
      const byP = mp
        .map((p) => ({ n: p.name, h: cDays.filter((d) => on(p, d)).length * rate[`${p.id}:${m.id}`] }))
        .filter((x) => x.h >= 0.5)
        .sort((a, b) => b.h - a.h);
      const tks = (scoped.tasks || []).filter((t) => t.a === m.id && t.st !== 'Done' && t.due >= cDays[0] && t.due < cw0 + 7 * DAY);
      return {
        m, k, u, sh, booked, cap,
        cells: per.map((h) => heat(h, sh)),
        state: STATES[k],
        freeLabel: booked < cap ? `${hh(cap - booked)} free` : `${hh(booked - cap)} over`,
        projects: byP.length ? byP.slice(0, 3).map((x) => `${x.n} ${hh(x.h)}`).join(' · ') : 'No project work booked',
        tasks: tks.length ? `${tks.length} task${tks.length > 1 ? 's' : ''} due · ${hh(tks.reduce((x, t) => x + (+t.est || 0), 0))} estimated` : '',
      };
    }).sort((a, b) => b.u - a.u);
    const sumB = all.reduce((x, c) => x + c.booked, 0);
    const sumC = all.reduce((x, c) => x + c.cap, 0);
    const n = (k) => all.filter((x) => x.k === k).length;
    return {
      all,
      cDays,
      title: `${WEEKS[capW] ? WEEKS[capW][1] : 'In 2 weeks'} · ${fday(cDays[0])} – ${fday(cDays[cDays.length - 1])}`,
      sub: `Team booked at ${sumC ? Math.round(sumB / sumC * 100) : 0}% · ${hh(Math.max(0, sumC - sumB))} unbooked. Remaining project hours are spread evenly up to each project’s due date.`,
      chips: [['', 'Everyone', all.length, 265], ['over', 'Overbooked', n('over'), 25], ['full', 'Fully booked', n('full'), 250], ['free', 'Has free time', n('free'), 150]]
        .map(([key, label, count, h]) => ({ key, label, count, dot: `oklch(0.62 0.13 ${h})` })),
    };
  }, [wk, capW, scoped.projects, scoped.tasks, T, info, g, memF]);

  const rows = v.all.filter((x) => !capF || x.k === capF);
  const pager = usePagination(rows, { resetKey: `${capF}|${capW}` });
  const openM = (id) => setPj({ selM: id, selP: null, mDay: null, exp: null, exp2: null });

  return (
    <div className={s.stack}>
      <div className={`${s.bar} ${s.barEnd}`}>
        <div style={{ minWidth: 0, maxWidth: 640 }}>
          <div className={s.title}>{v.title}</div>
          <div className={s.sub}>{v.sub}</div>
        </div>
        <SegmentedControl options={WEEKS} value={capW} onChange={(w) => setPj({ capW: w })} />
      </div>

      <FilterChips items={v.chips} value={capF} onChange={(k) => setPj({ capF: k })} tone="dark" />

      <div className={s.tableWrap}>
        <div className={s.tableScroll}>
        <table className={s.table} style={{ minWidth: 1040 }}>
          <thead>
            <tr>
              <th>Member</th>
              {v.cDays.map((d) => (
                <th key={d} className={s.dayTh}>{new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}</th>
              ))}
              <th>Booked vs capacity</th>
              <th>Working on</th>
            </tr>
          </thead>
          <tbody>
            {pager.pageItems.map((c) => (
              <tr key={c.m.id} className={s.clickRow} onClick={() => openM(c.m.id)}>
                <td><PersonCell m={c.m} /></td>
                {c.cells.map((x, i) => (
                  <td key={i} className={s.heatTd}><span className={s.heat} style={{ background: x.bg, color: x.fg }}>{x.label}</span></td>
                ))}
                <td style={{ minWidth: 210 }}>
                  <Meter
                    minWidth={0}
                    left={<span><span className={s.b600}>{hh(c.booked)}</span> <span className={s.muted}>of {hh(c.cap)} · {c.freeLabel}</span></span>}
                    right={(
                      <span className={s.statePill} style={{ background: `oklch(0.95 0.04 ${c.state[1]})`, color: `oklch(0.42 0.13 ${c.state[1]})` }}>
                        {c.state[0]}
                      </span>
                    )}
                    width={pctW(c.u)}
                    color={c.u > 1.1 ? RED : c.u >= 0.85 ? BLUE : GREEN}
                  />
                </td>
                <td className={s.working}>
                  <div>{c.projects}</div>
                  <div className={s.muted} style={{ marginTop: 2 }}>{c.tasks}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {rows.length === 0 && <div className={s.empty}>Nobody matches this filter.</div>}
        <Pagination {...pager} label="members" />
      </div>
    </div>
  );
}
