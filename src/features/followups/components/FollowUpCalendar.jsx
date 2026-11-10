import { useStore } from '@/store';
import { ymd } from '@/lib/date';
import { useFollowUpCalendar } from '../useFollowUpCalendar';
import FollowUpRow from './FollowUpRow';
import s from './FollowUpCalendar.module.css';

/**
 * Month calendar + selected-day panel.
 * `calMonth` / `calDay` are owned by the page (local UI state) and changed via `onNavigate(patch)`.
 */
export default function FollowUpCalendar({ fus, leadMap, calMonth, calDay, onNavigate, T, now }) {
  const openModal = useStore((st) => st.openModal);
  const cal = useFollowUpCalendar(fus, leadMap, { calMonth, calDay, T, now });
  const shift = (n) => {
    const m = new Date(cal.monthStart);
    onNavigate({ calMonth: new Date(m.getFullYear(), m.getMonth() + n, 1).getTime() });
  };
  const select = (c) => onNavigate({ calDay: c.d, calMonth: c.inMonth ? calMonth : new Date(c.d).setDate(1) });

  return (
    <div className={s.wrap}>
      <div className={s.month}>
        <div className={s.monthHead}>
          <div className={s.monthLabel}>{cal.monthLabel}</div>
          <div className={s.nav}>
            <button type="button" className={s.navBtn} title="Previous month" onClick={() => shift(-1)}>‹</button>
            <button type="button" className={s.todayBtn} onClick={() => onNavigate({ calMonth: null, calDay: T })}>Today</button>
            <button type="button" className={s.navBtn} title="Next month" onClick={() => shift(1)}>›</button>
          </div>
        </div>
        <div className={s.scroll}>
          <div className={s.gridWrap}>
            <div className={s.weekdays}>
              {cal.weekdays.map((w) => <div key={w} className={s.weekday}>{w}</div>)}
            </div>
            <div className={s.grid}>
              {cal.cells.map((c) => (
                <div
                  key={c.d}
                  role="button"
                  tabIndex={0}
                  onClick={() => select(c)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && select(c)}
                  className={`${s.cell} ${c.inMonth ? '' : s.outside} ${c.isSelected ? s.selected : ''}`}
                >
                  <div className={s.cellHead}>
                    <span className={`${s.num} ${c.isToday ? s.today : ''}`}>{c.day}</span>
                    {c.hasOver && <span className={s.overDot} title="Overdue" />}
                  </div>
                  {c.events.map((e) => (
                    <button
                      key={e.fu.id}
                      type="button"
                      title={e.tip}
                      className={s.event}
                      style={{ background: e.bg, color: e.fg, opacity: e.fu.done ? 0.55 : 1 }}
                      onClick={(ev) => { ev.stopPropagation(); openModal('fu', { editId: e.fu.id }); }}
                    >
                      <span className={s.eventTime}>{e.time}</span>
                      <span className={`${s.eventTitle} ${e.fu.done ? s.done : ''}`}>{e.fu.title}</span>
                    </button>
                  ))}
                  {c.more > 0 && <span className={s.more}>+{c.more} more</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <div className={s.panelTitle}>{cal.dayTitle}</div>
            <div className={s.panelSub}>{cal.daySub}</div>
          </div>
          <button type="button" className={s.addBtn} onClick={() => openModal('fu', { date: ymd(cal.selDay) })}>+ Add</button>
        </div>
        {cal.dayList.map((f) => <FollowUpRow key={f.id} fu={f} variant="day" now={now} />)}
        {cal.dayList.length === 0 && <div className={s.empty}>Nothing scheduled.</div>}
      </div>
    </div>
  );
}
