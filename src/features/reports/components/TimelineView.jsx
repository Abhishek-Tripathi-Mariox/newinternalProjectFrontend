import SegmentLegend from '@/features/attendance/shared/SegmentLegend';
import StatusAvatar from '@/features/attendance/shared/StatusAvatar';
import { SEG } from '@/features/attendance/shared/attendanceUtils';
import s from './TimelineView.module.css';

/** Gantt-like day/week timeline of working and break segments per person. */
export default function TimelineView({ model, pop, onSegment }) {
  const isActive = (g) => pop && pop.pid === g.pid && pop.a === g.a;
  return (
    <>
      <div className={s.panel}>
        <div className={s.inner}>
          <div className={s.headRow}>
            <span className={s.hStatus}>Status</span>
            <span className={s.hName}>Name</span>
            <span className={s.hTotal}>Total</span>
            <div className={s.track}>
              {model.cols.map((c) => (
                <span key={c.key} className={s.col} style={{ left: c.left, width: c.width, justifyContent: c.align }}>{c.label}</span>
              ))}
            </div>
          </div>
          {model.rows.map((r) => (
            <div key={r.id} className={s.row}>
              <div className={s.cStatus}><StatusAvatar name={r.name} h={r.person.h} size={30} dot={r.dot} /></div>
              <div className={s.cName}>
                <span className={s.name}>{r.name}</span>
                <span className={s.sub} style={{ color: r.subFg }}>{r.sub}</span>
              </div>
              <div className={s.cTotal} style={{ color: r.totFg }}>{r.total}</div>
              <div className={s.track}>
                {model.grid.map((g) => <span key={g} className={s.grid} style={{ left: g }} />)}
                {r.segs.map((g) => (
                  <span
                    key={g.key}
                    role="button"
                    tabIndex={0}
                    title={g.tip}
                    className={`${s.seg} ${isActive(g) ? s.segActive : ''}`}
                    style={{ top: g.top, bottom: g.bot, left: g.left, width: g.width, background: g.bg }}
                    onClick={(e) => onSegment(g, e)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { const b = e.currentTarget.getBoundingClientRect(); onSegment(g, { clientX: b.left, clientY: b.bottom }); } }}
                  />
                ))}
                {r.dayTotals.map((t) => (
                  <span key={t.key} className={s.dayTotal} style={{ left: t.left, width: t.width }}>{t.text}</span>
                ))}
              </div>
            </div>
          ))}
          {model.rows.length === 0 && <div className={s.empty}>Nobody matches this team.</div>}
        </div>
      </div>
      <SegmentLegend className={s.legend} swatch="square" work={SEG.tlWork} brk={SEG.tlBreak} hint="Click a bar for the full day" />
    </>
  );
}
