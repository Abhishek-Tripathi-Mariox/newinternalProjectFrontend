import { useStore } from '@/store';
import { Select } from '@/components/ui';
import { val } from '../leadUtils';
import s from './LeadFlags.module.css';

const STALE_OPTIONS = [3, 7, 14, 30];

/** Hot / stale / duplicate quick filters plus the "no-contact after" threshold. */
export default function LeadFlags({ leads, ins }) {
  const flag = useStore((st) => st.lf.flag);
  const staleDays = useStore((st) => st.staleDays) || 7;
  const setLf = useStore((st) => st.setLf);
  const setStaleDays = useStore((st) => st.setStaleDays);

  const flags = [
    ['hot', 'Hot leads', leads.filter(ins.isHot).length, 35],
    ['stale', `No contact in ${staleDays}+ days`, leads.filter(ins.isStale).length, 70],
    ['dup', 'Possible duplicates', Object.keys(ins.dupOf).length, 25],
  ];

  return (
    <div className={s.row}>
      {flags.map(([k, label, n, h]) => {
        const on = flag === k;
        return (
          <button
            key={k}
            type="button"
            className={s.flag}
            aria-pressed={on}
            onClick={() => setLf({ flag: on ? '' : k })}
            style={{
              background: on ? `oklch(0.48 0.14 ${h})` : `oklch(0.975 0.02 ${h})`,
              color: on ? '#fff' : `oklch(0.42 0.13 ${h})`,
              borderColor: on ? `oklch(0.48 0.14 ${h})` : `oklch(0.88 0.05 ${h})`,
            }}
          >
            {label}
            <span className={s.n}>{n}</span>
          </button>
        );
      })}
      <label className={s.stale}>
        Flag as no-contact after
        <Select compact value={String(staleDays)} onChange={(e) => setStaleDays(+val(e))} className={s.select}
          options={STALE_OPTIONS.map((d) => ({ value: String(d), label: `${d} days` }))} />
      </label>
    </div>
  );
}
