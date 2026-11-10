/** Tiny presentational pieces reused across the Projects feature. */
import { ProgressBar } from '@/components/ui';
import { pctW } from '@/lib/format';
import { msBadge } from '../lib/view';
import s from './shared.module.css';

/** Coloured square marker (project colour, status colour). */
export function Dot({ color, round = false }) {
  return <span className={round ? s.roundDot : s.dot} style={{ background: color }} />;
}

/** Project colour square + name. */
export function ProjectName({ color, name, bold = false, className = '' }) {
  return (
    <span className={`${s.nameRow} ${className}`}>
      <Dot color={color} />
      <span className={bold ? s.name : undefined}>{name}</span>
    </span>
  );
}

/** Health / approval style pill with explicit colours. */
export function HealthPill({ bg, fg, children }) {
  return (
    <span className={s.healthPill} style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

/** "label ……… right" header over a thin progress bar. `ratio` is 0..∞ (clamped). */
export function Meter({ left, right, ratio, width, color, className = '' }) {
  return (
    <div className={`${s.meter} ${className}`}>
      {(left != null || right != null) && (
        <div className={s.meterHead}>
          <span>{left}</span>
          {right != null && <span>{right}</span>}
        </div>
      )}
      <ProgressBar width={width || pctW(ratio)} color={color} />
    </div>
  );
}

/** "12h / 40h" — bold used + muted budget. */
export function UsedOf({ used, of }) {
  return (
    <>
      <span className={s.strong}>{used}</span> <span className={s.muted}>{of}</span>
    </>
  );
}

/** Numbered milestone circle (green when done, primary when current). */
export function MilestoneNumber({ milestone, current, large = false, children }) {
  const c = msBadge(milestone, current);
  return (
    <span className={`${s.numBadge} ${large ? s.numBadgeLg : ''}`} style={{ background: c.bg, color: c.fg }}>
      {children ?? milestone.n}
    </span>
  );
}

/** Date / note / hours rows used by the milestone and member breakdowns. */
export function EntryRows({ rows }) {
  return rows.map((e) => (
    <div key={e.id} className={s.entry}>
      <span>{e.date}</span>
      <span>{e.note}</span>
      <span>{e.h}</span>
    </div>
  ));
}
