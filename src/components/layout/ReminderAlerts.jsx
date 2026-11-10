import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store';
import { useNow } from '@/hooks/useNow';
import { tLabel } from '@/lib/date';
import s from './Banners.module.css';

/** Follow-up reminder cards ("Reminder · in 10 min") raised by store.checkReminders. */
export default function ReminderAlerts() {
  const { alerts, fus, leads } = useStore(useShallow((x) => ({ alerts: x.alerts, fus: x.fus, leads: x.leads })));
  const dismissAlert = useStore((x) => x.dismissAlert);
  const now = useNow(15000);

  const items = useMemo(
    () =>
      (alerts || [])
        .map((id) => (fus || []).find((f) => f.id === id))
        .filter(Boolean)
        .map((f) => {
          const l = (leads || []).find((x) => x.id === f.leadId);
          const mins = Math.round((f.due - now) / 6e4);
          return {
            id: f.id,
            title: f.title,
            when: mins > 0 ? `in ${mins} min` : mins === 0 ? 'now' : 'started',
            sub: `${f.type} · ${l ? l.company : 'Internal'} · ${tLabel(f.due)}`,
            meet: f.meet,
          };
        }),
    [alerts, fus, leads, now],
  );

  return items.map((a) => (
    <div key={a.id} className={s.alert} role="alert">
      <div className={s.alertTop}>
        <div>
          <div className={s.alertKicker}>Reminder · {a.when}</div>
          <div className={s.alertTitle}>{a.title}</div>
          <div className={s.alertSub}>{a.sub}</div>
        </div>
        <button type="button" className={s.dismiss} aria-label={`Dismiss reminder: ${a.title}`} onClick={() => dismissAlert(a.id)}>
          ✕
        </button>
      </div>
      {a.meet && (
        <a href={a.meet} target="_blank" rel="noreferrer" className={s.meet}>Join Google Meet</a>
      )}
    </div>
  ));
}
