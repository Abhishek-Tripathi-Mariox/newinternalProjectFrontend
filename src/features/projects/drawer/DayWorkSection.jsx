import { useMemo } from 'react';
import { Avatar } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { addDays, fday, longDay, parseDay, ymd } from '@/lib/date';
import { hh } from '@/lib/format';
import { useProjectNav } from '../hooks/useProjectNav';
import s from './drawer.module.css';

const UNKNOWN = { name: '—', h: 265, role: '' };

/** Day-wise work: pick a day (prev / next / date / recent chips) and see who logged what. */
export default function DayWorkSection({ project: sp, model }) {
  const pDay = useStore((st) => st.pj.pDay);
  const setPj = useStore((st) => st.setPj);
  const { logs, members } = useScoped();
  const { openMember } = useProjectNav();
  const { T, MSS } = model;

  const v = useMemo(() => {
    const MEM = Object.fromEntries(members.map((m) => [m.id, m]));
    const pl = logs.filter((l) => l.p === sp.id);
    const daysW = Array.from(new Set(pl.map((l) => l.d))).sort((a, b) => b - a);
    const day = pDay || daysW[0] || T;
    const dl = pl.filter((l) => l.d === day);
    const byM = {};
    dl.forEach((l) => (byM[l.m] = byM[l.m] || []).push(l));
    const people = Object.keys(byM)
      .map((id) => ({ id, m: MEM[id] || UNKNOWN, h: byM[id].reduce((x, l) => x + l.h, 0), entries: byM[id] }))
      .sort((a, b) => b.h - a.h);
    const totals = {};
    pl.forEach((l) => (totals[l.d] = (totals[l.d] || 0) + l.h));
    return { day, people, total: dl.reduce((x, l) => x + l.h, 0), recent: daysW.slice(0, 21).map((d) => ({ d, total: totals[d] || 0 })) };
  }, [logs, members, sp.id, pDay, T]);

  const go = (d) => setPj({ pDay: d });
  const n = v.people.length;

  return (
    <section className={`${s.section} ${s.boxed}`}>
      <div className={s.dayHead}>
        <div>
          <h3 className={s.h3}>Day-wise work</h3>
          <div className={s.small}>{longDay(v.day)}</div>
        </div>
        <div className={s.dayNav}>
          <button type="button" className={s.navBtn} title="Previous day" onClick={() => go(addDays(v.day, -1))}>
            ‹
          </button>
          <input
            className={s.dateInput}
            type="date"
            value={ymd(v.day)}
            onChange={(e) => {
              const d = parseDay(e.target.value);
              if (d) go(d);
            }}
          />
          <button type="button" className={s.navBtn} title="Next day" onClick={() => go(addDays(v.day, 1))}>
            ›
          </button>
        </div>
      </div>

      <div className={s.dayChips}>
        {v.recent.map(({ d, total }) => (
          <button type="button" key={d} className={`${s.dayChip} ${d === v.day ? s.dayChipOn : ''}`} onClick={() => go(d)}>
            <span className={s.dayChipLabel}>{d === T ? 'Today' : fday(d)}</span>
            <span className={s.dayChipTotal}>{hh(total)}</span>
          </button>
        ))}
      </div>

      {v.people.map((p) => (
        <div key={p.id} className={s.dayPerson}>
          <Avatar name={p.m.name} h={p.m.h} size={30} />
          <div className={s.minw}>
            <button type="button" className={s.dayName} onClick={() => openMember(p.id)}>
              {p.m.name} <span className={s.dayRole}>· {p.m.role}</span>
            </button>
            {p.entries.map((l) => (
              <div key={l.id} className={s.dayEntry}>
                <span>
                  {(MSS[l.ms] || {}).name || '—'} · {l.note || '—'}
                </span>
                <span>{hh(l.h)}</span>
              </div>
            ))}
          </div>
          <span className={s.dayH}>{hh(p.h)}</span>
        </div>
      ))}
      {n === 0 && <div className={s.dayEmpty}>No one logged hours on this project on this day.</div>}
      <div className={s.dayTotal}>
        <span className={s.muted}>{n ? `${n}${n === 1 ? ' person' : ' people'} worked on this day` : 'Total'}</span>
        <span>{hh(v.total)}</span>
      </div>
    </section>
  );
}
