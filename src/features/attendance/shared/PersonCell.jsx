import StatusAvatar from './StatusAvatar';
import s from './shared.module.css';

/** Avatar + two-line name/sub cell used in every people table. */
export default function PersonCell({ name, h, title, sub, dot, size = 28, ini }) {
  return (
    <div className={s.person}>
      <StatusAvatar name={name} h={h} size={size} dot={dot} ini={ini} />
      <div className={s.personText}>
        <div className={s.personName}>{title ?? name}</div>
        {sub ? <div className={s.personSub}>{sub}</div> : null}
      </div>
    </div>
  );
}
