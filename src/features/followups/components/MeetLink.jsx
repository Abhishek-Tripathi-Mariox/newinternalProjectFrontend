import s from './FollowUpRow.module.css';

/** Green "Join Meet" pill link (or the plain "Meet ↗" text link when `plain`). */
export default function MeetLink({ href, plain = false, children, className = '' }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`${plain ? s.meetPlain : s.meet} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children || (plain ? 'Meet ↗' : 'Join Meet')}
    </a>
  );
}
