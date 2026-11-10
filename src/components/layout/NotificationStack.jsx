import ReminderAlerts from './ReminderAlerts';
import ToastHost from './ToastHost';
import s from './Banners.module.css';

/** Bottom-right stack: reminder alerts above, toast at the bottom (as in the original). */
export default function NotificationStack() {
  return (
    <div className={s.stack}>
      <ReminderAlerts />
      <ToastHost />
    </div>
  );
}
