import { DateRangeFilter, SearchInput, Select, Toolbar, Button } from '@/components/ui';
import { FU_DATE_PRESETS, OWNERS, PRIORITY_NAMES } from '@/config/constants';
import { EMPTY_FF, TYPE_NAMES, hasActiveFilters } from '../model';

const TYPE_OPTS = [{ value: '', label: 'All types' }, ...TYPE_NAMES.map((t) => ({ value: t, label: t }))];
const OWNER_OPTS = [{ value: '', label: 'All owners' }, ...OWNERS.map((o) => ({ value: o.id, label: o.name }))];
const PRIO_OPTS = [{ value: '', label: 'All priorities' }, ...PRIORITY_NAMES.map((p) => ({ value: p, label: p }))];
const MEET_OPTS = [
  { value: '', label: 'Meet link: any' },
  { value: 'yes', label: 'Has Meet link' },
  { value: 'no', label: 'No Meet link' },
];

/** DateRangeFilter may report the preset as `value`/`preset`/`date`; normalise to the `ff` keys. */
const normDate = (p) => {
  const { value, preset, ...rest } = p || {};
  const date = rest.date ?? value ?? preset;
  return date === undefined ? rest : { ...rest, date };
};

/** Filter bar for the Follow-ups page (writes `ff` in the store). */
export default function FollowUpFilters({ ff, setFf }) {
  const on = (k) => (e) => setFf({ [k]: e && e.target ? e.target.value : e });
  return (
    <Toolbar>
      <SearchInput
        value={ff.q}
        onChange={on('q')}
        placeholder="Search title or company"
        style={{ flex: '1 1 200px', minWidth: 170 }}
      />
      <DateRangeFilter
        presets={FU_DATE_PRESETS}
        value={ff.date}
        from={ff.from}
        to={ff.to}
        onChange={(p) => setFf(normDate(p))}
      />
      <Select value={ff.type} onChange={on('type')} options={TYPE_OPTS} aria-label="Type" />
      <Select value={ff.owner} onChange={on('owner')} options={OWNER_OPTS} aria-label="Owner" />
      <Select value={ff.priority} onChange={on('priority')} options={PRIO_OPTS} aria-label="Priority" />
      <Select value={ff.meet} onChange={on('meet')} options={MEET_OPTS} aria-label="Meet link" />
      {hasActiveFilters(ff) && (
        <Button variant="link" onClick={() => setFf({ ...EMPTY_FF })}>Clear filters</Button>
      )}
    </Toolbar>
  );
}
