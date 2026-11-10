import { useId } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './IconButton';
import { useDialog } from './useDialog';
import { cx } from './cx';
import s from './Modal.module.css';

/**
 * Centered dialog (radius 14) with header + ✕, scrollable body and optional sticky footer.
 * Closes on backdrop click and Escape, locks body scroll, focuses the first field.
 * Put `data-autofocus` on an element to focus it instead.
 * `bodyClassName` / `bodyStyle` customise the body (default: column, gap 14).
 */
export function Modal({ open = true, onClose, title, sub, width = 580, footer, children, className, style, bodyClassName, bodyStyle, headerExtra }) {
  const { panelRef, backdropProps } = useDialog(open, onClose);
  const titleId = useId();
  if (!open) return null;
  return createPortal(
    <div className={s.backdrop} {...backdropProps}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        data-dialog-panel=""
        className={cx(s.panel, className)}
        style={{ '--w': typeof width === 'number' ? `${width}px` : width, ...style }}
      >
        {(title || onClose) && (
          <div className={s.head}>
            <div className={s.titles}>
              {title && <h2 id={titleId} className={s.title}>{title}</h2>}
              {sub && <div className={s.sub}>{sub}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {headerExtra}
              {onClose && <IconButton label="Close" onClick={onClose} />}
            </div>
          </div>
        )}
        <div className={cx(s.body, bodyClassName)} style={bodyStyle}>{children}</div>
        {footer && <div className={s.foot}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
