import { KpiCard, KpiGrid } from '@/components/ui';

/** Row of KPI cards — `items: [{label, value, sub, dot?, onClick?}]`. */
export default function KpiRow({ items, min = 150 }) {
  return (
    <KpiGrid min={min}>
      {items.map((k) => (
        <KpiCard key={k.key || k.label} label={k.label} value={k.value} sub={k.sub} dot={k.dot} onClick={k.onClick} />
      ))}
    </KpiGrid>
  );
}
