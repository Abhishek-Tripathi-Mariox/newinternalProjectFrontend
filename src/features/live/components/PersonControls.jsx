import { useState } from 'react';
import { useStore } from '@/store';
import { Button, Select } from '@/components/ui';
import s from './TeamTable.module.css';

/** Check in / timer / break / check out controls for one person row. */
export default function PersonControls({ row }) {
  const checkIn = useStore((st) => st.checkIn);
  const checkOut = useStore((st) => st.checkOut);
  const toggleBreak = useStore((st) => st.toggleBreak);
  const startTimer = useStore((st) => st.startTimer);
  const stopTimer = useStore((st) => st.stopTimer);
  const [busy, setBusy] = useState(false);
  /** One request per row at a time (buttons disable while it runs). */
  const act = (fn) => async () => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div className={s.controls}>
      {row.canIn && <Button variant="secondary" size="sm" disabled={busy} onClick={act(() => checkIn(row.id))}>Check in</Button>}
      {row.hasTimer && <Button variant="dangerOutline" size="sm" disabled={busy} onClick={act(() => stopTimer(row.id))}>Stop timer</Button>}
      {row.canStart && (
        <Select
          compact
          className={s.timerSelect}
          value=""
          placeholder="Start timer…"
          options={row.tasks}
          disabled={busy}
          onChange={(e) => { const v = e.target.value; if (v) act(() => startTimer(row.id, v))(); }}
        />
      )}
      {row.canBreak && <Button variant="secondary" size="sm" disabled={busy} onClick={act(() => toggleBreak(row.id))}>{row.brkLabel}</Button>}
      {row.canOut && <Button variant="ghost" size="sm" className={s.outBtn} disabled={busy} onClick={act(() => checkOut(row.id))}>Check out</Button>}
    </div>
  );
}
