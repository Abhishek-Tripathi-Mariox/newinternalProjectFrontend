import { useState } from 'react';
import { useStore } from '@/store';
import { useNow } from '@/hooks/useNow';
import { Button, Select, SegmentedControl } from '@/components/ui';
import { download } from '@/api/client';
import { today, ymd } from '@/lib/date';
import RangeFilter from '@/features/attendance/shared/RangeFilter';
import sh from '@/features/attendance/shared/shared.module.css';
import { ATT_TEAMS } from '@/features/attendance/useAttendanceModel';
import { useReportsModel } from './useReportsModel';
import TimelineView from './components/TimelineView';
import TimelinePopover from './components/TimelinePopover';
import HoursLog from './components/HoursLog';
import s from './ReportsPage.module.css';

const TABS = [['timeline', 'Timeline'], ['log', 'Hours log']];
const MODES = [['day', 'Day'], ['week', 'Week']];
const TEAM_OPTIONS = [{ value: '', label: 'All teams' }].concat(ATT_TEAMS.map((t) => ({ value: t, label: t })));

/** Reports — attendance timeline and hours log. */
export default function ReportsPage() {
  const now = useNow();
  const [pop, setPop] = useState(null);
  const { RF, timeline: tl, log, popover } = useReportsModel(now, pop);
  const setRepF = useStore((st) => st.setRepF);
  const flash = useStore((st) => st.flash);
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await download('/reports/hours-log/export.csv', { range: RF.range, date: RF.date, person: RF.person }, log.csvName);
    } catch (e) {
      flash(e.message);
    } finally {
      setExporting(false);
    }
  };

  const openPop = (seg, e) => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    setPop({
      pid: seg.pid, d: seg.d, k: seg.k, a: seg.a, b: seg.b,
      x: Math.max(12, Math.min(e.clientX - 165, W - 342)),
      y: e.clientY + 14 > H - 420 ? Math.max(12, e.clientY - 430) : e.clientY + 14,
    });
  };

  return (
    <div className={sh.page}>
      <div className={s.head}>
        <div className={s.titleRow}>
          <h1 className={sh.title}>Reports</h1>
          <SegmentedControl options={TABS} value={RF.tab} onChange={(v) => setRepF({ tab: v })} />
        </div>

        {tl && (
          <div className={sh.toolbar}>
            <Button variant="secondary" className={s.navBtn} onClick={() => setRepF({ tday: tl.prevDay })}>‹</Button>
            <span className={s.navLabel}>{tl.label}</span>
            <Button
              variant="secondary"
              className={s.navBtn}
              style={{ opacity: tl.canNext ? 1 : 0.4 }}
              onClick={() => { if (tl.canNext) setRepF({ tday: tl.nextDay }); }}
            >
              ›
            </Button>
            <Button variant="secondary" onClick={() => setRepF({ tday: 0 })}>Today</Button>
            <SegmentedControl options={MODES} value={RF.tmode} onChange={(v) => setRepF({ tmode: v })} />
            <Select compact value={RF.tteam} options={TEAM_OPTIONS} onChange={(e) => setRepF({ tteam: e.target.value })} />
          </div>
        )}

        {log && (
          <div className={sh.toolbar}>
            <Select
              compact
              value={RF.person}
              options={[{ value: '', label: 'Everyone' }].concat(log.people)}
              onChange={(e) => setRepF({ person: e.target.value })}
            />
            <RangeFilter range={RF.range} date={RF.date || ymd(today())} onChange={setRepF} />
            <Button variant="secondary" onClick={exportCsv} disabled={exporting} aria-busy={exporting || undefined}>{exporting ? 'Exporting…' : 'Export CSV'}</Button>
          </div>
        )}
      </div>

      {tl && (
        <>
          <TimelineView model={tl} pop={pop} onSegment={openPop} />
          {popover && <TimelinePopover data={popover} x={pop.x} y={pop.y} onClose={() => setPop(null)} />}
        </>
      )}

      {log && <HoursLog model={log} />}
    </div>
  );
}
