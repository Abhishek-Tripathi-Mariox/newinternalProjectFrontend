import s from './AttendanceDayTable.module.css';

/** 8a–10p bar with working / break segments: `segs [{key,left,width,bg,tip}]`. */
export default function DayBar({ segs }) {
  return (
    <div className={s.bar}>
      {segs.map((g) => (
        <span key={g.key} title={g.tip} className={s.seg} style={{ left: g.left, width: g.width, background: g.bg }} />
      ))}
    </div>
  );
}
