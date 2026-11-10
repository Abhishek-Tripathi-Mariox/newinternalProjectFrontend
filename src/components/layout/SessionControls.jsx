import { useCallback, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store';
import { sumDay } from '@/domain/attendance';
import { fmtDur, sod } from '@/lib/date';
import { cx } from '@/components/ui/cx';
import MyDayPopover from './MyDayPopover';
import { dayEvents } from './dayEvents';
import s from './Header.module.css';

/** Status pill (▾ My day), Check in, Break / End break, End shift — for the signed-in team member. */
export default function SessionControls({ pid, now }) {
  const { live, attLog } = useStore(useShallow((x) => ({ live: x.live, attLog: x.attLog })));
  const checkIn = useStore((x) => x.checkIn);
  const myBreak = useStore((x) => x.myBreak);
  const openEndShift = useStore((x) => x.openEndShift);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);

  const aa = ((live && live.att) || {})[pid];
  const T = sod(now);
  const { day, events } = useMemo(() => {
    const list = (attLog || []).filter((e) => e.who === pid && e.t >= T).sort((x, y) => x.t - y.t);
    return { day: sumDay(list, T, now), events: dayEvents(list, aa, now) };
  }, [attLog, pid, T, now, aa]);

  const status = !aa || aa.out ? 'Not checked in' : aa.brk ? `On break · ${fmtDur(now - aa.brk)}` : `Working · ${fmtDur(day.work)} today`;
  const dot = !aa || aa.out ? 'oklch(0.7 0.01 265)' : aa.brk ? 'oklch(0.72 0.14 70)' : 'oklch(0.62 0.16 150)';
  const needIn = !aa || !!aa.out;
  const canBreak = !!aa && !aa.out;

  return (
    <div className={s.sess} ref={anchorRef}>
      <button
        type="button"
        className={s.status}
        title="See my day"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? 'my-day-popover' : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={s.dot} style={{ background: dot }} aria-hidden="true" />
        <span className={s.statusText}>{status}</span>
        <span className={s.caret} aria-hidden="true">▾</span>
      </button>
      {open && <MyDayPopover anchorRef={anchorRef} onClose={close} day={day} events={events} now={now} />}
      {needIn && (
        <button type="button" className={cx(s.sBtn, s.checkIn)} onClick={() => checkIn(pid)}>Check in</button>
      )}
      {canBreak && (
        <button type="button" className={cx(s.sBtn, s.brk, aa.brk && s.brkOn)} onClick={() => myBreak()}>
          {aa.brk ? 'End break' : 'Break'}
        </button>
      )}
      {canBreak && (
        <button type="button" className={cx(s.sBtn, s.end)} onClick={() => openEndShift(pid)}>End shift</button>
      )}
    </div>
  );
}
