import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, IconButton } from '@/components/ui';
import { eventDot } from '@/features/attendance/shared/attendanceUtils';
import s from './TimelinePopover.module.css';

/** Fixed-position card with the full day for a clicked timeline segment. */
export default function TimelinePopover({ data, x, y, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <>
      <div className={s.backdrop} onClick={onClose} />
      <div className={s.card} style={{ left: x, top: y }} role="dialog" aria-label={`${data.person.name} · ${data.date}`}>
        <div className={s.top}>
          <div className={s.who}>
            <Avatar name={data.person.name} h={data.person.h} size={32} />
            <div><div className={s.name}>{data.person.name}</div><div className={s.date}>{data.date}</div></div>
          </div>
          <IconButton label="Close" onClick={onClose} />
        </div>
        <div className={s.seg} style={{ background: data.segBg }}>
          <span className={s.segDot} style={{ background: data.segDot }} />
          <div className={s.segText}>
            <div className={s.segLabel} style={{ color: data.segFg }}>{data.segLabel}</div>
            <div className={s.segRange}>{data.segRange}</div>
          </div>
          <span className={s.segDur} style={{ color: data.segFg }}>{data.segDur}</span>
        </div>
        <div className={s.stats}>
          {data.stats.map((st) => (
            <div key={st.label} className={s.stat}>
              <div className={s.statLabel}>{st.label}</div>
              <div className={s.statValue} style={{ color: st.fg }}>{st.value}</div>
            </div>
          ))}
        </div>
        <div>
          <div className={s.tlTitle}>Timeline</div>
          {data.events.map((e) => (
            <div key={e.key} className={s.event}>
              <span className={s.evTime}>{e.time}</span>
              <span className={s.evDot} style={{ background: eventDot(e) }} />
              <div>
                <div className={s.evLabel}>{e.label}</div>
                {e.sub && <div className={s.evSub}>{e.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}
