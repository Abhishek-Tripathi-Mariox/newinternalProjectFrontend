import s from './ToggleChip.module.css';

/** Multi-select pill (services, team members). `mark` shows the ✓ slot used by the service chips. */
export default function ToggleChip({ on, onClick, children, mark = false, title, disabled }) {
  return (
    <button type="button" className={`${s.chip} ${on ? s.on : ''} ${mark ? s.withMark : ''}`} onClick={onClick} title={title} aria-pressed={!!on} disabled={disabled}>
      {mark && <span className={s.mark}>{on ? '✓' : ''}</span>}
      {children}
    </button>
  );
}
