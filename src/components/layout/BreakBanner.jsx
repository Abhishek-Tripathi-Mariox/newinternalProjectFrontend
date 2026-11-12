import { useState } from 'react';
import { useStore } from '@/store';
import { useNow } from '@/hooks/useNow';
import { clock, fmtDur } from '@/lib/date';
import { useSession } from './useSession';
import s from './Banners.module.css';
import { serverNow } from '@/lib/clock';

/** Amber "You're on lunch break" banner with elapsed time, plan progress and resume button. */
export default function BreakBanner() {
  const { pid } = useSession();
  const a = useStore((x) => (pid && x.live && x.live.att ? x.live.att[pid] : null));
  const myBreak = useStore((x) => x.myBreak);
  const tick = useNow(15000);
  const [busy, setBusy] = useState(false);
  if (!a || a.out || !a.brk) return null;

  // `tick` only drives the 15 s refresh; it can predate a break that just started, which made the
  // elapsed time negative and the progress bar render full. Read the clock fresh, like the original.
  const now = Math.max(tick, serverNow());
  const el = Math.max(0, now - a.brk);
  const pl = (a.brkPlan || 0) * 6e4;
  const over = !!pl && el > pl;
  const title = `You’re on ${a.brkType ? `${a.brkType.toLowerCase()} break` : 'a break'}`;
  const sub = `Started ${clock(a.brk)}${pl ? ` · back by ${clock(a.brk + pl)}` : ''}${a.brkNote ? ` · ${a.brkNote}` : ''}`;

  return (
    <section className={s.brk} role="status" aria-live="polite" aria-label="Break in progress">
      <div className={s.brkMain}>
        <div className={s.brkTitle}>{title}</div>
        <div className={s.brkSub}>{sub}</div>
        <div className={s.brkTrack}>
          <div
            className={s.brkFill}
            style={{ width: pl ? `${Math.min(100, (el / pl) * 100).toFixed(1)}%` : '100%', background: over ? 'oklch(0.58 0.18 25)' : 'oklch(0.7 0.15 70)' }}
          />
        </div>
      </div>
      <div className={s.brkRight}>
        <div className={s.brkEl} style={{ color: over ? 'oklch(0.5 0.18 25)' : 'oklch(0.3 0.06 60)' }}>{fmtDur(el)}</div>
        <div className={s.brkOf}>{pl ? `of ${fmtDur(pl)}` : 'elapsed'}</div>
        {over && <div className={s.brkOver}>{fmtDur(el - pl)} over</div>}
      </div>
      <button
        type="button"
        className={s.resume}
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          try { await myBreak(); } finally { setBusy(false); }
        }}
      >
        End break &amp; resume work
      </button>
    </section>
  );
}
