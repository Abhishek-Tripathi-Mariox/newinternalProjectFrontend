import s from './drawer.module.css';

/** Section heading with the summary *under* the title and an action on the right (portal, CRs). */
export default function SectionHead({ title, sub, action }) {
  return (
    <div className={s.sectionHead}>
      <div className={s.minw}>
        <h3 className={s.h3}>{title}</h3>
        {sub && <div className={s.small}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}
