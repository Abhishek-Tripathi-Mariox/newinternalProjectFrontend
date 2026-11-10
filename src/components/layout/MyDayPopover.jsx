import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StatGrid, Timeline } from '@/components/ui';
import { clock, fmtDur } from '@/lib/date';
import s from './Header.module.css';

/**
 * "My day" popover anchored under the session status button. Closes on outside click,
 * Escape (focus returns to the trigger) and window resize.
 */
export default function MyDayPopover({ anchorRef, onClose, day, events, now }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ top: r.bottom + 8, left: Math.max(12, Math.min(r.left, window.innerWidth - 352)) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        anchorRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorRef]);

  const stats = [
    { label: 'Logged in', value: day && day.first ? clock(day.first) : '—' },
    { label: 'Worked', value: day ? fmtDur(day.work) : '0m' },
    { label: 'Breaks', value: day && day.breaks.length ? `${day.breaks.length} · ${fmtDur(day.br)}` : 'None' },
  ];

  return createPortal(
    <div
      ref={ref}
      id="my-day-popover"
      role="dialog"
      aria-label="My day"
      tabIndex={-1}
      className={s.pop}
      style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
    >
      <div>
        <h2 className={s.popTitle}>My day</h2>
        <div className={s.popSub}>{new Date(now).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
      </div>
      <StatGrid items={stats} cols={3} />
      {!events.length && <div className={s.popEmpty}>Nothing logged yet today.</div>}
      {events.length > 0 && <Timeline items={events} className={s.popList} />}
    </div>,
    document.body,
  );
}
