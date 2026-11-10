import { Select } from './Select';
import { Input } from './Input';
import { DAY, today, ymd } from '@/lib/date';
import s from './Field.module.css';

/**
 * Period preset select + custom from/to date inputs (shown when value === 'custom').
 * presets: [[value, label]] · onChange(patch) with {date} | {from} | {to}.
 * `field` renames the preset key in the patch (default 'date').
 * `customDays` — when switching to Custom with no dates set, the range is pre-filled
 * with the last N days (default 30) so the data filters immediately.
 */
export function DateRangeFilter({ presets = [], value, from = '', to = '', onChange, field = 'date', title, customDays = 30, className, style }) {
  const pick = (v) => {
    const patch = { [field]: v };
    if (v === 'custom' && !from && !to) {
      const T = today();
      patch.from = ymd(T - (customDays - 1) * DAY);
      patch.to = ymd(T);
    }
    onChange?.(patch);
  };
  return (
    <>
      <Select
        compact
        inline
        title={title}
        aria-label={title || 'Date range'}
        value={value}
        onChange={(e) => pick(e.target.value)}
        options={presets.map(([v, l]) => ({ value: v, label: l }))}
        className={className}
        style={style}
      />
      {value === 'custom' && (
        <span className={s.dateRange}>
          <Input compact inline type="date" aria-label="From" value={from} max={to || undefined} onChange={(e) => onChange?.({ from: e.target.value })} />
          <span className={s.dateSep}>to</span>
          <Input compact inline type="date" aria-label="To" value={to} min={from || undefined} onChange={(e) => onChange?.({ to: e.target.value })} />
        </span>
      )}
    </>
  );
}
