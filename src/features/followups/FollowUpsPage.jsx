import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useNow } from '@/hooks/useNow';
import { SegmentedControl, Tabs } from '@/components/ui';
import { sod } from '@/lib/date';
import { FU_TABS, filterFollowUps, tabTest } from './model';
import FollowUpFilters from './components/FollowUpFilters';
import FollowUpList from './components/FollowUpList';
import FollowUpCalendar from './components/FollowUpCalendar';
import s from './FollowUpsPage.module.css';

const VIEWS = [['list', 'List'], ['cal', 'Calendar']];

export default function FollowUpsPage() {
  const { leads, fus } = useScoped();
  const ff = useStore((st) => st.ff);
  const fuTab = useStore((st) => st.fuTab);
  const setFf = useStore((st) => st.setFf);
  const setFuTab = useStore((st) => st.setFuTab);
  const now = useNow();
  const T = sod(now);

  const [fuView, setFuView] = useState('list');
  const [cal, setCal] = useState({ calMonth: null, calDay: null });

  const leadMap = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads]);
  const filtered = useMemo(() => filterFollowUps(fus, ff, leadMap), [fus, ff, leadMap]);

  const tabs = useMemo(
    () => FU_TABS.map((t) => ({
      key: t.key,
      label: t.label,
      count: filtered.filter((f) => t.test(f, T, now)).length,
      tone: t.key === 'overdue' ? 'red' : undefined,
    })),
    [filtered, T, now],
  );

  const rows = useMemo(() => {
    const test = tabTest(fuTab);
    return filtered
      .filter((f) => test(f, T, now))
      .sort((a, b) => (fuTab === 'completed' ? b.due - a.due : a.due - b.due));
  }, [filtered, fuTab, T, now]);

  const isCal = fuView === 'cal';

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Follow-ups</h1>
          <div className={s.sub}>Meetings, calls, tasks and reminders across all leads</div>
        </div>
        <SegmentedControl options={VIEWS} value={fuView} onChange={setFuView} />
      </div>

      {!isCal && <Tabs tabs={tabs} value={fuTab} onChange={setFuTab} />}

      <FollowUpFilters ff={ff} setFf={setFf} />

      {isCal ? (
        <FollowUpCalendar
          fus={filtered}
          leadMap={leadMap}
          calMonth={cal.calMonth}
          calDay={cal.calDay}
          onNavigate={(patch) => setCal((c) => ({ ...c, ...patch }))}
          T={T}
          now={now}
        />
      ) : (
        <FollowUpList rows={rows} now={now} />
      )}
    </div>
  );
}
