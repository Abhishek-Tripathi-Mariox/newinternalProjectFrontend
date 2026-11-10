import { cx } from './cx';
import s from './Button.module.css';

/**
 * Standard button.
 * variant: primary | secondary | ghost | danger | dangerOutline | link | dark
 * size: sm | md | lg. Pass `href` to render an anchor styled as a button.
 */
export function Button({ variant = 'secondary', size = 'md', block, icon, className, children, type = 'button', href, ...rest }) {
  const cls = cx(s.btn, s[variant], s[size], block && s.block, className);
  const content = (
    <>
      {icon != null && <span className={s.icon} aria-hidden="true">{icon}</span>}
      {children}
    </>
  );
  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} className={cls} {...rest}>
      {content}
    </button>
  );
}
