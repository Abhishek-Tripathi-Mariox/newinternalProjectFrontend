import { useStore } from '@/store';
import { DateRangeFilter, SearchInput, Select, Toolbar } from '@/components/ui';
import { LEAD_DATE_PRESETS } from '@/config/constants';
import { useLeadStatusNames, useMasters, useServices, useSources } from '@/store/masters';
import { EMPTY_LF, val } from '../leadUtils';
import s from './LeadsFilters.module.css';
import { getOwners } from '@/store/owners';

const ownerOpts = () => [{ value: '', label: 'All owners' }, ...getOwners().map((o) => ({ value: o.id, label: o.name }))];
const withAll = (label, list) => [{ value: '', label }, ...list.map((k) => ({ value: k, label: k }))];

/** Normalise a DateRangeFilter patch to the `lf` keys ({date, from, to}). */
function datePatch(p) {
  if (!p || typeof p !== 'object') return { date: p };
  const { value, preset, ...rest } = p;
  const out = { ...rest };
  if (value !== undefined) out.date = value;
  if (preset !== undefined) out.date = preset;
  return out;
}

/** Search + date + owner/status/source/service filter row for the Leads page. */
export default function LeadsFilters() {
  const lf = useStore((st) => st.lf);
  const setLf = useStore((st) => st.setLf);
  const set = (k) => (e) => setLf({ [k]: val(e) });
  const stages = useLeadStatusNames();
  const sources = useSources();
  const services = useServices();
  const { addLeadStatus, addSource, addService } = useMasters.getState();
  /** onCreate handler: add to the master list and apply it as the filter. */
  const create = (k, add) => (label) => {
    const name = add(label);
    if (name) setLf({ [k]: name });
    return name;
  };
  const nActive = ['q', 'owner', 'source', 'service', 'status', 'flag'].filter((k) => lf[k]).length + (lf.date !== 'all' ? 1 : 0);

  return (
    <Toolbar>
      <SearchInput value={lf.q} onChange={set('q')} placeholder="Search leads…" title="Search by company, contact, email or lead ID" className={s.search} />
      <DateRangeFilter presets={LEAD_DATE_PRESETS} value={lf.date} from={lf.from} to={lf.to} onChange={(p) => setLf(datePatch(p))} />
      <Select value={lf.owner} onChange={set('owner')} options={ownerOpts()} />
      <Select value={lf.status} onChange={set('status')} options={withAll('All statuses', stages)} createLabel="Add stage" onCreate={create('status', addLeadStatus)} />
      <Select value={lf.source} onChange={set('source')} options={withAll('All sources', sources)} createLabel="Add source" onCreate={create('source', addSource)} />
      <Select value={lf.service} onChange={set('service')} options={withAll('All services', services)} createLabel="Add service" onCreate={create('service', addService)} />
      {nActive > 0 && (
        <button type="button" className={s.clear} onClick={() => setLf(EMPTY_LF)}>
          Clear {nActive} filter{nActive > 1 ? 's' : ''}
        </button>
      )}
    </Toolbar>
  );
}
