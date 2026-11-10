import { Fragment } from 'react';
import { Pagination, Pill, usePagination } from '@/components/ui';
import PersonCell from '../shared/PersonCell';
import SegmentLegend from '../shared/SegmentLegend';
import { SEG } from '../shared/attendanceUtils';
import { ATT_HOURS } from '../useAttendanceModel';
import DayBar from './DayBar';
import s from './AttendanceDayTable.module.css';

/** Expanded row content: event chips + end-of-shift report. */
function RowDetails({ r }) {
  return (
    <tr>
      <td colSpan={8} className={s.detailCell}>
        <div className={s.events}>
          {r.events.map((e) => (
            <span key={e.key} className={s.event}>
              <span className={s.eventDot} style={{ background: e.dot }} />
              <span className={s.eventTime}>{e.time}</span>
              {e.text}
            </span>
          ))}
        </div>
        {r.rep.length > 0 && (
          <div className={s.report}>
            <div className={s.reportTitle}>End-of-shift report</div>
            {r.rep.map((q) => (
              <div key={q.k + q.v} className={s.reportLine}><span className={s.reportKey}>{q.k}</span><span className={s.reportVal}>{q.v}</span></div>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

/** Day / person attendance table with timeline bars and expandable rows. */
export default function AttendanceDayTable({ firstCol, rows, empty, onToggle }) {
  // Page by person/day; expanding a row doesn't change the row count, so the page is kept.
  const pager = usePagination(rows, { pageSize: 25, resetKey: firstCol });
  return (
    <div className={s.panel}>
      <table className={s.table}>
        <thead>
          <tr>
            <th className={s.first}>{firstCol}</th>
            <th>Status</th>
            <th>Logged in</th>
            <th>Breaks</th>
            <th>Logged out</th>
            <th className={s.right}>Worked</th>
            <th className={s.hoursHead}><div className={s.hours}>{ATT_HOURS.map((h) => <span key={h}>{h}</span>)}</div></th>
            <th className={s.chevHead} />
          </tr>
        </thead>
        <tbody>
          {pager.pageItems.map((r) => (
            <Fragment key={r.key}>
              <tr className={s.row} onClick={() => onToggle(r)}>
                <td className={s.first}><PersonCell name={r.person.name} h={r.person.h} title={r.label} sub={r.sub} /></td>
                <td><Pill bg={r.sBg} fg={r.sFg}>{r.status}</Pill></td>
                <td className={s.inCell} style={{ color: r.inColor }}>
                  {r.inL}{r.late && <> <span className={s.lateTag}>Late</span></>}
                </td>
                <td title={r.brkTimes}>
                  <div className={s.nowrap}>{r.brkL}</div>
                  <div className={s.brkTimes}>{r.brkTimes}</div>
                </td>
                <td className={s.nowrap}>
                  {r.outL}{r.rep.length > 0 && <> <span className={s.repTag}>Report</span></>}
                </td>
                <td className={s.worked} style={{ color: r.workedColor }}>{r.worked}</td>
                <td className={s.barCell}><DayBar segs={r.segs} /></td>
                <td className={s.chev}>{r.open ? '▴' : '▾'}</td>
              </tr>
              {r.open && <RowDetails r={r} />}
            </Fragment>
          ))}
        </tbody>
      </table>
      {empty && <div className={s.empty}>Nobody matches these filters.</div>}
      <Pagination {...pager} label={firstCol === 'Date' ? 'days' : 'people'} />
      <SegmentLegend
        className={s.legend}
        work={SEG.attWork}
        brk={SEG.attBreak}
        hint="Click a row to see every login, break and logout. Late = logged in after 10:30."
      />
    </div>
  );
}
