import { useMemo } from 'react';
import { useStore } from '@/store';
import { Avatar, Checkbox, DataTable, Pill } from '@/components/ui';
import { DupTag, HotTag, ScoreTag } from './LeadTags';
import s from './LeadsTable.module.css';

/** Click-isolating wrapper so checkbox clicks don't open the lead. */
const Stop = ({ children }) => (
  <span className={s.check} onClick={(e) => e.stopPropagation()}>{children}</span>
);

/** Sortable, selectable leads table. `rows` = leadRowModel()[]. */
export default function LeadsTable({ rows, onOpen }) {
  const selIds = useStore((st) => st.selIds);
  const sort = useStore((st) => st.sort);
  const setSort = useStore((st) => st.setSort);
  const toggleSel = useStore((st) => st.toggleSel);
  const setSelIds = useStore((st) => st.setSelIds);

  const sel = useMemo(() => new Set(selIds), [selIds]);
  const allChk = rows.length > 0 && rows.every((r) => sel.has(r.lead.id));
  const toggleAll = () => {
    const shownIds = rows.map((r) => r.lead.id);
    setSelIds(allChk ? selIds.filter((id) => !shownIds.includes(id)) : Array.from(new Set(selIds.concat(shownIds))));
  };
  const onSort = (k) => setSort({ k, d: sort.k === k ? -sort.d : k === 'company' || k === 'next' ? 1 : -1 });

  const columns = [
    {
      key: 'sel', width: 20, sortable: false,
      label: <Stop><Checkbox checked={allChk} onChange={toggleAll} title="Select all" aria-label="Select all" /></Stop>,
      render: (r) => <Stop><Checkbox checked={sel.has(r.lead.id)} onChange={() => toggleSel(r.lead.id)} aria-label={`Select ${r.lead.company}`} /></Stop>,
    },
    {
      key: 'company', label: 'Lead', sortable: true,
      render: (r) => (
        <>
          <div className={s.leadLine}>
            <span className={s.company}>{r.lead.company}</span>
            {r.hot && <HotTag />}
            {r.dup && <DupTag />}
          </div>
          <div className={s.sub}>
            {r.lead.contact} · <span className={s.id}>{r.lead.id}</span>
            {r.stale && <> · <span className={s.stale}>{r.staleLabel}</span></>}
          </div>
        </>
      ),
    },
    { key: 'service', label: 'Service', sortable: true, render: (r) => r.lead.service },
    { key: 'source', label: 'Source', sortable: true, render: (r) => <span className={s.soft}>{r.lead.source}</span> },
    {
      key: 'owner', label: 'Owner', sortable: true,
      render: (r) => (
        <span className={s.owner}>
          <Avatar name={r.owner.name} h={r.owner.h} ini={r.owner.ini} size={24} />
          {r.owner.name}
        </span>
      ),
    },
    {
      key: 'status', label: 'Status', sortable: true,
      render: (r) => <Pill bg={r.st.bg} fg={r.st.fg} dot={r.st.dot}>{r.lead.status}</Pill>,
    },
    { key: 'score', label: 'Score', align: 'right', sortable: true, render: (r) => <ScoreTag table sp={r.sp}>{r.score}</ScoreTag> },
    { key: 'value', label: 'Value', align: 'right', sortable: true, render: (r) => <span className={s.value}>{r.valueLabel}</span> },
    { key: 'created', label: 'Created', sortable: true, render: (r) => <span className={`${s.soft} ${s.nowrap}`}>{r.createdLabel}</span> },
    { key: 'next', label: 'Next follow-up', sortable: true, render: (r) => <span className={s.nowrap} style={{ color: r.nextColor }}>{r.nextLabel}</span> },
  ];

  return (
    <DataTable itemLabel="leads"
      minWidth={980}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.lead.id}
      onRowClick={(r) => onOpen(r.lead.id)}
      sort={sort}
      onSort={onSort}
      empty="No leads match these filters."
      rowStyle={(r) => (sel.has(r.lead.id) ? { background: 'oklch(0.97 0.02 265)' } : undefined)}
    />
  );
}
