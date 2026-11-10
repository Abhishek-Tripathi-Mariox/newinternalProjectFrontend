import { useId } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './IconButton';
import { useDialog } from './useDialog';
import { cx } from './cx';
import s from './Modal.module.css';

/**
 * Right-hand side sheet. Closes on backdrop click / Escape, locks scroll.
 * Default sticky header = title + sub + `actions` + ✕. Pass `header` to replace the
 * header's title block entirely (✕ and actions still render on the right);
 * `headerBelow` renders extra rows inside the sticky header (e.g. quick actions, tabs).
 */
export function Drawer({ open = true, onClose, width = 620, title, sub, header, headerBelow, actions, children, className, style, bodyClassName, bodyStyle, label }) {
  const { panelRef, backdropProps } = useDialog(open, onClose);
  const titleId = useId();
  if (!open) return null;
  return createPortal(
    <div className={s.drawerBackdrop} {...backdropProps}>
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title && !header ? titleId : undefined}
        aria-label={header || !title ? label || (typeof title === 'string' ? title : undefined) : undefined}
        tabIndex={-1}
        data-dialog-panel=""
        className={cx(s.drawer, className)}
        style={{ '--w': typeof width === 'number' ? `${width}px` : width, ...style }}
      >
        <div className={s.drawerHead}>
          <div className={s.drawerTop}>
            <div style={{ minWidth: 0, flex: 1 }}>
              {header ?? (
                <>
                  {title && <h2 id={titleId} className={s.drawerTitle}>{title}</h2>}
                  {sub && <div className={s.sub}>{sub}</div>}
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
              {actions}
              {onClose && <IconButton label="Close" onClick={onClose} size="lg" />}
            </div>
          </div>
          {headerBelow}
        </div>
        <div className={cx(s.drawerBody, bodyClassName)} style={bodyStyle}>{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
