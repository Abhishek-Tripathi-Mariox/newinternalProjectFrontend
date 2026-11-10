import s from './LeadTags.module.css';

/** Small inline markers used on lead cards / rows: Hot, No contact Nd, Duplicate?. */
export function HotTag({ children = 'Hot' }) {
  return <span className={`${s.tag} ${s.hot}`}>{children}</span>;
}
export function StaleTag({ children }) {
  return <span className={`${s.tag} ${s.stale}`}>{children}</span>;
}
export function DupTag() {
  return <span className={`${s.tag} ${s.dup}`}>Duplicate?</span>;
}
/** Lead score pill; `sp` = scorePill(score) → {bg, fg}. */
export function ScoreTag({ sp, children, table = false }) {
  return (
    <span className={table ? s.scoreTable : s.tag} style={{ background: sp.bg, color: sp.fg }}>
      {children}
    </span>
  );
}
