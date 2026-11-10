import { cx } from './cx';
import s from './Timeline.module.css';

/** Time · dot · label/sub event list. items: [{time, label, sub?, dot, fg?}] */
export function Timeline({ items = [], className, style }) {
  return (
    <ol className={cx(s.list, className)} style={{ listStyle: 'none', margin: 0, padding: 0, ...style }}>
      {items.map((e, i) => (
        <li key={`${e.time}-${i}`} className={s.row}>
          <span className={s.time}>{e.time}</span>
          <span className={s.dot} style={{ background: e.dot }} aria-hidden="true" />
          <div>
            <div className={s.label} style={e.fg ? { color: e.fg } : undefined}>{e.label}</div>
            {e.sub && <div className={s.sub}>{e.sub}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
