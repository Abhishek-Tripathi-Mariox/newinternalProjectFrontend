import { useState } from 'react';
import { useStore } from '@/store';
import { useNow } from '@/hooks/useNow';
import { Button, Select, SearchInput } from '@/components/ui';
import { download } from '@/api/client';
import { today, ymd } from '@/lib/date';
import KpiRow from './shared/KpiRow';
import RangeFilter from './shared/RangeFilter';
import sh from './shared/shared.module.css';
import { useAttendanceModel, ATT_TEAMS } from './useAttendanceModel';
import AttendanceDayTable from './components/AttendanceDayTable';
import AttendanceSummaryTable from './components/AttendanceSummaryTable';
import s from './AttendancePage.module.css';

const TEAM_OPTIONS = [{ value: '', label: 'All teams' }].concat(ATT_TEAMS.map((t) => ({ value: t, label: t })));

/** Attendance — day view, per-person history and period summary. */
export default function AttendancePage() {
  const now = useNow();
  const { AF, model: m } = useAttendanceModel(now);
  const setAttF = useStore((st) => st.setAttF);
  const flash = useStore((st) => st.flash);

  const onRange = (patch) => {
    if ('range' in patch) setAttF({ range: patch.range, person: AF.person, exp: '' });
    else setAttF({ ...patch, exp: '' });
  };
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await download('/attendance/export.csv', { range: AF.range, date: AF.date, team: AF.team, q: AF.q, person: AF.person }, m.csvName);
      flash('Attendance exported');
    } catch (e) {
      flash(e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={sh.page}>
      <div className={sh.head}>
        <div className={s.titleWrap}>
          {m.person && <Button variant="secondary" onClick={() => setAttF({ person: '', exp: '' })}>← Everyone</Button>}
          <div>
            <h1 className={sh.title}>Attendance</h1>
            <div className={sh.sub}>{m.title}{m.person ? ` · ${m.person.role}` : ''}</div>
          </div>
        </div>
        <div className={sh.toolbar}>
          <RangeFilter range={AF.range} date={AF.date || ymd(today())} onChange={onRange} />
          <Select compact value={AF.team} options={TEAM_OPTIONS} onChange={(e) => setAttF({ team: e.target.value })} />
          <SearchInput className={s.search} value={AF.q} onChange={(e) => setAttF({ q: e.target.value })} placeholder="Search person" />
          <Button variant="secondary" onClick={exportCsv} disabled={exporting} aria-busy={exporting || undefined}>{exporting ? 'Exporting…' : 'Export CSV'}</Button>
        </div>
      </div>

      <KpiRow items={m.kpis} />

      {m.showDay && (
        <AttendanceDayTable
          firstCol={m.firstCol}
          rows={m.rows}
          empty={m.empty}
          onToggle={(r) => setAttF({ exp: r.open ? '' : r.key })}
        />
      )}
      {m.showSum && (
        <AttendanceSummaryTable rows={m.sum} empty={m.empty} onOpen={(r) => setAttF({ person: r.id, exp: '' })} />
      )}
    </div>
  );
}
