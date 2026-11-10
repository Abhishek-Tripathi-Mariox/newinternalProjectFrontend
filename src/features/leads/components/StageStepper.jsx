import { useLeadStatusNames } from '@/store/masters';
import { statusTone } from '../leadUtils';
import s from './StageStepper.module.css';

/** One-click pipeline stage selector. */
export default function StageStepper({ value, onChange }) {
  const names = useLeadStatusNames();
  return (
    <div className={s.wrap}>
      <span className={s.label}>Stage · one click to move</span>
      <div className={s.steps}>
        {names.map((k) => {
          const t = statusTone(k);
          const on = k === value;
          return (
            <button
              key={k}
              type="button"
              className={s.step}
              aria-pressed={on}
              onClick={() => !on && onChange(k)}
              style={{
                borderColor: on ? t.dot : 'oklch(0.9 0.006 85)',
                background: on ? t.bg : '#fff',
                color: on ? t.fg : 'oklch(0.42 0.012 265)',
                fontWeight: on ? 600 : 500,
              }}
            >
              <span className={s.dot} style={{ background: t.dot }} />
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}
