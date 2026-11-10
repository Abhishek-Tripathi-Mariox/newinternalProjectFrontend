import { Avatar } from '@/components/ui';
import KpiRow from '@/features/attendance/shared/KpiRow';
import { eventDot, eventFg } from '@/features/attendance/shared/attendanceUtils';
import s from './HoursLog.module.css';

/** One person's events for a day. */
function PersonDay({ r }) {
  return (
    <div className={s.row}>
      <div className={s.who}>
        <Avatar name={r.person.name} h={r.person.h} size={30} />
        <div className={s.whoText}><div className={s.name}>{r.person.name}</div><div className={s.role}>{r.person.role}</div></div>
      </div>
      <div className={s.events}>
        {r.absent && <span className={s.absent}>Absent</span>}
        {r.events.map((e) => (
          <div key={e.key} className={s.event}>
            <span className={s.evLabel} style={{ color: eventFg(e) }}><span className={s.evDot} style={{ background: eventDot(e) }} />{e.label}</span>
            <span className={s.evTime}>{e.time}</span>
            {e.sub && <span className={s.evSub}>{e.sub}</span>}
          </div>
        ))}
      </div>
      <div className={s.totals}>
        <div><div className={s.tLabel}>Break</div><div className={s.tBreak}>{r.brk}</div></div>
        <div><div className={s.tLabel}>Worked</div><div className={s.tWorked} style={{ color: r.workedColor }}>{r.worked}</div></div>
      </div>
    </div>
  );
}

/** Hours log tab — KPIs and day-grouped login/break/logout events. */
export default function HoursLog({ model }) {
  return (
    <>
      <KpiRow items={model.kpis} />
      {model.days.map((d) => (
        <div key={d.key} className={s.day}>
          <div className={s.dayHead}><span className={s.dayLabel}>{d.label}</span><span className={s.daySub}>{d.sub}</span></div>
          {d.rows.map((r) => <PersonDay key={r.id} r={r} />)}
        </div>
      ))}
      {model.days.length === 0 && <div className={s.empty}>No activity in this period.</div>}
    </>
  );
}
