import { useStore } from '@/store';
import { Select } from '@/components/ui';
import { useLeadStatusNames, useMasters } from '@/store/masters';
import { val } from '../leadUtils';
import s from './BulkBar.module.css';
import { getActiveOwners } from '@/store/owners';

/** Floating dark action bar shown while leads are selected. */
export default function BulkBar({ onExport }) {
  const selIds = useStore((st) => st.selIds);
  const bulk = useStore((st) => st.bulk);
  const setSelIds = useStore((st) => st.setSelIds);
  const stages = useLeadStatusNames();
  const addLeadStatus = useMasters((st) => st.addLeadStatus);
  if (!selIds.length) return null;

  return (
    <div className={s.bar} role="toolbar" aria-label="Bulk actions">
      <span className={s.count}>{selIds.length} selected</span>
      <Select unstyled value="" placeholder="Assign to…" className={s.select} aria-label="Assign to owner"
        onChange={(e) => { if (e.target.value) bulk('owner', e.target.value); }}
        options={getActiveOwners().map((o) => ({ value: o.id, label: o.name }))} />
      <Select
        value=""
        placeholder="Move to stage…"
        options={stages}
        onChange={(e) => { const v = val(e); if (v) bulk('status', v); }}
        createLabel="Add stage"
        onCreate={addLeadStatus}
        unstyled
        className={s.select}
        aria-label="Move to stage"
      />
      <button type="button" className={s.export} onClick={onExport}>Export CSV</button>
      <button type="button" className={s.clear} title="Clear selection" aria-label="Clear selection" onClick={() => setSelIds([])}>✕</button>
    </div>
  );
}
