import { Button } from '@/components/ui';
import s from './AlertsPanel.module.css';

/** "Needs your attention" list. Each alert: {key, dot, title, sub, actLabel, action}. */
export default function AlertsPanel({ alerts, onAct }) {
  if (!alerts.length) return null;
  return (
    <section className={s.panel}>
      <h2 className={s.title}>Needs your attention <span className={s.count}>{alerts.length}</span></h2>
      {alerts.map((a) => (
        <div key={a.key} className={s.row}>
          <span className={s.dot} style={{ background: a.dot }} />
          <div className={s.text}>
            <div className={s.head}>{a.title}</div>
            <div className={s.sub}>{a.sub}</div>
          </div>
          <Button variant="secondary" size="sm" className={s.act} onClick={() => onAct(a.action)}>{a.actLabel}</Button>
        </div>
      ))}
    </section>
  );
}
