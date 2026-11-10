import s from './FollowUpRow.module.css';

/** Small square "done" checkbox used on every follow-up row. */
export default function DoneCheck({ done, onToggle, title = 'Mark complete', className = '' }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={!!done}
      title={title}
      onClick={onToggle}
      className={`${s.check} ${done ? s.checkOn : ''} ${className}`}
    >
      {done ? '✓' : ''}
    </button>
  );
}
