import { Select, Input } from '@/components/ui';
import { RANGE_OPTIONS } from './attendanceUtils';

const OPTIONS = RANGE_OPTIONS.map(([value, label]) => ({ value, label }));

/** Range select (Today … Last 30 days) plus a date input for "Pick a date…". */
export default function RangeFilter({ range, date, onChange }) {
  return (
    <>
      <Select compact value={range} options={OPTIONS} onChange={(e) => onChange({ range: e.target.value })} />
      {range === 'date' && (
        <Input compact type="date" value={date} onChange={(e) => onChange({ date: e.target.value })} />
      )}
    </>
  );
}
