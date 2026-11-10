import { useCallback, useMemo } from 'react';
import { useStore } from '@/store';
import { Button, FilterChips, KanbanBoard, SegmentedControl } from '@/components/ui';
import { useLeadStatusNames } from '@/store/masters';
import { range } from '@/lib/date';
import { money } from '@/lib/format';
import { useLeadInsights } from './useLeadInsights';
import { leadRowModel } from './leadRow';
import { exportLeadsCsv, ownerOf, statusOrder, statusTone, sumValue, val } from './leadUtils';
import LeadsFilters from './components/LeadsFilters';
import LeadFlags from './components/LeadFlags';
import BulkBar from './components/BulkBar';
import LeadsTable from './components/LeadsTable';
import LeadCard from './components/LeadCard';
import s from './LeadsPage.module.css';

const VIEW_OPTIONS = [['kanban', 'Board'], ['table', 'Table']];

/** Leads pipeline: filters, flags, status chips, board / table views, bulk actions, CSV export. */
export default function LeadsPage() {
  const stageNames = useLeadStatusNames();
  const { leads, ins, now } = useLeadInsights();
  const lf = useStore((st) => st.lf);
  const sort = useStore((st) => st.sort);
  const leadView = useStore((st) => st.leadView);
  const selIds = useStore((st) => st.selIds);
  const setLf = useStore((st) => st.setLf);
  const setLeadView = useStore((st) => st.setLeadView);
  const selectLead = useStore((st) => st.selectLead);
  const setLead = useStore((st) => st.setLead);
  const flash = useStore((st) => st.flash);

  // Everything except the status filter (status chips count against this).
  const base = useMemo(() => {
    const rg = range(lf.date, lf.from, lf.to);
    const q = (lf.q || '').trim().toLowerCase();
    return leads.filter((l) =>
      (!rg || (l.created >= rg[0] && l.created < rg[1]))
      && (!lf.owner || l.owner === lf.owner)
      && (!lf.source || l.source === lf.source)
      && (!lf.service || (l.service || '').split(', ').includes(lf.service))
      && (!q || `${l.company} ${l.contact} ${l.email} ${l.id}`.toLowerCase().includes(q))
      && (!lf.flag || (lf.flag === 'hot' ? ins.isHot(l) : lf.flag === 'stale' ? ins.isStale(l) : !!ins.dupOf[l.id])));
  }, [leads, lf, ins]);

  const shown = useMemo(() => {
    const list = lf.status ? base.filter((l) => l.status === lf.status) : base.slice();
    const { k, d } = sort;
    const key = (l) => (k === 'score' ? ins.scoreOf[l.id]
      : k === 'status' ? statusOrder(l.status)
        : k === 'owner' ? ownerOf(l.owner).name
          : k === 'next' ? (ins.nextOf[l.id] ? ins.nextOf[l.id].due : Infinity)
            : typeof l[k] === 'string' ? l[k].toLowerCase() : l[k]);
    return list.sort((a, b) => {
      const x = key(a);
      const y = key(b);
      return (x > y ? 1 : x < y ? -1 : 0) * d;
    });
  }, [base, lf.status, sort, ins]);

  const rows = useMemo(() => shown.map((l) => leadRowModel(l, ins, now)), [shown, ins, now]);

  const columns = useMemo(() => stageNames.map((k) => {
    const items = base.filter((l) => l.status === k);
    return {
      key: k, name: k, dot: statusTone(k).dot, count: items.length, meta: money(sumValue(items)),
      items: items.map((l) => leadRowModel(l, ins, now)),
    };
  }), [stageNames, base, ins, now]);

  const chips = useMemo(() => [
    { key: '', label: 'All', count: base.length, dot: 'oklch(0.7 0.01 265)' },
    ...stageNames.map((k) => ({ key: k, label: k, count: base.filter((l) => l.status === k).length, dot: statusTone(k).dot })),
  ], [stageNames, base]);

  const open = useCallback((id) => selectLead(id), [selectLead]);
  const exportList = (list) => flash(exportLeadsCsv(list, ins.scoreOf, ins.touch));
  const onMove = (id, to) => {
    const ld = leads.find((l) => l.id === id);
    if (ld && ld.status !== to) {
      setLead(id, 'status', to);
      flash(`${ld.company} → ${to}`);
    }
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Leads</h1>
          <div className={s.summary}>{shown.length} leads · {money(sumValue(shown))} total value</div>
        </div>
        <div className={s.actions}>
          <Button onClick={() => exportList(shown)}>Export CSV</Button>
          <SegmentedControl options={VIEW_OPTIONS} value={leadView} onChange={(v) => setLeadView(val(v))} />
        </div>
      </div>

      <LeadsFilters />

      <FilterChips items={chips} value={lf.status} onChange={(v) => setLf({ status: val(v) })} tone="dark" />

      <LeadFlags leads={leads} ins={ins} />

      <BulkBar onExport={() => exportList(leads.filter((l) => selIds.includes(l.id)))} />

      {leadView === 'table' ? (
        <LeadsTable rows={rows} onOpen={open} />
      ) : (
        <KanbanBoard
          columns={columns}
          getId={(r) => r.lead.id}
          renderCard={(r) => <LeadCard row={r} onOpen={open} />}
          onMove={onMove}
          minColWidth={260}
        />
      )}
    </div>
  );
}
